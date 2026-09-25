# DIHAG Compliance-Cockpit – Einrichtung und Betrieb

## 1. Überblick

Das Cockpit ist der **Microsoft-365- und Datenschutz-Teil** des ISMS und an das
Richtlinienmanagementsystem (RMS, rms.dihag.de) angebunden:

| Thema | Führend | Im Cockpit |
|---|---|---|
| Richtlinien, SoA, IMS-Abdeckung, Reifegrad | RMS | SoA-Stand wird gelesen und bei den M365-Nachweisen angezeigt |
| Risikoregister | RMS (Liste „Risiken“ auf /sites/ISMS) | Kennzahlen, Reviews und Maßnahmen im Arbeitsvorrat, Suche |
| Vorfälle und Datenpannen | RMS (Tickets + Bewertung, Fristen DSGVO/NIS2) | Verweis ins RMS |
| Maßnahmen, Audits, Abweichungen | RMS (Register „Wirksamkeit“) | Kennzahlen, Arbeitsvorrat; aus M365-Warnungen wird eine Abweichung angelegt |
| Microsoft 365 / Purview live | Cockpit | Warnungen, Protokolle, Bezeichnungen, eDiscovery, Identität, Geräte, Secure Score |
| M365-Nachweise je Control | Cockpit (Liste `Compliance_M365Nachweise`) | Live-Wert sichern; die SoA im RMS zeigt ihn an |
| VVT, TOM, AVV, Betroffenenanfragen | Cockpit | eigene Register |

So gibt es jeden Datensatz genau einmal. Zwei Risikoregister oder zwei SoAs wären im Audit ein
eigener Befund.

## 2. Voraussetzungen

| Punkt | Wert |
|---|---|
| Entra-App-Registrierung | „DIHAG Compliance", Client `a129024b-8b1a-4d54-89f4-8e6049b5f59b` |
| Objekt-ID | `630e639b-d406-402e-bc34-4c9f87ef26bb` |
| Mandant | `fdb70646-023a-403b-a4b9-1f474a935123` |
| Plattform | **Einzelseitige Anwendung (SPA)**, Redirect-URI `https://compliance.dihag.de/` |
| SharePoint-Site | `dihag.sharepoint.com/sites/IT` |
| RMS | rms.dihag.de; für die Anbindung braucht der angemeldete Benutzer Lesezugriff auf `/sites/ISMS` (Risiken, Wirksamkeit) |
| Lizenzen | Microsoft Priva ist nicht bereitgestellt (daher das eigene Register für Betroffenenanfragen), eDiscovery (Premium) braucht eine E5-/Add-on-Lizenz |

## 3. Einrichtung in drei Schritten

### 3.1 Berechtigungen setzen

```powershell
.\setup-compliance.ps1
```

Das Skript trägt Redirect-URIs und alle delegierten Graph-Berechtigungen ein und erteilt die
Administratorzustimmung für den Mandanten. Mit `-NurLesen` werden nur Leseberechtigungen
angefordert (dann bitte auch `erlaubeSchreibaktionen: false` in `js/config.js` setzen).

Angeforderte Berechtigungen (alle **delegiert**, keine Anwendungsberechtigungen):

| Berechtigung | Wofür |
|---|---|
| `User.Read`, `User.ReadBasic.All`, `User.Read.All` | Anmeldung, Namen, Kontenstatistik |
| `Sites.ReadWrite.All` | Einträge in Governance-Listen und Nachweisbibliothek lesen/schreiben |
| `Sites.Manage.All` | Listen, Spalten und Bibliothek anlegen („Listen prüfen / anlegen“) |
| `Mail.Send` | Meldeentwurf an den DSB senden |
| `SecurityEvents.Read.All` | Secure Score |
| `SecurityAlert.ReadWrite.All` | Warnungen lesen, bearbeiten, schließen |
| `SecurityIncident.Read.All` | Vorfälle aus Defender XDR |
| `AuditLogsQuery.Read.All` | Suche im einheitlichen Überwachungsprotokoll |
| `AuditLog.Read.All` | Entra-Verzeichnisprotokoll |
| `SensitivityLabels.Read.All`, `SensitivityLabel.Read` | Vertraulichkeitsbezeichnungen (neue Schnittstelle `dataSecurityAndGovernance`) |
| `InformationProtectionPolicy.Read` | Vertraulichkeitsbezeichnungen, alte Schnittstelle als Rückfallebene |
| `RecordsManagement.ReadWrite.All` | Aufbewahrungsbezeichnungen lesen und anlegen |
| `eDiscovery.ReadWrite.All` | eDiscovery-Fälle lesen und anlegen |
| `SubjectRightsRequest.ReadWrite.All` | Betroffenenanfragen |
| `Policy.Read.All` | Richtlinien für bedingten Zugriff |
| `RoleManagement.Read.Directory` | Privilegierte Verzeichnisrollen |
| `DeviceManagementConfiguration.Read.All`, `DeviceManagementManagedDevices.Read.All` | Intune |

### 3.2 Listen anlegen

App öffnen → **Einstellungen → „Listen prüfen / anlegen“**. Angelegt werden:

