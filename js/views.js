"use strict";

// Alle Ansichten der App. Jede Funktion rendert in ihren Container und ist
// mehrfach aufrufbar (Neuladen über die Aktualisieren-Schaltfläche).

// Kleiner Helfer für Unterreiter innerhalb einer Ansicht. Ohne ausdrücklichen
// Wunsch öffnet er den zuletzt benutzten Reiter (im Browser gemerkt).
function subTabs(container, tabs, aktiv) {
  const merkKey = "cc-tab-" + container.id;
  if (!aktiv) {
    try { aktiv = localStorage.getItem(merkKey); } catch (e) { /* kein Speicher */ }
  }
  if (!tabs.some(t => t.key === aktiv)) aktiv = tabs[0].key;
  container.innerHTML = `
    <div class="subnav">${tabs.map(t =>
      `<button class="sub-btn${t.key === aktiv ? " active" : ""}" data-sub="${t.key}">${esc(t.label)}</button>`).join("")}</div>
    <div class="sub-inhalt"></div>`;
  const inhalt = container.querySelector(".sub-inhalt");
  const zeige = key => {
    try { localStorage.setItem(merkKey, key); } catch (e) { /* kein Speicher */ }
    container.querySelectorAll(".sub-btn").forEach(b => b.classList.toggle("active", b.dataset.sub === key));
    inhalt.innerHTML = ladeBox();
    const tab = tabs.find(t => t.key === key);
    Promise.resolve(tab.render(inhalt)).catch(e => { inhalt.innerHTML = fehlerBox(e, tab.label); });
  };
  container.querySelectorAll(".sub-btn").forEach(b => { b.onclick = () => zeige(b.dataset.sub); });
  zeige(aktiv);
}

function kachel(label, wert, zusatz = "", klasse = "") {
  return `<div class="stat-tile ${klasse}">
    <div class="stat-num">${esc(wert)}</div>
    <div class="stat-label">${esc(label)}</div>
    ${zusatz ? `<div class="stat-sub">${zusatz}</div>` : ""}
  </div>`;
}

// ===========================================================================
// Dashboard
// ===========================================================================

async function renderDashboard(el) {
  el.innerHTML = `
    <div id="dashListenHinweis"></div>
    <div class="card">
      <div class="card-head">
        <h2>Compliance-Cockpit</h2>
        <button class="btn-ghost-dark" id="btnRefreshDash">Aktualisieren</button>
      </div>
      <div class="stat-row" id="dashKacheln">${ladeBox("Governance-Daten werden geladen …")}</div>
      <div id="dashFrameworks"></div>
    </div>
    <div class="card">
      <div class="card-head">
        <h2>Arbeitsvorrat</h2>
        <span class="muted">Alle Fristen aus allen Bereichen, Klick öffnet den Eintrag</span>
      </div>
      <div id="dashArbeit">${ladeBox()}</div>
    </div>
    <div class="card">
      <h2>Microsoft 365 – Live</h2>
      <p class="hint">Werte direkt aus Microsoft Graph. Fehlt eine Berechtigung oder Lizenz, wird nur die betroffene Kachel ausgeblendet.</p>
      <div class="stat-row" id="dashLive">${ladeBox("Microsoft-365-Signale werden abgerufen …")}</div>
    </div>`;

  document.getElementById("btnRefreshDash").onclick = () => { Store.invalidate(); renderDashboard(el); };

  // --- Governance-Kacheln
  try {
    const d = await Store.alle();
    const { controls, aufgaben, risiken, vorfaelle, vvt, anfragen } = d;
    const offeneAufgaben = aufgaben.filter(a => a.Status === "Offen" || a.Status === "In Arbeit");
    const ueberfaellig = offeneAufgaben.filter(a => istUeberfaellig(a.Faellig));
    const hoheRisiken = risiken.filter(r => Number(r.Bewertung) >= 15 && r.Status !== "Geschlossen");
    const offeneVorfaelle = vorfaelle.filter(v => v.Status !== "Abgeschlossen");
    const offeneAnfragen = anfragen.filter(anfrageOffen);
    const knappeAnfragen = offeneAnfragen.filter(a => a.Frist && tageBis(a.Frist) <= 7);
    document.getElementById("dashKacheln").innerHTML =
      kachel("Umsetzungsgrad Controls", umsetzungsgrad(controls) + " %", `${controls.length} Controls`) +
      kachel("Offene Aufgaben", offeneAufgaben.length, ueberfaellig.length ? `<span class="ueberfaellig">${ueberfaellig.length} überfällig</span>` : "im Plan") +
      kachel("Risiken hoch", hoheRisiken.length, `${risiken.length} bewertet`) +
      kachel("Offene Vorfälle", offeneVorfaelle.length, `${vorfaelle.length} insgesamt`) +
      kachel("Betroffenenanfragen", offeneAnfragen.length,
        knappeAnfragen.length ? `<span class="ueberfaellig">${knappeAnfragen.length} mit Frist ≤ 7 Tage</span>` : "offen") +
      kachel("Verarbeitungstätigkeiten", vvt.length, `${vvt.filter(v => v.Status === "Freigegeben").length} freigegeben`);

    // Fortschritt je Framework
    const aktive = (Store.konfig.frameworks || []).filter(k => CC_FRAMEWORKS[k]);
    document.getElementById("dashFrameworks").innerHTML = aktive.map(k => {
      const teil = controls.filter(c => c.Framework === k);
      const p = umsetzungsgrad(teil);
      return `<div class="fortschritt-zeile">
        <span class="fortschritt-label">${esc(CC_FRAMEWORKS[k].kurz)} <span class="muted">(${teil.length} Controls)</span></span>
        <span class="fortschritt-bar"><span style="width:${p}%"></span></span>
        <span class="fortschritt-wert">${p} %</span>
      </div>`;
    }).join("") || `<p class="muted">Noch keine Frameworks importiert – siehe Einstellungen.</p>`;

    // Fehlt nach einem Update eine neue Liste, darauf hinweisen statt zu scheitern.
    if (Store.fehlendeListen.size) {
      document.getElementById("dashListenHinweis").innerHTML = hinweisBox(
        `<strong>Noch nicht angelegt:</strong> ${esc([...Store.fehlendeListen].join(", "))}.
         ${Store.rolle.admin ? `Bitte unter <strong>Einstellungen → „Listen prüfen / anlegen“</strong> nachziehen.`
           : "Bitte einen Administrator bitten, die Listen anzulegen."}`, "warn");
    }
    renderArbeitsvorrat(document.getElementById("dashArbeit"));
  } catch (e) {
    document.getElementById("dashKacheln").innerHTML = fehlerBox(e, "Governance-Daten");
    document.getElementById("dashArbeit").innerHTML = "";
  }

  // --- Live-Kacheln (jede für sich, damit ein fehlendes Recht nicht alles kippt)
  const live = document.getElementById("dashLive");
  live.innerHTML = "";
  const liveKacheln = [
    { label: "Secure Score", laden: async () => { const s = await Purview.secureScore();
        return s ? { wert: s.prozent + " %", zusatz: `${Math.round(s.punkte)} von ${s.max} Punkten` } : null; } },
    { label: "Offene Warnungen", laden: async () => { const a = await Purview.alerts({ top: 100, nurOffen: true });
        return { wert: a.length, zusatz: `${a.filter(x => x.schwere === "high").length} hoch` }; } },
    { label: "DLP-Warnungen", laden: async () => { const a = await Purview.dlpAlerts({ top: 100 });
        return { wert: a.length, zusatz: "Purview DLP" }; } },
    { label: "Betroffenenanfragen", laden: async () => { const r = await Purview.subjectRightsRequests();
        return { wert: r.filter(x => x.status !== "closed").length, zusatz: `${r.length} insgesamt` }; } },
    { label: "Geräte konform", laden: async () => { const g = await Purview.geraeteKonformitaet();
        return { wert: g.gesamt ? Math.round(g.konform / g.gesamt * 100) + " %" : "–", zusatz: `${g.nichtKonform} nicht konform` }; } }
  ];
  for (const k of liveKacheln) {
    const platz = document.createElement("div");
    platz.className = "stat-tile stat-laden";
    platz.innerHTML = `<div class="stat-num">…</div><div class="stat-label">${esc(k.label)}</div>`;
    live.appendChild(platz);
    k.laden().then(r => {
      if (!r) { platz.remove(); return; }
      platz.className = "stat-tile";
      platz.innerHTML = `<div class="stat-num">${esc(r.wert)}</div><div class="stat-label">${esc(k.label)}</div>
        <div class="stat-sub">${esc(r.zusatz || "")}</div>`;
    }).catch(e => {
      if (e.nichtLizenziert) { platz.remove(); return; }
      platz.className = "stat-tile stat-fehlt";
      platz.innerHTML = `<div class="stat-num">–</div><div class="stat-label">${esc(k.label)}</div>
        <div class="stat-sub">${e.name === "BerechtigungFehlt" ? "Berechtigung fehlt"
          : e.nichtLizenziert ? "nicht lizenziert" : "nicht verfügbar"}</div>`;
    });
  }
}

