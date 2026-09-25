"use strict";

// MSAL-Setup, Token-Beschaffung mit inkrementellem Consent und Microsoft-Graph-Helfer.

const msalInstance = new msal.PublicClientApplication({
  auth: {
    clientId: CC_CONFIG.clientId,
    authority: "https://login.microsoftonline.com/" + CC_CONFIG.tenantId,
    // MSAL 5: Die Antwort von Microsoft landet auf der eigenen Rückkehrseite
    // (redirect.html, „Redirect-Bridge") und wird von dort an diese Seite
    // weitergereicht. In Entra muss genau diese Adresse als SPA-Redirect-URI stehen.
    redirectUri: new URL("redirect.html", window.location.href).href,
    // Nach dem Abmelden zurück auf die App (ohne Bridge – bei logoutRedirect optional).
    postLogoutRedirectUri: window.location.origin + window.location.pathname
  },
  cache: { cacheLocation: "sessionStorage" }
});
// Ab MSAL 3 muss initialize() fertig sein, bevor irgendeine andere MSAL-Funktion
// läuft. Einmal starten, überall abwarten.
const _msalBereit = msalInstance.initialize();

let _account = null;

async function ensureLogin() {
  await _msalBereit;
  const resp = await msalInstance.handleRedirectPromise();
  if (resp && resp.account) {
    _account = resp.account;
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      _account = accounts[0];
    } else {
      msalInstance.loginRedirect({ scopes: CC_SCOPES.base });
      return null;
    }
  }
  msalInstance.setActiveAccount(_account);
  return _account;
}

function logout() {
  msalInstance.logoutRedirect({ account: _account });
}

// Fehler, der ein fehlendes/abgelehntes Recht kennzeichnet – die Module zeigen
// dann einen Hinweis statt einer roten Fehlermeldung.
class BerechtigungFehlt extends Error {
  constructor(scopes, ursache) {
    super("Für diese Ansicht fehlt die Berechtigung: " + scopes.join(", "));
    this.name = "BerechtigungFehlt";
    this.scopes = scopes;
    this.ursache = ursache;
  }
}

// Scopes, für die der Benutzer die Zustimmung bereits abgelehnt hat – nicht in
// derselben Sitzung erneut mit Popups nerven.
const _abgelehnteScopes = new Set();

async function getToken(scopes = CC_SCOPES.base) {
  const key = scopes.join(" ");
  await _msalBereit;
  try {
    const r = await msalInstance.acquireTokenSilent({ scopes, account: _account });
    return r.accessToken;
  } catch (e) {
    if (_abgelehnteScopes.has(key)) throw new BerechtigungFehlt(scopes, e);
    try {
      const r = await msalInstance.acquireTokenPopup({ scopes, account: _account });
      return r.accessToken;
    } catch (e2) {
      _abgelehnteScopes.add(key);
      throw new BerechtigungFehlt(scopes, e2);
    }
  }
}

// path: "/…" (relativ zur Graph-Version) oder vollständige URL.
// opts.scopes: benötigte Delegated-Scopes, opts.version: "v1.0" | "beta".
async function graphFetch(path, opts = {}) {
  const scopes = opts.scopes || CC_SCOPES.base;
  const version = opts.version || "v1.0";
  const token = await getToken(scopes);
  const url = path.startsWith("https://") ? path : "https://graph.microsoft.com/" + version + path;
  const res = await fetch(url, {
    method: opts.method || "GET",
    body: opts.body,
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      ...(opts.headers || {})
    }
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : res.status + " " + res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    if (res.status === 401 || res.status === 403) {
      err.berechtigung = scopes;
    }
    throw err;
  }
  return data;
}

// Holt alle Seiten einer Graph-Collection (mit Obergrenze, damit ein
// Audit-Log-Abruf den Browser nicht sprengt).
async function graphFetchAll(path, opts = {}, maxItems = 1000) {
  let url = path;
  const out = [];
  while (url && out.length < maxItems) {
    const data = await graphFetch(url, opts);
    if (!data) break;
    out.push(...(data.value || []));
    url = data["@odata.nextLink"] || null;
  }
  return out.slice(0, maxItems);
}

// ---------------------------------------------------------------------------
// SharePoint über Graph
// ---------------------------------------------------------------------------

let _siteId = null;
const _listIdCache = {};

async function getSiteId() {
  if (_siteId) return _siteId;
  const site = await graphFetch(`/sites/${CC_CONFIG.siteHostname}:${CC_CONFIG.sitePath}`);
  _siteId = site.id;
  return _siteId;
}

async function spGetListId(listName) {
  if (_listIdCache[listName]) return _listIdCache[listName];
  const siteId = await getSiteId();
  const list = await graphFetch(`/sites/${siteId}/lists/${encodeURIComponent(listName)}?$select=id,name`);
  _listIdCache[listName] = list.id;
  return list.id;
}

async function spListExists(listName) {
  try { await spGetListId(listName); return true; } catch (e) { return false; }
}

async function spGetAll(listName) {
  const siteId = await getSiteId();
  let url = `/sites/${siteId}/lists/${encodeURIComponent(listName)}/items?expand=fields&$top=200`;
  const out = [];
  while (url) {
    const data = await graphFetch(url);
    out.push(...data.value);
    url = data["@odata.nextLink"] || null;
  }
  return out;
}

async function spCreate(listName, fields) {
  const siteId = await getSiteId();
  return graphFetch(`/sites/${siteId}/lists/${encodeURIComponent(listName)}/items`, {
    method: "POST",
    body: JSON.stringify({ fields })
  });
}

