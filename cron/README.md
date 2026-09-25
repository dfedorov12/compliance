# Compliance-Cron

Täglicher Lauf über GitHub Actions (`.github/workflows/compliance-cron.yml`), der erledigt,
was eine statische SPA nicht kann: zeitgesteuerte Erinnerungen, Eskalationen, Fristüberwachung
und der Wochenbericht.

## Aufgaben des Laufs

| Schritt | Inhalt | Empfänger |
|---|---|---|
| 1 | VVT- und AV-Prüfungen sowie Verträge mit Ende in ≤ 60 Tagen | DSB |
| 2 | Betroffenenanfragen: 7 und 2 Tage vor Fristende, nach Ablauf Eskalation | Bearbeiter + DSB / DSB, CISO, Administratoren |
| 3 | montags: Datenschutz-Wochenbericht mit Anfragen, fälligen Prüfungen und TOM | DSB, CISO, Administratoren |

Risiken, Maßnahmen und Vorfälle erinnert der Cron des RMS (`richtlinienmanagementsystem/scripts/erinnerungen.mjs`).

Alle Mails verlinken direkt auf den Eintrag (`?ansicht=…&eintrag=bereich:id`). Fehlt eine Liste
noch (z. B. `Compliance_Anfragen` direkt nach einem Update), wird der Schritt übersprungen.

Die fachlichen Einstellungen (Empfänger, Fristen, `erinnerungenAktiv`) stehen in der
SharePoint-Liste `Compliance_Konfiguration` und werden in der App gepflegt – nicht hier.

## Benötigte Secrets (Repository → Settings → Secrets and variables → Actions)

| Secret | Inhalt |
|---|---|
| `CC_TENANT_ID` | `fdb70646-023a-403b-a4b9-1f474a935123` |
| `CC_CLIENT_ID` | App-Registrierung „DIHAG Cron-Job" (`089bf9ad-2d9a-4cbc-b85d-88b4484af0bb`) |
| `CC_CLIENT_SECRET` | Geheimnis dieser App – **niemals im Repository ablegen** |

Anwendungsberechtigungen (Admin-Zustimmung erforderlich):

* `Sites.ReadWrite.All` – oder besser `Sites.Selected` mit `write`-Grant auf `/sites/IT`
* `Mail.Send` – empfohlen über eine Application Access Policy in Exchange Online auf das
  Postfach `administrator@dihag.com` beschränken

## Umgebungsvariablen (im Workflow gesetzt)

| Variable | Standard |
|---|---|
| `CC_SITE_HOST` | `dihag.sharepoint.com` |
| `CC_SITE_PATH` | `/sites/IT` |
| `CC_SENDER` | `administrator@dihag.com` |
| `CC_APP_URL` | `https://compliance.dihag.de/` |
| `CC_DRY_RUN` | `true` bei manuellem Start mit Testlauf |

## Testlauf

GitHub → Actions → **Compliance Cron** → *Run workflow* → `dry_run = true`.
Es wird nichts versendet und nichts geschrieben; das Protokoll zeigt, was passiert wäre.

Lokal:

```bash
CC_TENANT_ID=... CC_CLIENT_ID=... CC_CLIENT_SECRET=... CC_DRY_RUN=1 python cron/compliance_cron.py
```

## Sicherheitsnetze im Skript

* ohne Secrets: sofortiger, grüner Abbruch
* Versand nur an Adressen der eigenen Absenderdomäne
* je Datensatz eine Erinnerungsmarke (`Erinnert`), damit nicht täglich dieselbe Mail geht
* jeder Schritt ist gekapselt – ein Fehler stoppt den Rest des Laufs nicht
