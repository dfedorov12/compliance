"use strict";

// Demo-Modus: Aufruf mit ?demo=1 zeigt die App mit Beispieldaten – ohne Anmeldung,
// ohne SharePoint, ohne Microsoft Graph. Gedacht für Vorführungen, Schulungen und
// zum Testen des Layouts. Im Normalbetrieb ändert diese Datei nichts.

(function () {
  if (!new URLSearchParams(location.search).has("demo")) return;

  const heute = new Date();
  const tage = n => new Date(heute.getTime() + n * 86400000).toISOString().slice(0, 10);
  let _id = 100;
  const neueId = () => String(++_id);

  // --- Beispieldaten -------------------------------------------------------
  const controls = CC_FRAMEWORKS.ISO27001.controls.map((c, i) => ({
    id: neueId(), Title: c.id, Framework: "ISO27001",
    Kategorie: c.id.split(".").slice(0, 2).join("."),
    Bezeichnung: c.titel, Anforderung: c.anforderung || "",
    Status: i % 7 === 0 ? "Offen" : i % 5 === 0 ? "In Umsetzung" : i % 11 === 0 ? "Nicht anwendbar" : "Umgesetzt",
    Reifegrad: CC_REIFEGRADE[Math.min(5, (i % 6))].label,
    Verantwortlich: i % 3 === 0 ? "fedorov@dihag.com" : "it@dihag.com",
    Umsetzung: "", NachweisText: "", Begruendung: i % 11 === 0 ? "Kein eigener Rechenzentrumsbetrieb." : "",
    LetztePruefung: tage(-200 + (i % 60)), NaechstePruefung: tage(-10 + (i % 90)),
    M365Signal: c.m365 || "", RisikoIds: ""
  })).concat(CC_FRAMEWORKS.DSGVO.controls.map((c, i) => ({
    id: neueId(), Title: c.id, Framework: "DSGVO",
    Kategorie: c.id.split(".").slice(0, 2).join("."),
    Bezeichnung: c.titel, Anforderung: c.anforderung || "",
    Status: i % 4 === 0 ? "In Umsetzung" : "Umgesetzt",
    Reifegrad: CC_REIFEGRADE[3].label, Verantwortlich: "datenschutz@dihag.com",
    Umsetzung: "", NachweisText: "", Begruendung: "",
    LetztePruefung: tage(-120), NaechstePruefung: tage(20 + i),
    M365Signal: c.m365 || "", RisikoIds: ""
  })));

  const daten = {
    [CC_LISTS.controls]: controls,
    [CC_LISTS.aufgaben]: [
      { id: neueId(), Title: "MFA für alle Dienstkonten erzwingen", Beschreibung: "Konten ohne MFA identifizieren und Richtlinie ausrollen.", ControlId: "A.8.5", Verantwortlich: "fedorov@dihag.com", Faellig: tage(-6), Prioritaet: "Hoch", Status: "In Arbeit", Erledigt: "", Quelle: "Secure Score", Erinnert: "" },
      { id: neueId(), Title: "DLP-Richtlinie für Konstruktionsdaten erweitern", Beschreibung: "Prototypendaten in die bestehende Richtlinie aufnehmen.", ControlId: "A.8.12", Verantwortlich: "it@dihag.com", Faellig: tage(9), Prioritaet: "Mittel", Status: "Offen", Erledigt: "", Quelle: "TISAX-Audit", Erinnert: "" },
      { id: neueId(), Title: "Löschkonzept mit Aufbewahrungsbezeichnungen abgleichen", Beschreibung: "", ControlId: "D.1.6", Verantwortlich: "datenschutz@dihag.com", Faellig: tage(21), Prioritaet: "Mittel", Status: "Offen", Erledigt: "", Quelle: "Datenschutzaudit", Erinnert: "" },
      { id: neueId(), Title: "Notfallübung Wiederanlauf ERP", Beschreibung: "", ControlId: "A.5.30", Verantwortlich: "it@dihag.com", Faellig: tage(-25), Prioritaet: "Hoch", Status: "Offen", Erledigt: "", Quelle: "ISO-Audit 2026", Erinnert: "" },
      { id: neueId(), Title: "Awareness-Kampagne Phishing Q3", Beschreibung: "", ControlId: "A.6.3", Verantwortlich: "fedorov@dihag.com", Faellig: tage(40), Prioritaet: "Niedrig", Status: "Offen", Erledigt: "", Quelle: "Schulungsplan", Erinnert: "" },
      { id: neueId(), Title: "Berechtigungsreview Finanzbuchhaltung", Beschreibung: "", ControlId: "A.5.18", Verantwortlich: "it@dihag.com", Faellig: tage(-40), Prioritaet: "Hoch", Status: "Erledigt", Erledigt: tage(-38), Quelle: "Quartalsreview", Erinnert: "" }
    ],
    [CC_LISTS.risiken]: [
      { id: neueId(), Title: "Ransomware-Angriff auf Produktionsnetz", Beschreibung: "Verschlüsselung der Fertigungssteuerung führt zu Produktionsstillstand.", Kategorie: "IT-Sicherheit", Eintritt: 3, Auswirkung: 5, Bewertung: 15, Strategie: "Vermindern", Massnahmen: "Segmentierung, Backup-Tests, EDR auf allen Servern.", RestrisikoE: 2, RestrisikoA: 5, ControlIds: "A.8.7, A.8.13, A.8.22", Verantwortlich: "fedorov@dihag.com", Status: "In Behandlung", Ueberpruefung: tage(45) },
      { id: neueId(), Title: "Abfluss von Konstruktionsdaten über Cloud-Speicher", Beschreibung: "Mitarbeitende laden CAD-Daten in private Dienste.", Kategorie: "Datenschutz", Eintritt: 3, Auswirkung: 4, Bewertung: 12, Strategie: "Vermindern", Massnahmen: "DLP-Richtlinie, Vertraulichkeitsbezeichnungen, Webfilter.", RestrisikoE: 2, RestrisikoA: 3, ControlIds: "A.8.12, A.5.12", Verantwortlich: "it@dihag.com", Status: "In Behandlung", Ueberpruefung: tage(20) },
      { id: neueId(), Title: "Ausfall eines Auftragsverarbeiters (Lohnabrechnung)", Beschreibung: "", Kategorie: "Lieferkette", Eintritt: 2, Auswirkung: 4, Bewertung: 8, Strategie: "Übertragen", Massnahmen: "Vertragliche SLA, Ausweichprozess.", RestrisikoE: 2, RestrisikoA: 3, ControlIds: "A.5.19, N.1.d", Verantwortlich: "hr@dihag.com", Status: "Offen", Ueberpruefung: tage(90) },
      { id: neueId(), Title: "Fehlende Meldung einer Datenpanne binnen 72 Stunden", Beschreibung: "", Kategorie: "Recht & Compliance", Eintritt: 2, Auswirkung: 5, Bewertung: 10, Strategie: "Vermindern", Massnahmen: "Meldeprozess im Cockpit, Fristüberwachung per Cron.", RestrisikoE: 1, RestrisikoA: 5, ControlIds: "D.3.2", Verantwortlich: "datenschutz@dihag.com", Status: "In Behandlung", Ueberpruefung: tage(60) },
      { id: neueId(), Title: "Veraltete Firmware an Fertigungsanlagen", Beschreibung: "", Kategorie: "Betrieb", Eintritt: 4, Auswirkung: 3, Bewertung: 12, Strategie: "Vermindern", Massnahmen: "Patchfenster mit Instandhaltung abstimmen.", RestrisikoE: 3, RestrisikoA: 3, ControlIds: "A.8.8", Verantwortlich: "it@dihag.com", Status: "Offen", Ueberpruefung: tage(30) }
    ],
    [CC_LISTS.vvt]: [
      { id: neueId(), Title: "Personalverwaltung", Verantwortlicher: "DIHAG Foundry Group", Fachbereich: "Personal", Zweck: "Begründung, Durchführung und Beendigung des Beschäftigungsverhältnisses.", Rechtsgrundlage: "§ 26 BDSG – Beschäftigtenverhältnis", Betroffenengruppen: "Beschäftigte, Bewerber", Datenkategorien: "Stammdaten, Vertragsdaten, Abrechnungsdaten", BesondereKat: "Ja", Empfaenger: "Lohnbüro, Sozialversicherungsträger", Drittland: "", Garantien: "", Loeschfrist: "10 Jahre nach Austritt", TOMRef: "TOM-Katalog", Systeme: "SAP HCM, Microsoft 365", DSFA: "Nicht erforderlich", Status: "Freigegeben", DSBFreigabe: "datenschutz@dihag.com", LetztePruefung: tage(-180), NaechstePruefung: tage(10) },
      { id: neueId(), Title: "Videoüberwachung Werksgelände", Verantwortlicher: "DIHAG Foundry Group", Fachbereich: "Werkschutz", Zweck: "Schutz des Eigentums und Aufklärung von Straftaten.", Rechtsgrundlage: "Art. 6 Abs. 1 lit. f – berechtigtes Interesse", Betroffenengruppen: "Beschäftigte, Besucher, Lieferanten", Datenkategorien: "Bilddaten", BesondereKat: "Nein", Empfaenger: "Werkschutz, ggf. Strafverfolgungsbehörden", Drittland: "", Garantien: "", Loeschfrist: "72 Stunden", TOMRef: "", Systeme: "Videoanlage", DSFA: "Durchgeführt", Status: "Freigegeben", DSBFreigabe: "datenschutz@dihag.com", LetztePruefung: tage(-90), NaechstePruefung: tage(-5) },
      { id: neueId(), Title: "Kunden- und Auftragsverwaltung", Verantwortlicher: "DIHAG Foundry Group", Fachbereich: "Vertrieb", Zweck: "Angebots- und Auftragsabwicklung.", Rechtsgrundlage: "Art. 6 Abs. 1 lit. b – Vertrag", Betroffenengruppen: "Ansprechpartner bei Kunden", Datenkategorien: "Kontaktdaten, Vertragsdaten", BesondereKat: "Nein", Empfaenger: "Logistikdienstleister", Drittland: "USA (Cloud-Dienst)", Garantien: "Standardvertragsklauseln", Loeschfrist: "10 Jahre (HGB/AO)", TOMRef: "", Systeme: "ERP, Microsoft 365", DSFA: "Nicht erforderlich", Status: "Entwurf", DSBFreigabe: "", LetztePruefung: "", NaechstePruefung: tage(30) }
    ],
    [CC_LISTS.tom]: [
      { id: neueId(), Title: "Zutrittskontrolle über Werksausweis", Kategorie: "Zutrittskontrolle", Beschreibung: "Vereinzelung am Werkstor, Ausweisleser an Sicherheitsbereichen.", Umsetzung: "Umgesetzt an allen Standorten.", Status: "Umgesetzt", Verantwortlich: "werkschutz@dihag.com", ControlIds: "A.7.1, A.7.2", LetztePruefung: tage(-100) },
      { id: neueId(), Title: "Mehrfaktor-Authentifizierung für alle Konten", Kategorie: "Zugangskontrolle", Beschreibung: "MFA über Microsoft Entra ID und bedingten Zugriff.", Umsetzung: "Für Beschäftigte umgesetzt, Dienstkonten offen.", Status: "Teilweise", Verantwortlich: "fedorov@dihag.com", ControlIds: "A.8.5, D.3.1", LetztePruefung: tage(-30) },
      { id: neueId(), Title: "Verschlüsselung mobiler Endgeräte", Kategorie: "Verschlüsselung", Beschreibung: "BitLocker über Intune erzwungen.", Umsetzung: "Umgesetzt.", Status: "Umgesetzt", Verantwortlich: "it@dihag.com", ControlIds: "A.8.1, A.8.24", LetztePruefung: tage(-60) },
      { id: neueId(), Title: "Protokollierung und Auswertung sicherheitsrelevanter Ereignisse", Kategorie: "Eingabekontrolle", Beschreibung: "Einheitliches Überwachungsprotokoll in Microsoft Purview.", Umsetzung: "Aufbewahrung 180 Tage.", Status: "Umgesetzt", Verantwortlich: "fedorov@dihag.com", ControlIds: "A.8.15", LetztePruefung: tage(-45) }
    ],
    [CC_LISTS.avv]: [
      { id: neueId(), Title: "Microsoft Ireland Operations Ltd.", Leistung: "Microsoft 365, Azure", Kategorie: "Auftragsverarbeiter (Art. 28)", Vertragsdatum: tage(-700), Ablauf: "", Datenkategorien: "Kommunikations- und Nutzungsdaten", Drittland: "USA (Unterauftragnehmer)", Garantien: "Standardvertragsklauseln", TOMGeprueft: "Ja", LoeschungNachEnde: "Ja", Systeme: "Microsoft 365", Kontakt: "Data Protection Officer", Verantwortlich: "fedorov@dihag.com", Status: "Aktiv", NaechstePruefung: tage(120) },
      { id: neueId(), Title: "Lohnbüro Süd GmbH", Leistung: "Entgeltabrechnung", Kategorie: "Auftragsverarbeiter (Art. 28)", Vertragsdatum: tage(-1100), Ablauf: tage(45), Datenkategorien: "Abrechnungs- und Sozialversicherungsdaten", Drittland: "", Garantien: "Nicht erforderlich", TOMGeprueft: "Nein", LoeschungNachEnde: "Ja", Systeme: "Lohnportal", Kontakt: "info@lohnbuero-sued.example", Verantwortlich: "hr@dihag.com", Status: "Aktiv", NaechstePruefung: tage(8) },
      { id: neueId(), Title: "Aktenvernichtung Rhein GmbH", Leistung: "Datenträgervernichtung", Kategorie: "Auftragsverarbeiter (Art. 28)", Vertragsdatum: tage(-400), Ablauf: "", Datenkategorien: "sämtliche Papierunterlagen", Drittland: "", Garantien: "Nicht erforderlich", TOMGeprueft: "Ja", LoeschungNachEnde: "Ja", Systeme: "–", Kontakt: "", Verantwortlich: "werkschutz@dihag.com", Status: "Aktiv", NaechstePruefung: tage(200) }
    ],
    [CC_LISTS.vorfaelle]: [
      { id: neueId(), Title: "Fehlversand einer Gehaltsliste per E-Mail", Art: "Datenpanne (DSGVO Art. 33)", Entdeckt: tage(-1), EntdecktUhr: "09:30", Beschreibung: "Eine Gehaltsübersicht wurde an einen falschen internen Verteiler gesendet.", Ursache: "Autovervollständigung im Mailclient.", Betroffene: "Beschäftigte Verwaltung", Anzahl: 24, Datenkategorien: "Entgeltdaten", Risiko: "Mittel", MeldungBehoerde: "Erforderlich", MeldungAm: "", Benachrichtigung: "Erforderlich", Massnahmen: "Nachricht zurückgerufen, Empfänger zur Löschung aufgefordert.", Verantwortlich: "datenschutz@dihag.com", Status: "In Bearbeitung", Abgeschlossen: "", Erinnert: "" },
      { id: neueId(), Title: "Phishing-Welle mit Zugangsdatenabfrage", Art: "Sicherheitsvorfall", Entdeckt: tage(-20), EntdecktUhr: "07:10", Beschreibung: "Gefälschte Anmeldeseite an 40 Beschäftigte versendet.", Ursache: "Externe Kampagne.", Betroffene: "Beschäftigte", Anzahl: 40, Datenkategorien: "Zugangsdaten", Risiko: "Hoch", MeldungBehoerde: "Nicht erforderlich", MeldungAm: "", Benachrichtigung: "Nicht erforderlich", Massnahmen: "Mails entfernt, Kennwörter zurückgesetzt, Awareness-Hinweis versendet.", Verantwortlich: "fedorov@dihag.com", Status: "Abgeschlossen", Abgeschlossen: tage(-14), Erinnert: "" }
    ],
    [CC_LISTS.konfig]: [
      { id: neueId(), Title: "Allgemein", WertJson: JSON.stringify({
          adminEmails: ["fedorov@dihag.com"], auditorEmails: [],
          dsbEmail: "datenschutz@dihag.com", cisoEmail: "fedorov@dihag.com",
          mailSender: "administrator@dihag.com",
          frameworks: ["ISO27001", "DSGVO"], pruefzyklusMonate: 12,
          erinnerungTageVorher: 14, eskalationTageNach: 7, erinnerungenAktiv: true,
          rmsUrl: "https://richtlinienmanagement.dihag-extern.com/",
          organisation: "DIHAG Foundry Group (Demo)"
        }) }
    ]
  };

  // --- Graph-/SharePoint-Ebene ersetzen ------------------------------------
  ensureLogin = async () => ({ name: "Demo-Benutzer", username: "demo@dihag.com" });
  logout = () => location.href = location.pathname;
  getToken = async () => "demo-token";
  getMe = async () => ({ displayName: "Denis Fedorov (Demo)", mail: "fedorov@dihag.com", department: "IT" });
  getSiteId = async () => "demo-site";
  spGetAll = async (liste) => (daten[liste] || []).map(f => ({ id: f.id, fields: f, lastModifiedDateTime: new Date().toISOString() }));
  spCreate = async (liste, felder) => {
    const eintrag = { id: neueId(), ...felder };
    (daten[liste] = daten[liste] || []).push(eintrag);
    return eintrag;
  };
  spUpdate = async (liste, id, felder) => {
    const e = (daten[liste] || []).find(x => x.id === id);
    if (e) Object.assign(e, felder);
    return e;
  };
  spDelete = async (liste, id) => { daten[liste] = (daten[liste] || []).filter(x => x.id !== id); };
  spEnsureList = async () => ({ angelegt: false, spalten: [] });
  spEnsureLibrary = async () => ({ angelegt: false });
  listNachweise = async () => [
    { id: "d1", name: "Nachweis-Screenshot.png", size: 184320, webUrl: "#", geaendert: new Date().toISOString() }
  ];
  uploadNachweis = async () => { toast("Demo-Modus: Datei wurde nicht wirklich hochgeladen."); };
  sendMail = async () => { toast("Demo-Modus: Es wurde keine E-Mail versendet."); };

  // --- Microsoft-365-Signale simulieren ------------------------------------
  const zufall = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  Object.assign(Purview, {
    secureScore: async () => ({
      punkte: 412, max: 620, prozent: 66, datum: new Date().toISOString(),
      lizenzierteNutzer: 340, aktiveNutzer: 318,
      bereiche: [
        { name: "MFA für alle Benutzer aktivieren", kategorie: "Identity", punkte: 0, beschreibung: "Bedingter Zugriff mit MFA für alle Konten." },
        { name: "Legacy-Authentifizierung blockieren", kategorie: "Identity", punkte: 30, beschreibung: "" },
        { name: "Sichere Anlagen aktivieren", kategorie: "Apps", punkte: 20, beschreibung: "" },
        { name: "DLP-Richtlinien einrichten", kategorie: "Data", punkte: 15, beschreibung: "" },
        { name: "Überwachungsprotokollierung aktivieren", kategorie: "Data", punkte: 10, beschreibung: "" },
        { name: "Geräteverschlüsselung erzwingen", kategorie: "Device", punkte: 0, beschreibung: "BitLocker über Intune." }
      ]
    }),
    alerts: async ({ top = 50, nurOffen = false, quelle = null } = {}) => {
      const quellen = ["microsoftDefenderForOffice365", "microsoftDataLossPrevention", "microsoftDefenderForEndpoint", "microsoftDefenderForIdentity"];
      let a = zufall(18, i => ({
        id: "al" + i, titel: ["Verdächtige Anmeldung aus ungewöhnlichem Land", "DLP-Richtlinie „Konstruktionsdaten“ ausgelöst",
          "Schadsoftware auf Endgerät erkannt", "Massenhafter Dateidownload aus SharePoint",
          "Phishing-Mail zugestellt und angeklickt", "Ungewöhnliche Weiterleitungsregel im Postfach"][i % 6],
        schwere: ["high", "medium", "low", "medium"][i % 4],
        status: ["new", "inProgress", "resolved"][i % 3],
        quelle: quellen[i % quellen.length], kategorie: ["InitialAccess", "Exfiltration", "Malware", "Collection"][i % 4],
        erstellt: new Date(Date.now() - i * 7200000).toISOString(),
        aktualisiert: new Date(Date.now() - i * 3600000).toISOString(),
        zugewiesen: i % 3 === 0 ? "fedorov@dihag.com" : "", beschreibung: "Beispielwarnung aus dem Demo-Modus.",
        webUrl: ""
      }));
      if (nurOffen) a = a.filter(x => x.status !== "resolved");
      if (quelle) a = a.filter(x => x.quelle === quelle);
      return a.slice(0, top);
    },
    setzeAlertStatus: async () => { toast("Demo-Modus: Status wurde nicht geändert."); },
    incidents: async () => zufall(6, i => ({
      id: "in" + i, titel: ["Mehrstufiger Angriff auf Benutzerkonto", "Datenabfluss über OneDrive",
        "Malware-Ausbruch Fertigung", "Kompromittierte Identität", "Phishing-Kampagne", "Verdächtige Anmeldeserie"][i],
      status: i % 3 === 0 ? "active" : "resolved", schwere: ["high", "medium", "low"][i % 3],
      erstellt: new Date(Date.now() - i * 86400000).toISOString(), aktualisiert: new Date().toISOString(),
      klassifizierung: i % 2 ? "truePositive" : "unknown", zugewiesen: "", webUrl: ""
    })),
    dlpAlerts: async () => (await Purview.alerts({ top: 50, quelle: "microsoftDataLossPrevention" })),
    sensitivityLabels: async () => [
      { id: "s1", name: "Öffentlich", beschreibung: "Frei verwendbar", aktiv: true, prioritaet: 0, uebergeordnet: "" },
      { id: "s2", name: "Intern", beschreibung: "Nur für Beschäftigte", aktiv: true, prioritaet: 1, uebergeordnet: "" },
      { id: "s3", name: "Vertraulich", beschreibung: "Verschlüsselt, nur benannte Gruppen", aktiv: true, prioritaet: 2, uebergeordnet: "" },
      { id: "s4", name: "Vertraulich \\ Konstruktion", beschreibung: "Prototypenschutz TISAX", aktiv: true, prioritaet: 3, uebergeordnet: "Vertraulich" },
      { id: "s5", name: "Streng vertraulich", beschreibung: "Geschäftsleitung", aktiv: true, prioritaet: 4, uebergeordnet: "" }
    ],
    retentionLabels: async () => [
      { id: "r1", name: "Handelsbrief 6 Jahre", beschreibung: "§ 257 HGB", aktion: "retain", dauer: "6 Jahre", basis: "delete", art: "", istDatensatz: "", erstellt: "" },
      { id: "r2", name: "Buchungsbeleg 10 Jahre", beschreibung: "§ 147 AO", aktion: "retainAsRecord", dauer: "10 Jahre", basis: "startDispositionReview", art: "", istDatensatz: "", erstellt: "" },
      { id: "r3", name: "Personalakte 10 Jahre nach Austritt", beschreibung: "", aktion: "retainAsRecord", dauer: "10 Jahre", basis: "delete", art: "", istDatensatz: "", erstellt: "" },
      { id: "r4", name: "Videodaten 72 Stunden", beschreibung: "Werksüberwachung", aktion: "retain", dauer: "3 Tage", basis: "delete", art: "", istDatensatz: "", erstellt: "" }
    ],
    createRetentionLabel: async () => { toast("Demo-Modus: Bezeichnung wurde nicht angelegt."); },
    ediscoveryCases: async () => [
      { id: "e1", name: "Kündigungsstreit Müller ./. DIHAG", beschreibung: "Beweissicherung Postfach", status: "active", erstellt: new Date(Date.now() - 30 * 86400000).toISOString(), geschlossen: "", geschlossenVon: "" },
      { id: "e2", name: "Verdacht Datenabfluss Konstruktion", beschreibung: "", status: "closed", erstellt: new Date(Date.now() - 200 * 86400000).toISOString(), geschlossen: new Date(Date.now() - 120 * 86400000).toISOString(), geschlossenVon: "Denis Fedorov" }
    ],
    createEdiscoveryCase: async () => { toast("Demo-Modus: Fall wurde nicht angelegt."); },
    subjectRightsRequests: async () => [
      { id: "p1", name: "Auskunftsersuchen Bewerber K.", typ: "export", status: "active", betroffen: "K. Bewerber", email: "bewerber@example.com", erstellt: new Date(Date.now() - 10 * 86400000).toISOString(), faellig: tage(4) + "T12:00:00Z", abgeschlossen: "", regelung: "DSGVO" },
      { id: "p2", name: "Löschersuchen ehem. Mitarbeiter", typ: "delete", status: "closed", betroffen: "M. Ehemalig", email: "", erstellt: new Date(Date.now() - 60 * 86400000).toISOString(), faellig: tage(-25) + "T12:00:00Z", abgeschlossen: new Date(Date.now() - 30 * 86400000).toISOString(), regelung: "DSGVO" }
    ],
    auditQueryStart: async () => ({ id: "q1" }),
    auditQueryStatus: async () => ({ status: "succeeded" }),
    auditQueryRecords: async () => zufall(25, i => ({
      zeit: new Date(Date.now() - i * 5400000).toISOString(),
      benutzer: ["fedorov@dihag.com", "it@dihag.com", "hr@dihag.com"][i % 3],
      operation: ["FileDownloaded", "FileDeleted", "UserLoggedIn", "SharingSet", "MailItemsAccessed"][i % 5],
      dienst: ["SharePoint", "Exchange", "AzureActiveDirectory"][i % 3],
      workload: "", objekt: "/sites/IT/Freigegebene Dokumente/Datei" + i + ".docx",
      ip: "10.10.4." + (10 + i), detail: ""
    })),
    directoryAudits: async () => zufall(20, i => ({
      zeit: new Date(Date.now() - i * 9000000).toISOString(),
      kategorie: ["UserManagement", "GroupManagement", "ApplicationManagement", "Policy"][i % 4],
      aktivitaet: ["Benutzer aktualisiert", "Mitglied zu Gruppe hinzugefügt", "Anwendung registriert", "Richtlinie geändert"][i % 4],
      ergebnis: "success", akteur: ["fedorov@dihag.com", "administrator@dihag.com"][i % 2],
      ziel: "Benutzer " + i
    })),
    conditionalAccessPolicies: async () => [
      { id: "c1", name: "MFA für alle Benutzer", status: "enabled", erstellt: "", geaendert: new Date(Date.now() - 40 * 86400000).toISOString(), kontrollen: "mfa" },
      { id: "c2", name: "Legacy-Authentifizierung blockieren", status: "enabled", erstellt: "", geaendert: new Date(Date.now() - 200 * 86400000).toISOString(), kontrollen: "block" },
      { id: "c3", name: "Konforme Geräte für SharePoint", status: "enabledForReportingButNotEnforced", erstellt: "", geaendert: new Date(Date.now() - 12 * 86400000).toISOString(), kontrollen: "compliantDevice" },
      { id: "c4", name: "Risikoanmeldungen blockieren", status: "disabled", erstellt: "", geaendert: "", kontrollen: "block" }
    ],
    privilegierteRollen: async () => [
      { name: "Globaler Administrator", beschreibung: "", mitglieder: ["administrator@dihag.com", "fedorov@dihag.com"] },
      { name: "Exchange-Administrator", beschreibung: "", mitglieder: ["it@dihag.com"] },
      { name: "Compliance-Administrator", beschreibung: "", mitglieder: ["fedorov@dihag.com", "datenschutz@dihag.com"] },
      { name: "Intune-Administrator", beschreibung: "", mitglieder: ["it@dihag.com"] }
    ],
    benutzerStatistik: async () => ({ gesamt: 348, gaeste: 27, deaktiviert: 41 }),
    geraeteKonformitaet: async () => ({
      gesamt: 212, konform: 197, nichtKonform: 15,
      geraete: zufall(15, i => ({ name: "DIHAG-NB-" + (100 + i), status: "noncompliant",
        os: i % 3 ? "Windows" : "iOS", benutzer: "user" + i + "@dihag.com",
        sync: new Date(Date.now() - i * 86400000).toISOString() }))
    }),
    geraeteRichtlinien: async () => [
      { id: "g1", name: "Windows – Basissicherheit", plattform: "windows10CompliancePolicy", erstellt: "", geaendert: new Date(Date.now() - 60 * 86400000).toISOString(), version: 4 },
      { id: "g2", name: "iOS – Mindestversion und PIN", plattform: "iosCompliancePolicy", erstellt: "", geaendert: new Date(Date.now() - 120 * 86400000).toISOString(), version: 2 },
      { id: "g3", name: "Android – Arbeitsprofil", plattform: "androidWorkProfileCompliancePolicy", erstellt: "", geaendert: "", version: 1 }
    ]
  });

  document.addEventListener("DOMContentLoaded", () => {
    const kopf = document.querySelector(".brand-sub");
    if (kopf) kopf.textContent = "DEMO-MODUS – Beispieldaten, keine Verbindung zu Microsoft 365";
  });
})();
