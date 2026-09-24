# DIHAG Compliance-Cockpit – Einrichtung und Betrieb

## 1. Überblick

Das Cockpit verbindet zwei Ebenen:

1. **Microsoft 365 / Purview (live über Microsoft Graph)** – Warnungen, Protokolle,
   Bezeichnungen, eDiscovery, Betroffenenanfragen, bedingter Zugriff, Geräte, Secure Score.
2. **Eigene Governance-Schicht (SharePoint-Listen)** – Controls nach ISO 27001, NIS2, TISAX
   und DSGVO, Aufgaben, Risiken, VVT, TOM, Auftragsverarbeiter, Vorfälle.

Der Mehrwert gegenüber dem Purview-Portal liegt in der Verbindung: Zu einem Control lässt sich
ein **Live-Wert aus Microsoft 365 als Nachweis mit Stichtag** übernehmen, aus einer Warnung
direkt eine Maßnahme erzeugen und aus allem ein prüffähiger Bericht ziehen.

## 2. Voraussetzungen

| Punkt | Wert |
|---|---|
| Entra-App-Registrierung | „DIHAG Compliance", Client `a129024b-8b1a-4d54-89f4-8e6049b5f59b` |
| Objekt-ID | `630e639b-d406-402e-bc34-4c9f87ef26bb` |
| Mandant | `fdb70646-023a-403b-a4b9-1f474a935123` |
| Plattform | **Einzelseitige Anwendung (SPA)**, Redirect-URI `https://dfedorov12.github.io/compliance/` |
| SharePoint-Site | `dihag.sharepoint.com/sites/IT` |
| Lizenzen | Betroffenenanfragen setzen Priva voraus, eDiscovery (Premium) eine E5-/Add-on-Lizenz |

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

App öffnen → **Einstellungen → „Listen prüfen / anlegen"**. Angelegt werden:

`Compliance_Controls`, `Compliance_Aufgaben`, `Compliance_Risiken`, `Compliance_VVT`,
`Compliance_TOM`, `Compliance_AVV`, `Compliance_Vorfaelle`, `Compliance_Konfiguration`
sowie die Dokumentbibliothek `Compliance_Nachweise`.

Die Spalten stammen aus `js/schema.js`. Wird das Schema erweitert, legt derselbe Knopf die
fehlenden Spalten nach – vorhandene Daten bleiben erhalten.

### 3.3 Rollen und Kataloge

1. **Einstellungen** ausfüllen: Administratoren, Auditoren, DSB, CISO, Absender, Prüfzyklus,
   Erinnerungsfristen, aktive Normenkataloge → **speichern**.
2. **„Normenkatalog importieren"** – legt die Controls der gewählten Kataloge an
   (vorhandene IDs werden übersprungen, der Import ist also wiederholbar).
3. **„Berechtigungen prüfen"** – zeigt zeilenweise, welche Graph-Bereiche der Mandant
   tatsächlich liefert. Das ist die schnellste Fehlersuche.

> Solange keine Administratoren eingetragen sind, gilt der angemeldete Benutzer als
> Administrator (Erstinstallation). Nach dem ersten Speichern greift die Liste.

## 4. Rollen

| Rolle | Rechte |
|---|---|
| **Administrator** | Einstellungen, Listen und Kataloge, Löschen von Datensätzen |
| **DSB** | erhält Datenschutz-Erinnerungen und Meldeentwürfe |
| **CISO** | erhält Eskalationen und den Wochenbericht |
| **Auditor** | lesender Zugriff, Berichte |
| **alle Beschäftigten** | Aufgaben, Vorfälle melden, eigene Daten pflegen |

Die Rollen steuern die Oberfläche. Der eigentliche Datenschutz erfolgt über die
SharePoint-Berechtigungen der Listen – wer dort keine Rechte hat, sieht die Daten auch nicht.
Empfehlung: Leseberechtigung auf die Listen für den Compliance-Kreis beschränken.

## 5. Tägliche Arbeit

