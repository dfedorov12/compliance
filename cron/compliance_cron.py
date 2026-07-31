#!/usr/bin/env python3
"""DIHAG Compliance-Cockpit – Cron-Job (App-only, Microsoft Graph).

Laeuft taeglich via GitHub Actions und erledigt, was die SPA im Browser nicht
kann (zeitgesteuerte Erinnerungen und Berichte):

  1. Aufgaben: Erinnerung vor Faelligkeit, Eskalation nach Ueberfaelligkeit
  2. Controls: faellige Wiederholungspruefungen an die Verantwortlichen
  3. Datenschutz: faellige VVT- und AV-Vertragspruefungen an den DSB
  4. Datenpannen: Ueberwachung der 72-Stunden-Meldefrist (Art. 33 DSGVO)
  5. Montags: Wochenbericht an CISO, DSB und Administratoren

Nur Python-Standardbibliothek. Konfiguration ueber Umgebungsvariablen
(siehe cron/README.md); die fachlichen Einstellungen (Empfaenger, Fristen)
kommen aus der SharePoint-Liste Compliance_Konfiguration, gepflegt in der App.

Ohne gesetzte Secrets endet der Lauf als gruener No-op.
"""

import os
import sys
import json
import datetime
import urllib.request
import urllib.parse
import urllib.error

TENANT = os.environ.get("CC_TENANT_ID", "")
CLIENT = os.environ.get("CC_CLIENT_ID", "")
SECRET = os.environ.get("CC_CLIENT_SECRET", "")
HOST = os.environ.get("CC_SITE_HOST", "dihag.sharepoint.com")
SITEPATH = os.environ.get("CC_SITE_PATH", "/sites/IT")
SENDER = os.environ.get("CC_SENDER", "administrator@dihag.com")
APP_URL = os.environ.get("CC_APP_URL", "https://dfedorov12.github.io/compliance/")
DRY_RUN = os.environ.get("CC_DRY_RUN", "").lower() in ("1", "true", "ja")

L_CONTROLS = "Compliance_Controls"
L_AUFGABEN = "Compliance_Aufgaben"
L_RISIKEN = "Compliance_Risiken"
L_VVT = "Compliance_VVT"
L_AVV = "Compliance_AVV"
L_VORFAELLE = "Compliance_Vorfaelle"
L_KONFIG = "Compliance_Konfiguration"

GRAPH = "https://graph.microsoft.com/v1.0"
NOW = datetime.datetime.now(datetime.timezone.utc)
HEUTE = NOW.date()

if not (TENANT and CLIENT and SECRET):
    print("Keine Zugangsdaten gesetzt (CC_TENANT_ID/CC_CLIENT_ID/CC_CLIENT_SECRET) – nichts zu tun.")
    sys.exit(0)


# --------------------------------------------------------------------------
# Graph-Grundfunktionen
# --------------------------------------------------------------------------

def get_token():
    data = urllib.parse.urlencode({
        "client_id": CLIENT,
        "client_secret": SECRET,
        "scope": "https://graph.microsoft.com/.default",
        "grant_type": "client_credentials",
    }).encode()
    url = f"https://login.microsoftonline.com/{TENANT}/oauth2/v2.0/token"
    with urllib.request.urlopen(urllib.request.Request(url, data=data)) as r:
        return json.load(r)["access_token"]


TOKEN = get_token()


def api(method, path, body=None):
    url = path if path.startswith("http") else GRAPH + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", "Bearer " + TOKEN)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read().decode()
            return json.loads(txt) if txt else None
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:400]}")


SITE_ID = api("GET", f"/sites/{HOST}:{SITEPATH}")["id"]


def all_items(list_name):
    out, url = [], f"/sites/{SITE_ID}/lists/{list_name}/items?expand=fields&$top=200"
    while url:
        d = api("GET", url)
        out += d["value"]
        url = d.get("@odata.nextLink")
    return out


def patch_fields(list_name, item_id, fields):
    if DRY_RUN:
        print(f"  [dry-run] PATCH {list_name}/{item_id}: {fields}")
        return
    api("PATCH", f"/sites/{SITE_ID}/lists/{list_name}/items/{item_id}/fields", fields)


def send_mail(to, subject, html):
    empfaenger = [a for a in (to if isinstance(to, list) else [to]) if a]
    if not empfaenger:
        return
    absender_domain = SENDER.split("@")[-1].lower()
    # Sicherheitsnetz: nur an die eigene Domain versenden.
    empfaenger = [a for a in empfaenger if a.split("@")[-1].lower() == absender_domain]
    if not empfaenger:
        return
    if DRY_RUN:
        print(f"  [dry-run] Mail an {', '.join(empfaenger)}: {subject}")
        return
    api("POST", f"/users/{urllib.parse.quote(SENDER)}/sendMail", {
        "message": {
            "subject": subject,
            "body": {"contentType": "HTML", "content": html},
            "toRecipients": [{"emailAddress": {"address": a}} for a in empfaenger],
        },
        "saveToSentItems": True,
    })