`Compliance_VVT`, `Compliance_TOM`, `Compliance_AVV`, `Compliance_Anfragen`,
`Compliance_M365Nachweise`, `Compliance_Konfiguration` sowie die Dokumentbibliothek `Compliance_Nachweise`.

Kommt mit einem Update eine neue Liste hinzu, zeigt das Dashboard einen Hinweis, bis sie angelegt
ist. Die übrigen Bereiche arbeiten bis dahin normal weiter.

> **Aus früheren Versionen:** Die Listen `Compliance_Controls`, `Compliance_Aufgaben`,
> `Compliance_Risiken` und `Compliance_Vorfaelle` nutzt das Cockpit nicht mehr, weil diese Themen
> im RMS liegen. Falls sie angelegt wurden und leer sind, können sie in SharePoint gelöscht werden;
> enthalten sie Daten, bitte vorher ins RMS übertragen.

> **Datenschutz der Listen:** `Compliance_Anfragen` enthält personenbezogene Daten. Ihre Berechtigung
> sollte auf DSB und Compliance-Kreis beschränkt werden (SharePoint → Listeneinstellungen →
> Berechtigungen, Vererbung unterbrechen).

Die Spalten stammen aus `js/schema.js`. Wird das Schema erweitert, legt derselbe Knopf die
fehlenden Spalten nach; vorhandene Daten bleiben erhalten.

### 3.3 Rollen und RMS-Anbindung

1. **Einstellungen** ausfüllen: Administratoren, Auditoren, DSB, CISO, Absender, Erinnerungsfristen
   → **speichern**.
2. **„Anbindung prüfen“** (Karte „Anbindung an das RMS“): liest SoA, Risiken und das Register
   „Wirksamkeit“ probeweise. Schlägt das fehl, fehlt meist der Lesezugriff auf `/sites/ISMS`.
3. **„Berechtigungen prüfen“**: zeigt zeilenweise, welche Graph-Bereiche der Mandant liefert.

> Solange keine Administratoren eingetragen sind, gilt der angemeldete Benutzer als
> Administrator (Erstinstallation). Nach dem ersten Speichern greift die Liste.

## 4. Rollen

| Rolle | Rechte |
|---|---|
| **Administrator** | Einstellungen, Listen und Kataloge, Löschen von Datensätzen |
| **DSB** | erhält Datenschutz-Erinnerungen und Meldeentwürfe |
| **CISO** | erhält Eskalationen und den Wochenbericht |
| **Auditor** | lesender Zugriff, Berichte |
| **alle Beschäftigten** | Datenschutz-Register lesen und pflegen, soweit SharePoint es erlaubt |

Die Rollen steuern die Oberfläche. Der eigentliche Datenschutz erfolgt über die
SharePoint-Berechtigungen der Listen – wer dort keine Rechte hat, sieht die Daten auch nicht.
Empfehlung: Leseberechtigung auf die Listen für den Compliance-Kreis beschränken.

## 5. Tägliche Arbeit

* **Warnung → Maßnahme:** Microsoft 365 → Warnungen → Warnung öffnen → „Maßnahme im RMS anlegen“.
  Das legt im RMS-Register „Wirksamkeit“ eine Abweichung mit Korrekturmaßnahme an (ISO 27001 10.2);
  weiterbearbeitet wird sie im RMS. Der Warnungsdialog zeigt, ob es dazu schon einen Eintrag gibt.
* **M365-Nachweise:** M365-Nachweise → Control öffnen → Live-Wert prüfen → „Als Nachweis sichern“.
  Vor einem Audit „Alle Signale abrufen und sichern“: jedes Signal wird einmal abgerufen und für alle
  zugehörigen Controls mit Stichtag gesichert. Die SoA im RMS zeigt den jüngsten Nachweis.
* **Betroffenenanfrage:** Datenschutz → Betroffenenanfragen → „+ Betroffenenanfrage“. Vorgangsnummer,
  Eingang und Bearbeiter sind vorbelegt, die Antwortfrist rechnet die App (siehe unten). Im Vorgang:
  Identität prüfen, „In Durchsuchte Systeme übernehmen“ aus dem VVT-Suchumfang, bei Bedarf
  „eDiscovery-Fall anlegen“ und im Purview-Portal Postfach/OneDrive der Person durchsuchen, dann
  „Antwortentwurf“ und „Als beantwortet erfassen“.
* **Datenpanne:** als Ticket erfassen; Bewertung und Meldefristen (DSGVO 72 h, NIS2) im RMS unter „Vorfälle“.
* **Audit:** Berichte → „Datenschutzbericht“ → drucken/als PDF speichern; zusätzlich
  „Nachweis-Snapshot M365“ als CSV. SoA und ISMS-Kennzahlen kommen aus dem RMS.

### Schneller arbeiten

