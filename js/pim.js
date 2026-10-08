"use strict";

// Privileged Identity Management (PIM) nach Anlage 3 der KBV
// („Rollen- und Berechtigungskonzept“). Diese Datei enthält
//   * den Rollenkatalog der Anlage 3 (zugelassene Rollen, PIM-Pflicht, Höchstzahlen),
//   * das Lesen und Schreiben über die PIM-Schnittstellen von Microsoft Graph,
//   * die Prüfung des Ist-Stands gegen die Anlage (bewerteAnlage3).
// Die Ansichten dazu stehen in rollen.js.

// Rollenkatalog, Anlage 3 Abschnitt 3. id = Template-ID der Entra-Rolle (bei
// eingebauten Rollen identisch mit der roleDefinitionId der Zuweisungen).
// p: personenbezogene Zuweisung grundsätzlich über PIM. max: Höchstzahl
// gleichzeitig aktiver personenbezogener Rolleninhaber. audit: Rolle mit Zugriff
// auf Audit-, Sicherheits- oder Protokolldaten (für die Übersicht nach § 9).
const CC_ANLAGE3_ROLLEN = [
  { id: "e8611ab8-c189-46e8-94e1-60213ab1f814", kat: "Global", name: "Administrator für privilegierte Rollen", p: true, max: 4 },
  { id: "8329153b-31d0-4727-b945-745eb3bc5f31", kat: "Global", name: "Domänennamenadministrator", p: true, max: 4 },
  { id: "62e90394-69f5-4237-9190-012177145e10", kat: "Global", name: "Globaler Administrator", p: true, max: 4, audit: true },
  { id: "f2ef992c-3afb-46b9-b7cf-a126ee74c451", kat: "Global", name: "Globaler Leser", p: true, max: 20, audit: true },
  { id: "fdd7a751-b60b-444a-984c-02652fe8fa1c", kat: "Global", name: "Gruppenadministrator", p: true, max: 8 },
  { id: "c430b396-e693-46cc-96f3-db01bf8bb62a", kat: "Security", name: "Administrator für Angriffssimulation", p: true, max: 4 },
  { id: "b1be1c3e-b65d-4f19-8427-f6fa0d97feb9", kat: "Security", name: "Administrator für bedingten Zugriff", p: true, max: 5 },
  { id: "4a5d8f65-41da-4de4-8968-e035b65339cf", kat: "Security", name: "Berichtleseberechtigter", p: false, max: 12, audit: true },
  { id: "194ae4cb-b126-40b2-bd5b-6091b380977d", kat: "Security", name: "Sicherheitsadministrator", p: true, max: 6, audit: true },
  { id: "5d6b6bb7-de71-4623-b4af-96380a352509", kat: "Security", name: "Sicherheitsleseberechtigter", p: true, max: 12, audit: true },
  { id: "17315797-102d-40b4-93e0-432062caca18", kat: "Compliance", name: "Complianceadministrator", p: true, max: 6, audit: true },
  { id: "c4e39bd9-1100-46d3-8c65-fb160da0071f", kat: "Authentication", name: "Authentifizierungsadministrator", p: true, max: 8 },
  { id: "fe930be7-5e62-47db-91af-98c3a49a38b1", kat: "Authentication", name: "Benutzeradministrator", p: true, max: 8 },
  { id: "8ac3fc64-6eca-42ea-9e69-59f4c7b60eb2", kat: "Authentication", name: "Hybrididentitätsadministrator", p: true, max: 4 },
  { id: "7be44c8a-adaf-4e2a-84d6-ab2649e08a13", kat: "Authentication", name: "Privilegierter Authentifizierungsadministrator", p: true, max: 4 },
  { id: "b0f54661-2d74-4c50-afa3-1ec803f12efe", kat: "Billing", name: "Abrechnungsadministrator", p: false, max: 4 },
  { id: "4d6ac14f-3453-41d0-bef9-a3e0c569773a", kat: "Billing", name: "Lizenzadministrator", p: false, max: 8 },
  { id: "2b745bdf-0803-4d80-aa65-822c4493daac", kat: "Application", name: "Administrator für Office-Apps", p: false, max: 6 },
  { id: "9b895d92-2cd3-44c7-9d02-a6ac2d5ea5c3", kat: "Application", name: "Anwendungsadministrator", p: true, max: 6 },
  { id: "158c047a-c907-4556-b7ef-446551a6b5f7", kat: "Application", name: "Cloudanwendungsadministrator", p: true, max: 6 },
  { id: "7698a772-787b-4ac8-901f-60d6b08affd2", kat: "Application", name: "Cloudgeräteadministrator", p: true, max: 6 },
  { id: "44367163-eba1-44c3-98af-f5787879f96a", kat: "Application", name: "Dynamics-365-Administrator", p: true, max: 4 },
  { id: "29232cdf-9323-42fd-ade2-1d097af3e4de", kat: "Application", name: "Exchange-Administrator", p: true, max: 6 },
  { id: "a9ea8996-122f-4c74-9520-8edcd192826c", kat: "Application", name: "Fabric-Administrator", p: true, max: 4 },
  { id: "95e79109-95c0-4d8e-aee3-d01accf2d47b", kat: "Application", name: "Gasteinladender", p: false, max: 12 },
  { id: "3a2c62db-5318-420d-8d74-23affee5d9d5", kat: "Application", name: "Intune-Administrator", p: true, max: 6 },
  { id: "d37c8bed-0711-4417-ba38-b4abe66ce4c2", kat: "Application", name: "Netzwerkadministrator", p: false, max: 4 },
  { id: "11648597-926c-4cf3-9c36-bcebb0ba8dcc", kat: "Application", name: "Power-Platform-Administrator", p: true, max: 6 },
  { id: "f28a1f50-f6e7-4571-818b-6a12f2af6b6c", kat: "Application", name: "SharePoint-Administrator", p: true, max: 6 },
  { id: "69091246-20e8-4a56-aa4d-066075b2a7a8", kat: "Application", name: "Teams-Administrator", p: true, max: 6 },
  { id: "baf37b3a-610e-45da-9e62-d9d1e5e8914b", kat: "Application", name: "Teams-Kommunikationsadministrator", p: true, max: 4 },
  { id: "88d8e3e3-8f55-4a1e-953a-9b9898b8876b", kat: "Application", name: "Verzeichnisleseberechtigter", p: false, max: 20 },
  { id: "9360feb5-f418-4baa-8175-e2a00bac4301", kat: "Application", name: "Verzeichnisschreibberechtigter", p: true, max: 0, nurTechnisch: true },
  { id: "11451d60-acb2-45eb-a7d6-43d0f0125c13", kat: "Application", name: "Windows-365-Administrator", p: true, max: 4 },
  { id: "810a2642-a034-447f-a5e8-41beaa378541", kat: "Application", name: "Viva-Engage-Administrator", p: true, max: 4 },
  { id: "f023fd81-a637-4b56-95fd-791ac0226033", kat: "Helpdesk", name: "Dienstsupportadministrator", p: false, max: 8 },
  { id: "729827e3-9c14-49f7-bb1b-9608f156bbb8", kat: "Helpdesk", name: "Helpdeskadministrator", p: true, max: 12 },
  { id: "966707d0-3269-4727-9be2-8c3a10f19b9d", kat: "Helpdesk", name: "Kennwortadministrator", p: true, max: 12 },
  { id: "f70938a0-fc10-4177-9e90-2178f8765737", kat: "Helpdesk", name: "Supporttechniker für Teams-Kommunikation", p: false, max: 8 },
  { id: "fcf91098-03e3-41a9-b5ba-6f0ec8188a12", kat: "Helpdesk", name: "Supportspezialist für Teams-Kommunikation", p: false, max: 12 }
];

