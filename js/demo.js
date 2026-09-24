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
  const daten = {
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
    [CC_LISTS.anfragen]: [
      berechneAnfrage({ id: neueId(), Title: "BA-2026-0904-0915", Art: "Auskunft (Art. 15)", Eingang: tage(-20), Kanal: "E-Mail",
        PersonName: "K. Bewerberin", PersonKontakt: "k.bewerberin@example.com", Personengruppe: "Bewerber",
        Anliegen: "Auskunft über alle im Bewerbungsverfahren gespeicherten Daten.", Identitaet: "Geprüft",
        IdentitaetNachweis: "Abgleich mit Bewerbungsunterlagen", Verlaengert: "Nein", Systeme: "", EdiscoveryFall: "",
        Ergebnis: "Offen", Begruendung: "", Beantwortet: "", Verantwortlich: "datenschutz@dihag.com", Status: "In Bearbeitung", Erinnert: "" }),
      berechneAnfrage({ id: neueId(), Title: "BA-2026-0828-1402", Art: "Löschung (Art. 17)", Eingang: tage(-27), Kanal: "Brief",
        PersonName: "M. Ehemalig", PersonKontakt: "Musterstraße 1, 12345 Musterstadt", Personengruppe: "Ehemalige Beschäftigte",
        Anliegen: "Löschung aller Daten nach Austritt.", Identitaet: "Offen", IdentitaetNachweis: "", Verlaengert: "Nein",
        Systeme: "", EdiscoveryFall: "", Ergebnis: "Offen", Begruendung: "", Beantwortet: "",
        Verantwortlich: "fedorov@dihag.com", Status: "Identität prüfen", Erinnert: "" }),
      berechneAnfrage({ id: neueId(), Title: "BA-2026-0815-0830", Art: "Auskunft (Art. 15)", Eingang: tage(-40), Kanal: "E-Mail",
        PersonName: "S. Beschäftigter", PersonKontakt: "s.beschaeftigter@dihag.com", Personengruppe: "Beschäftigte",
        Anliegen: "Vollständige Auskunft inkl. Kopie aller E-Mails, in denen er genannt wird.", Identitaet: "Geprüft",
        IdentitaetNachweis: "Persönlich bekannt", Verlaengert: "Ja", VerlaengerungGrund: "des Umfangs der zu sichtenden E-Mail-Postfächer",
        Systeme: "Personalverwaltung (SAP HCM, Microsoft 365)", EdiscoveryFall: "BA-2026-0815-0830 Betroffenenanfrage (demo)",
        Ergebnis: "Offen", Begruendung: "", Beantwortet: "", Verantwortlich: "datenschutz@dihag.com", Status: "In Bearbeitung", Erinnert: "" }),
      berechneAnfrage({ id: neueId(), Title: "BA-2026-0610-1100", Art: "Widerspruch (Art. 21)", Eingang: tage(-105), Kanal: "Webformular",
        PersonName: "Kunde GmbH, Hr. Beispiel", PersonKontakt: "einkauf@kunde.example", Personengruppe: "Kunden",
        Anliegen: "Widerspruch gegen Newsletter-Versand.", Identitaet: "Geprüft", IdentitaetNachweis: "Absenderadresse bekannt",
        Verlaengert: "Nein", Systeme: "CRM", EdiscoveryFall: "", Ergebnis: "Vollständig erfüllt", Begruendung: "",
        Beantwortet: tage(-98), Verantwortlich: "datenschutz@dihag.com", Status: "Abgeschlossen", Erinnert: "" })
    ],
    [CC_LISTS.nachweise]: [
      { id: neueId(), Title: "A.8.5", Bezeichnung: "Sichere Authentifizierung", Signal: CC_SIGNAL_LABELS.ca,
        Wert: "2 aktive Richtlinien für bedingten Zugriff (von 4)", Stand: tage(-40), Zeit: tage(-40) + "T09:00:00Z", ErfasstVon: "fedorov@dihag.com" },
      { id: neueId(), Title: "A.8.12", Bezeichnung: "Verhinderung von Datenlecks", Signal: CC_SIGNAL_LABELS.dlp,
        Wert: "5 DLP-Warnungen in Microsoft Purview", Stand: tage(-12), Zeit: tage(-12) + "T09:00:00Z", ErfasstVon: "fedorov@dihag.com" },
      { id: neueId(), Title: "A.5.12", Bezeichnung: "Klassifizierung von Informationen", Signal: CC_SIGNAL_LABELS.labels,
        Wert: "5 Vertraulichkeitsbezeichnungen veröffentlicht: Öffentlich, Intern, Vertraulich, Vertraulich \\ Konstruktion, Streng vertraulich",
        Stand: tage(-120), Zeit: tage(-120) + "T09:00:00Z", ErfasstVon: "fedorov@dihag.com" }
    ],
    [CC_LISTS.konfig]: [
      { id: neueId(), Title: "Allgemein", WertJson: JSON.stringify({
          adminEmails: ["fedorov@dihag.com"], auditorEmails: [],
          dsbEmail: "datenschutz@dihag.com", cisoEmail: "fedorov@dihag.com",
          mailSender: "administrator@dihag.com",
          erinnerungTageVorher: 14, eskalationTageNach: 7, erinnerungenAktiv: true,
          rmsUrl: "https://rms.dihag.de/",
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
  Store.personen = async () => [
    { name: "Datenschutz DIHAG", mail: "datenschutz@dihag.com" },
    { name: "Denis Fedorov", mail: "fedorov@dihag.com" },
    { name: "IT-Service", mail: "it@dihag.com" },
    { name: "Personalabteilung", mail: "hr@dihag.com" },
    { name: "Werkschutz", mail: "werkschutz@dihag.com" }
  ];

  // --- RMS nachbilden (SoA, Risiken, Wirksamkeit) --------------------------
  const soaDemo = { controls: {}, meta: {} };
  CC_ANNEX_A.forEach((c, i) => {
    if (i % 9 === 4) return;                                   // noch nicht entschieden
    if (i % 17 === 3) { soaDemo.controls[c.id] = { anwendbar: false, begruendung: i % 2 ? "Keine eigene Softwareentwicklung." : "", status: "" }; return; }
    soaDemo.controls[c.id] = { anwendbar: true, begruendung: "", status: i % 5 === 0 ? "teilweise umgesetzt" : i % 7 === 0 ? "geplant" : "umgesetzt" };
  });
  const risikenDemo = [
    { id: "r1", titel: "Ransomware-Angriff auf Produktionsnetz", beschreibung: "Verschlüsselung der Fertigungssteuerung.", kategorie: "Technik / IT",
      eigner: "fedorov@dihag.com", wert: 15, status: "in Behandlung", naechsteReview: tage(12),
      massnahmen: [{ titel: "Segmentierung OT-Netz", verantwortlich: "it@dihag.com", frist: tage(-3), status: "in Umsetzung" },
                   { titel: "Wiederherstellungstest Backup", verantwortlich: "it@dihag.com", frist: tage(20), status: "offen" }],
      controls: ["A.8.7", "A.8.13", "A.8.22"] },
    { id: "r2", titel: "Abfluss von Konstruktionsdaten über Cloud-Speicher", beschreibung: "CAD-Daten in privaten Diensten.", kategorie: "Technik / IT",
      eigner: "it@dihag.com", wert: 12, status: "in Behandlung", naechsteReview: tage(40),
      massnahmen: [{ titel: "DLP-Regel für CAD-Dateien", verantwortlich: "fedorov@dihag.com", frist: tage(9), status: "offen" }],
      controls: ["A.8.12", "A.5.12"] },
    { id: "r3", titel: "Ausfall Lohnabrechnungsdienstleister", beschreibung: "", kategorie: "Lieferanten / Dienstleister",
      eigner: "hr@dihag.com", wert: 8, status: "offen", naechsteReview: tage(-5), massnahmen: [], controls: ["A.5.19"] },
    { id: "r4", titel: "Fehlende MFA bei Dienstkonten", beschreibung: "", kategorie: "Technik / IT",
      eigner: "fedorov@dihag.com", wert: 16, status: "offen", naechsteReview: tage(25),
      massnahmen: [{ titel: "Dienstkonten auf verwaltete Identitäten umstellen", verantwortlich: "fedorov@dihag.com", frist: tage(30), status: "offen" }],
      controls: ["A.8.5"] }
  ];
  const wirkDemo = [
    { id: "w1", titel: "Audit-Feststellung: Berechtigungsreview fehlt", art: "abweichung", status: "in Umsetzung", quelle: "Internes Audit",
      herkunftId: "", verantwortlich: "it@dihag.com",
      massnahmen: [{ titel: "Quartalsreview einführen", verantwortlich: "it@dihag.com", frist: tage(-10), status: "in Umsetzung" }] },
    { id: "w2", titel: "Warnung: Verdächtige Anmeldung aus ungewöhnlichem Land", art: "abweichung", status: "offen", quelle: CC_RMS.quelle,
      herkunftId: "m365:al0", verantwortlich: "fedorov@dihag.com",
      massnahmen: [{ titel: "Konto sperren und Kennwort zurücksetzen", verantwortlich: "fedorov@dihag.com", frist: tage(2), status: "offen" }] }
  ];
  Object.assign(Rms, {
    soa: async () => soaDemo,
    risiken: async () => risikenDemo,
    wirksamkeit: async () => wirkDemo,
    abweichungAnlegen: async ({ titel, herkunftId, massnahme, verantwortlich, frist }) => {
      const id = "w" + (wirkDemo.length + 1);
      wirkDemo.push({ id, titel, art: "abweichung", status: "offen", quelle: CC_RMS.quelle, herkunftId, verantwortlich,
        massnahmen: [{ titel: massnahme, verantwortlich, frist, status: "offen" }] });
      toast("Demo-Modus: Die Abweichung wurde nicht wirklich im RMS angelegt.");
      return { id };
    }
  });

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
    createEdiscoveryCase: async ({ name }) => {
      toast("Demo-Modus: Der Fall wurde nicht wirklich angelegt.");
      return { id: "demo-" + Date.now(), displayName: name };
    },
    subjectRightsRequests: async () => [
      { id: "p1", name: "Auskunftsersuchen Bewerber K.", typ: "export", status: "active", betroffen: "K. Bewerber", email: "bewerber@example.com", erstellt: new Date(Date.now() - 10 * 86400000).toISOString(), faellig: tage(4) + "T12:00:00Z", abgeschlossen: "", regelung: "DSGVO" },
      { id: "p2", name: "Löschersuchen ehem. Mitarbeiter", typ: "delete", status: "closed", betroffen: "M. Ehemalig", email: "", erstellt: new Date(Date.now() - 60 * 86400000).toISOString(), faellig: tage(-25) + "T12:00:00Z", abgeschlossen: new Date(Date.now() - 30 * 86400000).toISOString(), regelung: "DSGVO" }
    ],
    auditQueryStart: async () => ({ id: "q1" }),
    auditQueryListe: async () => ({ value: [] }),
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
    lizenzen: async () => ({ skus: ["SPE_E3"], informationProtection: ["RMS_S_ENTERPRISE", "MIP_S_CLP1"], priva: [] }),
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