// ===========================================================================
// Microsoft 365 / Purview
// ===========================================================================

function renderPurview(el) {
  el.innerHTML = `<div class="card">
    <div class="card-head"><h2>Microsoft 365 &amp; Purview – Live</h2></div>
    <div id="purviewTabs"></div></div>`;
  subTabs(document.getElementById("purviewTabs"), [
    { key: "warnungen", label: "Warnungen & Vorfälle", render: renderWarnungen },
    { key: "audit",     label: "Überwachungsprotokoll", render: renderAudit },
    { key: "labels",    label: "Klassifizierung & Aufbewahrung", render: renderLabels },
    { key: "ediscovery",label: "eDiscovery", render: renderEdiscovery },
    { key: "srr",       label: "Betroffenenanfragen", render: renderSrr },
    { key: "identitaet",label: "Identität & Zugriff", render: renderIdentitaet },
    { key: "geraete",   label: "Geräte", render: renderGeraete },
    { key: "score",     label: "Secure Score", render: renderSecureScore }
  ], tabWunsch("purview"));
}

async function renderWarnungen(el) {
  const [alerts, incidents] = await Promise.all([
    Purview.alerts({ top: 100 }),
    Purview.incidents({ top: 50 }).catch(() => [])
  ]);
  el.innerHTML = `
    <div class="filter-bar">
      <select id="fSchwere"><option value="">Schwere: alle</option><option>high</option><option>medium</option><option>low</option><option>informational</option></select>
      <select id="fStatus"><option value="">Status: alle</option><option>new</option><option>inProgress</option><option>resolved</option></select>
      <select id="fQuelle"><option value="">Quelle: alle</option>${
        [...new Set(alerts.map(a => a.quelle).filter(Boolean))].map(q => `<option>${esc(q)}</option>`).join("")}</select>
      <button class="btn-csv" id="btnCsvAlerts">CSV</button>
    </div>
    <div id="alertTabelle"></div>
    <h3 class="abschnitt">Vorfälle (Defender XDR)</h3>
    <div id="incidentTabelle"></div>`;

  const spalten = [
    { key: "schwere", label: "Schwere", render: a => `<span class="status ${a.schwere === "high" ? "st-red" : a.schwere === "medium" ? "st-yellow" : "st-gray"}">${esc(a.schwere)}</span>` },
    { key: "titel", label: "Warnung" },
    { key: "quelle", label: "Quelle" },
    { key: "status", label: "Status", render: a => statusBadge(a.status === "new" ? "Offen" : a.status === "inProgress" ? "In Bearbeitung" : "Abgeschlossen") },
    { key: "erstellt", label: "Erstellt", render: a => fmtDatumZeit(a.erstellt) }
  ];
  const zeige = () => {
    const s = document.getElementById("fSchwere").value;
    const st = document.getElementById("fStatus").value;
    const q = document.getElementById("fQuelle").value;
    const gefiltert = alerts.filter(a => (!s || a.schwere === s) && (!st || a.status === st) && (!q || a.quelle === q));
    document.getElementById("alertTabelle").innerHTML = tabelleHtml(gefiltert, spalten, { leer: "Keine Warnungen." });
    document.querySelectorAll("#alertTabelle [data-idx]").forEach(tr => {
      tr.onclick = () => zeigeAlert(gefiltert[Number(tr.dataset.idx)], () => renderWarnungen(el));
    });
    el._alerts = gefiltert;
  };
  ["fSchwere", "fStatus", "fQuelle"].forEach(id => { document.getElementById(id).onchange = zeige; });
  document.getElementById("btnCsvAlerts").onclick = () => csvExport("purview_warnungen.csv", el._alerts || alerts,
    [{ key: "erstellt", label: "Erstellt" }, { key: "schwere", label: "Schwere" }, { key: "titel", label: "Warnung" },
     { key: "quelle", label: "Quelle" }, { key: "kategorie", label: "Kategorie" }, { key: "status", label: "Status" }]);
  zeige();

  document.getElementById("incidentTabelle").innerHTML = tabelleHtml(incidents, [
    { key: "titel", label: "Vorfall" },
    { key: "schwere", label: "Schwere" },
    { key: "status", label: "Status" },
    { key: "klassifizierung", label: "Klassifizierung" },
    { key: "erstellt", label: "Erstellt", render: i => fmtDatumZeit(i.erstellt) }
  ], { leer: "Keine Vorfälle abrufbar." });
  document.querySelectorAll("#incidentTabelle [data-idx]").forEach(tr => {
    tr.onclick = () => { const i = incidents[Number(tr.dataset.idx)]; if (i.webUrl) window.open(i.webUrl, "_blank", "noopener"); };
  });
}

function zeigeAlert(a, neuladen) {
  const aktionen = [];
  if (CC_CONFIG.erlaubeSchreibaktionen && a.status !== "resolved") {
    aktionen.push({ label: "In Bearbeitung setzen", klasse: "btn-primary", onClick: async () => {
      try { await Purview.setzeAlertStatus(a.id, "inProgress"); toast("Status gesetzt."); Dialog.schliesse(); neuladen(); }
      catch (e) { toast("Fehlgeschlagen: " + e.message, 6000); }
    } });
    aktionen.push({ label: "Als behoben schließen", klasse: "btn-approve", onClick: async () => {
      try { await Purview.setzeAlertStatus(a.id, "resolved", "truePositive"); toast("Warnung geschlossen."); Dialog.schliesse(); neuladen(); }
      catch (e) { toast("Fehlgeschlagen: " + e.message, 6000); }
    } });
  }
  aktionen.push({ label: "Aufgabe daraus anlegen", klasse: "btn-secondary", onClick: () => {
    Dialog.schliesse();
    oeffneEditor("aufgaben", {
      Title: "Warnung bearbeiten: " + a.titel,
      Beschreibung: `${a.beschreibung || ""}\n\nQuelle: ${a.quelle} · Schwere: ${a.schwere}\n${a.webUrl || ""}`,
      Prioritaet: a.schwere === "high" ? "Hoch" : "Mittel",
      Status: "Offen", Quelle: "Microsoft Defender / Purview",
      Faellig: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
    }, () => toast("Aufgabe angelegt."));
  } });

  Dialog.zeige({
    titel: a.titel,
    breit: true,
    html: `<table class="detail-table">
      <tr><td class="dt">Schwere</td><td>${esc(a.schwere)}</td></tr>
      <tr><td class="dt">Status</td><td>${esc(a.status)}</td></tr>
      <tr><td class="dt">Quelle</td><td>${esc(a.quelle)}</td></tr>
      <tr><td class="dt">Kategorie</td><td>${esc(a.kategorie || "")}</td></tr>
      <tr><td class="dt">Erstellt</td><td>${fmtDatumZeit(a.erstellt)}</td></tr>
      <tr><td class="dt">Zugewiesen an</td><td>${esc(a.zugewiesen || "–")}</td></tr>
      <tr><td class="dt">Beschreibung</td><td>${esc(a.beschreibung || "")}</td></tr>
      ${a.webUrl ? `<tr><td class="dt">Portal</td><td><a href="${esc(a.webUrl)}" target="_blank" rel="noopener">In Microsoft Defender öffnen</a></td></tr>` : ""}
    </table>`,
    aktionen
  });
}