* **Warnung → Maßnahme:** Microsoft 365 → Warnungen → Warnung öffnen → „Aufgabe daraus anlegen".
* **Control prüfen:** Controls → Control öffnen → Live-Nachweis abrufen → „Als Nachweis
  übernehmen" → „Geprüft (heute)" setzt Prüfdatum und nächsten Termin automatisch.
* **Datenpanne:** Datenschutz → Datenpannen → „+ Vorfall" mit Datum **und Uhrzeit** der Kenntnis
  (Startpunkt der 72-Stunden-Frist) → „Meldeentwurf erzeugen" → prüfen → an DSB senden oder
  in das Portal der Aufsichtsbehörde übertragen.
* **Audit:** Berichte → „Managementbericht erzeugen" → drucken/als PDF speichern; zusätzlich
  „Nachweis-Snapshot M365" als CSV zum Stichtag.

## 6. Cron (Erinnerungen, Eskalationen, Wochenbericht)

GitHub Actions ruft täglich `cron/compliance_cron.py` auf (App-only, Client-Credentials).
Benötigt werden die Repository-Secrets `CC_TENANT_ID`, `CC_CLIENT_ID`, `CC_CLIENT_SECRET`
der App-Registrierung **„DIHAG Cron-Job"** (`089bf9ad-2d9a-4cbc-b85d-88b4484af0bb`) mit den
Anwendungsberechtigungen `Sites.ReadWrite.All` (oder `Sites.Selected` + Grant auf `/sites/IT`)
und `Mail.Send`. Details: [cron/README.md](cron/README.md).

Der Lauf erledigt:

1. Aufgaben: Erinnerung vor Fälligkeit, Eskalation an CISO/Administratoren nach Überfälligkeit
2. Controls: fällige Wiederholungsprüfungen gebündelt an die Verantwortlichen
3. Datenschutz: fällige VVT-/AV-Prüfungen und auslaufende Verträge an den DSB
4. Datenpannen: Warnung, wenn die 72-Stunden-Frist unter 48 h fällt, unter 24 h und nach Ablauf
5. montags: Wochenbericht an CISO, DSB und Administratoren

Fristen und Empfänger stammen aus den App-Einstellungen; `erinnerungenAktiv: false` schaltet
alles ab. Ohne gesetzte Secrets endet der Lauf als grüner No-op. Manueller Testlauf über
„Run workflow" mit `dry_run = true` (sendet und schreibt nichts).

## 7. Grenzen

* **DLP-Richtlinien, Kommunikationscompliance, Insider-Risikomanagement und Compliance Manager**
  besitzen keine (vollständige) Graph-Schnittstelle. Konfiguriert wird weiterhin im Purview-Portal
  bzw. per Security-&-Compliance-PowerShell; das Cockpit zeigt die daraus entstehenden Warnungen
  und dokumentiert den Umsetzungsstand im jeweiligen Control.
* Die Suche im Überwachungsprotokoll läuft asynchron und liegt je nach Mandant noch in der
  Beta-Schnittstelle; die App fällt automatisch auf `v1.0` zurück.
* Betroffenenanfragen und eDiscovery Premium benötigen die entsprechende Lizenzierung,
  sonst antwortet Graph mit 403/404 – die App zeigt dann einen Hinweis.
* Ein Browser kann nichts zeitgesteuert tun; alles Terminliche erledigt der Cron-Job.

## 8. Änderungen am Datenmodell

Neue Felder werden ausschließlich in `js/schema.js` ergänzt (Name ASCII, keine Umlaute –
SharePoint kodiert sie in internen Namen). Danach in der App „Listen prüfen / anlegen"
ausführen; Tabelle, Filter, CSV-Export und Bearbeiten-Dialog passen sich automatisch an.

## 9. Demo-Modus

`?demo=1` startet die App ohne Anmeldung mit Beispieldaten (`js/demo.js`) – für Vorführungen,
Schulungen und Layout-Tests. Es werden keine Daten geschrieben und keine Mails versendet.
