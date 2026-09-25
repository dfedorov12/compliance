# DIHAG Compliance-Cockpit

Microsoft-365- und Datenschutz-Teil des DIHAG-ISMS. Führend für Richtlinien, SoA, Risiken,
Vorfälle und Maßnahmen ist das **Richtlinienmanagementsystem** ([rms.dihag.de](https://rms.dihag.de/));
das Cockpit ist daran angebunden und liefert, was dort fehlt: Live-Daten aus Microsoft 365/Purview,
M365-Nachweise je Annex-A-Control und die Datenschutz-Register.

**Live:** https://compliance.dihag.de/
**Demo mit Beispieldaten (ohne Anmeldung):** https://compliance.dihag.de/?demo=1

## Was die App macht

| Bereich | Inhalt |
|---|---|
| **Dashboard** | ISMS-Kennzahlen aus dem RMS (SoA-Umsetzung, hohe Risiken, offene Maßnahmen und Abweichungen), Datenschutz, **Arbeitsvorrat** mit Fristen aus Datenschutz und RMS, Live-Kacheln aus M365 |
| **Microsoft 365** | Sicherheits- und DLP-Warnungen (bearbeiten/schließen, **als Abweichung ins RMS**), Überwachungsprotokoll-Suche, Entra-Verzeichnisprotokoll, Vertraulichkeits- und Aufbewahrungsbezeichnungen, eDiscovery-Fälle, bedingter Zugriff, privilegierte Rollen, Geräte, Secure Score |
| **M365-Nachweise** | Alle 93 Annex-A-Controls mit SoA-Stand aus dem RMS; für 38 davon Live-Wert aus M365, mit Stichtag sicherbar (einzeln oder alle); die SoA im RMS zeigt den jüngsten Nachweis |
| **Datenschutz** | VVT (Art. 30), TOM (Art. 32), Auftragsverarbeiter (Art. 28), **Betroffenenanfragen** (Art. 15–21) mit Fristberechnung, Suchumfang aus dem VVT, eDiscovery-Fall und Antwortentwürfen; Datenpannen laufen über Ticket und RMS-Vorfälle |
| **Berichte** | Datenschutzbericht (druck-/PDF-fähig) und Nachweis-Snapshot aller M365-Signale; SoA und ISMS-Berichte im RMS |
| **Bedienung** | Globale Suche (`/`, inkl. RMS-Risiken), Sammelbearbeitung, Personenauswahl aus dem Verzeichnis, Direktlinks, gemerkte Filter |
| **Cron** | Datenschutz-Prüffristen, Antwortfristen der Betroffenenanfragen, Datenschutz-Wochenbericht |

## Zusammenspiel mit dem RMS

| Richtung | Was |
|---|---|
| RMS → Cockpit (lesen) | SoA (`soa-config.json` auf /sites/IT), Risiken und Register „Wirksamkeit“ (Listen auf /sites/ISMS) |
| Cockpit → RMS (schreiben) | Abweichung mit Korrekturmaßnahme aus einer M365-Warnung, im Format des RMS (`Quelle = Microsoft 365 (Compliance-Cockpit)`) |
| Cockpit → RMS (Links) | `?ansicht=risiken&risiko=ID`, `?ansicht=wirksamkeit&eintrag=ID`, `?ansicht=abdeckung&modus=soa&control=A.x` |
| RMS → Cockpit (Links) | `?ansicht=nachweise&control=A.x` aus der SoA; die SoA zeigt den jüngsten Eintrag aus `Compliance_M365Nachweise` |

## Technik

Statische SPA (kein Server): MSAL 4.30.0 LTS (selbst ausgeliefert aus `vendor/`) → Microsoft Graph → SharePoint-Listen auf `/sites/IT`.
Berechtigungen werden **inkrementell** angefordert – fehlt eine, blendet die App nur den
betroffenen Bereich mit Hinweis aus.

```
index.html            Oberfläche und Navigation
css/styles.css        DIHAG Corporate Design
js/config.js          Client-ID, Site, Scopes, Listennamen
js/graph.js           MSAL, Graph-Aufrufe, SharePoint-Zugriff, Nachweisdateien
js/frameworks.js      Annex A mit Zuordnung zu M365-Signalen
js/schema.js          Datenmodell (erzeugt Spalten, Tabellen und Dialoge)
js/data.js            Cache, CRUD, Provisionierung, Konfiguration, Rollen
js/ui.js              Tabellen, Filter, CSV, Dialoge, generische Listenansicht
js/purview.js         Microsoft-365-Abfragen und Signal-Definitionen
js/rms.js             Anbindung an das RMS (lesen, Abweichung anlegen, Direktlinks)
js/views.js           Dashboard, Microsoft 365, Datenschutz, Berichte
js/nachweise.js       M365-Nachweise je Annex-A-Control
js/arbeit.js          Arbeitsvorrat, globale Suche, Direktlinks, Nachweisbereich
js/anfragen.js        Register für Betroffenenanfragen inkl. Antwortentwürfe
js/demo.js            Demo-Modus (?demo=1) mit Beispieldaten
js/app.js             Start, Navigation, Einstellungen
setup-compliance.ps1  Entra-App: Redirect-URIs, Berechtigungen, Admin-Zustimmung
cron/                 Täglicher Erinnerungslauf (Python, App-only)
```

Details zur Einrichtung: [ANLEITUNG.md](ANLEITUNG.md)

## Sicherheit (Stand 2026-09-25)

- **CSP** in `index.html`: Skripte nur aus der eigenen Quelle (`script-src 'self'`, kein Inline-Code –
  die App nutzt keine Inline-Handler, das soll so bleiben), Daten nur an Graph, Anmeldung und
  SharePoint. Neue Ziele (fetch, iframe) dort eintragen, sonst blockiert der Browser sie.
- **MSAL** aus `vendor/msal-browser/4.30.0` (npm-Paket, Integrität geprüft) statt vom CDN;
  `initialize()` läuft vor jedem anderen MSAL-Aufruf (`_msalBereit` in `js/graph.js`).
- **Escaping:** Tabellen, Kacheln und Badges escapen selbst; `fmtDatum()`/`fmtDatumZeit()` escapen
  auch, was kein Datum ist. Der Cron escapt alle SharePoint-Felder in Mails (`esc()`).
- **Workflows** auf Commits festgelegt; Cron und Syntax-Check laufen nur mit Leserecht.
- **Eigene Domain:** `compliance.dihag.de` (Datei `CNAME`). Unter `dfedorov12.github.io` teilte sich
  die App die Origin mit allen GitHub-Pages-Seiten des Kontos – deren Skripte hätten auf denselben
  Browserspeicher zugreifen können. Redirect-URI in Entra: `https://compliance.dihag.de/`.