const CC_ROLLE_GA = "62e90394-69f5-4237-9190-012177145e10";

// Die Purview-Rollen der Anlage sind Rollengruppen im Purview-Portal und über
// Graph nicht lesbar. Sie werden im Rollenregister von Hand geführt.
const CC_ANLAGE3_PURVIEW = [
  { name: "Überwachungsleser (Audit Reader)", p: false, max: 8 },
  { name: "Überwachungs-Manager (Audit Manager)", p: true, max: 4 }
];

// Zulässige Zwecke für Zugriffe auf Audit- und Protokolldaten (Anlage 3 § 8).
// Bei Aktivierungen über das Cockpit steht der Zweck in eckigen Klammern vor
// der Begründung; daraus entsteht die Zweckstatistik für den KBR (§ 9).
const CC_PIM_ZWECKE = [
  "Aufrechterhaltung der IT-Sicherheit",
  "Erkennung und Bearbeitung von Sicherheitsvorfällen",
  "Administration und technischer Support",
  "Fehleranalyse und Fehlerbehebung",
  "Wiederherstellung von Systemen und Daten",
  "Prüfung von Berechtigungen",
  "Datenschutz- und Compliancekontrollen",
  "Revision",
  "Erfüllung gesetzlicher oder behördlicher Pflichten",
  "Zulässige Beweissicherung"
];
const CC_ZWECK_OHNE = "nicht zugeordnet";

// Hausstandard für die Aktivierungsregeln. Die Anlage lässt offen, welche
// Bedingungen gelten („kann abhängig gemacht werden“); das hier ist der
// Vorschlag, in der Ansicht „Aktivierungsregeln“ änderbar.
const CC_PIM_STANDARD = {
  dauer: 8,                 // Stunden, höchstens 24
  dauerKritisch: 4,
  mfa: true,
  begruendung: true,
  ticket: false,
  genehmigungKritisch: true,
  genehmiger: [],           // E-Mail-Adressen
  benachrichtigung: [],     // zusätzliche Empfänger bei jeder Aktivierung
  kritisch: [
    "62e90394-69f5-4237-9190-012177145e10",   // Globaler Administrator
    "e8611ab8-c189-46e8-94e1-60213ab1f814",   // Administrator für privilegierte Rollen
    "7be44c8a-adaf-4e2a-84d6-ab2649e08a13",   // Privilegierter Authentifizierungsadministrator
    "b1be1c3e-b65d-4f19-8427-f6fa0d97feb9"    // Administrator für bedingten Zugriff
  ]
};

const CC_PIM_PORTAL = {
  meine: "https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ActivationMenuBlade/~/aadmigratedroles",
  genehmigen: "https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ApproveRequestMenuBlade/~/aadmigratedroles",
  rollen: "https://portal.azure.com/#view/Microsoft_Azure_PIMCommon/ResourceMenuBlade/~/roles/resourceId//resourceType/tenant/provider/aadroles",
  pruefungen: "https://portal.azure.com/#view/Microsoft_AAD_ERM/DashboardBlade/~/Controls"
};

function anlage3Rolle(id) {
  return CC_ANLAGE3_ROLLEN.find(r => r.id === id) || null;
}

// Einstellungen zur Anlage 3 mit Standardwerten (Konfiguration „pim“).
function pimKonfig() {
  const k = (Store.konfig && Store.konfig.pim) || {};
  const klein = a => (a || []).map(x => String(x).trim().toLowerCase()).filter(Boolean);
  return {
    notfallkonten: klein(k.notfallkonten),
    adminKennzeichen: klein(k.adminKennzeichen),
    externeDomains: klein(k.externeDomains).map(d => d.replace(/^@/, "")),
    verantwortlich: String(k.verantwortlich || (Store.konfig && Store.konfig.cisoEmail) || "").toLowerCase(),
    notfallGeprueft: k.notfallGeprueft || "",
    notfallIntervall: Number(k.notfallIntervall) || 90,
    standard: Object.assign({}, CC_PIM_STANDARD, k.standard || {})
  };
}

// Zweck aus einer PIM-Begründung: zuerst „[Zweck] …“, sonst Stichworte.
function zweckAus(begruendung) {
  const t = String(begruendung || "").trim();
  const m = t.match(/^\[([^\]]+)\]/);
  if (m) {
    const z = CC_PIM_ZWECKE.find(x => x.toLowerCase() === m[1].trim().toLowerCase());
    if (z) return z;
  }
  const s = t.toLowerCase();
  const stichworte = [
    [/vorfall|incident|angriff|phishing|kompromitt/, 1],
    [/wiederherstell|restore|backup/, 4],
    [/fehler|störung|stoerung|problem/, 3],
    [/berechtigung|access review|rezertifiz/, 5],
    [/datenschutz|compliance|dsgvo/, 6],
    [/revision|audit/, 7],
    [/behörd|behoerd|gesetz|gericht/, 8],
    [/beweis|ediscovery|sicherung von/, 9],
    [/support|administration|einricht|konfigur|änderung|aenderung/, 2],
    [/sicherheit|security/, 0]
  ];
  const treffer = stichworte.find(([re]) => re.test(s));
  return treffer ? CC_PIM_ZWECKE[treffer[1]] : CC_ZWECK_OHNE;
}

