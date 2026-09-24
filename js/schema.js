"use strict";

// Datenmodell der Governance-Schicht. Aus diesem Schema werden erzeugt:
//   * die SharePoint-Spalten (Einstellungen → „Listen prüfen/anlegen")
//   * die Tabellen (Spaltenauswahl, Filter, CSV-Export)
//   * der Bearbeiten-Dialog
// Spaltennamen bewusst ASCII (SharePoint kodiert Umlaute in internen Namen).

const CC_SCHEMA = {

  vvt: {
    list: CC_LISTS.vvt,
    label: "Verarbeitungstätigkeiten",
    singular: "Verarbeitungstätigkeit",
    titelLabel: "Verarbeitungstätigkeit",
    sort: (a, b) => (a.Title || "").localeCompare(b.Title || ""),
    tabelle: ["Title", "Fachbereich", "Rechtsgrundlage", "Loeschfrist", "DSFA", "Status", "NaechstePruefung"],
    felder: [
      { name: "Title",             label: "Verarbeitungstätigkeit", type: "text", span2: true, required: true },
      { name: "Verantwortlicher",  label: "Verantwortlicher (Gesellschaft)", type: "text" },
      { name: "Fachbereich",       label: "Fachbereich", type: "text" },
      { name: "Zweck",             label: "Zweck der Verarbeitung", type: "note", span2: true, required: true },
      { name: "Rechtsgrundlage",   label: "Rechtsgrundlage", type: "select", required: true, options: () => [
          "Art. 6 Abs. 1 lit. a – Einwilligung",
          "Art. 6 Abs. 1 lit. b – Vertrag",
          "Art. 6 Abs. 1 lit. c – rechtliche Verpflichtung",
          "Art. 6 Abs. 1 lit. d – lebenswichtige Interessen",
          "Art. 6 Abs. 1 lit. e – öffentliches Interesse",
          "Art. 6 Abs. 1 lit. f – berechtigtes Interesse",
          "§ 26 BDSG – Beschäftigtenverhältnis",
          "Art. 9 Abs. 2 – besondere Kategorien"
        ] },
      { name: "Betroffenengruppen",label: "Kategorien betroffener Personen", type: "note", span2: true },
      { name: "Datenkategorien",   label: "Kategorien personenbezogener Daten", type: "note", span2: true },
      { name: "BesondereKat",      label: "Besondere Kategorien (Art. 9)", type: "select", options: () => ["Nein", "Ja"] },
      { name: "Empfaenger",        label: "Empfänger / Kategorien von Empfängern", type: "note", span2: true },
      { name: "Drittland",         label: "Drittlandtransfer", type: "text" },
      { name: "Garantien",         label: "Garantien bei Drittlandtransfer", kurz: "Garantien", type: "text" },
      { name: "Loeschfrist",       label: "Löschfrist", type: "text", required: true },
      { name: "TOMRef",            label: "TOM (Verweis)", type: "text" },
      { name: "Systeme",           label: "Eingesetzte Systeme", type: "text" },
      { name: "DSFA",              label: "Datenschutz-Folgenabschätzung", kurz: "DSFA", type: "select", options: () => ["Nicht erforderlich", "Erforderlich", "Durchgeführt"] },
      { name: "Status",            label: "Status", type: "select", options: () => ["Entwurf", "Freigegeben", "Überarbeitung"], required: true },
      { name: "DSBFreigabe",       label: "Freigabe DSB", type: "text" },
      { name: "LetztePruefung",    label: "Letzte Prüfung", type: "date" },
      { name: "NaechstePruefung",  label: "Nächste Prüfung", type: "date" }
    ]
  },

  tom: {
    list: CC_LISTS.tom,
    label: "TOM",
    singular: "Maßnahme (TOM)",
    titelLabel: "Maßnahme",
    sort: (a, b) => (a.Kategorie || "").localeCompare(b.Kategorie || ""),
    tabelle: ["Title", "Kategorie", "Status", "Verantwortlich", "LetztePruefung"],
    felder: [
      { name: "Title",          label: "Maßnahme", type: "text", span2: true, required: true },
      { name: "Kategorie",      label: "Kategorie", type: "select", required: true, options: () => [
          "Zutrittskontrolle", "Zugangskontrolle", "Zugriffskontrolle", "Weitergabekontrolle",
          "Eingabekontrolle", "Auftragskontrolle", "Verfügbarkeitskontrolle", "Trennungskontrolle",
          "Pseudonymisierung", "Verschlüsselung", "Belastbarkeit", "Wiederherstellbarkeit",
          "Evaluierung der Wirksamkeit"
        ] },
      { name: "Beschreibung",   label: "Beschreibung", type: "note", span2: true },
      { name: "Umsetzung",      label: "Umsetzung im Haus", type: "note", span2: true },
      { name: "Status",         label: "Status", type: "select", options: () => ["Geplant", "Umgesetzt", "Teilweise", "Nicht anwendbar"], required: true },
      { name: "Verantwortlich", label: "Verantwortlich (E-Mail)", kurz: "Verantwortlich", type: "person" },
      { name: "ControlIds",     label: "Verknüpfte Controls (RMS)", type: "text", hint: "kommagetrennt, z. B. A.8.5, A.8.24" },
      { name: "LetztePruefung", label: "Letzte Prüfung", type: "date" }
    ]
  },

  avv: {
    list: CC_LISTS.avv,
    label: "Auftragsverarbeiter",
    singular: "Dienstleister",
    titelLabel: "Dienstleister",
    sort: (a, b) => (a.Title || "").localeCompare(b.Title || ""),
    tabelle: ["Title", "Leistung", "Kategorie", "Drittland", "Status", "NaechstePruefung"],
    felder: [
      { name: "Title",            label: "Dienstleister", type: "text", span2: true, required: true },
      { name: "Leistung",         label: "Leistung", type: "text", span2: true },
      { name: "Kategorie",        label: "Einordnung", type: "select", required: true, options: () => ["Auftragsverarbeiter (Art. 28)", "Gemeinsam Verantwortliche (Art. 26)", "Eigenständig Verantwortlicher"] },
      { name: "Vertragsdatum",    label: "AV-Vertrag vom", type: "date" },
      { name: "Ablauf",           label: "Vertragsende", type: "date" },
      { name: "Datenkategorien",  label: "Verarbeitete Datenkategorien", type: "note", span2: true },
      { name: "Drittland",        label: "Drittland", type: "text" },
      { name: "Garantien",        label: "Garantien", type: "select", options: () => ["Nicht erforderlich", "Angemessenheitsbeschluss", "Standardvertragsklauseln", "Binding Corporate Rules", "Keine – Risiko"] },
      { name: "TOMGeprueft",      label: "TOM geprüft", type: "select", options: () => ["Nein", "Ja"] },
      { name: "LoeschungNachEnde",label: "Löschung/Rückgabe nach Vertragsende geregelt", type: "select", options: () => ["Nein", "Ja"] },
      { name: "Systeme",          label: "Betroffene Systeme", type: "text" },
      { name: "Kontakt",          label: "Kontakt beim Dienstleister", type: "text" },
      { name: "Verantwortlich",   label: "Interner Ansprechpartner", type: "person" },
      { name: "Status",           label: "Status", type: "select", options: () => ["In Prüfung", "Aktiv", "Gekündigt"], required: true },
      { name: "NaechstePruefung", label: "Nächste Prüfung", type: "date" }
    ]
  },

  // Betroffenenanfragen nach Art. 15–21 DSGVO. Ersatz für Microsoft Priva, das im
  // Mandanten nicht bereitgestellt ist. Die Antwortfrist wird beim Speichern aus
  // Eingang und Verlängerung berechnet (berechneAnfrage in data.js).
  anfragen: {
    list: CC_LISTS.anfragen,
    label: "Betroffenenanfragen",
    singular: "Betroffenenanfrage",
    titelLabel: "Vorgang",
    sort: (a, b) => {
      // Offene Anfragen nach Frist zuerst, erledigte danach (neueste oben).
      const offenA = anfrageOffen(a), offenB = anfrageOffen(b);
      if (offenA !== offenB) return offenA ? -1 : 1;
      return offenA ? (a.Frist || "9999").localeCompare(b.Frist || "9999")
                    : (b.Eingang || "").localeCompare(a.Eingang || "");
    },
    tabelle: ["Title", "Art", "PersonName", "Eingang", "Frist", "Identitaet", "Status"],
    beimSpeichern: werte => berechneAnfrage(werte),
    felder: [
      { name: "Title",             label: "Vorgangsnummer", kurz: "Vorgang", type: "text", required: true },
      { name: "Art",               label: "Art der Anfrage", type: "select", required: true, options: () => CC_ANFRAGE_ARTEN },
      { name: "Eingang",           label: "Eingegangen am", type: "date", required: true, hint: "Startpunkt der Monatsfrist (Art. 12 Abs. 3 DSGVO)" },
      { name: "Kanal",             label: "Eingangskanal", type: "select", options: () => ["E-Mail", "Brief", "Telefon", "Persönlich", "Webformular", "Über Dritte (z. B. Anwalt)"] },
      { name: "PersonName",        label: "Betroffene Person", kurz: "Person", type: "text", required: true },
      { name: "PersonKontakt",     label: "Kontakt (Anschrift oder E-Mail)", type: "text" },
      { name: "Personengruppe",    label: "Personengruppe", type: "select", options: () => CC_PERSONENGRUPPEN, hint: "bestimmt den vorgeschlagenen Suchumfang aus dem VVT" },
      { name: "Anliegen",          label: "Anliegen im Wortlaut / Umfang", type: "note", span2: true },
      { name: "Identitaet",        label: "Identitätsprüfung", kurz: "Identität", type: "select", options: () => ["Offen", "Geprüft", "Nicht nachweisbar"] },
      { name: "IdentitaetNachweis",label: "Wie wurde die Identität geprüft?", type: "text", hint: "z. B. Abgleich mit Personalakte, Rückruf, Ausweis (geschwärzt)" },
      { name: "Verlaengert",       label: "Frist verlängert (Art. 12 Abs. 3 S. 2)", type: "select", options: () => ["Nein", "Ja"] },
      { name: "VerlaengerungGrund",label: "Grund der Verlängerung", type: "note", span2: true, hint: "Komplexität oder Anzahl der Anträge. Die Person ist innerhalb des ersten Monats zu informieren." },
      { name: "Frist",             label: "Antwortfrist", type: "date", readonly: true, hint: "wird aus Eingang und Verlängerung berechnet" },
      { name: "Systeme",           label: "Durchsuchte Systeme / Verarbeitungstätigkeiten", type: "note", span2: true },
      { name: "EdiscoveryFall",    label: "eDiscovery-Fall", type: "text", hint: "wird beim Anlegen aus dem Vorgang gesetzt" },
      { name: "Ergebnis",          label: "Ergebnis", type: "select", options: () => ["Offen", "Vollständig erfüllt", "Teilweise erfüllt", "Abgelehnt (mit Begründung)", "Keine Daten vorhanden"] },
      { name: "Begruendung",       label: "Begründung bei Ablehnung oder Einschränkung", type: "note", span2: true },
      { name: "Beantwortet",       label: "Beantwortet am", type: "date" },
      { name: "Verantwortlich",    label: "Bearbeitet von (E-Mail)", kurz: "Bearbeiter", type: "person" },
      { name: "Status",            label: "Status", type: "select", required: true, options: () => CC_ANFRAGE_STATUS },
      { name: "Erinnert",          label: "Letzte Erinnerung", type: "text", readonly: true }
    ]
  },

  // Gesicherte Live-Werte aus Microsoft 365 je Annex-A-Control. Jede Sicherung
  // ist ein eigener Eintrag (Verlauf); das RMS zeigt in der SoA den jüngsten.
  nachweise: {
    list: CC_LISTS.nachweise,
    label: "M365-Nachweise",
    singular: "M365-Nachweis",
    titelLabel: "Control",
    versteckt: true,
    sort: (a, b) => (b.Zeit || "").localeCompare(a.Zeit || ""),
    tabelle: ["Title", "Bezeichnung", "Signal", "Wert", "Stand", "ErfasstVon"],
    felder: [
      { name: "Title",       label: "Control-ID", type: "text", required: true },
      { name: "Bezeichnung", label: "Control", type: "text" },
      { name: "Signal",      label: "M365-Signal", type: "text" },
      { name: "Wert",        label: "Wert zum Stichtag", type: "note", span2: true },
      { name: "Stand",       label: "Stand", type: "date" },
      { name: "Zeit",        label: "Zeitpunkt (ISO)", type: "text", readonly: true },
      { name: "ErfasstVon",  label: "Gesichert von", type: "person" }
    ]
  }
};

