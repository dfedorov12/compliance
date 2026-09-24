"use strict";

// Zuordnung der ISO/IEC 27001:2022-Anhang-A-Controls zu Live-Signalen aus
// Microsoft 365. Die Normen selbst, die SoA und den Umsetzungsstand führt das
// RMS (rms.dihag.de, js/normen.js und js/soa.js dort); das Cockpit liefert dazu
// die M365-Nachweise. Titel und Anforderung dienen nur der Anzeige.
//
// m365: Schlüssel eines Signals in purview.js (CC_SIGNALE). Controls ohne
// Signal stehen hier trotzdem, damit die Nachweisansicht alle 93 zeigen kann.

const CC_ANNEX_A = [
      { id: "A.5.1",  titel: "Informationssicherheitsrichtlinien", anforderung: "Richtlinien zur Informationssicherheit sind definiert, von der Leitung genehmigt, veröffentlicht und werden regelmäßig überprüft.", m365: "rms" },
      { id: "A.5.2",  titel: "Rollen und Verantwortlichkeiten der Informationssicherheit", anforderung: "Sicherheitsrollen sind festgelegt und zugewiesen." },
      { id: "A.5.3",  titel: "Aufgabentrennung", anforderung: "Widerstreitende Aufgaben und Verantwortungsbereiche sind getrennt.", m365: "rollen" },
      { id: "A.5.4",  titel: "Verantwortlichkeiten der Leitung", anforderung: "Die Leitung verlangt von allen Beschäftigten die Anwendung der Sicherheitsvorgaben." },
      { id: "A.5.5",  titel: "Kontakt mit Behörden", anforderung: "Kontakte zu relevanten Behörden werden gepflegt." },
      { id: "A.5.6",  titel: "Kontakt mit speziellen Interessengruppen", anforderung: "Kontakte zu Fachgruppen und Sicherheitsforen werden gepflegt." },
      { id: "A.5.7",  titel: "Bedrohungsinformationen", anforderung: "Informationen zu Bedrohungen werden erhoben, analysiert und verwertet.", m365: "alerts" },
      { id: "A.5.8",  titel: "Informationssicherheit im Projektmanagement", anforderung: "Sicherheit ist in das Projektmanagement integriert." },
      { id: "A.5.9",  titel: "Inventar der Informationen und zugehörigen Werte", anforderung: "Ein Verzeichnis der Informationswerte inkl. Eigentümer wird geführt.", m365: "geraete" },
      { id: "A.5.10", titel: "Zulässiger Gebrauch von Informationen und Werten", anforderung: "Regeln zum zulässigen Gebrauch sind festgelegt und kommuniziert.", m365: "rms" },
      { id: "A.5.11", titel: "Rückgabe von Werten", anforderung: "Beschäftigte geben bei Beendigung alle Werte zurück." },
      { id: "A.5.12", titel: "Klassifizierung von Informationen", anforderung: "Informationen werden nach Schutzbedarf klassifiziert.", m365: "labels" },
      { id: "A.5.13", titel: "Kennzeichnung von Informationen", anforderung: "Es besteht ein Verfahren zur Kennzeichnung entsprechend der Klassifizierung.", m365: "labels" },
      { id: "A.5.14", titel: "Informationsübertragung", anforderung: "Regeln und Vereinbarungen zur sicheren Übertragung von Informationen bestehen.", m365: "dlp" },
      { id: "A.5.15", titel: "Zugangssteuerung", anforderung: "Regeln zur physischen und logischen Zugriffssteuerung sind festgelegt.", m365: "ca" },
      { id: "A.5.16", titel: "Identitätsmanagement", anforderung: "Der gesamte Lebenszyklus von Identitäten wird gesteuert.", m365: "benutzer" },
      { id: "A.5.17", titel: "Authentifizierungsinformationen", anforderung: "Vergabe und Umgang mit Authentifizierungsinformationen sind geregelt.", m365: "ca" },
      { id: "A.5.18", titel: "Zugriffsrechte", anforderung: "Zugriffsrechte werden vergeben, überprüft und bei Wechsel/Austritt entzogen.", m365: "ca" },
      { id: "A.5.19", titel: "Informationssicherheit in Lieferantenbeziehungen", anforderung: "Risiken aus Lieferantenbeziehungen sind adressiert.", m365: "avv" },
      { id: "A.5.20", titel: "Informationssicherheit in Lieferantenvereinbarungen", anforderung: "Sicherheitsanforderungen sind vertraglich vereinbart.", m365: "avv" },
      { id: "A.5.21", titel: "Sicherheit in der IKT-Lieferkette", anforderung: "Risiken der IKT-Lieferkette werden gesteuert." },
      { id: "A.5.22", titel: "Überwachung und Änderung von Lieferantenleistungen", anforderung: "Leistungen der Lieferanten werden überwacht und überprüft." },
      { id: "A.5.23", titel: "Informationssicherheit bei Cloud-Diensten", anforderung: "Beschaffung, Nutzung und Beendigung von Cloud-Diensten sind geregelt.", m365: "secureScore" },
      { id: "A.5.24", titel: "Planung und Vorbereitung des Vorfallmanagements", anforderung: "Prozesse, Rollen und Verantwortlichkeiten für Sicherheitsvorfälle sind festgelegt." },
      { id: "A.5.25", titel: "Beurteilung und Entscheidung über Sicherheitsereignisse", anforderung: "Ereignisse werden bewertet und als Vorfall eingestuft oder verworfen.", m365: "alerts" },
      { id: "A.5.26", titel: "Reaktion auf Informationssicherheitsvorfälle", anforderung: "Auf Vorfälle wird gemäß dokumentierter Verfahren reagiert.", m365: "incidents" },
      { id: "A.5.27", titel: "Lernen aus Informationssicherheitsvorfällen", anforderung: "Erkenntnisse aus Vorfällen fließen in Maßnahmen ein." },
      { id: "A.5.28", titel: "Sammeln von Beweismaterial", anforderung: "Verfahren zur Identifizierung und Sicherung von Beweismitteln bestehen.", m365: "ediscovery" },
      { id: "A.5.29", titel: "Informationssicherheit bei Störungen", anforderung: "Sicherheit wird auch während Störungen aufrechterhalten." },
      { id: "A.5.30", titel: "IKT-Bereitschaft für Business Continuity", anforderung: "IKT-Bereitschaft ist geplant, umgesetzt und getestet." },
      { id: "A.5.31", titel: "Rechtliche und vertragliche Anforderungen", anforderung: "Anwendbare rechtliche Anforderungen sind identifiziert und dokumentiert." },
      { id: "A.5.32", titel: "Geistige Eigentumsrechte", anforderung: "Verfahren zum Schutz geistigen Eigentums sind umgesetzt." },
      { id: "A.5.33", titel: "Schutz von Aufzeichnungen", anforderung: "Aufzeichnungen sind vor Verlust, Fälschung und unberechtigtem Zugriff geschützt.", m365: "retention" },
      { id: "A.5.34", titel: "Privatsphäre und Schutz personenbezogener Daten", anforderung: "Datenschutzanforderungen werden identifiziert und erfüllt.", m365: "vvt" },
      { id: "A.5.35", titel: "Unabhängige Überprüfung der Informationssicherheit", anforderung: "Der Sicherheitsansatz wird unabhängig in geplanten Abständen überprüft." },
      { id: "A.5.36", titel: "Einhaltung von Richtlinien und Standards", anforderung: "Die Einhaltung der Sicherheitsvorgaben wird regelmäßig überprüft.", m365: "rms" },
      { id: "A.5.37", titel: "Dokumentierte Betriebsabläufe", anforderung: "Betriebsabläufe sind dokumentiert und den Beteiligten verfügbar." },

      { id: "A.6.1",  titel: "Sicherheitsüberprüfung (Screening)", anforderung: "Bewerber werden vor Einstellung angemessen überprüft." },
      { id: "A.6.2",  titel: "Arbeitsvertragliche Regelungen", anforderung: "Sicherheitspflichten sind Bestandteil der Arbeitsverträge." },
      { id: "A.6.3",  titel: "Sensibilisierung, Ausbildung und Schulung", anforderung: "Beschäftigte werden regelmäßig geschult und sensibilisiert.", m365: "rms" },
      { id: "A.6.4",  titel: "Disziplinarverfahren", anforderung: "Ein formales Verfahren bei Sicherheitsverstößen ist etabliert." },
      { id: "A.6.5",  titel: "Pflichten bei Beendigung oder Wechsel", anforderung: "Fortbestehende Pflichten sind festgelegt und werden durchgesetzt." },
      { id: "A.6.6",  titel: "Vertraulichkeitsvereinbarungen", anforderung: "NDA/Vertraulichkeitsvereinbarungen sind identifiziert und dokumentiert." },
      { id: "A.6.7",  titel: "Arbeiten aus der Ferne", anforderung: "Für mobiles Arbeiten sind Sicherheitsmaßnahmen umgesetzt.", m365: "ca" },
      { id: "A.6.8",  titel: "Meldung von Sicherheitsereignissen", anforderung: "Beschäftigte können Ereignisse zeitnah über einen definierten Weg melden." },

      { id: "A.7.1",  titel: "Physische Sicherheitszonen", anforderung: "Sicherheitsbereiche sind definiert und geschützt." },
      { id: "A.7.2",  titel: "Physischer Zutritt", anforderung: "Zutritt zu Sicherheitsbereichen wird gesteuert." },
      { id: "A.7.3",  titel: "Sicherung von Büros, Räumen und Einrichtungen", anforderung: "Physische Sicherheit für Räume ist konzipiert und umgesetzt." },
      { id: "A.7.4",  titel: "Physische Sicherheitsüberwachung", anforderung: "Räume werden auf unbefugten Zutritt überwacht." },
      { id: "A.7.5",  titel: "Schutz vor physischen und umweltbedingten Bedrohungen", anforderung: "Schutz gegen Feuer, Wasser, Naturereignisse u. Ä. besteht." },
      { id: "A.7.6",  titel: "Arbeiten in Sicherheitsbereichen", anforderung: "Für Arbeiten in Sicherheitsbereichen gelten besondere Maßnahmen." },
      { id: "A.7.7",  titel: "Aufgeräumter Arbeitsplatz und Bildschirm", anforderung: "Clear-Desk- und Clear-Screen-Regeln sind festgelegt." },
      { id: "A.7.8",  titel: "Platzierung und Schutz von Geräten", anforderung: "Betriebsmittel sind sicher platziert und geschützt." },
      { id: "A.7.9",  titel: "Sicherheit von Werten außerhalb der Räumlichkeiten", anforderung: "Werte außerhalb des Geländes sind geschützt.", m365: "geraete" },
      { id: "A.7.10", titel: "Speichermedien", anforderung: "Der gesamte Lebenszyklus von Speichermedien ist geregelt." },
      { id: "A.7.11", titel: "Versorgungseinrichtungen", anforderung: "Betriebsmittel sind vor Ausfall der Versorgung geschützt." },
      { id: "A.7.12", titel: "Sicherheit der Verkabelung", anforderung: "Strom- und Datenleitungen sind vor Abhören und Beschädigung geschützt." },
      { id: "A.7.13", titel: "Instandhaltung von Geräten", anforderung: "Betriebsmittel werden korrekt gewartet." },
      { id: "A.7.14", titel: "Sichere Entsorgung oder Wiederverwendung", anforderung: "Vor Entsorgung/Wiederverwendung werden Daten sicher gelöscht." },

      { id: "A.8.1",  titel: "Endgeräte der Benutzer", anforderung: "Auf Endgeräten gespeicherte Informationen sind geschützt.", m365: "geraete" },
      { id: "A.8.2",  titel: "Privilegierte Zugriffsrechte", anforderung: "Vergabe und Nutzung privilegierter Rechte sind beschränkt und werden überwacht.", m365: "rollen" },
      { id: "A.8.3",  titel: "Informationszugriffsbeschränkung", anforderung: "Zugriff auf Informationen wird gemäß Zugangssteuerung beschränkt.", m365: "labels" },
      { id: "A.8.4",  titel: "Zugriff auf Quellcode", anforderung: "Zugriff auf Quellcode und Entwicklungswerkzeuge ist geregelt." },
      { id: "A.8.5",  titel: "Sichere Authentifizierung", anforderung: "Sichere Authentifizierungsverfahren (z. B. MFA) sind umgesetzt.", m365: "ca" },
      { id: "A.8.6",  titel: "Kapazitätssteuerung", anforderung: "Ressourcennutzung wird überwacht und angepasst." },
      { id: "A.8.7",  titel: "Schutz vor Schadsoftware", anforderung: "Schutz vor Schadsoftware ist umgesetzt und durch Awareness flankiert.", m365: "alerts" },
      { id: "A.8.8",  titel: "Handhabung technischer Schwachstellen", anforderung: "Schwachstellen werden erkannt, bewertet und behandelt.", m365: "secureScore" },
      { id: "A.8.9",  titel: "Konfigurationsmanagement", anforderung: "Konfigurationen von Hard-/Software werden festgelegt und überwacht.", m365: "geraetepolicies" },
      { id: "A.8.10", titel: "Löschung von Informationen", anforderung: "Nicht mehr benötigte Informationen werden gelöscht.", m365: "retention" },
      { id: "A.8.11", titel: "Datenmaskierung", anforderung: "Datenmaskierung wird gemäß Zugriffs- und Datenschutzvorgaben eingesetzt." },
      { id: "A.8.12", titel: "Verhinderung von Datenlecks", anforderung: "DLP-Maßnahmen sind auf Systeme und Netzwerke angewendet.", m365: "dlp" },
      { id: "A.8.13", titel: "Sicherung von Informationen (Backup)", anforderung: "Sicherungen werden erstellt und regelmäßig getestet." },
      { id: "A.8.14", titel: "Redundanz der informationsverarbeitenden Einrichtungen", anforderung: "Verfügbarkeitsanforderungen werden durch Redundanz erfüllt." },
      { id: "A.8.15", titel: "Protokollierung", anforderung: "Ereignisse werden protokolliert, aufbewahrt und ausgewertet.", m365: "audit" },
      { id: "A.8.16", titel: "Überwachungsaktivitäten", anforderung: "Netzwerke und Systeme werden auf auffälliges Verhalten überwacht.", m365: "alerts" },
      { id: "A.8.17", titel: "Uhrzeitsynchronisation", anforderung: "Systemuhren sind mit einer Referenzzeit synchronisiert." },
      { id: "A.8.18", titel: "Gebrauch privilegierter Hilfsprogramme", anforderung: "Der Einsatz von Systemwerkzeugen ist beschränkt und überwacht." },
      { id: "A.8.19", titel: "Installation von Software auf Systemen", anforderung: "Software-Installation auf Produktivsystemen ist geregelt.", m365: "geraetepolicies" },
      { id: "A.8.20", titel: "Netzwerksicherheit", anforderung: "Netzwerke werden gesichert und verwaltet." },
      { id: "A.8.21", titel: "Sicherheit von Netzwerkdiensten", anforderung: "Sicherheitsmerkmale von Netzwerkdiensten sind festgelegt." },
      { id: "A.8.22", titel: "Trennung von Netzwerken", anforderung: "Netzwerke sind nach Diensten und Vertrauensstufen getrennt." },
      { id: "A.8.23", titel: "Webfilterung", anforderung: "Zugriff auf externe Websites wird gesteuert." },
      { id: "A.8.24", titel: "Verwendung von Kryptographie", anforderung: "Regeln zum Einsatz von Kryptographie und Schlüsselverwaltung bestehen.", m365: "labels" },
      { id: "A.8.25", titel: "Sicherer Entwicklungslebenszyklus", anforderung: "Regeln für die sichere Entwicklung sind festgelegt." },
      { id: "A.8.26", titel: "Anforderungen an die Anwendungssicherheit", anforderung: "Sicherheitsanforderungen für Anwendungen sind definiert." },
      { id: "A.8.27", titel: "Sichere Systemarchitektur und Engineering-Prinzipien", anforderung: "Prinzipien sicherer Architektur sind festgelegt und angewendet." },
      { id: "A.8.28", titel: "Sichere Programmierung", anforderung: "Prinzipien sicherer Programmierung werden angewendet." },
      { id: "A.8.29", titel: "Sicherheitstests in Entwicklung und Abnahme", anforderung: "Sicherheitstests sind Teil des Entwicklungsprozesses." },
      { id: "A.8.30", titel: "Ausgelagerte Entwicklung", anforderung: "Ausgelagerte Entwicklung wird gesteuert und überwacht." },
      { id: "A.8.31", titel: "Trennung von Entwicklungs-, Test- und Produktivumgebungen", anforderung: "Umgebungen sind voneinander getrennt und gesichert." },
      { id: "A.8.32", titel: "Änderungsmanagement", anforderung: "Änderungen unterliegen einem Änderungsverfahren." },
      { id: "A.8.33", titel: "Testinformationen", anforderung: "Testdaten werden ausgewählt, geschützt und verwaltet." },
      { id: "A.8.34", titel: "Schutz von Systemen während Audit-Tests", anforderung: "Audit-Tests an Produktivsystemen werden geplant und abgestimmt.", m365: "audit" }
];