| Funktion | Wo | Nutzen |
|---|---|---|
| **Arbeitsvorrat** | Dashboard | Fristen aus VVT, AV-Verträgen und Betroffenenanfragen sowie aus dem RMS (Risiko-Reviews, Risiko- und Korrekturmaßnahmen) in einer Liste, filterbar nach „nur meine“, Zeitraum und Art. Klick öffnet den Eintrag, RMS-Einträge (↗) im RMS. |
| **Globale Suche** | Kopfzeile, Taste `/` | Durchsucht Datenschutz, M365-Nachweise und die Risiken im RMS, Treffer mit Fundstelle. |
| **Sammelbearbeitung** | jede Tabelle | Einträge ankreuzen, dann Verantwortliche, Status oder Termine für alle gleichzeitig setzen. Leere Felder bleiben unverändert, Frist und Risikowert werden je Eintrag neu berechnet. |
| **Personenauswahl** | Personenfelder | Vorschläge aus dem Verzeichnis statt E-Mail-Adressen abzutippen. |
| **Direktlinks** | „Link kopieren“ im Dialog | Link auf genau diesen Eintrag, z. B. für Teams. Erinnerungsmails verlinken ebenso direkt und funktionieren auch über die Anmeldung hinweg. |
| **Gemerkte Filter** | alle Listen | Suchbegriff, Filter und zuletzt benutzter Unterreiter bleiben je Ansicht im Browser gespeichert. |

### Antwortfrist bei Betroffenenanfragen

Art. 12 Abs. 3 DSGVO: ein Monat ab Eingang, bei Verlängerung insgesamt drei Monate. Die App rechnet
nach der Fristenverordnung (EWG) Nr. 1182/71: Ende am gleichen Kalendertag des Folgemonats, gibt es
ihn nicht, am letzten Tag des Monats; fällt das Ende auf Samstag oder Sonntag, gilt der folgende
Montag. **Feiertage berücksichtigt die App nicht**, im Zweifel früher antworten. Eine Verlängerung
muss der Person innerhalb des ersten Monats mitgeteilt werden; dafür gibt es einen Entwurf.

## 6. Cron (Erinnerungen und Wochenbericht)

GitHub Actions ruft täglich `cron/compliance_cron.py` auf (App-only, Client-Credentials).
Benötigt werden die Repository-Secrets `CC_TENANT_ID`, `CC_CLIENT_ID`, `CC_CLIENT_SECRET`
der App-Registrierung **„DIHAG Cron-Job"** (`089bf9ad-2d9a-4cbc-b85d-88b4484af0bb`) mit den
Anwendungsberechtigungen `Sites.ReadWrite.All` (oder `Sites.Selected` + Grant auf `/sites/IT`)
und `Mail.Send`. Details: [cron/README.md](cron/README.md).

Der Lauf erledigt:

1. Datenschutz: fällige VVT-/AV-Prüfungen und auslaufende Verträge an den DSB
2. Betroffenenanfragen: Hinweis 7 und 2 Tage vor Fristende, Eskalation nach Ablauf
3. montags: Datenschutz-Wochenbericht an DSB, CISO und Administratoren

Jede Mail verlinkt direkt auf den betroffenen Eintrag. Erinnerungen zu Risiken, Maßnahmen und
Vorfällen verschickt der Cron des RMS.

Fristen und Empfänger stammen aus den App-Einstellungen; `erinnerungenAktiv: false` schaltet
alles ab. Ohne gesetzte Secrets endet der Lauf als grüner No-op. Manueller Testlauf über
„Run workflow" mit `dry_run = true` (sendet und schreibt nichts).

## 7. Grenzen

* **DLP-Richtlinien, Kommunikationscompliance, Insider-Risikomanagement und Compliance Manager**
  besitzen keine (vollständige) Graph-Schnittstelle. Konfiguriert wird weiterhin im Purview-Portal
  bzw. per Security-&-Compliance-PowerShell; das Cockpit zeigt die daraus entstehenden Warnungen,
  der Umsetzungsstand steht in der SoA des RMS.
* Die Suche im Überwachungsprotokoll läuft asynchron und liegt je nach Mandant noch in der
  Beta-Schnittstelle; die App fällt automatisch auf `v1.0` zurück.
* Microsoft Priva (Betroffenenanfragen) ist im Mandanten nicht bereitgestellt; die App zeigt das als
  „nicht lizenziert“ und führt die Anfragen im eigenen Register. eDiscovery Premium braucht die
  entsprechende Lizenz.
* Die Anbindung ans RMS liest mit den Rechten des angemeldeten Benutzers. Wer `/sites/ISMS` nicht
  lesen darf, sieht die ISMS-Kacheln nicht; das Cockpit funktioniert sonst normal weiter.
* Ein Browser kann nichts zeitgesteuert tun; alles Terminliche erledigt der Cron-Job.

## 8. Änderungen am Datenmodell

Neue Felder werden ausschließlich in `js/schema.js` ergänzt (Name ASCII, keine Umlaute –
SharePoint kodiert sie in internen Namen). Danach in der App „Listen prüfen / anlegen"
ausführen; Tabelle, Filter, CSV-Export und Bearbeiten-Dialog passen sich automatisch an.

## 9. Demo-Modus

`?demo=1` startet die App ohne Anmeldung mit Beispieldaten (`js/demo.js`) – für Vorführungen,
Schulungen und Layout-Tests. Es werden keine Daten geschrieben und keine Mails versendet.