const CC_ANFRAGE_ARTEN = [
  "Auskunft (Art. 15)", "Berichtigung (Art. 16)", "Löschung (Art. 17)", "Einschränkung (Art. 18)",
  "Datenübertragbarkeit (Art. 20)", "Widerspruch (Art. 21)", "Widerruf der Einwilligung (Art. 7 Abs. 3)", "Sonstiges"
];
const CC_ANFRAGE_STATUS = ["Eingegangen", "Identität prüfen", "In Bearbeitung", "Beantwortet", "Abgeschlossen"];
const CC_PERSONENGRUPPEN = ["Beschäftigte", "Ehemalige Beschäftigte", "Bewerber", "Kunden", "Lieferanten", "Besucher", "Sonstige"];

// Status, bei denen ein Datensatz als erledigt gilt (keine Frist mehr, kein Arbeitsvorrat).
const CC_ERLEDIGT = ["Erledigt", "Abgeschlossen", "Verworfen", "Beantwortet", "Geschlossen", "Gekündigt"];

function anfrageOffen(a) {
  return !["Beantwortet", "Abgeschlossen"].includes(a.Status);
}

// SharePoint-Spaltentyp je Feldtyp.
const CC_SP_TYPE = {
  text: "text", person: "text", select: "text",
  note: "note", number: "number", date: "dateTime", boolean: "boolean"
};

function spaltenFuer(entity) {
  return CC_SCHEMA[entity].felder.map(f => ({ name: f.name, type: CC_SP_TYPE[f.type] || "text" }));
}

// Control-IDs wie „A.8.12" natürlich sortieren (A.8.2 vor A.8.12).
function sortiereControlId(a = "", b = "") {
  const teile = s => String(s).split(/[.\s]/).map(t => (/^\d+$/.test(t) ? Number(t) : t));
  const ta = teile(a), tb = teile(b);
  for (let i = 0; i < Math.max(ta.length, tb.length); i++) {
    const x = ta[i], y = tb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (typeof x === "number" && typeof y === "number") { if (x !== y) return x - y; }
    else if (String(x) !== String(y)) return String(x).localeCompare(String(y));
  }
  return 0;
}