async function renderAudit(el) {
  const heute = new Date().toISOString().slice(0, 10);
  const vor7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  el.innerHTML = `
    <div class="card-inline">
      <h3>Suche im einheitlichen Überwachungsprotokoll</h3>
      <p class="hint">Entspricht der Überwachungssuche in Microsoft Purview. Die Suche läuft serverseitig und kann einige Minuten dauern.</p>
      <div class="form-grid">
        <label>Von<input type="date" id="aVon" value="${vor7}"></label>
        <label>Bis<input type="date" id="aBis" value="${heute}"></label>
        <label>Benutzer (UPN, kommagetrennt)<input type="text" id="aUser" placeholder="max.muster@dihag.com"></label>
        <label>Aktivitäten (kommagetrennt)<input type="text" id="aOps" placeholder="FileDeleted, UserLoggedIn"></label>
        <label class="span2">Stichwort<input type="text" id="aKey" placeholder="z. B. Dateiname oder Site"></label>
      </div>
      <button class="btn-primary" id="btnAuditStart">Suche starten</button>
      <div id="auditStatus"></div>
      <div id="auditErgebnis"></div>
    </div>
    <h3 class="abschnitt">Entra-Verzeichnisprotokoll (sofort verfügbar)</h3>
    <div id="entraAudit">${ladeBox()}</div>`;

  document.getElementById("btnAuditStart").onclick = async () => {
    const status = document.getElementById("auditStatus");
    const erg = document.getElementById("auditErgebnis");
    erg.innerHTML = "";
    status.innerHTML = ladeBox("Suchauftrag wird angelegt …");
    try {
      const auftrag = await Purview.auditQueryStart({
        von: document.getElementById("aVon").value,
        bis: document.getElementById("aBis").value,
        benutzer: teileListe(document.getElementById("aUser").value),
        operationen: teileListe(document.getElementById("aOps").value),
        stichwort: document.getElementById("aKey").value.trim()
      });
      let versuche = 0;
      const pollen = async () => {
        versuche++;
        const s = await Purview.auditQueryStatus(auftrag.id);
        status.innerHTML = ladeBox(`Suchstatus: ${s.status} (Abfrage ${versuche}) …`);
        if (s.status === "succeeded") {
          const rec = await Purview.auditQueryRecords(auftrag.id, 200);
          status.innerHTML = hinweisBox(`<strong>${rec.length} Datensätze</strong> gefunden.`, "info");
          erg.innerHTML = tabelleHtml(rec, [
            { key: "zeit", label: "Zeit", render: r => fmtDatumZeit(r.zeit) },
            { key: "benutzer", label: "Benutzer" },
            { key: "operation", label: "Aktivität" },
            { key: "dienst", label: "Dienst" },
            { key: "objekt", label: "Objekt" },
            { key: "ip", label: "IP" }
          ], { leer: "Keine Datensätze im gewählten Zeitraum." }) +
          `<button class="btn-csv" id="btnAuditCsv">CSV-Export</button>`;
          const btn = document.getElementById("btnAuditCsv");
          if (btn) btn.onclick = () => csvExport("audit_" + new Date().toISOString().slice(0, 10) + ".csv", rec,
            [{ key: "zeit", label: "Zeit" }, { key: "benutzer", label: "Benutzer" }, { key: "operation", label: "Aktivität" },
             { key: "dienst", label: "Dienst" }, { key: "objekt", label: "Objekt" }, { key: "ip", label: "IP" }]);
        } else if (s.status === "failed" || versuche > 40) {
          status.innerHTML = hinweisBox(`Suche beendet mit Status <strong>${esc(s.status)}</strong>.`, "warn");
        } else {
          setTimeout(pollen, 5000);
        }
      };
      setTimeout(pollen, 3000);
    } catch (e) {
      status.innerHTML = fehlerBox(e, "Überwachungssuche");
    }
  };

  try {
    const eintraege = await Purview.directoryAudits({ top: 100 });
    document.getElementById("entraAudit").innerHTML = tabelleHtml(eintraege, [
      { key: "zeit", label: "Zeit", render: a => fmtDatumZeit(a.zeit) },
      { key: "kategorie", label: "Kategorie" },
      { key: "aktivitaet", label: "Aktivität" },
      { key: "akteur", label: "Ausgelöst von" },
      { key: "ziel", label: "Ziel" },
      { key: "ergebnis", label: "Ergebnis", render: a => statusBadge(a.ergebnis === "success" ? "Erfolgt" : a.ergebnis) }
    ], { leer: "Keine Einträge." });
  } catch (e) {
    document.getElementById("entraAudit").innerHTML = fehlerBox(e, "Entra-Verzeichnisprotokoll");
  }
}

async function renderLabels(el) {
  el.innerHTML = `
    <h3>Vertraulichkeitsbezeichnungen</h3>
    <div id="sensLabels">${ladeBox()}</div>
    <h3 class="abschnitt">Aufbewahrungsbezeichnungen</h3>
    <div id="retLabels">${ladeBox()}</div>`;

  Purview.sensitivityLabels().then(labels => {
    document.getElementById("sensLabels").innerHTML = tabelleHtml(labels, [
      { key: "name", label: "Bezeichnung" },
      { key: "uebergeordnet", label: "Übergeordnet" },
      { key: "beschreibung", label: "Beschreibung" },
      { key: "aktiv", label: "Aktiv", render: l => statusBadge(l.aktiv ? "Ja" : "Nein") }
    ], { leer: "Keine Bezeichnungen veröffentlicht." });
  }).catch(e => { document.getElementById("sensLabels").innerHTML = fehlerBox(e, "Vertraulichkeitsbezeichnungen"); });

  Purview.retentionLabels().then(labels => {
    const neuBtn = CC_CONFIG.erlaubeSchreibaktionen && Store.rolle.admin
      ? `<button class="btn-primary btn-small" id="btnNeuesRetLabel">+ Aufbewahrungsbezeichnung</button>` : "";
    document.getElementById("retLabels").innerHTML = neuBtn + tabelleHtml(labels, [
      { key: "name", label: "Bezeichnung" },
      { key: "dauer", label: "Aufbewahrung" },
      { key: "aktion", label: "Verhalten" },
      { key: "basis", label: "Danach" },
      { key: "beschreibung", label: "Beschreibung" }
    ], { leer: "Keine Aufbewahrungsbezeichnungen vorhanden." });
    const btn = document.getElementById("btnNeuesRetLabel");
    if (btn) btn.onclick = () => oeffneRetentionDialog(() => renderLabels(el));
  }).catch(e => { document.getElementById("retLabels").innerHTML = fehlerBox(e, "Aufbewahrungsbezeichnungen"); });
}

function oeffneRetentionDialog(neuladen) {
  Dialog.zeige({
    titel: "Neue Aufbewahrungsbezeichnung",
    html: `<div class="form-grid">
      <label class="span2">Name *<input type="text" id="rlName" maxlength="64"></label>
      <label class="span2">Beschreibung für Benutzer<textarea id="rlBesch" rows="2"></textarea></label>
      <label>Aufbewahrungsdauer (Jahre) *<input type="number" id="rlJahre" min="1" max="100" value="10"></label>
      <label>Verhalten<select id="rlVerhalten">
        <option value="retain">Aufbewahren</option>
        <option value="retainAsRecord">Als Datensatz aufbewahren</option>
        <option value="retainAsRegulatoryRecord">Als gesetzlicher Datensatz</option>
      </select></label>
      <label>Nach Ablauf<select id="rlDanach">
        <option value="none">Nichts tun</option>
        <option value="delete">Löschen</option>
        <option value="startDispositionReview">Entsorgungsprüfung starten</option>
      </select></label>
    </div>
    <p class="hint">Die Bezeichnung wird in Microsoft Purview angelegt. Die Veröffentlichung über eine
       Bezeichnungsrichtlinie erfolgt anschließend im Purview-Portal.</p>`,
    aktionen: [{ label: "Anlegen", klasse: "btn-primary", onClick: async () => {
      const name = document.getElementById("rlName").value.trim();
      if (!name) { toast("Bitte einen Namen angeben."); return; }
      try {
        await Purview.createRetentionLabel({
          name,
          beschreibung: document.getElementById("rlBesch").value.trim(),
          jahre: Number(document.getElementById("rlJahre").value) || 10,
          verhalten: document.getElementById("rlVerhalten").value,
          danach: document.getElementById("rlDanach").value
        });
        Dialog.schliesse();
        toast("Aufbewahrungsbezeichnung angelegt.");
        neuladen();
      } catch (e) { toast("Anlegen fehlgeschlagen: " + e.message, 7000); }
    } }]
  });
}