async function spUpdate(listName, itemId, fields) {
  const siteId = await getSiteId();
  return graphFetch(`/sites/${siteId}/lists/${encodeURIComponent(listName)}/items/${itemId}/fields`, {
    method: "PATCH",
    body: JSON.stringify(fields)
  });
}

async function spDelete(listName, itemId) {
  const siteId = await getSiteId();
  return graphFetch(`/sites/${siteId}/lists/${encodeURIComponent(listName)}/items/${itemId}`, {
    method: "DELETE"
  });
}

// Legt eine Liste an, falls sie fehlt. columns: [{name, type}] mit
// type = text | note | number | dateTime | boolean.
async function spEnsureList(listName, columns) {
  const siteId = await getSiteId();
  let vorhanden = await spListExists(listName);
  if (!vorhanden) {
    await graphFetch(`/sites/${siteId}/lists`, {
      method: "POST",
      scopes: CC_SCOPES.verwalten,
      body: JSON.stringify({
        displayName: listName,
        list: { template: "genericList" },
        columns: columns.filter(c => c.name !== "Title").map(spColumnDef)
      })
    });
    delete _listIdCache[listName];
    return { angelegt: true, spalten: [] };
  }
  // Liste existiert: fehlende Spalten nachziehen.
  let existing = [];
  try {
    const cols = await graphFetch(`/sites/${siteId}/lists/${encodeURIComponent(listName)}/columns?$select=name&$top=200`);
    existing = cols.value.map(c => c.name);
  } catch (e) { /* ohne Spaltenliste wird das Anlegen einfach versucht */ }
  const neu = [];
  for (const col of columns) {
    if (col.name === "Title" || existing.includes(col.name)) continue;
    try {
      await graphFetch(`/sites/${siteId}/lists/${encodeURIComponent(listName)}/columns`, {
        method: "POST",
        scopes: CC_SCOPES.verwalten,
        body: JSON.stringify(spColumnDef(col))
      });
      neu.push(col.name);
    } catch (e) { /* z. B. fehlendes Recht „Listen verwalten" – im Bericht sichtbar */ }
  }
  return { angelegt: false, spalten: neu };
}

// Legt die Dokumentbibliothek für Nachweise an, falls sie fehlt.
async function spEnsureLibrary(name) {
  const siteId = await getSiteId();
  if (await spListExists(name)) return { angelegt: false };
  await graphFetch(`/sites/${siteId}/lists`, {
    method: "POST",
    scopes: CC_SCOPES.verwalten,
    body: JSON.stringify({ displayName: name, list: { template: "documentLibrary" } })
  });
  delete _listIdCache[name];
  _nachweiseDriveId = null;
  return { angelegt: true };
}

function spColumnDef(col) {
  const def = { name: col.name };
  switch (col.type) {
    case "note":     def.text = { allowMultipleLines: true, textType: "plain" }; break;
    case "number":   def.number = {}; break;
    case "dateTime": def.dateTime = { format: "dateOnly" }; break;
    case "boolean":  def.boolean = {}; break;
    default:         def.text = {};
  }
  return def;
}

// ---------------------------------------------------------------------------
// Nachweise (Dokumentbibliothek, ein Ordner je Bezugs-ID)
// ---------------------------------------------------------------------------

let _nachweiseDriveId = null;

async function getNachweiseDriveId() {
  if (_nachweiseDriveId) return _nachweiseDriveId;
  const siteId = await getSiteId();
  const drives = await graphFetch(`/sites/${siteId}/drives`);
  const drive = (drives.value || []).find(d => d.name === CC_CONFIG.nachweiseLibrary);
  if (!drive) throw new Error(`Dokumentbibliothek "${CC_CONFIG.nachweiseLibrary}" wurde auf der Site nicht gefunden.`);
  _nachweiseDriveId = drive.id;
  return _nachweiseDriveId;
}

async function uploadNachweis(ordner, file) {
  const driveId = await getNachweiseDriveId();
  await graphFetch(`/drives/${driveId}/root/children`, {
    method: "POST",
    body: JSON.stringify({ name: ordner, folder: {}, "@microsoft.graph.conflictBehavior": "fail" })
  }).catch(() => {});
  const token = await getToken();
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${encodeURIComponent(ordner)}/${encodeURIComponent(file.name)}:/content`,
    { method: "PUT", headers: { "Authorization": "Bearer " + token }, body: await file.arrayBuffer() }
  );
  if (!res.ok) throw new Error(`Upload von "${file.name}" fehlgeschlagen (${res.status}).`);
}

async function listNachweise(ordner) {
  try {
    const driveId = await getNachweiseDriveId();
    const res = await graphFetch(
      `/drives/${driveId}/root:/${encodeURIComponent(ordner)}:/children?$select=id,name,size,webUrl,lastModifiedDateTime`);
    return (res.value || []).map(f => ({
      id: f.id, name: f.name, size: f.size, webUrl: f.webUrl,
      geaendert: f.lastModifiedDateTime, driveId
    }));
  } catch (e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Benutzer & Mail
// ---------------------------------------------------------------------------

async function getMe() {
  return graphFetch("/me?$select=displayName,mail,userPrincipalName,jobTitle,department");
}

async function sendMail(to, subject, htmlBody, attachments = []) {
  const message = {
    subject,
    body: { contentType: "HTML", content: htmlBody },
    toRecipients: (Array.isArray(to) ? to : [to]).filter(Boolean).map(a => ({ emailAddress: { address: a } }))
  };
  if (attachments && attachments.length) {
    message.attachments = attachments.map(a => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: a.name,
      contentType: a.contentType || "application/octet-stream",
      contentBytes: a.contentBytes
    }));
  }
  await graphFetch("/me/sendMail", {
    method: "POST",
    body: JSON.stringify({ message, saveToSentItems: true })
  });
}
