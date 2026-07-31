"use strict";

// Live-Daten aus Microsoft 365 / Purview über Microsoft Graph.
// Jede Funktion kapselt genau einen Endpunkt inklusive der benötigten
// Berechtigung; fehlt sie, wirft graphFetch einen BerechtigungFehlt-Fehler,
// den die Ansicht als Hinweis darstellt (statt die Seite abstürzen zu lassen).

// Probiert mehrere Endpunkte (v1.0 zuerst, dann beta) – Purview-APIs wandern
// laufend von beta nach v1.0.
async function graphErsterTreffer(varianten) {
  let letzter = null;
  for (const v of varianten) {
    try {
      return await graphFetch(v.path, { version: v.version || "v1.0", scopes: v.scopes });
    } catch (e) {
      if (e.name === "BerechtigungFehlt" || e.status === 401 || e.status === 403) throw e;
      letzter = e;
    }
  }
  throw letzter || new Error("Kein Endpunkt erreichbar.");
}

const Purview = {

  // -------------------------------------------------------- Secure Score ---
  async secureScore() {
    const d = await graphFetch("/security/secureScores?$top=1", { scopes: CC_SCOPES.secureScore });
    const s = (d.value || [])[0];
    if (!s) return null;
    return {
      punkte: s.currentScore,
      max: s.maxScore,
      prozent: s.maxScore ? Math.round(s.currentScore / s.maxScore * 100) : 0,
      datum: s.createdDateTime,
      lizenzierteNutzer: s.licensedUserCount,
      aktiveNutzer: s.activeUserCount,
      bereiche: (s.controlScores || []).map(c => ({
        name: c.controlName, kategorie: c.controlCategory,
        punkte: c.score, beschreibung: c.description
      }))
    };
  },

  async secureScoreProfile() {
    const d = await graphFetch("/security/secureScoreControlProfiles?$top=200", { scopes: CC_SCOPES.secureScore });
    return d.value || [];
  },

  // ------------------------------------------------------------- Warnungen ---
  async alerts({ top = 50, nurOffen = false, quelle = null } = {}) {
    const filter = [];
    if (nurOffen) filter.push("status eq 'new' or status eq 'inProgress'");
    if (quelle) filter.push(`serviceSource eq '${quelle}'`);
    const f = filter.length ? `&$filter=${encodeURIComponent(filter.join(" and "))}` : "";
    const d = await graphFetch(`/security/alerts_v2?$top=${top}${f}`, { scopes: CC_SCOPES.alerts });
    return (d.value || []).map(a => ({
      id: a.id, titel: a.title, schwere: a.severity, status: a.status,
      quelle: a.serviceSource, kategorie: a.category,
      erstellt: a.createdDateTime, aktualisiert: a.lastUpdateDateTime,
      zugewiesen: a.assignedTo, beschreibung: a.description,
      incidentId: a.incidentId, webUrl: a.alertWebUrl
    }));
  },

  async setzeAlertStatus(id, status, klassifizierung) {
    const body = { status };
    if (klassifizierung) body.classification = klassifizierung;
    return graphFetch(`/security/alerts_v2/${id}`, {
      method: "PATCH", body: JSON.stringify(body), scopes: CC_SCOPES.alerts
    });
  },

  async incidents({ top = 25 } = {}) {
    const d = await graphFetch(`/security/incidents?$top=${top}`, { scopes: CC_SCOPES.alerts });
    return (d.value || []).map(i => ({
      id: i.id, titel: i.displayName, status: i.status, schwere: i.severity,
      erstellt: i.createdDateTime, aktualisiert: i.lastUpdateDateTime,
      klassifizierung: i.classification, zugewiesen: i.assignedTo, webUrl: i.incidentWebUrl
    }));
  },

  // DLP-Warnungen sind normale Alerts der Quelle microsoftDataLossPrevention.
  async dlpAlerts({ top = 50 } = {}) {
    return this.alerts({ top, quelle: "microsoftDataLossPrevention" });
  },

  // --------------------------------------------------------------- Labels ---
  async sensitivityLabels() {
    const d = await graphErsterTreffer([
      { path: "/security/informationProtection/sensitivityLabels", scopes: CC_SCOPES.labels },
      { path: "/security/informationProtection/sensitivityLabels", version: "beta", scopes: CC_SCOPES.labels },
      { path: "/me/informationProtection/policy/labels", scopes: CC_SCOPES.labels }
    ]);
    return (d.value || []).map(l => ({
      id: l.id, name: l.name || l.displayName, beschreibung: l.description || l.tooltip,
      aktiv: l.isActive !== false, prioritaet: l.priority !== undefined ? l.priority : l.sensitivity,
      uebergeordnet: l.parent ? (l.parent.name || l.parent.displayName) : ""
    }));
  },

  async retentionLabels() {
    const d = await graphErsterTreffer([
      { path: "/security/labels/retentionLabels?$top=200", scopes: CC_SCOPES.retention },
      { path: "/security/labels/retentionLabels?$top=200", version: "beta", scopes: CC_SCOPES.retention }
    ]);
    return (d.value || []).map(l => ({
      id: l.id, name: l.displayName, beschreibung: l.descriptionForUsers,
      aktion: l.behaviorDuringRetentionPeriod, dauer: beschreibeAufbewahrung(l),
      basis: l.actionAfterRetentionPeriod, art: l.labelToBeApplied,
      istDatensatz: l.retentionTrigger === "dateLabeled" ? "" : l.retentionTrigger,
      erstellt: l.createdDateTime
    }));
  },

  // Aufbewahrungsbezeichnung anlegen (nur wenn Schreibaktionen erlaubt sind).
  async createRetentionLabel({ name, beschreibung, jahre, verhalten = "retain", danach = "none" }) {
    const body = {
      displayName: name,
      descriptionForUsers: beschreibung || "",
      descriptionForAdmins: "Angelegt über das DIHAG Compliance-Cockpit",
      behaviorDuringRetentionPeriod: verhalten,
      actionAfterRetentionPeriod: danach,
      retentionTrigger: "dateLabeled",
      retentionDuration: { "@odata.type": "microsoft.graph.security.retentionDurationInDays", days: Math.round(jahre * 365) },
      isInUse: false
    };
    return graphFetch("/security/labels/retentionLabels", {
      method: "POST", body: JSON.stringify(body), scopes: CC_SCOPES.retention
    });
  },

  // ----------------------------------------------------------- eDiscovery ---
  async ediscoveryCases() {
    const d = await graphErsterTreffer([
      { path: "/security/cases/ediscoveryCases?$top=100", scopes: CC_SCOPES.ediscovery },
      { path: "/security/cases/ediscoveryCases?$top=100", version: "beta", scopes: CC_SCOPES.ediscovery }
    ]);
    return (d.value || []).map(c => ({
      id: c.id, name: c.displayName, beschreibung: c.description, status: c.status,
      erstellt: c.createdDateTime, geschlossen: c.closedDateTime,
      geschlossenVon: c.closedBy && c.closedBy.user ? c.closedBy.user.displayName : ""
    }));
  },

  async createEdiscoveryCase({ name, beschreibung }) {
    return graphFetch("/security/cases/ediscoveryCases", {
      method: "POST",
      body: JSON.stringify({ displayName: name, description: beschreibung || "" }),
      scopes: CC_SCOPES.ediscovery
    });
  },

  // ------------------------------------------- Betroffenenanfragen (DSGVO) ---
  async subjectRightsRequests() {
    const d = await graphErsterTreffer([
      { path: "/privacy/subjectRightsRequests?$top=100", scopes: CC_SCOPES.privacy },
      { path: "/security/subjectRightsRequests?$top=100", version: "beta", scopes: CC_SCOPES.privacy }
    ]);
    return (d.value || []).map(r => ({
      id: r.id, name: r.displayName, typ: r.type, status: r.status,
      betroffen: r.dataSubject ? [r.dataSubject.firstName, r.dataSubject.lastName].filter(Boolean).join(" ") : "",
      email: r.dataSubject ? r.dataSubject.email : "",
      erstellt: r.createdDateTime, faellig: r.dueDateTime, abgeschlossen: r.closedDateTime,
      regelung: r.regulations ? r.regulations.join(", ") : ""
    }));
  },

  // ------------------------------------------------- Überwachungsprotokoll ---
  // Suche im einheitlichen Überwachungsprotokoll. Läuft asynchron: Auftrag
  // anlegen, Status pollen, dann Datensätze abholen.
  async auditQueryStart({ von, bis, benutzer = [], operationen = [], stichwort = "" }) {
    const body = {
      displayName: "Compliance-Cockpit " + new Date().toISOString().slice(0, 19),
      filterStartDateTime: new Date(von + "T00:00:00Z").toISOString(),
      filterEndDateTime: new Date(bis + "T23:59:59Z").toISOString()
    };
    if (benutzer.length) body.userPrincipalNameFilters = benutzer;
    if (operationen.length) body.operationFilters = operationen;
    if (stichwort) body.keywordFilter = stichwort;
    // Die Audit-Such-API liegt je nach Tenant in beta oder bereits in v1.0.
    try {
      const r = await graphFetch("/security/auditLog/queries", {
        method: "POST", body: JSON.stringify(body), version: "beta", scopes: CC_SCOPES.audit
      });
      this._auditVersion = "beta";
      return r;
    } catch (e) {
      if (e.name === "BerechtigungFehlt" || e.status === 401 || e.status === 403) throw e;
      const r = await graphFetch("/security/auditLog/queries", {
        method: "POST", body: JSON.stringify(body), scopes: CC_SCOPES.audit
      });
      this._auditVersion = "v1.0";
      return r;
    }
  },

  _auditVersion: "beta",

  async auditQueryStatus(id) {
    return graphFetch(`/security/auditLog/queries/${id}`, { version: this._auditVersion, scopes: CC_SCOPES.audit });
  },

  async auditQueryRecords(id, top = 100) {
    const d = await graphFetch(`/security/auditLog/queries/${id}/records?$top=${top}`, {
      version: this._auditVersion, scopes: CC_SCOPES.audit
    });
    return (d.value || []).map(r => ({
      zeit: r.createdDateTime, benutzer: r.userPrincipalName, operation: r.operation,
      dienst: r.service, workload: r.auditLogRecordType, objekt: r.objectId,
      ip: r.clientIp, detail: r.auditData
    }));
  },

  // Entra-Verzeichnisprotokoll – ohne asynchrone Suche sofort verfügbar.
  async directoryAudits({ top = 50, filter = "" } = {}) {
    const f = filter ? `&$filter=${encodeURIComponent(filter)}` : "";
    const d = await graphFetch(`/auditLogs/directoryAudits?$top=${top}&$orderby=activityDateTime desc${f}`,
      { scopes: CC_SCOPES.entraAudit });
    return (d.value || []).map(a => ({
      zeit: a.activityDateTime, kategorie: a.category, aktivitaet: a.activityDisplayName,
      ergebnis: a.result, akteur: (a.initiatedBy && (a.initiatedBy.user || a.initiatedBy.app) || {}).userPrincipalName
        || (a.initiatedBy && a.initiatedBy.app ? a.initiatedBy.app.displayName : ""),
      ziel: (a.targetResources || []).map(t => t.displayName || t.userPrincipalName).filter(Boolean).join(", ")
    }));
  },

  // -------------------------------------------------- Identität & Geräte ---
  async conditionalAccessPolicies() {
    const d = await graphFetch("/identity/conditionalAccess/policies?$top=100", { scopes: CC_SCOPES.richtlinien });
    return (d.value || []).map(p => ({
      id: p.id, name: p.displayName, status: p.state,
      erstellt: p.createdDateTime, geaendert: p.modifiedDateTime,
      kontrollen: [
        ...((p.grantControls && p.grantControls.builtInControls) || []),
        ...(p.sessionControls ? Object.keys(p.sessionControls).filter(k => p.sessionControls[k]) : [])
      ].join(", ")
    }));
  },

  async privilegierteRollen() {
    const rollen = await graphFetch("/directoryRoles?$expand=members($select=displayName,userPrincipalName)",
      { scopes: CC_SCOPES.rollen });
    return (rollen.value || [])
      .map(r => ({
        name: r.displayName,
        beschreibung: r.description,
        mitglieder: (r.members || []).map(m => m.userPrincipalName || m.displayName).filter(Boolean)
      }))
      .filter(r => r.mitglieder.length)
      .sort((a, b) => b.mitglieder.length - a.mitglieder.length);
  },

  async benutzerStatistik() {
    const d = await graphFetch("/users?$select=userType,accountEnabled,userPrincipalName&$top=999",
      { scopes: CC_SCOPES.verzeichnis });
    const alle = d.value || [];
    return {
      gesamt: alle.length,
      gaeste: alle.filter(u => u.userType === "Guest").length,
      deaktiviert: alle.filter(u => u.accountEnabled === false).length
    };
  },

  async geraeteKonformitaet() {
    const d = await graphFetch("/deviceManagement/managedDevices?$select=deviceName,complianceState,operatingSystem,userPrincipalName,lastSyncDateTime&$top=500",
      { scopes: CC_SCOPES.geraete });
    const geraete = (d.value || []).map(g => ({
      name: g.deviceName, status: g.complianceState, os: g.operatingSystem,
      benutzer: g.userPrincipalName, sync: g.lastSyncDateTime
    }));
    return {
      geraete,
      gesamt: geraete.length,
      konform: geraete.filter(g => g.status === "compliant").length,
      nichtKonform: geraete.filter(g => g.status === "noncompliant").length
    };
  },

  async geraeteRichtlinien() {
    const d = await graphFetch("/deviceManagement/deviceCompliancePolicies?$top=100", { scopes: CC_SCOPES.geraete });
    return (d.value || []).map(p => ({
      id: p.id, name: p.displayName, plattform: (p["@odata.type"] || "").split(".").pop(),
      erstellt: p.createdDateTime, geaendert: p.lastModifiedDateTime, version: p.version
    }));
  }
};