async function renderEdiscovery(el) {
  const faelle = await Purview.ediscoveryCases();
  const neuBtn = CC_CONFIG.erlaubeSchreibaktionen && Store.rolle.admin
    ? `<button class="btn-primary btn-small" id="btnNeuerFall">+ Fall anlegen</button>` : "";
  el.innerHTML = neuBtn + tabelleHtml(faelle, [
    { key: "name", label: "Fall" },
    { key: "status", label: "Status", render: f => statusBadge(f.status === "active" ? "Aktiv" : f.status) },
    { key: "beschreibung", label: "Beschreibung" },
    { key: "erstellt", label: "Erstellt", render: f => fmtDatum(f.erstellt) },
    { key: "geschlossen", label: "Geschlossen", render: f => fmtDatum(f.geschlossen) }
  ], { leer: "Keine eDiscovery-Fälle vorhanden." });

  const btn = document.getElementById("btnNeuerFall");
  if (btn) btn.onclick = () => Dialog.zeige({
    titel: "Neuer eDiscovery-Fall",
    html: `<div class="form-grid">
      <label class="span2">Name *<input type="text" id="edName"></label>
      <label class="span2">Beschreibung<textarea id="edBesch" rows="3"></textarea></label>
    </div>
    <p class="hint">Datenquellen, Suchen und Exporte werden anschließend im Purview-Portal bearbeitet.</p>`,
    aktionen: [{ label: "Anlegen", klasse: "btn-primary", onClick: async () => {
      const name = document.getElementById("edName").value.trim();
      if (!name) { toast("Bitte einen Namen angeben."); return; }
      try {
        await Purview.createEdiscoveryCase({ name, beschreibung: document.getElementById("edBesch").value.trim() });
        Dialog.schliesse(); toast("Fall angelegt."); renderEdiscovery(el);
      } catch (e) { toast("Anlegen fehlgeschlagen: " + e.message, 7000); }
    } }]
  });
}

async function renderSrr(el) {
  let anfragen;
  try {
    anfragen = await Purview.subjectRightsRequests();
  } catch (e) {
    if (!e.nichtLizenziert) throw e;
    el.innerHTML = fehlerBox(e, "Microsoft Priva") + `
      <p>Betroffenenanfragen führen Sie stattdessen im eigenen Register mit Fristüberwachung,
         Antwortentwürfen und eDiscovery-Anbindung.</p>
      <button class="btn-primary" id="btnZumRegister">Zum Register für Betroffenenanfragen</button>`;
    document.getElementById("btnZumRegister").onclick = () => {
      _tabWunsch.datenschutz = "anfragen";
      zeigeAnsicht("datenschutz");
    };
    return;
  }
  el.innerHTML = `
    <p class="hint">Betroffenenanfragen aus Microsoft Priva/Purview. Die Monatsfrist des Art. 12 Abs. 3 DSGVO
       wird farblich hervorgehoben.</p>
    ${tabelleHtml(anfragen, [
      { key: "name", label: "Anfrage" },
      { key: "typ", label: "Typ" },
      { key: "betroffen", label: "Betroffene Person", render: r => esc([r.betroffen, r.email].filter(Boolean).join(" · ")) },
      { key: "status", label: "Status", render: r => statusBadge(r.status === "closed" ? "Abgeschlossen" : r.status === "active" ? "In Bearbeitung" : r.status) },
      { key: "faellig", label: "Frist", render: r => {
          if (!r.faellig) return "";
          const t = Math.ceil((new Date(r.faellig) - new Date()) / 86400000);
          return `<span class="${t < 0 ? "ueberfaellig" : t < 7 ? "warnung" : ""}">${fmtDatum(r.faellig)}</span>`;
        } },
      { key: "erstellt", label: "Eingegangen", render: r => fmtDatum(r.erstellt) }
    ], { leer: "Keine Betroffenenanfragen vorhanden." })}`;
}

async function renderIdentitaet(el) {
  el.innerHTML = `
    <div class="stat-row" id="idKacheln"></div>
    <h3>Richtlinien für bedingten Zugriff</h3>
    <div id="caTabelle">${ladeBox()}</div>
    <h3 class="abschnitt">Privilegierte Verzeichnisrollen</h3>
    <div id="rollenTabelle">${ladeBox()}</div>`;

  Purview.benutzerStatistik().then(s => {
    document.getElementById("idKacheln").innerHTML =
      kachel("Konten gesamt", s.gesamt) + kachel("Gastkonten", s.gaeste) + kachel("Deaktiviert", s.deaktiviert);
  }).catch(() => {});

  Purview.conditionalAccessPolicies().then(p => {
    document.getElementById("caTabelle").innerHTML = tabelleHtml(p, [
      { key: "name", label: "Richtlinie" },
      { key: "status", label: "Status", render: x => statusBadge(x.status === "enabled" ? "Aktiv" : x.status === "enabledForReportingButNotEnforced" ? "Nur Bericht" : "Nein") },
      { key: "kontrollen", label: "Kontrollen" },
      { key: "geaendert", label: "Zuletzt geändert", render: x => fmtDatum(x.geaendert) }
    ], { leer: "Keine Richtlinien abrufbar." });
  }).catch(e => { document.getElementById("caTabelle").innerHTML = fehlerBox(e, "Bedingter Zugriff"); });

  Purview.privilegierteRollen().then(r => {
    document.getElementById("rollenTabelle").innerHTML = tabelleHtml(r, [
      { key: "name", label: "Rolle" },
      { key: "anzahl", label: "Mitglieder", render: x => x.mitglieder.length },
      { key: "mitglieder", label: "Zugewiesen an", render: x => esc(x.mitglieder.join(", ")) }
    ], { leer: "Keine Rollen abrufbar." });
  }).catch(e => { document.getElementById("rollenTabelle").innerHTML = fehlerBox(e, "Verzeichnisrollen"); });
}

async function renderGeraete(el) {
  el.innerHTML = `<div class="stat-row" id="gKacheln">${ladeBox()}</div>
    <h3>Gerätekonformitätsrichtlinien</h3><div id="gPolicies">${ladeBox()}</div>
    <h3 class="abschnitt">Nicht konforme Geräte</h3><div id="gGeraete"></div>`;
  try {
    const g = await Purview.geraeteKonformitaet();
    document.getElementById("gKacheln").innerHTML =
      kachel("Verwaltete Geräte", g.gesamt) + kachel("Konform", g.konform) + kachel("Nicht konform", g.nichtKonform);
    document.getElementById("gGeraete").innerHTML = tabelleHtml(
      g.geraete.filter(x => x.status !== "compliant"), [
        { key: "name", label: "Gerät" },
        { key: "os", label: "Betriebssystem" },
        { key: "benutzer", label: "Benutzer" },
        { key: "status", label: "Status" },
        { key: "sync", label: "Letzte Synchronisierung", render: x => fmtDatumZeit(x.sync) }
      ], { leer: "Alle verwalteten Geräte sind konform." });
  } catch (e) {
    document.getElementById("gKacheln").innerHTML = fehlerBox(e, "Geräte");
  }
  Purview.geraeteRichtlinien().then(p => {
    document.getElementById("gPolicies").innerHTML = tabelleHtml(p, [
      { key: "name", label: "Richtlinie" },
      { key: "plattform", label: "Plattform" },
      { key: "geaendert", label: "Zuletzt geändert", render: x => fmtDatum(x.geaendert) }
    ], { leer: "Keine Richtlinien vorhanden." });
  }).catch(e => { document.getElementById("gPolicies").innerHTML = fehlerBox(e, "Gerätekonformitätsrichtlinien"); });
}

async function renderSecureScore(el) {
  const s = await Purview.secureScore();
  if (!s) { el.innerHTML = hinweisBox("Kein Secure Score verfügbar.", "warn"); return; }
  const bereiche = {};
  s.bereiche.forEach(b => {
    const k = b.kategorie || "Sonstige";
    bereiche[k] = (bereiche[k] || 0) + (Number(b.punkte) || 0);
  });
  el.innerHTML = `
    <div class="stat-row">
      ${kachel("Secure Score", s.prozent + " %", `${Math.round(s.punkte)} von ${s.max} Punkten`)}
      ${kachel("Stand", fmtDatum(s.datum))}
      ${kachel("Lizenzierte Benutzer", s.lizenzierteNutzer || "–")}
    </div>
    <h3>Punkte je Kategorie</h3>
    ${Object.entries(bereiche).map(([k, v]) => `<div class="fortschritt-zeile">
        <span class="fortschritt-label">${esc(k)}</span>
        <span class="fortschritt-bar"><span style="width:${Math.min(100, Math.round(v / (s.max || 1) * 100))}%"></span></span>
        <span class="fortschritt-wert">${Math.round(v)}</span></div>`).join("")}
    <h3 class="abschnitt">Maßnahmen mit offenen Punkten</h3>
    ${tabelleHtml(s.bereiche.filter(b => (Number(b.punkte) || 0) === 0).slice(0, 40), [
      { key: "name", label: "Maßnahme" },
      { key: "kategorie", label: "Kategorie" },
      { key: "beschreibung", label: "Beschreibung" }
    ], { leer: "Keine offenen Maßnahmen." })}`;
}