// ISO-8601-Dauer (PT8H, PT1H30M, P1D) in Stunden.
function dauerStunden(iso) {
  const m = String(iso || "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return null;
  return (Number(m[1] || 0) * 24) + Number(m[2] || 0) + Number(m[3] || 0) / 60;
}

function dauerText(iso) {
  const h = dauerStunden(iso);
  if (h === null) return iso || "";
  if (h >= 24 && h % 24 === 0) return (h / 24) + (h === 24 ? " Tag" : " Tage");
  return (Math.round(h * 10) / 10).toString().replace(".", ",") + " h";
}

function istTechnisch(kontoart) { return kontoart === "Technisch"; }
function istPersonenbezogen(kontoart) { return kontoart === "Person" || kontoart === "Extern"; }

// ---------------------------------------------------------------------------
// Graph-Zugriffe
// ---------------------------------------------------------------------------

const Pim = {
  _stand: null,
  _regeln: null,
  _ich: null,

  invalidate() { this._stand = null; this._regeln = null; },

  async ich() {
    if (!this._ich) this._ich = await graphFetch("/me?$select=id,userPrincipalName,displayName");
    return this._ich;
  },

  // Namen aller Rollendefinitionen (eingebaut und eigene), id → displayName.
  async definitionen() {
    const d = await graphFetchAll("/roleManagement/directory/roleDefinitions?$select=id,displayName,templateId,isBuiltIn",
      { scopes: CC_SCOPES.rollen }, 2000);
    const out = {};
    d.forEach(r => { out[r.id] = r.displayName; if (r.templateId) out[r.templateId] = r.displayName; });
    return out;
  },

  // Zuweisungsinstanzen mit Prinzipal. Erst mit $expand, sonst ohne.
  async _instanzen(pfad) {
    try {
      return await graphFetchAll(pfad + "?$expand=principal", { scopes: CC_SCOPES.rollen }, 5000);
    } catch (e) {
      if (e.name === "BerechtigungFehlt" || e.status === 401 || e.status === 403) throw e;
      if (/licen|premium|P2/i.test(e.message || "")) throw e;
      return graphFetchAll(pfad, { scopes: CC_SCOPES.rollen }, 5000);
    }
  },

  // Der vollständige Ist-Stand: berechtigte und aktive Zuweisungen, Benutzerdaten,
  // aufgelöste Gruppen. pimVerfuegbar=false heißt: ohne PIM-Lizenz nur die
  // aktiven Zuweisungen aus der klassischen Schnittstelle.
  async lade(force = false) {
    if (!force && this._stand && Date.now() - this._stand.zeit < 120000) return this._stand;
    const hinweise = [];
    let pimVerfuegbar = true, aktiv = [], berechtigt = [];
    try {
      [aktiv, berechtigt] = await Promise.all([
        this._instanzen("/roleManagement/directory/roleAssignmentScheduleInstances"),
        this._instanzen("/roleManagement/directory/roleEligibilityScheduleInstances")
      ]);
    } catch (e) {
      if (e.name === "BerechtigungFehlt") throw e;
      pimVerfuegbar = false;
      hinweise.push("PIM-Schnittstellen nicht verfügbar (" + mitStatus(e) + "). Angezeigt werden nur die aktiven Zuweisungen.");
      aktiv = (await graphFetchAll("/roleManagement/directory/roleAssignments?$expand=principal",
        { scopes: CC_SCOPES.rollen }, 5000)).map(a => ({ ...a, assignmentType: "Assigned", memberType: "Direct" }));
    }
    const definitionen = await this.definitionen().catch(() => ({}));
    let zeilen = [
      ...aktiv.map(i => zuweisungAus(i, "aktiv")),
      ...berechtigt.map(i => zuweisungAus(i, "berechtigt"))
    ];

    // Rollen an Gruppen: Mitglieder zählen als Inhaber. Liefert Graph sie nicht
    // schon selbst (memberType „Group“), werden sie hier aufgelöst.
    const gruppen = zeilen.filter(z => z.principalTyp === "group");
    for (const g of gruppen) {
      const schonDa = zeilen.some(z => z.memberType === "Group" && z.rolleId === g.rolleId && z.principalTyp === "user");
      if (schonDa) continue;
      try {
        const mitglieder = await graphFetchAll(`/groups/${g.principalId}/members?$select=id,displayName,userPrincipalName&$top=999`,
          { scopes: CC_SCOPES.gruppen }, 2000);
        mitglieder.filter(m => (m["@odata.type"] || "").endsWith("user")).forEach(m => zeilen.push({
          ...g, principalId: m.id, principalTyp: "user", konto: m.userPrincipalName || m.displayName,
          name: m.displayName || "", memberType: "Group", ueberGruppe: g.name || g.konto
        }));
      } catch (e) {
        g.mitgliederFehlen = true;
        hinweise.push(`Mitglieder der Gruppe „${g.name || g.konto}“ nicht lesbar (${e.name === "BerechtigungFehlt" ? "Zustimmung für GroupMember.Read.All fehlt" : mitStatus(e)}).`);
      }
    }

    // Benutzerdaten (Gast, deaktiviert, synchronisiert) in Blöcken zu 15 Ids.
    const userIds = [...new Set(zeilen.filter(z => z.principalTyp === "user" || z.principalTyp === "unbekannt").map(z => z.principalId))];
    const benutzer = {};
    try {
      for (let i = 0; i < userIds.length; i += 15) {
        const teil = userIds.slice(i, i + 15).map(id => `'${id}'`).join(",");
        const r = await graphFetch(`/users?$filter=id in (${teil})&$select=id,displayName,userPrincipalName,userType,accountEnabled,onPremisesSyncEnabled`,
          { scopes: CC_SCOPES.verzeichnis });
        (r.value || []).forEach(u => { benutzer[u.id] = u; });
      }
    } catch (e) {
      hinweise.push("Benutzerdetails nicht lesbar (" + (e.name === "BerechtigungFehlt" ? "Zustimmung für User.Read.All fehlt" : mitStatus(e)) + "). Gäste und deaktivierte Konten werden nicht erkannt.");
    }
    zeilen.forEach(z => {
      const u = benutzer[z.principalId];
      if (u) {
        z.principalTyp = "user";
        z.konto = u.userPrincipalName || z.konto;
        z.name = u.displayName || z.name;
        z.userType = u.userType || "";
        z.aktiviert = u.accountEnabled !== false;
        z.synchronisiert = !!u.onPremisesSyncEnabled;
      }
      z.rolleName = (anlage3Rolle(z.rolleId) || {}).name || definitionen[z.rolleId] || z.rolleId;
    });

    this._stand = { zeit: Date.now(), pimVerfuegbar, zeilen, definitionen, hinweise };
    return this._stand;
  },

  // Aktivierungsregeln je Rolle: { rolleId: { policyId, regeln: { ruleId: rule } } }.
  async regeln(force = false) {
    if (!force && this._regeln) return this._regeln;
    const filter = encodeURIComponent("scopeId eq '/' and scopeType eq 'DirectoryRole'");
    const [zuordnungen, richtlinien] = await Promise.all([
      graphFetchAll(`/policies/roleManagementPolicyAssignments?$filter=${filter}`, { scopes: CC_SCOPES.rollen }, 2000),
      graphFetchAll(`/policies/roleManagementPolicies?$filter=${filter}&$expand=rules`, { scopes: CC_SCOPES.rollen }, 2000)
    ]);
    const nachId = {};
    richtlinien.forEach(p => { nachId[p.id] = p; });
    const out = {};
    zuordnungen.forEach(z => {
      const p = nachId[z.policyId];
      if (!p) return;
      const regeln = {};
      (p.rules || []).forEach(r => { regeln[r.id] = r; });
      out[z.roleDefinitionId] = { policyId: z.policyId, regeln };
    });
    this._regeln = out;
    return out;
  },

  // Letzte Anmeldung eines Kontos (für die Notfallkonten).
  async letzteAnmeldung(userId) {
    const u = await graphFetch(`/users/${userId}?$select=signInActivity`,
      { scopes: [...CC_SCOPES.verzeichnis, ...CC_SCOPES.entraAudit] });
    const s = u.signInActivity || {};
    return [s.lastSignInDateTime, s.lastNonInteractiveSignInDateTime].filter(Boolean).sort().pop() || "";
  },

  // Hat das Konto eine Lizenz, die PIM abdeckt (Entra ID P2 oder ID Governance)?
  async hatPimLizenz(userId) {
    const d = await graphFetch(`/users/${userId}/licenseDetails?$select=servicePlans`, { scopes: CC_SCOPES.verzeichnis });
    return (d.value || []).some(l => (l.servicePlans || []).some(p =>
      p.provisioningStatus !== "Disabled" && /AAD_PREMIUM_P2|IDENTITY_GOVERNANCE|ID_GOVERNANCE/i.test(p.servicePlanName || "")));
  },

  // Eingerichtete Zugriffsüberprüfungen (Access Reviews), nur lesend.
  async zugriffspruefungen() {
    const d = await graphFetchAll("/identityGovernance/accessReviews/definitions?$top=100",
      { scopes: CC_SCOPES.zugriffspruefungen }, 500);
    return d.map(x => ({ id: x.id, name: x.displayName, status: x.status,
      rollen: JSON.stringify(x.scope || {}).includes("roleDefinitions") || JSON.stringify(x.scope || {}).includes("roleAssignmentSchedule") }));
  },

  // ---------------------------------------------------------- Schreiben ---

  // Dauerhafte Zuweisung in eine PIM-Berechtigung überführen: erst berechtigen,
  // dann die aktive Zuweisung entfernen. Ist die Person schon berechtigt, geht
  // es direkt mit dem Entfernen weiter.
  async ueberfuehren(z, begruendung) {
    const basis = { principalId: z.principalId, roleDefinitionId: z.rolleId, directoryScopeId: z.scope || "/", justification: begruendung };
    const ablaeufe = [{ type: "noExpiration" }, { type: "afterDuration", duration: "P365D" }, { type: "afterDuration", duration: "P180D" }];
    let berechtigt = false, letzter = null;
    for (const expiration of ablaeufe) {
      try {
        await graphFetch("/roleManagement/directory/roleEligibilityScheduleRequests", {
          method: "POST", scopes: CC_SCOPES.pim,
          body: JSON.stringify({ ...basis, action: "adminAssign", scheduleInfo: { startDateTime: new Date().toISOString(), expiration } })
        });
        berechtigt = true;
        break;
      } catch (e) {
        if (e.name === "BerechtigungFehlt") throw e;
        if (/RoleAssignmentExists|already exists/i.test((e.code || "") + " " + e.message)) { berechtigt = true; break; }
        letzter = e;
        if (!/Expiration/i.test((e.code || "") + " " + e.message)) break;   // anderer Grund: nicht weiter probieren
      }
    }
    if (!berechtigt) throw letzter || new Error("Berechtigung konnte nicht angelegt werden.");
    await graphFetch("/roleManagement/directory/roleAssignmentScheduleRequests", {
      method: "POST", scopes: CC_SCOPES.pim,
      body: JSON.stringify({ ...basis, action: "adminRemove" })
    });
  },

  // Hausstandard auf die Regeln einer Rolle anwenden. Liefert die Liste der
  // geänderten Regeln; was ohne Angaben nicht geht (Genehmiger fehlen), steht in hinweise.
  async regelnAnwenden(rolleId, std) {
    const alle = await this.regeln();
    const eintrag = alle[rolleId];
    if (!eintrag) throw new Error("Für diese Rolle gibt es keine PIM-Richtlinie.");
    const kritisch = std.kritisch.includes(rolleId);
    const sollDauer = kritisch ? std.dauerKritisch : std.dauer;
    const r = eintrag.regeln;
    const ziel = (regel, extra) => ({
      "@odata.type": regel["@odata.type"], id: regel.id,
      target: {
        "@odata.type": "microsoft.graph.unifiedRoleManagementPolicyRuleTarget",
        caller: regel.target.caller, operations: regel.target.operations || ["All"], level: regel.target.level,
        inheritableSettings: regel.target.inheritableSettings || [], enforcedSettings: regel.target.enforcedSettings || []
      },
      ...extra
    });
    const patch = async (regel, body) => {
      await graphFetch(`/policies/roleManagementPolicies/${encodeURIComponent(eintrag.policyId)}/rules/${encodeURIComponent(regel.id)}`, {
        method: "PATCH", scopes: CC_SCOPES.pimRegeln, body: JSON.stringify(body)
      });
    };
    const geaendert = [], hinweise = [];

    const ablauf = r.Expiration_EndUser_Assignment;
    if (ablauf) {
      const ist = dauerStunden(ablauf.maximumDuration);
      if (ist === null || ist > sollDauer || !ablauf.isExpirationRequired) {
        await patch(ablauf, ziel(ablauf, { isExpirationRequired: true, maximumDuration: `PT${sollDauer}H` }));
        geaendert.push(`Höchstdauer ${sollDauer} h`);
      }
    }

    const freigabe = r.Enablement_EndUser_Assignment;
    if (freigabe) {
      const ist = new Set(freigabe.enabledRules || []);
      const kontext = r.AuthenticationContext_EndUser_Assignment && r.AuthenticationContext_EndUser_Assignment.isEnabled;
      const soll = new Set(ist);
      if (std.mfa && !kontext) soll.add("MultiFactorAuthentication");
      if (std.begruendung) soll.add("Justification");
      if (std.ticket) soll.add("Ticketing");
      if (soll.size !== ist.size) {
        await patch(freigabe, ziel(freigabe, { enabledRules: [...soll] }));
        geaendert.push("Bedingungen: " + [...soll].map(x => ({ MultiFactorAuthentication: "MFA", Justification: "Begründung", Ticketing: "Ticket" }[x] || x)).join(", "));
      }
    }

    const genehmigung = r.Approval_EndUser_Assignment;
    if (genehmigung && kritisch && std.genehmigungKritisch) {
      const s = genehmigung.setting || {};
      if (!s.isApprovalRequired) {
        if (!std.genehmiger.length) {
          hinweise.push("Genehmigung nicht gesetzt: im Hausstandard sind keine Genehmiger hinterlegt.");
        } else {
          const ids = [];
          for (const mail of std.genehmiger) {
            const u = await graphFetch(`/users/${encodeURIComponent(mail)}?$select=id`);
            ids.push(u.id);
          }
          await patch(genehmigung, ziel(genehmigung, {
            setting: {
              "@odata.type": "microsoft.graph.approvalSettings",
              isApprovalRequired: true, isApprovalRequiredForExtension: false, isRequestorJustificationRequired: true,
              approvalMode: "SingleStage",
              approvalStages: [{
                approvalStageTimeOutInDays: 1, isApproverJustificationRequired: true, escalationTimeInMinutes: 0,
                isEscalationEnabled: false, escalationApprovers: [],
                primaryApprovers: ids.map(id => ({ "@odata.type": "#microsoft.graph.singleUser", userId: id }))
              }]
            }
          }));
          geaendert.push("Genehmigung durch " + std.genehmiger.join(", "));
        }
      }
    }

    const info = r.Notification_Admin_EndUser_Assignment;
    if (info && std.benachrichtigung.length) {
      const ist = (info.notificationRecipients || []).map(x => String(x).toLowerCase());
      const fehlt = std.benachrichtigung.filter(x => !ist.includes(x.toLowerCase()));
      if (fehlt.length) {
        await patch(info, ziel(info, {
          notificationType: info.notificationType || "Email", recipientType: info.recipientType || "Admin",
          notificationLevel: "All", isDefaultRecipientsEnabled: info.isDefaultRecipientsEnabled !== false,
          notificationRecipients: [...(info.notificationRecipients || []), ...fehlt]
        }));
        geaendert.push("Benachrichtigung an " + fehlt.join(", "));
      }
    }
    this._regeln = null;
    return { geaendert, hinweise };
  },

  // ------------------------------------------------- eigene Rollen (JIT) ---

  // Abruf mit $expand, bei Ablehnung des Parameters ohne (die Namen kommen dann
  // aus dem Katalog bzw. der Rollendefinition).
  async _mitExpand(pfad, expand, max = 500) {
    const trenner = pfad.includes("?") ? "&" : "?";
    try {
      return await graphFetchAll(`${pfad}${trenner}$expand=${expand}`, { scopes: CC_SCOPES.rollen }, max);
    } catch (e) {
      if (e.name === "BerechtigungFehlt" || e.status === 401 || e.status === 403) throw e;
      return graphFetchAll(pfad, { scopes: CC_SCOPES.rollen }, max);
    }
  },

  async meineRollen() {
    const basis = "/roleManagement/directory";
    const offen = encodeURIComponent("status eq 'PendingApproval'");
    const [berechtigt, aktiv, antraege] = await Promise.all([
      this._mitExpand(`${basis}/roleEligibilityScheduleInstances/filterByCurrentUser(on='principal')`, "roleDefinition"),
      this._mitExpand(`${basis}/roleAssignmentScheduleInstances/filterByCurrentUser(on='principal')`, "roleDefinition"),
      this._mitExpand(`${basis}/roleAssignmentScheduleRequests/filterByCurrentUser(on='principal')?$filter=${offen}`, "roleDefinition", 200).catch(() => [])
    ]);
    const name = x => (anlage3Rolle(x.roleDefinitionId) || {}).name || (x.roleDefinition && x.roleDefinition.displayName) || x.roleDefinitionId;
    return {
      berechtigt: berechtigt.map(x => ({ rolleId: x.roleDefinitionId, rolle: name(x), scope: x.directoryScopeId || "/", ende: x.endDateTime || "", ueberGruppe: x.memberType === "Group" })),
      aktiv: aktiv.map(x => ({ rolleId: x.roleDefinitionId, rolle: name(x), scope: x.directoryScopeId || "/", art: x.assignmentType, ende: x.endDateTime || "" })),
      antraege: antraege.map(x => ({ id: x.id, rolleId: x.roleDefinitionId, rolle: name(x), zeit: x.createdDateTime, begruendung: x.justification || "" }))
    };
  },

  async aktivieren({ rolleId, scope = "/", zweck, text, stunden, ticket }) {
    const ich = await this.ich();
    const body = {
      action: "selfActivate", principalId: ich.id, roleDefinitionId: rolleId, directoryScopeId: scope,
      justification: `[${zweck}] ${text}`.trim(),
      scheduleInfo: { startDateTime: new Date().toISOString(), expiration: { type: "afterDuration", duration: `PT${stunden}H` } }
    };
    if (ticket) body.ticketInfo = { ticketNumber: ticket, ticketSystem: "DIHAG Tickets" };
    return graphFetch("/roleManagement/directory/roleAssignmentScheduleRequests", {
      method: "POST", scopes: CC_SCOPES.pim, body: JSON.stringify(body)
    });
  },

  async deaktivieren(rolleId, scope = "/") {
    const ich = await this.ich();
    return graphFetch("/roleManagement/directory/roleAssignmentScheduleRequests", {
      method: "POST", scopes: CC_SCOPES.pim,
      body: JSON.stringify({ action: "selfDeactivate", principalId: ich.id, roleDefinitionId: rolleId, directoryScopeId: scope,
        justification: "Aufgabe erledigt, Rolle vorzeitig zurückgegeben" })
    });
  },

  async antragZurueckziehen(id) {
    return graphFetch(`/roleManagement/directory/roleAssignmentScheduleRequests/${id}/cancel`, { method: "POST", scopes: CC_SCOPES.pim });
  },

  // Anträge, die der angemeldete Benutzer genehmigen darf.
  async zuGenehmigen() {
    const f = encodeURIComponent("status eq 'PendingApproval'");
    const d = await this._mitExpand(`/roleManagement/directory/roleAssignmentScheduleRequests/filterByCurrentUser(on='approver')?$filter=${f}`,
      "principal,roleDefinition", 200);
    return d.map(x => ({
      id: x.id, approvalId: x.approvalId, rolleId: x.roleDefinitionId,
      rolle: (anlage3Rolle(x.roleDefinitionId) || {}).name || (x.roleDefinition && x.roleDefinition.displayName) || x.roleDefinitionId,
      wer: x.principal ? (x.principal.userPrincipalName || x.principal.displayName) : x.principalId,
      zeit: x.createdDateTime, begruendung: x.justification || "",
      dauer: x.scheduleInfo && x.scheduleInfo.expiration ? x.scheduleInfo.expiration.duration : ""
    }));
  },

  // Genehmigen oder ablehnen. Diese Schnittstelle gibt es nur unter beta.
  async entscheide(antrag, ergebnis, begruendung) {
    const a = await graphFetch(`/roleManagement/directory/roleAssignmentApprovals/${antrag.approvalId}`, { version: "beta", scopes: CC_SCOPES.pim });
    const schritt = (a.steps || []).find(s => s.assignedToMe && s.status !== "Completed") || (a.steps || [])[0];
    if (!schritt) throw new Error("Kein offener Genehmigungsschritt gefunden.");
    await graphFetch(`/roleManagement/directory/roleAssignmentApprovals/${antrag.approvalId}/steps/${schritt.id}`, {
      method: "PATCH", version: "beta", scopes: CC_SCOPES.pim,
      body: JSON.stringify({ reviewResult: ergebnis, justification: begruendung })
    });
  },

  // ----------------------------------------------- Aktivierungsprotokoll ---

  // PIM hält die Aktivierungen nur etwa 30 Tage vor. Für die Quartalsübersicht
  // an den KBR (Anlage 3 § 9) werden sie in Compliance_PIMAktivierungen gesichert.
  async aktivierungenAusPim() {
    let d;
    try {
      d = await graphFetchAll("/roleManagement/directory/roleAssignmentScheduleRequests?$expand=principal", { scopes: CC_SCOPES.rollen }, 3000);
    } catch (e) {
      if (e.name === "BerechtigungFehlt" || e.status === 401 || e.status === 403) throw e;
      d = await graphFetchAll("/roleManagement/directory/roleAssignmentScheduleRequests", { scopes: CC_SCOPES.rollen }, 3000);
    }
    return d.filter(x => x.action === "selfActivate").map(x => ({
      Title: x.id,
      Rolle: (anlage3Rolle(x.roleDefinitionId) || {}).name || x.roleDefinitionId,
      RolleId: x.roleDefinitionId,
      Konto: x.principal ? (x.principal.userPrincipalName || x.principal.displayName || x.principalId) : x.principalId,
      Zeit: x.createdDateTime || "",
      Dauer: x.scheduleInfo && x.scheduleInfo.expiration ? (x.scheduleInfo.expiration.duration || "") : "",
      Zweck: zweckAus(x.justification),
      Begruendung: x.justification || "",
      Ticket: x.ticketInfo && x.ticketInfo.ticketNumber ? x.ticketInfo.ticketNumber : "",
      Status: x.status || ""
    }));
  },

  async sichereAktivierungen() {
    const [neu, vorhanden] = await Promise.all([this.aktivierungenAusPim(), Store.loadOderLeer("aktivierungen")]);
    if (Store.fehlendeListen.has(CC_LISTS.aktivierungen)) return { neu: 0, aktualisiert: 0, listeFehlt: true };
    const nachTitel = {};
    vorhanden.forEach(v => { nachTitel[v.Title] = v; });
    let n = 0, a = 0;
    await parallelAbarbeiten(neu, 3, async x => {
      const alt = nachTitel[x.Title];
      if (!alt) { await Store.save("aktivierungen", null, x); n++; }
      else if (alt.Status !== x.Status) { await Store.save("aktivierungen", alt.id, { Status: x.Status }); a++; }
    });
    return { neu: n, aktualisiert: a };
  }
};

// Eine Zeile je Instanz, vereinheitlicht.
function zuweisungAus(inst, typ) {
  const p = inst.principal || {};
  const odt = String(p["@odata.type"] || "").replace("#microsoft.graph.", "");
  let art;
  if (typ === "berechtigt") art = "berechtigt";
  else if (inst.assignmentType === "Activated") art = "aktiviert";
  else art = inst.endDateTime ? "befristet" : "dauerhaft";
  return {
    principalId: inst.principalId,
    principalTyp: odt || "unbekannt",
    konto: p.userPrincipalName || p.displayName || inst.principalId,
    name: p.displayName || "",
    appId: p.appId || "",
    rolleId: inst.roleDefinitionId,
    scope: inst.directoryScopeId || "/",
    art,
    start: inst.startDateTime || "",
    ende: inst.endDateTime || "",
    memberType: inst.memberType || "Direct"
  };
}

// Schlüssel einer Zuweisung im Rollenregister (Title).
function registerSchluessel(z) {
  return [z.principalId, z.rolleId, z.scope && z.scope !== "/" ? z.scope : ""].filter(Boolean).join("|");
}

// ---------------------------------------------------------------------------
// Prüfung gegen Anlage 3
// ---------------------------------------------------------------------------

// stand: Ergebnis von Pim.lade(); register: Einträge aus Compliance_Rollenregister;
// k: pimKonfig(); regeln: Pim.regeln() oder null; extra: { anmeldungen, lizenzen,
// zugriffspruefungen } (optional, je nachdem, was lesbar war).
// Liefert eine Zuweisung je Konto und Rolle, die Soll-Ist-Zeilen je Rolle der
// Anlage, Rollen außerhalb der Anlage, Feststellungen und Kennzahlen.
function bewerteAnlage3(stand, register, k, regeln = null, extra = {}) {
  const heute = new Date().toISOString().slice(0, 10);
  const vorJahr = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const reg = {};
  (register || []).forEach(r => { if (r.Title) reg[r.Title] = r; });

  // Zeilen je Konto + Rolle zusammenfassen (eine Aktivierung erzeugt zusätzlich
  // zur Berechtigung eine aktive Instanz).
  const nachSchluessel = {};
  stand.zeilen.forEach(z => {
    const key = registerSchluessel(z) + (z.memberType === "Group" && z.ueberGruppe ? "|g:" + z.ueberGruppe : "");
    const e = nachSchluessel[key] = nachSchluessel[key] || { ...z, key, arten: new Set(), aktivBis: "", seit: z.start, bis: "" };
    e.arten.add(z.art);
    if (z.art === "aktiviert") e.aktivBis = z.ende;
    if (z.art === "dauerhaft" || z.art === "befristet") e.bis = z.ende;
    if (z.art === "berechtigt" && !e.bis) e.bis = z.ende;
    if (z.start && (!e.seit || z.start < e.seit)) e.seit = z.start;
  });

  const zuweisungen = Object.values(nachSchluessel).map(z => {
    const r = reg[registerSchluessel(z)] || null;
    const upn = String(z.konto || "").toLowerCase();
    let kontoart;
    if (z.principalTyp === "servicePrincipal") kontoart = "Technisch";
    else if (z.principalTyp === "group") kontoart = "Gruppe";
    else if (k.notfallkonten.includes(upn)) kontoart = "Notfallkonto";
    else if (r && (r.Kontoart === "Technisch" || r.Kontoart === "Extern")) kontoart = r.Kontoart;
    else if (z.userType === "Guest" || upn.includes("#ext#") || k.externeDomains.some(d => upn.endsWith("@" + d))) kontoart = "Extern";
    else kontoart = "Person";
    const dauerhaft = z.arten.has("dauerhaft") || z.arten.has("befristet");
    const zuweisung = dauerhaft ? (z.arten.has("dauerhaft") ? "dauerhaft" : "aktiv (befristet)")
      : z.arten.has("berechtigt") ? "berechtigt (PIM)" : "aktiviert";
    const aktivJetzt = dauerhaft || z.arten.has("aktiviert");
    const dokumentiert = !!(r && String(r.Zweck || "").trim() && String(r.GenehmigtVon || "").trim());
    const pruefungFaellig = !r || !r.LetztePruefung || r.LetztePruefung < vorJahr;
    return { ...z, kontoart, zuweisung, dauerhaft, aktivJetzt, register: r, dokumentiert, pruefungFaellig,
      ausnahme: !!(r && String(r.Ausnahme || "").trim()), rolle: anlage3Rolle(z.rolleId) };
  });

  // Soll-Ist je Rolle der Anlage
  const rollen = CC_ANLAGE3_ROLLEN.map(rolle => {
    const zw = zuweisungen.filter(z => z.rolleId === rolle.id);
    const pers = zw.filter(z => istPersonenbezogen(z.kontoart));
    const aktivPersonen = new Set(pers.filter(z => z.aktivJetzt).map(z => z.principalId));
    const berechtigtPersonen = new Set(pers.filter(z => z.arten.has("berechtigt")).map(z => z.principalId));
    const dauerhaftPersonen = new Set(pers.filter(z => z.dauerhaft).map(z => z.principalId));
    return {
      ...rolle,
      aktiv: aktivPersonen.size, berechtigt: berechtigtPersonen.size, dauerhaft: dauerhaftPersonen.size,
      technisch: zw.filter(z => z.kontoart === "Technisch").length,
      notfall: zw.filter(z => z.kontoart === "Notfallkonto").length,
      gruppen: zw.filter(z => z.kontoart === "Gruppe").length,
      ueberschritten: aktivPersonen.size > rolle.max,
      belegt: zw.length > 0
    };
  });

  // Rollen, die zugewiesen sind, aber nicht in der Anlage stehen
  const fremdIds = [...new Set(zuweisungen.filter(z => !z.rolle).map(z => z.rolleId))];
  const fremd = fremdIds.map(id => {
    const zw = zuweisungen.filter(z => z.rolleId === id);
    return {
      id, name: zw[0].rolleName,
      personen: zw.filter(z => istPersonenbezogen(z.kontoart)).length,
      technisch: zw.filter(z => z.kontoart === "Technisch").length,
      dokumentiert: zw.filter(z => istPersonenbezogen(z.kontoart)).every(z => z.ausnahme)
    };
  });

  // Feststellungen
  const fs = [];
  const neu = (id, schwere, paragraf, titel, text, ziel, extraFelder = {}) =>
    fs.push({ id, schwere, paragraf, titel, text, ziel, ...extraFelder });
  const namen = liste => liste.slice(0, 6).join(", ") + (liste.length > 6 ? ` und ${liste.length - 6} weitere` : "");

  fremd.filter(f => f.personen && !f.dokumentiert).forEach(f => neu("fremd:" + f.id, "hoch", "§ 3, § 12",
    `Rolle „${f.name}“ ist nicht in der Anlage 3 zugelassen`,
    `${f.personen} personenbezogene Zuweisung(en). Entweder entziehen oder im Register als gleichwertige bzw. geringere Rolle (§ 12 Abs. 2) begründen; sonst Änderungsverfahren der KBV.`,
    "register", { rolleId: f.id }));

  rollen.filter(r => r.ueberschritten).forEach(r => neu("max:" + r.id, "hoch", "§ 2.3, § 3",
    `${r.name}: ${r.aktiv} gleichzeitig aktive Inhaber, zulässig ${r.max}`,
    r.nurTechnisch ? "Die Rolle ist grundsätzlich technischen Identitäten vorbehalten (0 personenbezogen)."
      : "Gezählt sind Personen mit dauerhafter oder gerade aktivierter Zuweisung; nur berechtigte zählen nicht.",
    "umstellung", { rolleId: r.id }));

  rollen.filter(r => r.nurTechnisch && r.berechtigt).forEach(r => neu("tech:" + r.id, "mittel", "§ 3",
    `${r.name}: ${r.berechtigt} Person(en) über PIM berechtigt`,
    "Die Rolle ist grundsätzlich nur für technische Identitäten vorgesehen.", "register", { rolleId: r.id }));

  const ohnePim = zuweisungen.filter(umstellungKandidat);
  if (ohnePim.length) neu("dauerhaft", ohnePim.some(z => z.rolleId === CC_ROLLE_GA) ? "hoch" : "mittel", "§ 2.2",
    `${ohnePim.length} dauerhafte Zuweisung(en) von PIM-Rollen an Personen`,
    `Diese Rollen sind grundsätzlich über PIM zu vergeben: ${namen(ohnePim.map(z => `${z.rolleName} (${z.konto})`))}. In PIM überführen oder die Ausnahme im Register begründen.`,
    "umstellung", { anzahl: ohnePim.length });

  // Notfallkonten (§ 5)
  if (!k.notfallkonten.length) {
    neu("notfall:fehlt", "hoch", "§ 5", "Keine Notfallzugriffskonten hinterlegt",
      "Vorgesehen sind zwei cloudbasierte Konten mit dauerhafter Rolle „Globaler Administrator“. Ohne diese Angabe sperrt das Cockpit die Umstellung der globalen Administratoren.",
      "einstellungen");
  } else {
    if (k.notfallkonten.length !== 2) neu("notfall:anzahl", "mittel", "§ 5", `${k.notfallkonten.length} Notfallzugriffskonto/-konten hinterlegt`,
      "Die Anlage sieht grundsätzlich zwei Notfallzugriffskonten vor.", "einstellungen");
    k.notfallkonten.forEach(upn => {
      const zw = zuweisungen.filter(z => String(z.konto).toLowerCase() === upn);
      const ga = zw.find(z => z.rolleId === CC_ROLLE_GA && z.arten.has("dauerhaft"));
      if (!ga) neu("notfall:ga:" + upn, "hoch", "§ 5", `Notfallkonto ${upn} ohne dauerhafte Rolle „Globaler Administrator“`,
        zw.length ? "Das Konto hat die Rolle nur berechtigt oder befristet. Im Notfall muss es ohne Aktivierung funktionieren." : "Das Konto hat keine Rolle oder wurde nicht gefunden.", "einstellungen");
      const z = zw[0];
      if (z && z.aktiviert === false) neu("notfall:aus:" + upn, "hoch", "§ 5", `Notfallkonto ${upn} ist deaktiviert`, "", "einstellungen");
      if (z && z.synchronisiert) neu("notfall:sync:" + upn, "mittel", "§ 5", `Notfallkonto ${upn} wird aus dem lokalen AD synchronisiert`,
        "Notfallkonten sollen cloudbasiert sein, damit sie bei einem Ausfall der Synchronisation funktionieren.", "einstellungen");
      const anm = (extra.anmeldungen || {})[upn];
      if (anm && anm >= new Date(Date.now() - 30 * 86400000).toISOString()) neu("notfall:anmeldung:" + upn, "mittel", "§ 5",
        `Notfallkonto ${upn} wurde am ${fmtDatum(anm)} verwendet`,
        "Verwendung nur in dokumentierten Notfällen. Bitte den Anlass dokumentieren (Test oder Notfall).", "einstellungen");
    });
    const faellig = !k.notfallGeprueft || tageBis(addiereTage(k.notfallGeprueft, k.notfallIntervall)) < 0;
    if (faellig) neu("notfall:test", "niedrig", "§ 5, § 11", "Funktionstest der Notfallkonten fällig",
      k.notfallGeprueft ? `Letzter Test am ${fmtDatum(k.notfallGeprueft)}, Intervall ${k.notfallIntervall} Tage.` : "Noch kein Funktionstest dokumentiert.", "notfalltest");
  }

  // Externe (§ 7): befristet vergeben
  const externUnbefristet = zuweisungen.filter(z => z.kontoart === "Extern" && !z.bis && !z.ausnahme);
  if (externUnbefristet.length) neu("extern", "mittel", "§ 7", `${externUnbefristet.length} unbefristete Zuweisung(en) an Externe`,
    `Berechtigungen externer Dienstleister sind nach Möglichkeit zeitlich zu begrenzen: ${namen(externUnbefristet.map(z => `${z.rolleName} (${z.konto})`))}.`, "register",
    { anzahl: externUnbefristet.length });

  // Getrennte Administratorkonten (§ 2.4), nur wenn ein Kennzeichen hinterlegt ist
  if (k.adminKennzeichen.length) {
    const ohne = zuweisungen.filter(z => z.kontoart === "Person" && z.rolle && z.rolle.p &&
      !k.adminKennzeichen.some(m => String(z.konto).toLowerCase().includes(m)));
    const konten = [...new Set(ohne.map(z => z.konto))];
    if (konten.length) neu("adminkonto", "niedrig", "§ 2.4", `${konten.length} Konto/Konten mit PIM-Rolle ohne Kennzeichen für Administratorkonten`,
      `Soweit möglich verwenden Administratoren ein getrenntes Administratorkonto: ${namen(konten)}.`, "register");
  }

  // Lizenz für PIM (Microsoft-Lizenzbedingung, nicht Teil der Anlage)
  if (extra.lizenzen) {
    const ohne = [...new Set(zuweisungen.filter(z => z.arten.has("berechtigt") && z.principalTyp === "user" && extra.lizenzen[z.principalId] === false).map(z => z.konto))];
    if (ohne.length) neu("lizenz", "mittel", "Lizenz", `${ohne.length} berechtigte Person(en) ohne Entra-ID-P2- oder Governance-Lizenz`,
      `Microsoft verlangt für jede Person, die PIM nutzt, eine passende Lizenz: ${namen(ohne)}.`, "register");
  }

  // Register (§ 10) und Überprüfung (§ 11)
  const undokumentiert = zuweisungen.filter(z => !z.dokumentiert && z.memberType !== "Group");
  if (undokumentiert.length) neu("register", "niedrig", "§ 10", `${undokumentiert.length} Zuweisung(en) ohne Zweck oder genehmigende Stelle im Rollenregister`,
    "Das Register muss je Zuweisung den betrieblichen Zweck und die genehmigende Stelle enthalten.", "register", { anzahl: undokumentiert.length });
  const ungeprueft = zuweisungen.filter(z => z.memberType !== "Group" && z.pruefungFaellig);
  if (ungeprueft.length) neu("pruefung", "mittel", "§ 11", `${ungeprueft.length} Zuweisung(en) ohne Überprüfung in den letzten zwölf Monaten`,
    "Privilegierte Rollen, technische Identitäten und Notfallkonten sind mindestens jährlich zu überprüfen.", "register", { anzahl: ungeprueft.length });
  const aktivKeys = new Set(zuweisungen.map(z => registerSchluessel(z)));
  const entfallen = (register || []).filter(r => r.Quelle !== "manuell" && !r.Entzogen && r.Title && !aktivKeys.has(r.Title));
  if (entfallen.length) neu("entfallen", "niedrig", "§ 10, § 11", `${entfallen.length} Registereintrag/-einträge ohne bestehende Zuweisung`,
    "Die Rolle wurde entzogen oder ist abgelaufen. Bitte den Entzug im Register dokumentieren.", "register");

  // Aktivierungsregeln (§ 2.2)
  let regelBewertung = null;
  if (regeln) {
    regelBewertung = CC_ANLAGE3_ROLLEN.filter(r => r.p).map(r => ({ rolle: r, ...bewerteRegeln(regeln[r.id], r.id, k.standard) }));
    const abw = regelBewertung.filter(x => x.vorhanden && !x.ok);
    if (abw.length) neu("regeln", "mittel", "§ 2.2", `${abw.length} PIM-Rolle(n) weichen vom Hausstandard für die Aktivierung ab`,
      namen(abw.map(x => x.rolle.name)) + ".", "regeln", { anzahl: abw.length });
  }

  if (extra.zugriffspruefungen && !extra.zugriffspruefungen.some(p => p.rollen))
    neu("accessreview", "niedrig", "§ 11", "Keine automatische Zugriffsüberprüfung für Admin-Rollen eingerichtet",
      "Optional: Mit der PIM-Lizenz lassen sich jährliche Access Reviews für die Rollen einrichten. Die Überprüfung im Register genügt ebenfalls.", "pruefungen");

  const rang = { hoch: 0, mittel: 1, niedrig: 2 };
  fs.sort((a, b) => rang[a.schwere] - rang[b.schwere]);

  const pers = zuweisungen.filter(z => istPersonenbezogen(z.kontoart));
  return {
    zuweisungen, rollen, fremd, feststellungen: fs, regelBewertung, entfallen,
    kennzahlen: {
      berechtigt: pers.filter(z => z.arten.has("berechtigt")).length,
      dauerhaft: pers.filter(z => z.dauerhaft && z.rolle && z.rolle.p).length,
      aktivJetzt: pers.filter(z => z.arten.has("aktiviert")).length,
      personen: new Set(pers.map(z => z.principalId)).size,
      technisch: zuweisungen.filter(z => z.kontoart === "Technisch").length,
      dokumentiertQuote: zuweisungen.length ? Math.round(zuweisungen.filter(z => z.dokumentiert || z.memberType === "Group").length / zuweisungen.length * 100) : 100,
      hoch: fs.filter(f => f.schwere === "hoch").length,
      mittel: fs.filter(f => f.schwere === "mittel").length,
      stand: heute
    }
  };
}

// Dauerhafte Zuweisung einer PIM-Rolle an eine Person oder an eine Gruppe (deren
// Mitglieder dann dauerhaft aktiv sind), ohne begründete Ausnahme. Notfallkonten
// und technische Identitäten sind nach § 2.2 ausgenommen.
function umstellungKandidat(z) {
  return !!(z.rolle && z.rolle.p && z.dauerhaft && !z.ausnahme && z.memberType !== "Group" &&
    (istPersonenbezogen(z.kontoart) || z.kontoart === "Gruppe"));
}

// Regeln einer Rolle gegen den Hausstandard. Liefert { vorhanden, ok, werte, abweichungen }.
function bewerteRegeln(eintrag, rolleId, std) {
  if (!eintrag) return { vorhanden: false, ok: false, werte: {}, abweichungen: ["keine PIM-Richtlinie gelesen"] };
  const r = eintrag.regeln;
  const kritisch = std.kritisch.includes(rolleId);
  const sollDauer = kritisch ? std.dauerKritisch : std.dauer;
  const ablauf = r.Expiration_EndUser_Assignment || {};
  const bedingungen = (r.Enablement_EndUser_Assignment || {}).enabledRules || [];
  const kontext = !!(r.AuthenticationContext_EndUser_Assignment && r.AuthenticationContext_EndUser_Assignment.isEnabled);
  const genehmigung = ((r.Approval_EndUser_Assignment || {}).setting || {});
  const info = r.Notification_Admin_EndUser_Assignment || {};
  const empfaenger = (info.notificationRecipients || []).map(x => String(x).toLowerCase());
  const genehmiger = ((genehmigung.approvalStages || [])[0] || {}).primaryApprovers || [];
  const werte = {
    dauer: dauerStunden(ablauf.maximumDuration),
    mfa: bedingungen.includes("MultiFactorAuthentication") || kontext,
    kontext,
    begruendung: bedingungen.includes("Justification"),
    ticket: bedingungen.includes("Ticketing"),
    genehmigung: !!genehmigung.isApprovalRequired,
    genehmigerAnzahl: genehmiger.length,
    empfaenger
  };
  const abw = [];
  if (werte.dauer === null || werte.dauer > sollDauer) abw.push(`Höchstdauer ${werte.dauer === null ? "unbegrenzt" : dauerText(ablauf.maximumDuration)} statt höchstens ${sollDauer} h`);
  if (std.mfa && !werte.mfa) abw.push("MFA nicht verlangt");
  if (std.begruendung && !werte.begruendung) abw.push("Begründung nicht verlangt");
  if (std.ticket && !werte.ticket) abw.push("Ticketnummer nicht verlangt");
  if (kritisch && std.genehmigungKritisch && !werte.genehmigung) abw.push("keine Genehmigung");
  const fehlen = std.benachrichtigung.filter(x => !empfaenger.includes(String(x).toLowerCase()));
  if (fehlen.length) abw.push("Benachrichtigung fehlt an " + fehlen.join(", "));
  return { vorhanden: true, ok: !abw.length, werte, abweichungen: abw, kritisch, sollDauer };
}

function addiereTage(iso, tage) {
  const d = new Date(String(iso).slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + Number(tage || 0));
  return d.toISOString().slice(0, 10);
}

// Gemeinsamer Stand für alle Reiter der Ansicht „Admin-Rollen“. Optionale
// Zusatzdaten (Regeln, letzte Anmeldung der Notfallkonten) fehlen still, wenn
// sie nicht lesbar sind; dann entfällt nur die jeweilige Prüfung.
async function pimStand({ mitRegeln = true, mitExtras = true, force = false } = {}) {
  const k = pimKonfig();
  const [stand, register] = await Promise.all([Pim.lade(force), Store.loadOderLeer("rollenregister")]);
  let regeln = null, regelFehler = null;
  if (mitRegeln && stand.pimVerfuegbar) {
    try { regeln = await Pim.regeln(force); } catch (e) { regelFehler = e; }
  }
  const extra = {};
  if (mitExtras) {
    const anmeldungen = {};
    await Promise.all(k.notfallkonten.map(async upn => {
      const z = stand.zeilen.find(x => String(x.konto).toLowerCase() === upn);
      if (!z) return;
      try { anmeldungen[upn] = await Pim.letzteAnmeldung(z.principalId); } catch (e) { /* ohne AuditLog.Read.All keine Prüfung */ }
    }));
    extra.anmeldungen = anmeldungen;
    try { extra.zugriffspruefungen = await Pim.zugriffspruefungen(); } catch (e) { /* optional */ }
    // Lizenz je über PIM berechtigter Person (höchstens 60 Abfragen).
    const berechtigte = [...new Set(stand.zeilen.filter(z => z.art === "berechtigt" && z.principalTyp === "user").map(z => z.principalId))].slice(0, 60);
    if (stand.pimVerfuegbar && berechtigte.length) {
      const lizenzen = {};
      let lesbar = true;
      await parallelAbarbeiten(berechtigte, 5, async id => {
        if (!lesbar) return;
        try { lizenzen[id] = await Pim.hatPimLizenz(id); }
        catch (e) { if (e.name === "BerechtigungFehlt" || e.status === 403) lesbar = false; }
      });
      if (lesbar) extra.lizenzen = lizenzen;
    }
  }
  const bewertung = bewerteAnlage3(stand, register, k, regeln, extra);
  return { k, stand, register, regeln, regelFehler, extra, bewertung };
}