# --------------------------------------------------------------------------
# Hilfsfunktionen
# --------------------------------------------------------------------------

def datum(wert):
    """SharePoint-Datum -> date (oder None)."""
    if not wert:
        return None
    try:
        return datetime.datetime.fromisoformat(str(wert).replace("Z", "+00:00")).date()
    except ValueError:
        return None


def tage_bis(wert):
    d = datum(wert)
    return None if d is None else (d - HEUTE).days


def rahmen(inhalt, titel):
    return (f"<div style='font-family:Segoe UI,Arial,sans-serif;color:#424241'>"
            f"<h2 style='color:#1A2644'>{titel}</h2>{inhalt}"
            f"<p style='margin-top:24px'><a href='{APP_URL}' "
            f"style='background:#17509E;color:#fff;padding:9px 18px;border-radius:6px;"
            f"text-decoration:none'>Compliance-Cockpit öffnen</a></p>"
            f"<p style='color:#6d7d8e;font-size:12px'>Automatische Nachricht des DIHAG "
            f"Compliance-Cockpits.</p></div>")


def load_konfig():
    standard = {
        "adminEmails": [], "dsbEmail": "", "cisoEmail": "",
        "erinnerungTageVorher": 14, "eskalationTageNach": 7,
        "erinnerungenAktiv": True, "organisation": "DIHAG Foundry Group",
    }
    try:
        for it in all_items(L_KONFIG):
            f = it.get("fields", {})
            if f.get("Title") == "Allgemein" and f.get("WertJson"):
                standard.update(json.loads(f["WertJson"]))
                break
    except Exception as e:
        print(f"WARN Konfiguration nicht lesbar: {e}", file=sys.stderr)
    return standard


# --------------------------------------------------------------------------
# 1. Aufgaben: Erinnerung und Eskalation
# --------------------------------------------------------------------------

def run_aufgaben(k):
    vorher = int(k.get("erinnerungTageVorher") or 14)
    eskal = int(k.get("eskalationTageNach") or 7)
    eskalationsziel = [k.get("cisoEmail")] + list(k.get("adminEmails") or [])
    erinnert = eskaliert = 0

    for it in all_items(L_AUFGABEN):
        f = it["fields"]
        if f.get("Status") not in ("Offen", "In Arbeit"):
            continue
        rest = tage_bis(f.get("Faellig"))
        if rest is None:
            continue
        marke = str(f.get("Erinnert") or "")
        heute_str = HEUTE.isoformat()
        titel = f.get("Title", "")
        wer = (f.get("Verantwortlich") or "").strip()
        try:
            if rest < -eskal and not marke.startswith("eskaliert"):
                send_mail(eskalationsziel,
                          f"Compliance-Eskalation: „{titel}“ seit {abs(rest)} Tagen überfällig",
                          rahmen(f"<p>Die Aufgabe <b>{titel}</b> (verantwortlich: {wer or 'nicht zugewiesen'}) "
                                 f"ist seit <b>{abs(rest)} Tagen</b> überfällig.</p>"
                                 f"<p>Bezug: {f.get('ControlId') or '–'}</p>",
                                 "Eskalation einer überfälligen Maßnahme"))
                patch_fields(L_AUFGABEN, it["id"], {"Erinnert": "eskaliert " + heute_str})
                eskaliert += 1
            elif -eskal <= rest <= vorher and marke[:10] != heute_str and not marke.startswith("eskaliert"):
                lage = "überfällig seit %d Tagen" % abs(rest) if rest < 0 else \
                       ("heute fällig" if rest == 0 else "fällig in %d Tagen" % rest)
                send_mail(wer, f"Compliance-Aufgabe {lage}: „{titel}“",
                          rahmen(f"<p>Ihre Aufgabe <b>{titel}</b> ist <b>{lage}</b> "
                                 f"(Termin {f.get('Faellig','')[:10]}).</p>"
                                 f"<p>{f.get('Beschreibung') or ''}</p>",
                                 "Erinnerung an eine Compliance-Maßnahme"))
                patch_fields(L_AUFGABEN, it["id"], {"Erinnert": heute_str})
                erinnert += 1
        except Exception as e:
            print(f"WARN Aufgabe {titel}: {e}", file=sys.stderr)

    print(f"Aufgaben: {erinnert} Erinnerungen, {eskaliert} Eskalationen")