// ===========================================================================
// Controls
// ===========================================================================

async function renderControls(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>Controls &amp; Normenkataloge</h2>
        <button class="btn-ghost-dark" id="btnControlsRefresh">Aktualisieren</button>
      </div>
      <div id="controlsUebersicht">${ladeBox()}</div>
    </div>
    <div class="card"><div id="controlsListe"></div></div>`;

  document.getElementById("btnControlsRefresh").onclick = () => { Store.invalidate("controls"); renderControls(el); };

  let controls;
  try { controls = await Store.load("controls"); }
  catch (e) {
    document.getElementById("controlsUebersicht").innerHTML = fehlerBox(e, "Control-Liste");
    return;
  }

  if (!controls.length) {
    document.getElementById("controlsUebersicht").innerHTML = hinweisBox(
      `Es sind noch keine Controls vorhanden. Ein Administrator kann die Normenkataloge unter
       <strong>Einstellungen → Normenkatalog importieren</strong> einspielen.`, "info");
    return;
  }

  const frameworks = [...new Set(controls.map(c => c.Framework))];
  document.getElementById("controlsUebersicht").innerHTML = `
    <div class="stat-row">
      ${kachel("Controls", controls.length)}
      ${kachel("Umgesetzt", controls.filter(c => c.Status === "Umgesetzt").length)}
      ${kachel("In Umsetzung", controls.filter(c => c.Status === "In Umsetzung").length)}
      ${kachel("Offen", controls.filter(c => c.Status === "Offen").length)}
      ${kachel("Ø Reifegrad", (controls.reduce((s, c) => s + reifegradWert(c.Reifegrad), 0) / controls.length).toFixed(1))}
    </div>
    ${frameworks.map(f => {
      const teil = controls.filter(c => c.Framework === f);
      const p = umsetzungsgrad(teil);
      return `<div class="fortschritt-zeile">
        <span class="fortschritt-label">${esc((CC_FRAMEWORKS[f] || {}).label || f)}</span>
        <span class="fortschritt-bar"><span style="width:${p}%"></span></span>
        <span class="fortschritt-wert">${p} %</span></div>`;
    }).join("")}`;

  renderEntity(document.getElementById("controlsListe"), "controls", {
    filter: ["Framework", "Status", "Reifegrad"],
    onOeffnen: c => zeigeControl(c, () => renderControls(el))
  });
}

async function zeigeControl(c, neuladen) {
  const signal = CC_SIGNALE[c.M365Signal];
  Dialog.zeige({
    titel: `${c.Title} – ${c.Bezeichnung}`,
    breit: true,
    html: `
      <table class="detail-table">
        <tr><td class="dt">Framework</td><td>${esc((CC_FRAMEWORKS[c.Framework] || {}).label || c.Framework)}</td></tr>
        <tr><td class="dt">Anforderung</td><td>${esc(c.Anforderung)}</td></tr>
        <tr><td class="dt">Status</td><td>${statusBadge(c.Status)}</td></tr>
        <tr><td class="dt">Reifegrad</td><td>${esc(c.Reifegrad || "–")}</td></tr>
        <tr><td class="dt">Verantwortlich</td><td>${esc(c.Verantwortlich || "–")}</td></tr>
        <tr><td class="dt">Umsetzung</td><td>${esc(c.Umsetzung || "–")}</td></tr>
        <tr><td class="dt">Nachweis (Fundstelle)</td><td>${esc(c.NachweisText || "–")}</td></tr>
        <tr><td class="dt">Letzte Prüfung</td><td>${fmtDatum(c.LetztePruefung) || "–"}</td></tr>
        <tr><td class="dt">Nächste Prüfung</td><td>${fmtDatum(c.NaechstePruefung) || "–"}</td></tr>
      </table>
      ${signal ? `<div class="signal-box">
        <strong>Live-Nachweis aus Microsoft 365:</strong> ${esc(signal.label)}
        <div id="signalWert">${ladeBox("Signal wird abgerufen …")}</div>
      </div>` : ""}
      <div class="verknuepfungen">
        <strong>Verknüpft</strong>
        <div id="controlVerknuepfungen">${ladeBox("Verknüpfungen werden gesucht …")}</div>
      </div>
      ${nachweisHtml()}`,
    link: linkZuEintrag("controls", c.id),
    aktionen: [
      { label: "Bearbeiten", klasse: "btn-primary", onClick: () => { Dialog.schliesse(); oeffneEditor("controls", c, neuladen); } },
      { label: "Aufgabe anlegen", klasse: "btn-secondary", onClick: () => {
          Dialog.schliesse();
          oeffneEditor("aufgaben", {
            Title: `${c.Title}: `, ControlId: c.Title, Status: "Offen", Prioritaet: "Mittel",
            Verantwortlich: c.Verantwortlich || "",
            Faellig: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
            Quelle: "Control-Prüfung"
          }, () => toast("Aufgabe angelegt."));
        } },
      { label: "Geprüft (heute)", klasse: "btn-approve", onClick: async () => {
          const monate = Number(Store.konfig.pruefzyklusMonate) || 12;
          const naechste = new Date(); naechste.setMonth(naechste.getMonth() + monate);
          try {
            await Store.save("controls", c.id, {
              LetztePruefung: new Date().toISOString().slice(0, 10),
              NaechstePruefung: naechste.toISOString().slice(0, 10)
            });
            Dialog.schliesse(); toast("Prüfung dokumentiert."); neuladen();
          } catch (e) { toast("Speichern fehlgeschlagen: " + e.message, 6000); }
        } }
    ]
  });

  if (signal) {
    signal.laden().then(r => {
      const box = document.getElementById("signalWert");
      if (!box) return;
      box.innerHTML = `<p class="signal-text">${esc(r.text)}</p>` +
        (r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Zum System</a>` : "") +
        `<button class="btn-csv" id="btnSignalNachweis">Als Nachweis übernehmen</button>`;
      const btn = document.getElementById("btnSignalNachweis");
      if (btn) btn.onclick = async () => {
        const stand = `${r.text} (Stand ${new Date().toLocaleString("de-DE")})`;
        try {
          await Store.save("controls", c.id, { NachweisText: (c.NachweisText ? c.NachweisText + "\n" : "") + stand });
          toast("Nachweis übernommen."); Dialog.schliesse(); neuladen();
        } catch (e) { toast("Speichern fehlgeschlagen: " + e.message, 6000); }
      };
    }).catch(e => {
      const box = document.getElementById("signalWert");
      if (box) box.innerHTML = fehlerBox(e, signal.label);
    });
  }

  nachweiseVerbinden(c.Title);
  zeigeVerknuepfungen(c);
}

// Aufgaben, Risiken und TOM, die dieses Control nennen. Risiken und TOM führen
// eine kommagetrennte Liste, Aufgaben genau eine Control-ID.
async function zeigeVerknuepfungen(c) {
  const box = document.getElementById("controlVerknuepfungen");
  if (!box) return;
  const nennt = (liste, id) => String(liste || "").split(/[,;\s]+/).map(s => s.trim()).includes(id);
  try {
    const [aufgaben, risiken, tom] = await Promise.all([
      Store.loadOderLeer("aufgaben"), Store.loadOderLeer("risiken"), Store.loadOderLeer("tom")
    ]);
    const gruppen = [
      ["aufgaben", "Aufgaben", aufgaben.filter(a => String(a.ControlId || "").trim() === c.Title)],
      ["risiken", "Risiken", risiken.filter(r => nennt(r.ControlIds, c.Title))],
      ["tom", "TOM", tom.filter(t => nennt(t.ControlIds, c.Title))]
    ].filter(([, , liste]) => liste.length);
    box.innerHTML = gruppen.length
      ? gruppen.map(([entity, label, liste]) => `<div class="verknuepfung-gruppe"><span class="muted">${label}:</span>
          ${liste.map(x => `<button class="chip" data-entity="${entity}" data-id="${esc(x.id)}">${esc(x.Title)}
            ${x.Status ? `<span class="chip-status">${esc(x.Status)}</span>` : ""}</button>`).join("")}</div>`).join("")
      : `<p class="muted">Keine Aufgaben, Risiken oder TOM verweisen auf ${esc(c.Title)}.</p>`;
    box.querySelectorAll(".chip").forEach(b => {
      b.onclick = () => { Dialog.schliesse(); oeffneEintrag(b.dataset.entity, b.dataset.id); };
    });
  } catch (e) {
    box.innerHTML = fehlerBox(e, "Verknüpfungen");
  }
}

