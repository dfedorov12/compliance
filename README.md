# DIHAG Compliance-Cockpit

Compliance-Administration für Microsoft 365 – das, was Microsoft Purview kann, plus die
Governance-Schicht darüber (ISO 27001, NIS2, TISAX, DSGVO), die Purview nicht abbildet.

**Live:** https://dfedorov12.github.io/compliance/
**Demo mit Beispieldaten (ohne Anmeldung):** https://dfedorov12.github.io/compliance/?demo=1

## Was die App macht

| Bereich | Inhalt |
|---|---|
| **Dashboard** | Umsetzungsgrad, offene/überfällige Aufgaben, hohe Risiken, offene Vorfälle, Live-Kacheln aus M365, Fristen der nächsten 30 Tage |
| **Microsoft 365** | Sicherheits- und DLP-Warnungen (bearbeiten/schließen), Überwachungsprotokoll-Suche, Entra-Verzeichnisprotokoll, Vertraulichkeits- und Aufbewahrungsbezeichnungen (anlegen), eDiscovery-Fälle (anlegen), Betroffenenanfragen, bedingter Zugriff, privilegierte Rollen, Geräte, Secure Score |
| **Controls** | Kataloge ISO/IEC 27001:2022 (93), NIS2 (13), TISAX (23), DSGVO (13) mit Status, Reifegrad 0–5, Verantwortlichen, Prüfterminen, Nachweisdateien und **Live-Nachweis aus M365** |
| **Aufgaben** | Maßnahmen mit Verantwortlichem, Frist, Priorität; direkt aus Warnungen, Controls oder Vorfällen erzeugbar |
| **Risiken** | Risikoregister mit 5×5-Matrix, Strategie, Restrisiko, Control-Bezug |
| **Datenschutz** | VVT (Art. 30), TOM (Art. 32), Auftragsverarbeiter (Art. 28), Vorfall-/Datenpannenregister mit 72-Stunden-Fristüberwachung und Meldeentwurf nach Art. 33 |
| **Berichte** | Managementbericht (druck-/PDF-fähig) und Nachweis-Snapshot aller M365-Signale zum Stichtag, jeweils exportierbar |
| **Cron** | Tägliche Erinnerungen, Eskalationen, Fristüberwachung und Wochenbericht über GitHub Actions |

## Technik

Statische SPA (kein Server): MSAL 2.38.1 → Microsoft Graph → SharePoint-Listen auf `/sites/IT`.
Berechtigungen werden **inkrementell** angefordert – fehlt eine, blendet die App nur den
betroffenen Bereich mit Hinweis aus.

```
index.html            Oberfläche und Navigation
css/styles.css        DIHAG Corporate Design
js/config.js          Client-ID, Site, Scopes, Listennamen
js/graph.js           MSAL, Graph-Aufrufe, SharePoint-Zugriff, Nachweisdateien
js/frameworks.js      Normenkataloge inkl. Zuordnung zu M365-Signalen
js/schema.js          Datenmodell (erzeugt Spalten, Tabellen und Dialoge)
js/data.js            Cache, CRUD, Provisionierung, Konfiguration, Rollen
js/ui.js              Tabellen, Filter, CSV, Dialoge, generische Listenansicht
js/purview.js         Microsoft-365-Abfragen und Signal-Definitionen
js/views.js           Alle Ansichten
js/demo.js            Demo-Modus (?demo=1) mit Beispieldaten
js/app.js             Start, Navigation, Einstellungen
setup-compliance.ps1  Entra-App: Redirect-URIs, Berechtigungen, Admin-Zustimmung
cron/                 Täglicher Erinnerungslauf (Python, App-only)
```

Details zur Einrichtung: [ANLEITUNG.md](ANLEITUNG.md)