# --------------------------------------------------------------------------
# 2. Controls: faellige Wiederholungspruefungen
# --------------------------------------------------------------------------

def run_controls(k):
    vorher = int(k.get("erinnerungTageVorher") or 14)
    offen = {}
    for it in all_items(L_CONTROLS):
        f = it["fields"]
        if f.get("Status") == "Nicht anwendbar":
            continue
        rest = tage_bis(f.get("NaechstePruefung"))
        if rest is None or rest > vorher:
            continue
        ziel = (f.get("Verantwortlich") or k.get("cisoEmail") or "").strip()
        offen.setdefault(ziel, []).append(
            f"<li><b>{f.get('Title')}</b> – {f.get('Bezeichnung','')} "
            f"({'überfällig' if rest < 0 else 'fällig in %d Tagen' % rest})</li>")

    for ziel, zeilen in offen.items():
        if not ziel:
            continue
        send_mail(ziel, f"Compliance: {len(zeilen)} Control-Prüfung(en) fällig",
                  rahmen(f"<p>Für folgende Controls steht die Wiederholungsprüfung an:</p>"
                         f"<ul>{''.join(zeilen)}</ul>"
                         f"<p>Bitte Umsetzung und Nachweis im Cockpit aktualisieren und die Prüfung "
                         f"mit „Geprüft (heute)“ dokumentieren.</p>",
                         "Fällige Control-Prüfungen"))
    print(f"Controls: Prüfhinweise an {len([z for z in offen if z])} Empfänger")


# --------------------------------------------------------------------------
# 3. Datenschutz: VVT- und AV-Vertragspruefungen
# --------------------------------------------------------------------------

def run_datenschutz(k):
    dsb = (k.get("dsbEmail") or "").strip()
    if not dsb:
        print("Datenschutz: kein DSB hinterlegt – übersprungen")
        return
    vorher = int(k.get("erinnerungTageVorher") or 14)
    zeilen = []

    for it in all_items(L_VVT):
        f = it["fields"]
        rest = tage_bis(f.get("NaechstePruefung"))
        if rest is not None and rest <= vorher:
            zeilen.append(f"<li>VVT: <b>{f.get('Title')}</b> – Prüfung "
                          f"{'überfällig' if rest < 0 else 'fällig in %d Tagen' % rest}</li>")

    for it in all_items(L_AVV):
        f = it["fields"]
        rest = tage_bis(f.get("NaechstePruefung"))
        ablauf = tage_bis(f.get("Ablauf"))
        if rest is not None and rest <= vorher:
            zeilen.append(f"<li>AV-Vertrag: <b>{f.get('Title')}</b> – Prüfung "
                          f"{'überfällig' if rest < 0 else 'fällig in %d Tagen' % rest}</li>")
        if ablauf is not None and 0 <= ablauf <= 60:
            zeilen.append(f"<li>AV-Vertrag: <b>{f.get('Title')}</b> – Vertragsende in {ablauf} Tagen</li>")

    if zeilen:
        send_mail(dsb, f"Datenschutz: {len(zeilen)} anstehende Prüfung(en)",
                  rahmen(f"<ul>{''.join(zeilen)}</ul>", "Anstehende Datenschutzprüfungen"))
    print(f"Datenschutz: {len(zeilen)} Hinweise an den DSB")


# --------------------------------------------------------------------------
# 4. Datenpannen: 72-Stunden-Meldefrist
# --------------------------------------------------------------------------