// ===========================================================================
// Aufgaben
// ===========================================================================

async function renderAufgaben(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>Maßnahmen &amp; Aufgaben</h2>
        <button class="btn-ghost-dark" id="btnAufgabenRefresh">Aktualisieren</button>
      </div>
      <div class="stat-row" id="aufgKacheln"></div>
      <label class="checkline"><input type="checkbox" id="nurMeine"> Nur meine Aufgaben</label>
      <div id="aufgListe"></div>
    </div>`;
  document.getElementById("btnAufgabenRefresh").onclick = () => { Store.invalidate("aufgaben"); renderAufgaben(el); };

  const aufgaben = await Store.load("aufgaben");
  const offen = aufgaben.filter(a => ["Offen", "In Arbeit"].includes(a.Status));
  document.getElementById("aufgKacheln").innerHTML =
    kachel("Offen", offen.length) +
    kachel("Überfällig", offen.filter(a => istUeberfaellig(a.Faellig)).length) +
    kachel("Diese Woche fällig", offen.filter(a => { const t = tageBis(a.Faellig); return t !== null && t >= 0 && t <= 7; }).length) +
    kachel("Erledigt", aufgaben.filter(a => a.Status === "Erledigt").length);

  const zeigeListe = () => {
    const nurMeine = document.getElementById("nurMeine").checked;
    renderEntity(document.getElementById("aufgListe"), "aufgaben", {
      filter: ["Status", "Prioritaet"],
      vorfilter: a => !nurMeine || String(a.Verantwortlich || "").toLowerCase() === Store.benutzer.email.toLowerCase()
    });
  };
  document.getElementById("nurMeine").onchange = zeigeListe;
  zeigeListe();
}

// ===========================================================================
// Risiken
// ===========================================================================

async function renderRisiken(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>Risikoregister</h2>
        <button class="btn-ghost-dark" id="btnRisikenRefresh">Aktualisieren</button>
      </div>
      <div id="risikoMatrix">${ladeBox()}</div>
    </div>
    <div class="card"><div id="risikoListe"></div></div>`;
  document.getElementById("btnRisikenRefresh").onclick = () => { Store.invalidate("risiken"); renderRisiken(el); };

  const risiken = (await Store.load("risiken")).filter(r => r.Status !== "Geschlossen");
  const zellen = [];
  for (let a = 5; a >= 1; a--) {
    const reihe = [`<th class="matrix-achse">${a}</th>`];
    for (let e = 1; e <= 5; e++) {
      const treffer = risiken.filter(r => Number(r.Eintritt) === e && Number(r.Auswirkung) === a);
      const wert = e * a;
      const stufe = wert >= 15 ? "m-rot" : wert >= 8 ? "m-gelb" : "m-gruen";
      reihe.push(`<td class="matrix-zelle ${stufe}" title="Eintritt ${e} × Auswirkung ${a} = ${wert}">
        ${treffer.length ? `<span class="matrix-anzahl">${treffer.length}</span>` : ""}</td>`);
    }
    zellen.push(`<tr>${reihe.join("")}</tr>`);
  }
  document.getElementById("risikoMatrix").innerHTML = `
    <div class="matrix-wrap">
      <table class="matrix">
        <tr><th class="matrix-ecke">Auswirkung ↑<br>Eintritt →</th>${[1, 2, 3, 4, 5].map(e => `<th class="matrix-achse">${e}</th>`).join("")}</tr>
        ${zellen.join("")}
      </table>
      <div class="matrix-legende">
        <span><i class="m-gruen"></i> gering (1–7)</span>
        <span><i class="m-gelb"></i> mittel (8–14)</span>
        <span><i class="m-rot"></i> hoch (15–25)</span>
      </div>
    </div>`;

  renderEntity(document.getElementById("risikoListe"), "risiken", { filter: ["Kategorie", "Status", "Strategie"] });
}

// ===========================================================================
// Datenschutz
// ===========================================================================

function renderDatenschutz(el) {
  el.innerHTML = `<div class="card">
    <div class="card-head"><h2>Datenschutz (DSGVO)</h2></div>
    <div id="dsTabs"></div></div>`;
  subTabs(document.getElementById("dsTabs"), [
    { key: "vvt", label: "Verarbeitungstätigkeiten", render: c => renderEntity(c, "vvt", { filter: ["Status", "DSFA", "Rechtsgrundlage"] }) },
    { key: "tom", label: "TOM", render: c => renderEntity(c, "tom", { filter: ["Kategorie", "Status"] }) },
    { key: "avv", label: "Auftragsverarbeiter", render: c => renderEntity(c, "avv", { filter: ["Kategorie", "Status", "Garantien"] }) },
    { key: "anfragen", label: "Betroffenenanfragen", render: renderAnfragen },
    { key: "vorfaelle", label: "Datenpannen & Vorfälle", render: renderVorfaelle }
  ], tabWunsch("datenschutz"));
}

async function renderVorfaelle(el) {
  el.innerHTML = `<div id="vorfallFristen"></div><div id="vorfallListe"></div>`;
  const vorfaelle = await Store.load("vorfaelle");
  const offen = vorfaelle.filter(v => v.Status !== "Abgeschlossen" && v.Art.startsWith("Datenpanne"));
  const fristen = offen.map(v => {
    const frist = meldefrist(v);
    const restStunden = frist ? Math.round((frist - new Date()) / 3600000) : null;
    return { v, frist, restStunden };
  }).filter(f => f.frist && f.v.MeldungBehoerde !== "Erfolgt" && f.v.MeldungBehoerde !== "Nicht erforderlich");

  document.getElementById("vorfallFristen").innerHTML = fristen.length ? hinweisBox(
    `<strong>72-Stunden-Meldefrist (Art. 33 DSGVO):</strong><ul>${fristen.map(f =>
      `<li>${esc(f.v.Title)} – Frist ${fmtDatumZeit(f.frist)} ·
       <strong>${f.restStunden < 0 ? "abgelaufen" : "noch " + f.restStunden + " Stunden"}</strong></li>`).join("")}</ul>`,
    fristen.some(f => f.restStunden < 12) ? "fehler" : "warn") : "";

  renderEntity(document.getElementById("vorfallListe"), "vorfaelle", {
    filter: ["Art", "Status", "Risiko"],
    onOeffnen: v => zeigeVorfall(v, () => renderVorfaelle(el))
  });
}

function zeigeVorfall(v, neuladen) {
  const frist = meldefrist(v);
  const rest = frist ? Math.round((frist - new Date()) / 3600000) : null;
  Dialog.zeige({
    titel: v.Title,
    breit: true,
    html: `
      ${frist ? hinweisBox(`<strong>Meldefrist Art. 33 DSGVO:</strong> ${fmtDatumZeit(frist)} –
        ${rest < 0 ? "<strong>abgelaufen</strong>" : "noch " + rest + " Stunden"}`,
        rest < 0 ? "fehler" : rest < 24 ? "warn" : "info") : ""}
      <table class="detail-table">
        <tr><td class="dt">Art</td><td>${esc(v.Art)}</td></tr>
        <tr><td class="dt">Entdeckt</td><td>${fmtDatum(v.Entdeckt)} ${esc(v.EntdecktUhr || "")}</td></tr>
        <tr><td class="dt">Beschreibung</td><td>${esc(v.Beschreibung)}</td></tr>
        <tr><td class="dt">Ursache</td><td>${esc(v.Ursache || "–")}</td></tr>
        <tr><td class="dt">Betroffene</td><td>${esc(v.Betroffene || "–")} ${v.Anzahl ? `(${esc(v.Anzahl)})` : ""}</td></tr>
        <tr><td class="dt">Datenkategorien</td><td>${esc(v.Datenkategorien || "–")}</td></tr>
        <tr><td class="dt">Risiko</td><td>${statusBadge(v.Risiko)}</td></tr>
        <tr><td class="dt">Meldung Behörde</td><td>${statusBadge(v.MeldungBehoerde)} ${v.MeldungAm ? "am " + fmtDatum(v.MeldungAm) : ""}</td></tr>
        <tr><td class="dt">Benachrichtigung Betroffener</td><td>${statusBadge(v.Benachrichtigung)}</td></tr>
        <tr><td class="dt">Maßnahmen</td><td>${esc(v.Massnahmen || "–")}</td></tr>
        <tr><td class="dt">Status</td><td>${statusBadge(v.Status)}</td></tr>
      </table>
      ${nachweisHtml()}`,
    link: linkZuEintrag("vorfaelle", v.id),
    aktionen: [
      { label: "Bearbeiten", klasse: "btn-primary", onClick: () => { Dialog.schliesse(); oeffneEditor("vorfaelle", v, neuladen); } },
      { label: "Meldeentwurf erzeugen", klasse: "btn-secondary", onClick: () => zeigeMeldeentwurf(v) },
      { label: "Aufgabe anlegen", klasse: "btn-secondary", onClick: () => {
          Dialog.schliesse();
          oeffneEditor("aufgaben", {
            Title: "Vorfall: " + v.Title, ControlId: "A.5.26", Status: "Offen", Prioritaet: "Hoch",
            Verantwortlich: v.Verantwortlich || "", Quelle: "Vorfallbearbeitung",
            Faellig: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
          }, () => toast("Aufgabe angelegt."));
        } }
    ]
  });

  nachweiseVerbinden("Vorfall-" + String(v.id));
}