const CC_ANNEX_KATEGORIEN = {
  "A.5": "Organisatorische Maßnahmen",
  "A.6": "Personenbezogene Maßnahmen",
  "A.7": "Physische Maßnahmen",
  "A.8": "Technologische Maßnahmen"
};

function annexControl(id) {
  return CC_ANNEX_A.find(c => c.id === id) || null;
}

// Kurztexte zu den M365-Signalen (für die Nachweisansicht).
const CC_SIGNAL_LABELS = {
  labels:         "Vertraulichkeitsbezeichnungen (Purview)",
  retention:      "Aufbewahrungsbezeichnungen (Purview)",
  dlp:            "DLP-Warnungen (Purview)",
  audit:          "Einheitliches Überwachungsprotokoll",
  alerts:         "Sicherheitswarnungen (Defender/Purview)",
  incidents:      "Sicherheitsvorfälle (Defender XDR)",
  secureScore:    "Microsoft Secure Score",
  ca:             "Richtlinien für bedingten Zugriff",
  benutzer:       "Benutzerkonten (Entra ID)",
  rollen:         "Privilegierte Verzeichnisrollen",
  geraete:        "Verwaltete Geräte (Intune)",
  geraetepolicies:"Gerätekonformitätsrichtlinien (Intune)",
  ediscovery:     "eDiscovery-Fälle (Purview)",
  srr:            "Betroffenenanfragen (Priva/Purview)",
  vvt:            "Verzeichnis von Verarbeitungstätigkeiten (App)",
  tom:            "TOM-Katalog (App)",
  avv:            "AV-Verträge (App)",
  rms:            "Richtlinienmanagementsystem (DIHAG)",
  anfragen:       "Register Betroffenenanfragen (App)"
};
