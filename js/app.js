"use strict";

// Start, Navigation, Rollen und Einstellungen.

const Ansichten = {
  dashboard:   { titel: "Dashboard", render: renderDashboard },
  purview:     { titel: "Microsoft 365", render: renderPurview },
  controls:    { titel: "Controls", render: renderControls },
  aufgaben:    { titel: "Aufgaben", render: renderAufgaben },
  risiken:     { titel: "Risiken", render: renderRisiken },
  datenschutz: { titel: "Datenschutz", render: renderDatenschutz },
  berichte:    { titel: "Berichte", render: renderBerichte },
  einstellungen: { titel: "Einstellungen", render: renderEinstellungen, nurAdmin: true },
  hilfe:       { titel: "Hilfe", render: null }
};

let _aktiveAnsicht = "dashboard";

function zeigeAnsicht(key) {
  if (!Ansichten[key]) key = "dashboard";
  if (Ansichten[key].nurAdmin && !Store.rolle.admin) key = "dashboard";
  _aktiveAnsicht = key;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === key));
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + key));
  const ziel = document.getElementById("view-" + key);
  const render = Ansichten[key].render;
  if (render) {
    ziel.innerHTML = ladeBox();
    Promise.resolve(render(ziel)).catch(e => { ziel.innerHTML = fehlerBox(e, Ansichten[key].titel); });
  }
  // Vorhandene Parameter (z. B. ?demo=1) erhalten.
  const params = new URLSearchParams(location.search);
  params.set("ansicht", key);
  history.replaceState(null, "", "?" + params.toString());
}

async function start() {
  const ladeText = document.getElementById("loadingText");
  try {
    const konto = await ensureLogin();
    if (!konto) return;                       // Login-Redirect läuft

    ladeText.textContent = "Benutzerdaten werden geladen …";
    const me = await getMe();
    Store.benutzer = {
      name: me.displayName || konto.name,
      email: (me.mail || me.userPrincipalName || konto.username || "").toLowerCase(),
      abteilung: me.department || ""
    };

    ladeText.textContent = "Konfiguration wird geladen …";
    await Store.loadKonfig();
    Store.bestimmeRolle();

    document.getElementById("userName").textContent = Store.benutzer.name;
    document.getElementById("userChip").hidden = false;
    document.getElementById("mainNav").hidden = false;
    document.getElementById("mainContent").hidden = false;
    document.getElementById("loadingScreen").hidden = true;

    document.getElementById("navEinstellungen").hidden = !Store.rolle.admin;
    const rollen = [];
    if (Store.rolle.admin) rollen.push("Administrator");
    if (Store.rolle.dsb) rollen.push("DSB");
    if (Store.rolle.ciso) rollen.push("CISO");
    if (Store.rolle.auditor) rollen.push("Auditor");
    document.getElementById("userRolle").textContent = rollen.join(" · ");

    if (Store.rolle.erstinstallation) {
      toast("Erstinstallation: Bitte unter Einstellungen die Listen anlegen und Administratoren eintragen.", 9000);
    }

    const start = new URLSearchParams(location.search).get("ansicht");
    zeigeAnsicht(start || "dashboard");
  } catch (e) {
    ladeText.innerHTML = fehlerBox(e, "Start") +
      `<p class="hint">Prüfen Sie, ob die SharePoint-Site <code>${esc(CC_CONFIG.sitePath)}</code> erreichbar ist
        und die App-Registrierung die nötigen Berechtigungen besitzt.</p>`;
  }
}

// ===========================================================================
// Einstellungen
// ===========================================================================