// Textentwurf für die Meldung nach Art. 33 DSGVO – zum Kopieren in das
// Meldeformular der Aufsichtsbehörde.
function zeigeMeldeentwurf(v) {
  const text = `Meldung einer Verletzung des Schutzes personenbezogener Daten (Art. 33 DSGVO)

Verantwortlicher: ${(Store.konfig && Store.konfig.organisation) || ""}
Datenschutzbeauftragter: ${(Store.konfig && Store.konfig.dsbEmail) || ""}

1. Art der Verletzung
${v.Beschreibung || ""}

2. Zeitpunkt der Kenntniserlangung
${fmtDatum(v.Entdeckt)} ${v.EntdecktUhr || ""}

3. Kategorien und ungefähre Zahl der betroffenen Personen
${v.Betroffene || "–"}${v.Anzahl ? " / ca. " + v.Anzahl : ""}

4. Kategorien und ungefähre Zahl der betroffenen Datensätze
${v.Datenkategorien || "–"}

5. Wahrscheinliche Folgen
Risikoeinstufung: ${v.Risiko || "–"}

6. Ergriffene und vorgeschlagene Maßnahmen
${v.Massnahmen || "–"}

7. Benachrichtigung der betroffenen Personen (Art. 34)
${v.Benachrichtigung || "–"}
`;
  Dialog.zeige({
    titel: "Meldeentwurf Art. 33 DSGVO",
    breit: true,
    html: `<p class="hint">Entwurf prüfen, ergänzen und in das Meldeportal der zuständigen Aufsichtsbehörde übertragen.</p>
      <textarea id="meldeText" rows="22" class="voll">${esc(text)}</textarea>`,
    aktionen: [
      { label: "In Zwischenablage", klasse: "btn-primary", onClick: () => {
          navigator.clipboard.writeText(document.getElementById("meldeText").value)
            .then(() => toast("In die Zwischenablage kopiert."))
            .catch(() => toast("Kopieren nicht möglich – bitte manuell markieren."));
        } },
      { label: "An DSB senden", klasse: "btn-secondary", onClick: async () => {
          const dsb = (Store.konfig && Store.konfig.dsbEmail) || "";
          if (!dsb) { toast("In den Einstellungen ist kein DSB hinterlegt."); return; }
          try {
            await sendMail(dsb, "Meldeentwurf Datenpanne: " + v.Title,
              `<pre style="font-family:Segoe UI,sans-serif">${esc(document.getElementById("meldeText").value)}</pre>`);
            toast("Entwurf an den DSB gesendet.");
          } catch (e) { toast("Versand fehlgeschlagen: " + e.message, 7000); }
        } }
    ]
  });
}

// ===========================================================================
// Berichte
// ===========================================================================

async function renderBerichte(el) {
  el.innerHTML = `
    <div class="card no-print">
      <h2>Berichte</h2>
      <p class="hint">Managementbericht für Geschäftsleitung und Audit, Erklärung zur Anwendbarkeit (SoA)
         für die Zertifizierung sowie Nachweis-Snapshot aller Microsoft-365-Signale zum Stichtag.</p>
      <div class="btn-reihe">
        <button class="btn-primary" id="btnBericht">Managementbericht erzeugen</button>
        <button class="btn-secondary" id="btnSoa">Erklärung zur Anwendbarkeit (SoA)</button>
        <button class="btn-secondary" id="btnSnapshot">Nachweis-Snapshot M365</button>
        <button class="btn-csv" id="btnDruck">Drucken / als PDF speichern</button>
      </div>
    </div>
    <div class="card" id="berichtInhalt"><p class="muted">Bitte einen Bericht auswählen.</p></div>`;

  document.getElementById("btnDruck").onclick = () => window.print();
  document.getElementById("btnBericht").onclick = () => managementBericht(document.getElementById("berichtInhalt"));
  document.getElementById("btnSnapshot").onclick = () => nachweisSnapshot(document.getElementById("berichtInhalt"));
  document.getElementById("btnSoa").onclick = () => soaBericht(document.getElementById("berichtInhalt"));
  managementBericht(document.getElementById("berichtInhalt"));
}

async function managementBericht(box) {
  box.innerHTML = ladeBox("Bericht wird erstellt …");
  const { controls, aufgaben, risiken, vorfaelle, vvt, avv, tom, anfragen } = await Store.alle();
  const vorJahr = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const anfragenJahr = anfragen.filter(a => (a.Eingang || "") >= vorJahr);
  const quote = fristtreue(anfragenJahr);
  const heute = new Date().toLocaleDateString("de-DE");
  const offeneAufgaben = aufgaben.filter(a => ["Offen", "In Arbeit"].includes(a.Status));
  const frameworks = [...new Set(controls.map(c => c.Framework))];

  box.innerHTML = `
    <div class="bericht">
      <h2>Compliance-Bericht ${esc((Store.konfig && Store.konfig.organisation) || "")}</h2>
      <p class="muted">Stichtag ${heute} · erstellt von ${esc(Store.benutzer.name)}</p>

      <h3>1. Kennzahlen</h3>
      <div class="stat-row">
        ${kachel("Umsetzungsgrad", umsetzungsgrad(controls) + " %")}
        ${kachel("Ø Reifegrad", controls.length ? (controls.reduce((s, c) => s + reifegradWert(c.Reifegrad), 0) / controls.length).toFixed(1) : "–")}
        ${kachel("Offene Aufgaben", offeneAufgaben.length)}
        ${kachel("Hohe Risiken", risiken.filter(r => Number(r.Bewertung) >= 15 && r.Status !== "Geschlossen").length)}
        ${kachel("Offene Vorfälle", vorfaelle.filter(v => v.Status !== "Abgeschlossen").length)}
      </div>

      <h3>2. Umsetzungsstand je Norm</h3>
      ${tabelleHtml(frameworks.map(f => {
        const t = controls.filter(c => c.Framework === f);
        return {
          norm: (CC_FRAMEWORKS[f] || {}).label || f,
          gesamt: t.length,
          umgesetzt: t.filter(c => c.Status === "Umgesetzt").length,
          laufend: t.filter(c => c.Status === "In Umsetzung").length,
          offen: t.filter(c => c.Status === "Offen").length,
          na: t.filter(c => c.Status === "Nicht anwendbar").length,
          grad: umsetzungsgrad(t) + " %"
        };
      }), [
        { key: "norm", label: "Norm" }, { key: "gesamt", label: "Controls" },
        { key: "umgesetzt", label: "Umgesetzt" }, { key: "laufend", label: "In Umsetzung" },
        { key: "offen", label: "Offen" }, { key: "na", label: "Nicht anwendbar" },
        { key: "grad", label: "Umsetzungsgrad" }
      ])}

      <h3>3. Überfällige Aufgaben</h3>
      ${tabelleHtml(offeneAufgaben.filter(a => istUeberfaellig(a.Faellig)), [
        { key: "Title", label: "Aufgabe" }, { key: "ControlId", label: "Control" },
        { key: "Verantwortlich", label: "Verantwortlich" },
        { key: "Faellig", label: "Fällig", render: a => fmtDatum(a.Faellig) }
      ], { leer: "Keine überfälligen Aufgaben." })}

      <h3>4. Top-Risiken</h3>
      ${tabelleHtml(risiken.filter(r => r.Status !== "Geschlossen").slice(0, 10), [
        { key: "Title", label: "Risiko" }, { key: "Kategorie", label: "Kategorie" },
        { key: "Bewertung", label: "Wert", render: r => `${esc(r.Bewertung)} (${risikoStufe(r.Bewertung).label})` },
        { key: "Strategie", label: "Strategie" }, { key: "Verantwortlich", label: "Eigner" }
      ], { leer: "Keine offenen Risiken." })}

      <h3>5. Datenschutz</h3>
      <div class="stat-row">
        ${kachel("Verarbeitungstätigkeiten", vvt.length, `${vvt.filter(v => v.Status === "Freigegeben").length} freigegeben`)}
        ${kachel("DSFA erforderlich", vvt.filter(v => v.DSFA === "Erforderlich").length)}
        ${kachel("Auftragsverarbeiter", avv.filter(a => a.Status === "Aktiv").length)}
        ${kachel("TOM umgesetzt", `${tom.filter(t => t.Status === "Umgesetzt").length}/${tom.length}`)}
        ${kachel("Betroffenenanfragen (12 Mon.)", anfragenJahr.length, `${anfragenJahr.filter(anfrageOffen).length} offen`)}
        ${kachel("Fristtreue Anfragen", quote ? quote.prozent + " %" : "–", quote ? `${quote.rechtzeitig} von ${quote.gesamt} rechtzeitig` : "")}
      </div>
      ${anfragenJahr.length ? tabelleHtml(CC_ANFRAGE_ARTEN
        .map(art => ({ art, anzahl: anfragenJahr.filter(a => a.Art === art).length }))
        .filter(z => z.anzahl), [
          { key: "art", label: "Betroffenenanfragen nach Art" }, { key: "anzahl", label: "Anzahl" }
        ]) : ""}
      ${tabelleHtml(vorfaelle.filter(v => (v.Entdeckt || "") >= new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)), [
        { key: "Entdeckt", label: "Entdeckt", render: v => fmtDatum(v.Entdeckt) },
        { key: "Title", label: "Vorfall" }, { key: "Art", label: "Art" },
        { key: "Risiko", label: "Risiko" }, { key: "MeldungBehoerde", label: "Meldung" },
        { key: "Status", label: "Status" }
      ], { leer: "Keine Vorfälle in den letzten 12 Monaten." })}

      <h3>6. Nicht anwendbare Controls (mit Begründung)</h3>
      ${tabelleHtml(controls.filter(c => c.Status === "Nicht anwendbar"), [
        { key: "Title", label: "Control" }, { key: "Bezeichnung", label: "Bezeichnung" },
        { key: "Begruendung", label: "Begründung" }
      ], { leer: "Alle Controls sind anwendbar." })}
    </div>`;
}


