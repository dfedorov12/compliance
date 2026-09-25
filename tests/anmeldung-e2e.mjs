/**
 * Anmelde-Ende-zu-Ende-Test mit simulierter Microsoft-Anmeldung (MSAL 5 + Redirect-Bridge).
 *
 * Fängt Authorize-, Token- und Graph-Endpunkte in Chromium ab und antwortet wie Entra.
 * Spielt alle Wege durch, die MSAL 5 über redirect.html führt – ohne echtes Konto:
 *   1. Anmeldung per Weiterleitung        2. unsichtbares iframe (prompt=none)
 *   3. stille Ablehnung durch Microsoft   4. Popup für ein neues Recht (getToken)
 *   5. Clickjacking: das Cockpit in einem fremden Rahmen bleibt unsichtbar
 * Dazu: kein CSP-Verstoß. Vor jedem MSAL-Update laufen lassen.
 *
 *   npm i -D playwright && npx playwright install chromium   (einmalig, lokal)
 *   node tests/anmeldung-e2e.mjs
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = (port, liefere) => new Promise(ok => { const s = http.createServer(liefere).listen(port, '127.0.0.1', () => ok(s)); });
const app = await server(8766, (req, res) => {
  const datei = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!datei.startsWith(ROOT) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' }); res.end(fs.readFileSync(datei));
});
const fremdServer = await server(8767, (req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!DOCTYPE html><title>Fremde Seite</title><h1>Gewinnspiel</h1><iframe src="http://127.0.0.1:8766/index.html?demo=1" width="900" height="600"></iframe>'); });
const { chromium } = await import(process.env.PLAYWRIGHT_MODUL || 'playwright');
const APP = 'http://127.0.0.1:8766/';
const TID = 'fdb70646-023a-403b-a4b9-1f474a935123', CID = 'a129024b-8b1a-4d54-89f4-8e6049b5f59b';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const clientInfo = b64({ uid: 'u1', utid: TID });
const nonces = {};           // code → nonce
const spur = [];             // was bei „Microsoft" ankam
let silentAblehnen = false;  // prompt=none → interaction_required (erzwingt das Popup)
let rtAblehnen = false;      // Refresh-Token ablehnen (erzwingt iframe/Popup)
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };

const b = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
const ctx = await b.newContext();
const verstoss = [], fehler = [];
ctx.on('page', p => {
  p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) verstoss.push(p.url().slice(0, 40) + ': ' + t.slice(0, 150)); else if (m.type() === 'error') fehler.push(t.slice(0, 150)); });
  p.on('pageerror', e => fehler.push('pageerror: ' + e.message.slice(0, 150)));
});
await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await ctx.route('https://graph.microsoft.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ value: [], id: 'site', displayName: 'Test' }) }));
await ctx.route('https://login.microsoftonline.com/**', async r => {
  const req = r.request(); const u = new URL(req.url());
  if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
  if (u.pathname.includes('/discovery/instance')) return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ tenant_discovery_endpoint: `https://login.microsoftonline.com/${TID}/v2.0/.well-known/openid-configuration`, 'api-version': '1.1', metadata: [{ preferred_network: 'login.microsoftonline.com', preferred_cache: 'login.windows.net', aliases: ['login.microsoftonline.com', 'login.windows.net'] }] }) });
  if (u.pathname.includes('openid-configuration')) return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ token_endpoint: `https://login.microsoftonline.com/${TID}/oauth2/v2.0/token`, authorization_endpoint: `https://login.microsoftonline.com/${TID}/oauth2/v2.0/authorize`, end_session_endpoint: `https://login.microsoftonline.com/${TID}/oauth2/v2.0/logout`, issuer: `https://login.microsoftonline.com/${TID}/v2.0`, jwks_uri: 'x' }) });
  if (u.pathname.endsWith('/authorize')) {
    const q = u.searchParams, prompt = q.get('prompt') || '';
    const weg = q.get('response_mode') === 'query' ? '?' : '#';
    const ziel = q.get('redirect_uri');
    spur.push(`authorize prompt=${prompt || '-'} redirect_uri=${ziel.replace(APP, '/')} mode=${q.get('response_mode')}`);
    if (prompt === 'none' && silentAblehnen) {
      return r.fulfill({ status: 302, headers: { Location: `${ziel}${weg}error=interaction_required&error_description=test&state=${encodeURIComponent(q.get('state'))}` } });
    }
    const code = 'code' + Math.random().toString(36).slice(2);
    nonces[code] = q.get('nonce');
    return r.fulfill({ status: 302, headers: { Location: `${ziel}${weg}code=${code}&client_info=${clientInfo}&state=${encodeURIComponent(q.get('state'))}&session_state=s` } });
  }
  if (u.pathname.endsWith('/token')) {
    const f = new URLSearchParams(req.postData() || '');
    spur.push(`token grant=${f.get('grant_type')} scope=${(f.get('scope') || '').split(' ').filter(s => !/openid|profile|offline/.test(s)).join(',')}`);
    if (f.get('grant_type') === 'refresh_token' && rtAblehnen) return r.fulfill({ status: 400, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: 'invalid_grant', error_description: 'AADSTS50076 test', suberror: 'consent_required' }) });
    const jetzt = Math.floor(Date.now() / 1000);
    const idt = b64({ alg: 'none', typ: 'JWT' }) + '.' + b64({ aud: CID, iss: `https://login.microsoftonline.com/${TID}/v2.0`, tid: TID, oid: 'u1', sub: 'u1', nonce: nonces[f.get('code')] || undefined, preferred_username: 'test@dihag.com', name: 'Test Nutzer', iat: jetzt, nbf: jetzt, exp: jetzt + 3600 }) + '.x';
    return r.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ token_type: 'Bearer', scope: f.get('scope'), expires_in: 3600, ext_expires_in: 3600, access_token: 'at-' + Math.random().toString(36).slice(2), refresh_token: 'rt', id_token: idt, client_info: clientInfo }) });
  }
  return r.fulfill({ status: 404, body: '' });
});

// 1) Anmeldung per Weiterleitung über redirect.html
const p = await ctx.newPage();
await p.goto(APP + 'index.html');
await p.waitForFunction(() => document.getElementById('userName') && document.getElementById('userName').textContent.trim(), null, { timeout: 15000 }).catch(() => {});
console.log('1) Weiterleitung → angemeldet als:', JSON.stringify(await p.evaluate(() => (document.getElementById('userName') || {}).textContent)), '| sichtbar:', await p.evaluate(() => getComputedStyle(document.body).display !== 'none'), '| URL:', p.url().replace(APP, '/'));

await p.waitForTimeout(6000);   // Hintergrund-Anfragen des Dashboards abklingen lassen
const fenster = () => ctx.pages().length;

// 2) Unsichtbares iframe (prompt=none) über redirect.html
spur.length = 0; let vorher = fenster();
const t2 = await p.evaluate(() => msalInstance.ssoSilent({ scopes: ['Policy.Read.All'], loginHint: 'test@dihag.com' }).then(r => 'ok:' + r.account.username, e => 'fehler:' + e.errorCode));
console.log('2) iframe still:', t2, '| neue Fenster:', fenster() - vorher, '|', spur.join(' → '));

// 3) Microsoft lehnt still ab → saubere Meldung statt Hängen
silentAblehnen = true; spur.length = 0;
const t3 = await p.evaluate(() => msalInstance.ssoSilent({ scopes: ['Policy.Read.All'], loginHint: 'test@dihag.com' }).then(r => 'ok', e => 'fehler:' + e.errorCode));
console.log('3) iframe abgelehnt:', t3, '|', spur.join(' → '));

// 4) Neues Recht, Refresh-Token abgelehnt → getToken() der App fällt aufs Popup zurück
rtAblehnen = true; spur.length = 0;
const popupDa = ctx.waitForEvent('page', { timeout: 20000 }).catch(() => null);
const t4p = p.evaluate(() => getToken(['RoleManagement.Read.Directory']).then(t => 'ok:' + t.slice(0, 3), e => 'fehler:' + e.message));
const popup = await popupDa;
const t4 = await t4p;
await p.waitForTimeout(500);
console.log('4) Popup über getToken():', t4, '| Popup geöffnet:', !!popup, '| danach geschlossen:', popup ? popup.isClosed() : '-', '|', spur.join(' → '));
rtAblehnen = false; silentAblehnen = false;

// 5) Clickjacking: das Cockpit in einem fremden Rahmen
const fremd = await ctx.newPage();
await fremd.goto('http://localhost:8767/');
await fremd.waitForTimeout(1500);
const fr = fremd.frames().find(f => f.url().startsWith(APP));
const sichtbar = fr ? await fr.evaluate(() => getComputedStyle(document.body).display !== 'none').catch(() => 'n/a') : 'kein Rahmen';
console.log('5) Im fremden Rahmen sichtbar:', sichtbar, '| Top-Seite jetzt:', fremd.url());
// Die Rückkehrseite dagegen darf im Rahmen stecken (unsichtbares iframe der Anmeldung):
console.log('   redirect.html ohne Anmeldeantwort:', await (await ctx.newPage()).goto(APP + 'redirect.html').then(async r => r.status()));

console.log('CSP-Verstöße:', verstoss.length ? verstoss : 'keine');
console.log('Fehler:', fehler.filter(f => !/Failed to load resource/.test(f)).slice(0, 6));
await b.close();
app.close(); fremdServer.close();
