#!/usr/bin/env python3
"""DIHAG Compliance-Cockpit – Cron-Job (App-only, Microsoft Graph).

Laeuft taeglich via GitHub Actions und erledigt, was die SPA im Browser nicht
kann (zeitgesteuerte Erinnerungen und Berichte):

  1. Datenschutz: faellige VVT- und AV-Vertragspruefungen an den DSB
  2. Betroffenenanfragen: Antwortfrist nach Art. 12 Abs. 3 DSGVO
  3. Montags: Datenschutz-Wochenbericht an DSB, CISO und Administratoren

Controls/SoA, Risiken, Vorfaelle und Massnahmen fuehrt das RMS; dessen eigener
Cron (richtlinienmanagementsystem/scripts/erinnerungen.mjs) erinnert dort.

Alle Mails verlinken direkt auf den betroffenen Eintrag in der App.

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
from html import escape as _html_escape

TENANT = os.environ.get("CC_TENANT_ID", "")
CLIENT = os.environ.get("CC_CLIENT_ID", "")
SECRET = os.environ.get("CC_CLIENT_SECRET", "")
HOST = os.environ.get("CC_SITE_HOST", "dihag.sharepoint.com")
SITEPATH = os.environ.get("CC_SITE_PATH", "/sites/IT")
SENDER = os.environ.get("CC_SENDER", "administrator@dihag.com")
APP_URL = os.environ.get("CC_APP_URL", "https://dfedorov12.github.io/compliance/")
DRY_RUN = os.environ.get("CC_DRY_RUN", "").lower() in ("1", "true", "ja")

L_VVT = "Compliance_VVT"
L_AVV = "Compliance_AVV"
L_TOM = "Compliance_TOM"
L_ANFRAGEN = "Compliance_Anfragen"
L_KONFIG = "Compliance_Konfiguration"

GRAPH = "https://graph.microsoft.com/v1.0"

# Uhrzeiten (z. B. Kenntnis einer Datenpanne) werden in der App in deutscher
# Zeit erfasst, nicht in UTC.
try:
    from zoneinfo import ZoneInfo
    ZONE = ZoneInfo("Europe/Berlin")
except Exception:  # ohne Zeitzonendaten notfalls UTC
    ZONE = datetime.timezone.utc
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


def items_oder_leer(list_name):
    """Wie all_items, liefert aber [], wenn die Liste (noch) nicht existiert."""
    try:
        return all_items(list_name)
    except RuntimeError as e:
        if "-> 404" in str(e):
            print(f"Hinweis: Liste {list_name} existiert noch nicht, übersprungen.")
            return []
        raise


def patch_fields(list_name, item_id, fields):
    if DRY_RUN:
        print(f"  [dry-run] PATCH {list_name}/{item_id}: {fields}")
        return
    api("PATCH", f"/sites/{SITE_ID}/lists/{list_name}/items/{item_id}/fields", fields)


def send_mail(to, subject, html):
    # Doppelte Empfänger (z. B. Bearbeiter ist zugleich DSB) nur einmal anschreiben.
    empfaenger = list(dict.fromkeys(a.strip().lower() for a in (to if isinstance(to, list) else [to]) if a and a.strip()))
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


def link_zu(entity, item_id, ansicht):
    """Direktlink auf einen Eintrag (öffnet in der App den passenden Dialog)."""
    return f"{APP_URL}?ansicht={ansicht}&eintrag={entity}:{item_id}"


def esc(wert):
    """Text aus SharePoint für eine HTML-Mail – escapt, auch Anführungszeichen.

    Titel, Namen und Status kommen aus Listen, in die viele schreiben können,
    und bei Betroffenenanfragen von außen. Roh eingesetzt ließe sich damit HTML
    und ein fremder Link in eine Mail vom offiziellen Absender schmuggeln."""
    return _html_escape("" if wert is None else str(wert), quote=True)


def verlinkt(text, link):
    return f"<a href='{esc(link)}' style='color:#17509E'>{esc(text)}</a>"


def rahmen(inhalt, titel, link=None):
    knopf = "Eintrag im Compliance-Cockpit öffnen" if link else "Compliance-Cockpit öffnen"
    return (f"<div style='font-family:Segoe UI,Arial,sans-serif;color:#424241'>"
            f"<h2 style='color:#1A2644'>{esc(titel)}</h2>{inhalt}"
            f"<p style='margin-top:24px'><a href='{esc(link or APP_URL)}' "
            f"style='background:#17509E;color:#fff;padding:9px 18px;border-radius:6px;"
            f"text-decoration:none'>{knopf}</a></p>"
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
# 1. Datenschutz: VVT- und AV-Vertragspruefungen
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
            zeilen.append(f"<li>VVT: <b>{verlinkt(f.get('Title'), link_zu('vvt', it['id'], 'datenschutz'))}</b> – Prüfung "
                          f"{'überfällig' if rest < 0 else 'fällig in %d Tagen' % rest}</li>")

    for it in all_items(L_AVV):
        f = it["fields"]
        rest = tage_bis(f.get("NaechstePruefung"))
        ablauf = tage_bis(f.get("Ablauf"))
        if rest is not None and rest <= vorher:
            zeilen.append(f"<li>AV-Vertrag: <b>{verlinkt(f.get('Title'), link_zu('avv', it['id'], 'datenschutz'))}</b> – Prüfung "
                          f"{'überfällig' if rest < 0 else 'fällig in %d Tagen' % rest}</li>")
        if ablauf is not None and 0 <= ablauf <= 60:
            zeilen.append(f"<li>AV-Vertrag: <b>{verlinkt(f.get('Title'), link_zu('avv', it['id'], 'datenschutz'))}</b> – Vertragsende in {ablauf} Tagen</li>")

    if zeilen:
        send_mail(dsb, f"Datenschutz: {len(zeilen)} anstehende Prüfung(en)",
                  rahmen(f"<ul>{''.join(zeilen)}</ul>", "Anstehende Datenschutzprüfungen"))
    print(f"Datenschutz: {len(zeilen)} Hinweise an den DSB")


# --------------------------------------------------------------------------
# 2. Betroffenenanfragen: Antwortfrist nach Art. 12 Abs. 3 DSGVO
# --------------------------------------------------------------------------

def run_anfragen(k):
    dsb = (k.get("dsbEmail") or "").strip()
    eskalation = [dsb, k.get("cisoEmail")] + list(k.get("adminEmails") or [])
    gemeldet = 0
    for it in items_oder_leer(L_ANFRAGEN):
        f = it["fields"]
        if f.get("Status") in ("Beantwortet", "Abgeschlossen"):
            continue
        rest = tage_bis(f.get("Frist"))
        if rest is None or rest > 7:
            continue
        # Stufen: 7 Tage vorher, 2 Tage vorher, überfällig – je Stufe genau eine Mail.
        stufe = "ueberfaellig" if rest < 0 else ("2 Tage" if rest <= 2 else "7 Tage")
        if str(f.get("Erinnert") or "") == stufe:
            continue
        titel = f.get("Title", "")
        art = f.get("Art", "")
        lage = (f"seit {abs(rest)} Tagen überfällig" if rest < 0
                else "heute fällig" if rest == 0 else f"fällig in {rest} Tagen")
        hinweise = []
        if f.get("Identitaet") != "Geprüft":
            hinweise.append("Die Identität der Person ist noch nicht geprüft.")
        if f.get("Verlaengert") != "Ja" and rest >= 0:
            hinweise.append("Ist die Frist nicht zu halten, kann sie um zwei Monate verlängert werden. "
                            "Das muss der Person aber innerhalb des ersten Monats mitgeteilt werden.")
        empfaenger = eskalation if rest < 0 else [f.get("Verantwortlich"), dsb]
        try:
            send_mail(empfaenger, f"Betroffenenanfrage {titel} ({art}) {lage}",
                      rahmen(f"<p>Die Betroffenenanfrage <b>{esc(titel)}</b> ({esc(art)}) von "
                             f"<b>{esc(f.get('PersonName', ''))}</b> ist <b>{lage}</b>. "
                             f"Eingang {esc(str(f.get('Eingang', ''))[:10])}, Frist {esc(str(f.get('Frist', ''))[:10])}.</p>"
                             + "".join(f"<p>{h}</p>" for h in hinweise) +
                             f"<p>Status: {esc(f.get('Status', '–'))}</p>",
                             "Antwortfrist einer Betroffenenanfrage",
                             link_zu("anfragen", it["id"], "datenschutz")))
            patch_fields(L_ANFRAGEN, it["id"], {"Erinnert": stufe})
            gemeldet += 1
        except Exception as e:
            print(f"WARN Anfrage {titel}: {e}", file=sys.stderr)
    print(f"Betroffenenanfragen: {gemeldet} Fristhinweise")


# --------------------------------------------------------------------------
# 3. Datenschutz-Wochenbericht (montags)
# --------------------------------------------------------------------------

def run_wochenbericht(k):
    if HEUTE.weekday() != 0:
        return
    ziele = [k.get("dsbEmail"), k.get("cisoEmail")] + list(k.get("adminEmails") or [])
    vvt = [i["fields"] for i in items_oder_leer(L_VVT)]
    avv = [i["fields"] for i in items_oder_leer(L_AVV)]
    tom = [i["fields"] for i in items_oder_leer(L_TOM)]
    anfragen = items_oder_leer(L_ANFRAGEN)

    offene_anfragen = [i for i in anfragen if i["fields"].get("Status") not in ("Beantwortet", "Abgeschlossen")]
    knappe = [i for i in offene_anfragen
              if tage_bis(i["fields"].get("Frist")) is not None and tage_bis(i["fields"].get("Frist")) <= 7]
    vvt_faellig = [v for v in vvt if tage_bis(v.get("NaechstePruefung")) is not None and tage_bis(v.get("NaechstePruefung")) <= 30]
    avv_faellig = [a for a in avv if a.get("Status") != "Gekündigt"
                   and tage_bis(a.get("NaechstePruefung")) is not None and tage_bis(a.get("NaechstePruefung")) <= 30]

    html = (f"<table cellpadding='6' style='border-collapse:collapse'>"
            f"<tr><td>Offene Betroffenenanfragen</td><td><b>{len(offene_anfragen)}</b>, "
            f"davon {len(knappe)} mit Frist in 7 Tagen oder überfällig</td></tr>"
            f"<tr><td>Verarbeitungstätigkeiten</td><td><b>{len(vvt)}</b>, {len(vvt_faellig)} Prüfung(en) in 30 Tagen fällig</td></tr>"
            f"<tr><td>Auftragsverarbeiter</td><td><b>{len([a for a in avv if a.get('Status') == 'Aktiv'])}</b> aktiv, "
            f"{len(avv_faellig)} Prüfung(en) in 30 Tagen fällig</td></tr>"
            f"<tr><td>TOM umgesetzt</td><td><b>{len([x for x in tom if x.get('Status') == 'Umgesetzt'])}</b> von {len(tom)}</td></tr>"
            f"</table>")
    if knappe:
        html += ("<h3>Anfragen mit knapper Frist</h3><ul>" + "".join(
            f"<li>{verlinkt(i['fields'].get('Title'), link_zu('anfragen', i['id'], 'datenschutz'))} "
            f"({esc(i['fields'].get('Art', ''))}), Frist {esc(str(i['fields'].get('Frist', ''))[:10])}</li>" for i in knappe[:20]) + "</ul>")
    html += "<p style='color:#6d7d8e'>ISMS-Kennzahlen (SoA, Risiken, Maßnahmen) meldet das RMS.</p>"

    send_mail(ziele, f"Datenschutz-Wochenbericht {HEUTE.strftime('%d.%m.%Y')}",
              rahmen(html, f"Datenschutz-Wochenbericht {k.get('organisation','')}"))
    print("Wochenbericht versendet")


# --------------------------------------------------------------------------

def main():
    k = load_konfig()
    print(f"Compliance-Cron gestartet {NOW.isoformat()} (dry-run={DRY_RUN})")
    if not k.get("erinnerungenAktiv", True):
        print("Erinnerungen sind in den App-Einstellungen deaktiviert – nichts zu tun.")
        return
    for schritt in (run_datenschutz, run_anfragen, run_wochenbericht):
        try:
            schritt(k)
        except Exception as e:
            print(f"WARN {schritt.__name__}: {e}", file=sys.stderr)
    print("Compliance-Cron fertig.")


if __name__ == "__main__":
    main()