// Erklärung zur Anwendbarkeit (Statement of Applicability) nach ISO/IEC 27001,
// Abschnitt 6.1.3 d: jede Maßnahme mit Anwendbarkeit, Begründung und Umsetzungsstand.
async function soaBericht(box) {
  box.innerHTML = ladeBox("SoA wird erstellt …");
  const controls = await Store.loadOderLeer("controls");
  const frameworks = [...new Set(controls.map(c => c.Framework))];
  const wahl = frameworks.includes("ISO27001") ? "ISO27001" : frameworks[0];
  if (!wahl) { box.innerHTML = hinweisBox("Noch keine Controls importiert.", "info"); return; }

  const zeichne = fw => {
    const liste = controls.filter(c => c.Framework === fw).sort((a, b) => sortiereControlId(a.Title, b.Title));
    const zeilen = liste.map(c => ({
      id: c.Title,
      titel: c.Bezeichnung,
      anwendbar: c.Status === "Nicht anwendbar" ? "Nein" : "Ja",
      begruendung: c.Status === "Nicht anwendbar"
        ? (c.Begruendung || "[Begründung fehlt]")
        : (c.Umsetzung || c.Anforderung || ""),
      status: c.Status,
      reifegrad: c.Reifegrad,
      nachweis: c.NachweisText,
      geprueft: c.LetztePruefung
    }));
    const fehlend = zeilen.filter(z => z.anwendbar === "Nein" && z.begruendung === "[Begründung fehlt]").length;
    const kategorien = (CC_FRAMEWORKS[fw] || {}).kategorien || {};
    box.innerHTML = `
      <div class="bericht">
        <div class="card-head no-print">
          <label class="feldzeile">Norm
            <select id="soaFw">${frameworks.map(f => `<option value="${f}"${f === fw ? " selected" : ""}>${esc((CC_FRAMEWORKS[f] || {}).label || f)}</option>`).join("")}</select></label>
          <button class="btn-csv" id="btnSoaCsv">SoA als CSV</button>
        </div>
        <h2>Erklärung zur Anwendbarkeit</h2>
        <p class="muted">${esc((CC_FRAMEWORKS[fw] || {}).label || fw)} · ${esc((Store.konfig && Store.konfig.organisation) || "")} ·
          Stand ${new Date().toLocaleDateString("de-DE")} · erstellt von ${esc(Store.benutzer.name)}</p>
        <div class="stat-row">
          ${kachel("Maßnahmen", zeilen.length)}
          ${kachel("Anwendbar", zeilen.filter(z => z.anwendbar === "Ja").length)}
          ${kachel("Ausgeschlossen", zeilen.filter(z => z.anwendbar === "Nein").length)}
          ${kachel("Umgesetzt", zeilen.filter(z => z.status === "Umgesetzt").length)}
        </div>
        ${fehlend ? hinweisBox(`<strong>${fehlend} ausgeschlossene Maßnahme(n) ohne Begründung.</strong>
          Auditoren verlangen für jeden Ausschluss eine Begründung.`, "warn") : ""}
        ${Object.keys(kategorien).map(k => {
          const teil = zeilen.filter(z => z.id.startsWith(k + "."));
          if (!teil.length) return "";
          return `<h3>${esc(k)} ${esc(kategorien[k])}</h3>` + tabelleHtml(teil, [
            { key: "id", label: "Nr." },
            { key: "titel", label: "Maßnahme" },
            { key: "anwendbar", label: "Anwendbar", render: z => statusBadge(z.anwendbar) },
            { key: "begruendung", label: "Begründung / Umsetzung" },
            { key: "status", label: "Status", render: z => statusBadge(z.status) }
          ]);
        }).join("")}
      </div>`;
    document.getElementById("soaFw").onchange = ev => zeichne(ev.target.value);
    document.getElementById("btnSoaCsv").onclick = () => csvExport(`SoA_${fw}_${new Date().toISOString().slice(0, 10)}.csv`, zeilen, [
      { key: "id", label: "Nr." }, { key: "titel", label: "Maßnahme" }, { key: "anwendbar", label: "Anwendbar" },
      { key: "begruendung", label: "Begründung / Umsetzung" }, { key: "status", label: "Umsetzungsstatus" },
      { key: "reifegrad", label: "Reifegrad" }, { key: "nachweis", label: "Nachweis" }, { key: "geprueft", label: "Letzte Prüfung" }
    ]);
  };
  zeichne(wahl);
}

async function nachweisSnapshot(box) {
  box.innerHTML = `<div class="bericht"><h2>Nachweis-Snapshot Microsoft 365</h2>
    <p class="muted">Stichtag ${new Date().toLocaleString("de-DE")} · erstellt von ${esc(Store.benutzer.name)}</p>
    <div id="snapListe"></div></div>`;
  const liste = document.getElementById("snapListe");
  const ergebnisse = [];
  for (const [key, sig] of Object.entries(CC_SIGNALE)) {
    const zeile = document.createElement("div");
    zeile.className = "snap-zeile";
    zeile.innerHTML = `<span class="snap-label">${esc(sig.label)}</span><span class="snap-wert">wird abgerufen …</span>`;
    liste.appendChild(zeile);
    try {
      const r = await sig.laden();
      zeile.querySelector(".snap-wert").textContent = r.text;
      ergebnisse.push({ signal: sig.label, wert: r.text });
    } catch (e) {
      const txt = e.name === "BerechtigungFehlt" ? "Berechtigung fehlt: " + e.scopes.join(", ") : "nicht verfügbar (" + e.message + ")";
      zeile.querySelector(".snap-wert").innerHTML = `<span class="muted">${esc(txt)}</span>`;
      ergebnisse.push({ signal: sig.label, wert: txt });
    }
  }
  const btn = document.createElement("button");
  btn.className = "btn-csv no-print";
  btn.textContent = "Snapshot als CSV";
  btn.onclick = () => csvExport("m365_nachweis_snapshot_" + new Date().toISOString().slice(0, 10) + ".csv",
    ergebnisse, [{ key: "signal", label: "Signal" }, { key: "wert", label: "Wert zum Stichtag" }]);
  liste.appendChild(btn);
}

function teileListe(s) {
  return String(s || "").split(",").map(x => x.trim()).filter(Boolean);
}