async function renderEinstellungen(el) {
  const k = Store.konfig;
  el.innerHTML = `
    <div class="card">
      <h2>Rollen &amp; Zuständigkeiten</h2>
      <div class="settings-grid">
        <label class="span2">Administratoren (E-Mails, kommagetrennt)
          <input type="text" id="sAdmins" value="${esc((k.adminEmails || []).join(", "))}">
          <span class="feld-hint">Dürfen Einstellungen ändern, Listen anlegen und Daten löschen.</span></label>
        <label class="span2">Auditoren (nur lesend im Bericht)
          <input type="text" id="sAuditoren" value="${esc((k.auditorEmails || []).join(", "))}"></label>
        <label>Datenschutzbeauftragter
          <input type="email" id="sDsb" value="${esc(k.dsbEmail || "")}"></label>
        <label>Informationssicherheitsbeauftragter (CISO)
          <input type="email" id="sCiso" value="${esc(k.cisoEmail || "")}"></label>
        <label>Absender für Erinnerungen (Cron)
          <input type="email" id="sMailSender" value="${esc(k.mailSender || "")}"></label>
        <label>Organisation
          <input type="text" id="sOrg" value="${esc(k.organisation || "")}"></label>
        <label class="span2">Richtlinienmanagementsystem (URL)
          <input type="url" id="sRms" value="${esc(k.rmsUrl || "")}"></label>
      </div>

      <h3>Prüfzyklen &amp; Erinnerungen</h3>
      <div class="settings-grid">
        <label>Prüfzyklus Controls (Monate)
          <input type="number" id="sZyklus" min="1" max="60" value="${esc(k.pruefzyklusMonate || 12)}"></label>
        <label>Erinnerung vor Fälligkeit (Tage)
          <input type="number" id="sVorher" min="1" max="90" value="${esc(k.erinnerungTageVorher || 14)}"></label>
        <label>Eskalation nach Überfälligkeit (Tage)
          <input type="number" id="sEskal" min="1" max="90" value="${esc(k.eskalationTageNach || 7)}"></label>
        <label>Erinnerungen aktiv
          <select id="sErinnerungen">
            <option value="ja"${k.erinnerungenAktiv ? " selected" : ""}>Ja</option>
            <option value="nein"${!k.erinnerungenAktiv ? " selected" : ""}>Nein</option>
          </select></label>
      </div>

      <h3>Aktive Normenkataloge</h3>
      <div class="checkbox-reihe">
        ${Object.keys(CC_FRAMEWORKS).map(key => `<label class="checkline">
          <input type="checkbox" data-fw="${key}"${(k.frameworks || []).includes(key) ? " checked" : ""}>
          ${esc(CC_FRAMEWORKS[key].label)} <span class="muted">(${CC_FRAMEWORKS[key].controls.length})</span></label>`).join("")}
      </div>

      <button class="btn-primary" id="btnSaveSettings">Einstellungen speichern</button>
    </div>

    <div class="card">
      <h2>Einrichtung</h2>
      <p class="hint">Die App legt ihre SharePoint-Listen selbst an. Voraussetzung: Sie besitzen auf
        <code>${esc(CC_CONFIG.sitePath)}</code> die Berechtigung „Vollzugriff" bzw. „Listen verwalten".</p>
      <div class="btn-reihe">
        <button class="btn-primary" id="btnListen">Listen prüfen / anlegen</button>
        <button class="btn-secondary" id="btnImport">Normenkatalog importieren</button>
        <button class="btn-secondary" id="btnRechte">Berechtigungen prüfen</button>
      </div>
      <div id="setupProtokoll"></div>
    </div>

    <div class="card">
      <h2>Systeminformationen</h2>
      <table class="detail-table">
        <tr><td class="dt">Version</td><td>${esc(CC_CONFIG.appVersion)}</td></tr>
        <tr><td class="dt">Angemeldet als</td><td>${esc(Store.benutzer.name)} (${esc(Store.benutzer.email)})</td></tr>
        <tr><td class="dt">App-Registrierung</td><td>${esc(CC_CONFIG.clientId)}</td></tr>
        <tr><td class="dt">Mandant</td><td>${esc(CC_CONFIG.tenantId)}</td></tr>
        <tr><td class="dt">SharePoint-Site</td><td>${esc(CC_CONFIG.siteHostname + CC_CONFIG.sitePath)}</td></tr>
        <tr><td class="dt">Nachweis-Bibliothek</td><td>${esc(CC_CONFIG.nachweiseLibrary)}</td></tr>
        <tr><td class="dt">Schreibaktionen in M365</td><td>${CC_CONFIG.erlaubeSchreibaktionen ? "aktiviert" : "deaktiviert"}</td></tr>
      </table>
    </div>`;

  document.getElementById("btnSaveSettings").onclick = async () => {
    const liste = id => teileListe(document.getElementById(id).value);
    const frameworks = [...el.querySelectorAll("[data-fw]")].filter(c => c.checked).map(c => c.dataset.fw);
    try {
      await Store.saveKonfig({
        adminEmails: liste("sAdmins"),
        auditorEmails: liste("sAuditoren"),
        dsbEmail: document.getElementById("sDsb").value.trim(),
        cisoEmail: document.getElementById("sCiso").value.trim(),
        mailSender: document.getElementById("sMailSender").value.trim(),
        organisation: document.getElementById("sOrg").value.trim(),
        rmsUrl: document.getElementById("sRms").value.trim(),
        pruefzyklusMonate: Number(document.getElementById("sZyklus").value) || 12,
        erinnerungTageVorher: Number(document.getElementById("sVorher").value) || 14,
        eskalationTageNach: Number(document.getElementById("sEskal").value) || 7,
        erinnerungenAktiv: document.getElementById("sErinnerungen").value === "ja",
        frameworks
      });
      Store.bestimmeRolle();
      toast("Einstellungen gespeichert.");
    } catch (e) {
      toast("Speichern fehlgeschlagen: " + e.message, 7000);
    }
  };

  const protokoll = document.getElementById("setupProtokoll");

  document.getElementById("btnListen").onclick = async () => {
    protokoll.innerHTML = ladeBox("Listen werden geprüft …");
    try {
      const bericht = await Store.ensureAll(t => { protokoll.innerHTML = ladeBox(t); });
      protokoll.innerHTML = tabelleHtml(bericht, [
        { key: "liste", label: "Liste" },
        { key: "ergebnis", label: "Ergebnis", render: r => r.fehler
            ? `<span class="ueberfaellig">${esc(r.fehler)}</span>`
            : r.angelegt ? "neu angelegt"
            : r.spalten && r.spalten.length ? "Spalten ergänzt: " + esc(r.spalten.join(", "))
            : "vorhanden" }
      ]) + (bericht.some(r => /access denied|zugriff verweigert/i.test(r.fehler || ""))
        ? hinweisBox(`<strong>SharePoint hat das Anlegen abgelehnt.</strong> Prüfen Sie, ob die App-Registrierung
            die Berechtigung <code>Sites.Manage.All</code> mit Administratorzustimmung besitzt
            (<code>setup-compliance.ps1</code> erneut ausführen) und ob Ihr Konto auf
            <code>${esc(CC_CONFIG.sitePath)}</code> Listen verwalten darf.`, "warn")
        : "") + hinweisBox(`Angelegt werden alle Governance-Listen, die Konfigurationsliste und die
        Dokumentbibliothek <strong>${esc(CC_CONFIG.nachweiseLibrary)}</strong> für Nachweisdateien.`, "info");
    } catch (e) {
      protokoll.innerHTML = fehlerBox(e, "Listen anlegen");
    }
  };

  document.getElementById("btnImport").onclick = async () => {
    const frameworks = [...el.querySelectorAll("[data-fw]")].filter(c => c.checked).map(c => c.dataset.fw);
    if (!frameworks.length) { toast("Bitte mindestens einen Normenkatalog auswählen."); return; }
    const anzahl = frameworks.reduce((s, f) => s + CC_FRAMEWORKS[f].controls.length, 0);
    if (!confirm(`${anzahl} Controls aus ${frameworks.length} Katalog(en) importieren?\nBereits vorhandene Control-IDs werden übersprungen.`)) return;
    protokoll.innerHTML = ladeBox("Import läuft …");
    try {
      const neu = await Store.importFrameworks(frameworks, t => { protokoll.innerHTML = ladeBox(t); });
      protokoll.innerHTML = hinweisBox(`<strong>${neu}</strong> Controls importiert.`, "info");
      toast("Import abgeschlossen.");
    } catch (e) {
      protokoll.innerHTML = fehlerBox(e, "Import");
    }
  };

  document.getElementById("btnRechte").onclick = async () => {
    const pruefungen = [
      { label: "SharePoint-Listen (Sites.ReadWrite.All)", test: () => getSiteId() },
      { label: "Listen anlegen (Sites.Manage.All)", test: () => getToken(CC_SCOPES.verwalten) },
      { label: "Benutzerverzeichnis (User.Read.All)", test: () => Purview.benutzerStatistik() },
      { label: "Secure Score (SecurityEvents.Read.All)", test: () => Purview.secureScore() },
      { label: "Warnungen (SecurityAlert.*)", test: () => Purview.alerts({ top: 1 }) },
      { label: "Vorfälle (SecurityIncident.Read.All)", test: () => Purview.incidents({ top: 1 }) },
      { label: "Überwachungsprotokoll (AuditLogsQuery.Read.All)", test: () => Purview.auditQueryListe() },
      { label: "Entra-Protokoll (AuditLog.Read.All)", test: () => Purview.directoryAudits({ top: 1 }) },
      { label: "Vertraulichkeitsbezeichnungen (InformationProtectionPolicy.Read)", test: () => Purview.sensitivityLabels() },
      { label: "Aufbewahrung (RecordsManagement.*)", test: () => Purview.retentionLabels() },
      { label: "eDiscovery (eDiscovery.*)", test: () => Purview.ediscoveryCases() },
      { label: "Betroffenenanfragen (SubjectRightsRequest.*)", test: () => Purview.subjectRightsRequests() },
      { label: "Bedingter Zugriff (Policy.Read.All)", test: () => Purview.conditionalAccessPolicies() },
      { label: "Verzeichnisrollen (RoleManagement.Read.Directory)", test: () => Purview.privilegierteRollen() },
      { label: "Geräte (DeviceManagement*.Read.All)", test: () => Purview.geraeteRichtlinien() }
    ];
    protokoll.innerHTML = `<table class="report-table"><thead><tr><th>Bereich</th><th>Ergebnis</th></tr></thead>
      <tbody id="rechteBody"></tbody></table>`;
    const body = document.getElementById("rechteBody");
    for (const p of pruefungen) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${esc(p.label)}</td><td class="muted">wird geprüft …</td>`;
      body.appendChild(tr);
      try {
        await p.test();
        tr.lastElementChild.innerHTML = `<span class="status st-green">verfügbar</span>`;
      } catch (e) {
        const grund = e.name === "BerechtigungFehlt"
          ? "Zustimmung fehlt: " + e.scopes.join(", ")
          : (e.status ? e.status + " " : "") + (e.message || "").slice(0, 300);
        // Bei mehreren probierten Endpunkten jede Antwort einzeln zeigen.
        const details = e.versuche && e.versuche.length > 1
          ? `<details class="versuche"><summary>${e.versuche.length} Endpunkte probiert</summary><ul>${
              e.versuche.map(v => `<li>${esc(v.slice(0, 300))}</li>`).join("")}</ul></details>`
          : "";
        tr.lastElementChild.innerHTML = `<span class="status st-red">nicht verfügbar</span> <span class="muted">${esc(grund)}</span>${details}`;
      }
    }
  };
}

// ===========================================================================
// Ereignisse
// ===========================================================================

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".nav-btn").forEach(b => { b.onclick = () => zeigeAnsicht(b.dataset.view); });
  document.getElementById("btnLogout").onclick = logout;
  document.getElementById("btnModalClose").onclick = () => Dialog.schliesse();
  document.getElementById("detailModal").addEventListener("click", e => {
    if (e.target.id === "detailModal") Dialog.schliesse();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && Dialog.offen) Dialog.schliesse(); });
  start();
});