def run_vorfaelle(k):
    ziele = [k.get("dsbEmail"), k.get("cisoEmail")] + list(k.get("adminEmails") or [])
    gemeldet = 0
    for it in all_items(L_VORFAELLE):
        f = it["fields"]
        if f.get("Status") == "Abgeschlossen":
            continue
        if not str(f.get("Art", "")).startswith("Datenpanne"):
            continue
        if f.get("MeldungBehoerde") in ("Erfolgt", "Nicht erforderlich"):
            continue
        entdeckt = datum(f.get("Entdeckt"))
        if not entdeckt:
            continue
        uhr = str(f.get("EntdecktUhr") or "00:00")
        try:
            stunde, minute = (int(x) for x in uhr.split(":")[:2])
        except ValueError:
            stunde, minute = 0, 0
        start = datetime.datetime.combine(entdeckt, datetime.time(stunde, minute),
                                          tzinfo=datetime.timezone.utc)
        frist = start + datetime.timedelta(hours=72)
        rest_h = (frist - NOW).total_seconds() / 3600
        if rest_h > 48:
            continue
        marke = str(f.get("Erinnert") or "")
        stufe = "abgelaufen" if rest_h < 0 else ("kritisch" if rest_h <= 24 else "hinweis")
        if marke == stufe:
            continue
        lage = ("Die Meldefrist ist seit %.0f Stunden ABGELAUFEN." % abs(rest_h)) if rest_h < 0 else \
               ("Es verbleiben noch %.0f Stunden." % rest_h)
        send_mail(ziele, f"DSGVO-Meldefrist: „{f.get('Title')}“ – {lage}",
                  rahmen(f"<p>Für die Datenpanne <b>{f.get('Title')}</b> (entdeckt am "
                         f"{entdeckt.strftime('%d.%m.%Y')} {uhr}) läuft die 72-Stunden-Frist des "
                         f"Art. 33 DSGVO.</p><p><b>{lage}</b> Fristende: "
                         f"{frist.strftime('%d.%m.%Y %H:%M')} UTC.</p>"
                         f"<p>Risiko für Betroffene: {f.get('Risiko','–')} · "
                         f"Meldestatus: {f.get('MeldungBehoerde','–')}</p>",
                         "72-Stunden-Meldefrist läuft"))
        patch_fields(L_VORFAELLE, it["id"], {"Erinnert": stufe})
        gemeldet += 1
    print(f"Vorfälle: {gemeldet} Fristhinweise")


# --------------------------------------------------------------------------
# 5. Wochenbericht (montags)
# --------------------------------------------------------------------------

def run_wochenbericht(k):
    if HEUTE.weekday() != 0:
        return
    ziele = [k.get("cisoEmail"), k.get("dsbEmail")] + list(k.get("adminEmails") or [])
    controls = [i["fields"] for i in all_items(L_CONTROLS)]
    aufgaben = [i["fields"] for i in all_items(L_AUFGABEN)]
    risiken = [i["fields"] for i in all_items(L_RISIKEN)]
    vorfaelle = [i["fields"] for i in all_items(L_VORFAELLE)]

    relevant = [c for c in controls if c.get("Status") != "Nicht anwendbar"]
    punkte = sum(1 if c.get("Status") == "Umgesetzt" else 0.5 if c.get("Status") == "In Umsetzung" else 0
                 for c in relevant)
    grad = round(punkte / len(relevant) * 100) if relevant else 0
    offen = [a for a in aufgaben if a.get("Status") in ("Offen", "In Arbeit")]
    ueberfaellig = [a for a in offen if (tage_bis(a.get("Faellig")) or 0) < 0]
    hoch = [r for r in risiken if float(r.get("Bewertung") or 0) >= 15 and r.get("Status") != "Geschlossen"]
    offene_vorfaelle = [v for v in vorfaelle if v.get("Status") != "Abgeschlossen"]

    html = (f"<table cellpadding='6' style='border-collapse:collapse'>"
            f"<tr><td>Umsetzungsgrad Controls</td><td><b>{grad} %</b> ({len(relevant)} Controls)</td></tr>"
            f"<tr><td>Offene Aufgaben</td><td><b>{len(offen)}</b>, davon {len(ueberfaellig)} überfällig</td></tr>"
            f"<tr><td>Risiken mit hoher Bewertung</td><td><b>{len(hoch)}</b></td></tr>"
            f"<tr><td>Offene Vorfälle</td><td><b>{len(offene_vorfaelle)}</b></td></tr>"
            f"</table>")
    if ueberfaellig:
        html += ("<h3>Überfällige Maßnahmen</h3><ul>" + "".join(
            f"<li>{a.get('Title')} – {a.get('Verantwortlich') or 'nicht zugewiesen'} "
            f"(seit {abs(tage_bis(a.get('Faellig')) or 0)} Tagen)</li>" for a in ueberfaellig[:20]) + "</ul>")

    send_mail(ziele, f"Compliance-Wochenbericht {HEUTE.strftime('%d.%m.%Y')}",
              rahmen(html, f"Compliance-Wochenbericht {k.get('organisation','')}"))
    print("Wochenbericht versendet")


# --------------------------------------------------------------------------

def main():
    k = load_konfig()
    print(f"Compliance-Cron gestartet {NOW.isoformat()} (dry-run={DRY_RUN})")
    if not k.get("erinnerungenAktiv", True):
        print("Erinnerungen sind in den App-Einstellungen deaktiviert – nichts zu tun.")
        return
    for schritt in (run_aufgaben, run_controls, run_datenschutz, run_vorfaelle, run_wochenbericht):
        try:
            schritt(k)
        except Exception as e:
            print(f"WARN {schritt.__name__}: {e}", file=sys.stderr)
    print("Compliance-Cron fertig.")


if __name__ == "__main__":
    main()