function beschreibeAufbewahrung(l) {
  const d = l.retentionDuration || {};
  if (d.days) return `${d.days} Tage`;
  if (d.months) return `${d.months} Monate`;
  if (d.years) return `${d.years} Jahre`;
  return d["@odata.type"] && d["@odata.type"].includes("Forever") ? "unbegrenzt" : "";
}

// ---------------------------------------------------------------------------
// Signale: Verbindung zwischen einem Control und einem Live-Wert aus M365.
// Wird in der Control-Detailansicht als „Auto-Nachweis" gezogen.
// ---------------------------------------------------------------------------

const CC_SIGNALE = {
  secureScore: { label: CC_SIGNAL_LABELS.secureScore, laden: async () => {
      const s = await Purview.secureScore();
      return s ? { text: `Secure Score ${s.punkte}/${s.max} (${s.prozent} %), Stand ${fmtDatum(s.datum)}`, daten: s } : null;
    } },
  alerts: { label: CC_SIGNAL_LABELS.alerts, laden: async () => {
      const a = await Purview.alerts({ top: 100, nurOffen: true });
      return { text: `${a.length} offene Sicherheitswarnungen, davon ${a.filter(x => x.schwere === "high").length} mit hoher Schwere`, daten: a };
    } },
  incidents: { label: CC_SIGNAL_LABELS.incidents, laden: async () => {
      const i = await Purview.incidents({ top: 50 });
      const offen = i.filter(x => x.status !== "resolved");
      return { text: `${offen.length} offene Vorfälle (von ${i.length} zuletzt gemeldeten)`, daten: i };
    } },
  dlp: { label: CC_SIGNAL_LABELS.dlp, laden: async () => {
      const a = await Purview.dlpAlerts({ top: 100 });
      return { text: `${a.length} DLP-Warnungen in Microsoft Purview`, daten: a };
    } },
  labels: { label: CC_SIGNAL_LABELS.labels, laden: async () => {
      const l = await Purview.sensitivityLabels();
      return { text: `${l.length} Vertraulichkeitsbezeichnungen veröffentlicht: ${l.slice(0, 6).map(x => x.name).join(", ")}`, daten: l };
    } },
  retention: { label: CC_SIGNAL_LABELS.retention, laden: async () => {
      const l = await Purview.retentionLabels();
      return { text: `${l.length} Aufbewahrungsbezeichnungen definiert`, daten: l };
    } },
  audit: { label: CC_SIGNAL_LABELS.audit, laden: async () => {
      const a = await Purview.directoryAudits({ top: 20 });
      return { text: `Protokollierung aktiv – ${a.length} Verzeichnisereignisse zuletzt abgerufen`, daten: a };
    } },
  ca: { label: CC_SIGNAL_LABELS.ca, laden: async () => {
      const p = await Purview.conditionalAccessPolicies();
      const aktiv = p.filter(x => x.status === "enabled");
      return { text: `${aktiv.length} aktive Richtlinien für bedingten Zugriff (von ${p.length})`, daten: p };
    } },
  benutzer: { label: CC_SIGNAL_LABELS.benutzer, laden: async () => {
      const s = await Purview.benutzerStatistik();
      return { text: `${s.gesamt} Konten, davon ${s.gaeste} Gäste und ${s.deaktiviert} deaktiviert`, daten: s };
    } },
  rollen: { label: CC_SIGNAL_LABELS.rollen, laden: async () => {
      const r = await Purview.privilegierteRollen();
      const ga = r.find(x => x.name === "Globaler Administrator" || x.name === "Global Administrator");
      return { text: `${r.length} besetzte Verzeichnisrollen` + (ga ? `, ${ga.mitglieder.length} globale Administratoren` : ""), daten: r };
    } },
  geraete: { label: CC_SIGNAL_LABELS.geraete, laden: async () => {
      const g = await Purview.geraeteKonformitaet();
      return { text: `${g.konform}/${g.gesamt} verwaltete Geräte konform, ${g.nichtKonform} nicht konform`, daten: g };
    } },
  geraetepolicies: { label: CC_SIGNAL_LABELS.geraetepolicies, laden: async () => {
      const p = await Purview.geraeteRichtlinien();
      return { text: `${p.length} Gerätekonformitätsrichtlinien in Intune`, daten: p };
    } },
  ediscovery: { label: CC_SIGNAL_LABELS.ediscovery, laden: async () => {
      const c = await Purview.ediscoveryCases();
      return { text: `${c.filter(x => x.status !== "closed").length} aktive eDiscovery-Fälle (von ${c.length})`, daten: c };
    } },
  srr: { label: CC_SIGNAL_LABELS.srr, laden: async () => {
      const r = await Purview.subjectRightsRequests();
      return { text: `${r.filter(x => x.status !== "closed").length} offene Betroffenenanfragen (von ${r.length})`, daten: r };
    } },

  // Signale aus der eigenen Governance-Schicht
  vvt: { label: CC_SIGNAL_LABELS.vvt, laden: async () => {
      const v = await Store.load("vvt");
      return { text: `${v.length} Verarbeitungstätigkeiten, davon ${v.filter(x => x.Status === "Freigegeben").length} freigegeben`, daten: v };
    } },
  tom: { label: CC_SIGNAL_LABELS.tom, laden: async () => {
      const t = await Store.load("tom");
      return { text: `${t.filter(x => x.Status === "Umgesetzt").length}/${t.length} TOM umgesetzt`, daten: t };
    } },
  avv: { label: CC_SIGNAL_LABELS.avv, laden: async () => {
      const a = await Store.load("avv");
      return { text: `${a.length} Dienstleister erfasst, davon ${a.filter(x => x.Status === "Aktiv").length} aktiv`, daten: a };
    } },
  vorfaelle: { label: CC_SIGNAL_LABELS.vorfaelle, laden: async () => {
      const v = await Store.load("vorfaelle");
      return { text: `${v.filter(x => x.Status !== "Abgeschlossen").length} offene Vorfälle (von ${v.length} insgesamt)`, daten: v };
    } },
  risiken: { label: CC_SIGNAL_LABELS.risiken, laden: async () => {
      const r = await Store.load("risiken");
      return { text: `${r.length} Risiken bewertet, ${r.filter(x => Number(x.Bewertung) >= 15).length} mit hohem Risikowert`, daten: r };
    } },
  rms: { label: CC_SIGNAL_LABELS.rms, laden: async () => {
      return { text: "Richtlinien und Schulungsnachweise werden im Richtlinienmanagementsystem geführt.",
               link: (Store.konfig && Store.konfig.rmsUrl) || "" };
    } }
};
