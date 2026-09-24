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

// Kachel, die in eine andere Anwendung (das RMS) verlinkt.
function kachelLink(label, wert, zusatz, href) {
  return `<a class="stat-tile stat-link" href="${esc(href)}" target="_blank" rel="noopener" title="Im RMS öffnen">
    <div class="stat-num">${esc(wert)}</div>
    <div class="stat-label">${esc(label)} ↗</div>
    ${zusatz ? `<div class="stat-sub">${zusatz}</div>` : ""}
  </a>`;
}


// ===========================================================================
// Dashboard
// ===========================================================================

async function renderDashboard(el) {
  el.innerHTML = `
    <div id="dashListenHinweis"></div>
    <div class="card">
      <div class="card-head">
        <h2>ISMS <span class="muted">aus dem RMS</span></h2>
        <div class="btn-reihe-klein">
          <a class="btn-ghost-dark" href="${esc(Rms.link("cockpit"))}" target="_blank" rel="noopener">RMS öffnen ↗</a>
          <button class="btn-ghost-dark" id="btnRefreshDash">Aktualisieren</button>
        </div>
      </div>
      <div class="stat-row" id="dashIsms">${ladeBox("RMS wird gelesen …")}</div>
    </div>
    <div class="card">
      <h2>Datenschutz</h2>
      <div class="stat-row" id="dashDs">${ladeBox()}</div>
    </div>
    <div class="card">
      <div class="card-head">
        <h2>Arbeitsvorrat</h2>
        <span class="muted">Fristen aus Datenschutz und RMS, Klick öffnet den Eintrag</span>
      </div>
      <div id="dashArbeit">${ladeBox()}</div>
    </div>
    <div class="card">
      <h2>Microsoft 365 – Live</h2>
      <p class="hint">Werte direkt aus Microsoft Graph. Fehlt eine Berechtigung oder Lizenz, wird nur die betroffene Kachel ausgeblendet.</p>
      <div class="stat-row" id="dashLive">${ladeBox("Microsoft-365-Signale werden abgerufen …")}</div>
    </div>`;

  document.getElementById("btnRefreshDash").onclick = () => { Store.invalidate(); Rms.invalidate(); renderDashboard(el); };

  // --- ISMS-Kennzahlen aus dem RMS (jede Quelle für sich, damit ein fehlendes Recht nicht alles kippt)
  const heute = new Date().toISOString().slice(0, 10);
  const isms = document.getElementById("dashIsms");
  const [soa, risiken, wirk] = await Promise.all([
    Rms.soa().catch(e => ({ fehler: e })),
    Rms.risiken().catch(e => ({ fehler: e })),
    Rms.wirksamkeit().catch(e => ({ fehler: e }))
  ]);
  const kacheln = [];
  if (soa && soa.fehler) kacheln.push(kachel("SoA", "–", "nicht lesbar"));
  else {
    const k = Rms.soaKennzahlen(soa);
    kacheln.push(kachelLink("SoA umgesetzt", k.quote === null ? "–" : k.quote + " %",
      `${k.umgesetzt} von ${k.anwendbar} anwendbar · ${k.offen} offen`, Rms.link("abdeckung", { modus: "soa" })));
  }
  if (risiken.fehler) kacheln.push(kachel("Risiken", "–", "nicht lesbar"));
  else {
    const offen = risiken.filter(r => r.status !== "geschlossen");
    kacheln.push(kachelLink("Risiken hoch", offen.filter(r => r.wert >= 15).length, `${offen.length} offen`, Rms.link("risiken")));
  }
  if (!risiken.fehler || !wirk.fehler) {
    const massnahmen = [
      ...(risiken.fehler ? [] : risiken.filter(r => r.status !== "geschlossen").flatMap(r => r.massnahmen || [])),
      ...(wirk.fehler ? [] : wirk.filter(w => !["abgeschlossen", "verworfen"].includes(w.status)).flatMap(w => w.massnahmen || []))
    ].filter(m => m.status !== "erledigt");
    const spaet = massnahmen.filter(m => m.frist && String(m.frist).slice(0, 10) < heute).length;
    kacheln.push(kachelLink("Offene Maßnahmen", massnahmen.length,
      spaet ? `<span class="ueberfaellig">${spaet} überfällig</span>` : "im Plan", Rms.link("wirksamkeit")));
  }
  if (!wirk.fehler) {
    const abw = wirk.filter(w => w.art === "abweichung" && !["abgeschlossen", "verworfen"].includes(w.status));
    kacheln.push(kachelLink("Offene Abweichungen", abw.length,
      `${abw.filter(w => w.quelle === CC_RMS.quelle).length} aus Microsoft 365`, Rms.link("wirksamkeit")));
  }
  isms.innerHTML = kacheln.join("");
  const rmsFehler = [soa, risiken, wirk].find(x => x && x.fehler);
  if (rmsFehler) {
    isms.insertAdjacentHTML("afterend", hinweisBox(`Teile des RMS sind nicht lesbar (${esc(rmsFehler.fehler.message)}).
      Das Cockpit liest mit Ihren eigenen Rechten; für Risiken und Maßnahmen ist Lesezugriff auf
      <code>${esc(CC_RMS.ismsSite)}</code> nötig.`, "warn"));
  }

  // --- Datenschutz
  try {
    const { vvt, tom, avv, anfragen } = await Store.alle();
    const offeneAnfragen = anfragen.filter(anfrageOffen);
    const knapp = offeneAnfragen.filter(a => a.Frist && tageBis(a.Frist) <= 7);
    const vvtFaellig = vvt.filter(v => v.NaechstePruefung && tageBis(v.NaechstePruefung) <= 30);
    const avvFaellig = avv.filter(a => a.Status !== "Gekündigt" && a.NaechstePruefung && tageBis(a.NaechstePruefung) <= 30);
    document.getElementById("dashDs").innerHTML =
      kachel("Betroffenenanfragen", offeneAnfragen.length,
        knapp.length ? `<span class="ueberfaellig">${knapp.length} mit Frist ≤ 7 Tage</span>` : "offen") +
      kachel("Verarbeitungstätigkeiten", vvt.length,
        `${vvt.filter(v => v.Status === "Freigegeben").length} freigegeben` + (vvtFaellig.length ? ` · ${vvtFaellig.length} Prüfung fällig` : "")) +
      kachel("Auftragsverarbeiter", avv.filter(a => a.Status === "Aktiv").length,
        avvFaellig.length ? `${avvFaellig.length} Prüfung fällig` : "aktiv") +
      kachel("TOM umgesetzt", `${tom.filter(x => x.Status === "Umgesetzt").length}/${tom.length}`);

    if (Store.fehlendeListen.size) {
      document.getElementById("dashListenHinweis").innerHTML = hinweisBox(
        `<strong>Noch nicht angelegt:</strong> ${esc([...Store.fehlendeListen].join(", "))}.
         ${Store.rolle.admin ? `Bitte unter <strong>Einstellungen → „Listen prüfen / anlegen“</strong> nachziehen.`
           : "Bitte einen Administrator bitten, die Listen anzulegen."}`, "warn");
    }
  } catch (e) {
    document.getElementById("dashDs").innerHTML = fehlerBox(e, "Datenschutz");
  }
  renderArbeitsvorrat(document.getElementById("dashArbeit"));

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
  aktionen.push({ label: "Maßnahme im RMS anlegen", klasse: "btn-secondary", onClick: () => oeffneRmsAbweichung(a) });

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
      <tr><td class="dt">Im RMS</td><td id="alertRms">${ladeBox("wird geprüft …")}</td></tr>
    </table>`,
    aktionen
  });
  // Gibt es zu dieser Warnung schon eine Abweichung im RMS? Dann nicht doppelt anlegen.
  Rms.wirksamkeit().then(liste => {
    const box = document.getElementById("alertRms");
    if (!box) return;
    const treffer = liste.filter(w => w.herkunftId === "m365:" + a.id);
    box.innerHTML = treffer.length
      ? treffer.map(w => `<a href="${esc(Rms.link("wirksamkeit", { eintrag: w.id }))}" target="_blank" rel="noopener">${esc(w.titel)} ↗</a>
          ${statusBadge(w.status === "abgeschlossen" ? "Abgeschlossen" : w.status === "offen" ? "Offen" : "In Bearbeitung")}`).join("<br>")
      : `<span class="muted">noch nicht erfasst</span>`;
  }).catch(() => {
    const box = document.getElementById("alertRms");
    if (box) box.innerHTML = `<span class="muted">RMS nicht lesbar</span>`;
  });
}

// Legt zur Warnung eine Abweichung mit Korrekturmaßnahme im RMS-Register
// „Wirksamkeit“ an (ISO 27001 10.2). Dort wird sie weiterbearbeitet.
function oeffneRmsAbweichung(a) {
  const frist = new Date(Date.now() + (a.schwere === "high" ? 7 : 14) * 86400000).toISOString().slice(0, 10);
  Dialog.zeige({
    titel: "Abweichung im RMS anlegen",
    breit: true,
    html: `<p class="hint">Die Warnung wird im RMS unter „Wirksamkeit & Verbesserung“ als Abweichung mit
        Korrekturmaßnahme erfasst und dort weiterverfolgt (Ursache, Wirksamkeitsprüfung).</p>
      <div class="form-grid">
        <label class="span2">Titel *<input type="text" id="rmsTitel" value="${esc("Warnung: " + a.titel)}" maxlength="255"></label>
        <label class="span2">Beschreibung<textarea id="rmsBesch" rows="4">${esc(
          `${a.beschreibung || ""}

Quelle: ${a.quelle} · Schwere: ${a.schwere} · erstellt ${fmtDatumZeit(a.erstellt)}
${a.webUrl || ""}`.trim())}</textarea></label>
        <label class="span2">Korrekturmaßnahme *<input type="text" id="rmsMassnahme" placeholder="z. B. Konto sperren, Kennwort zurücksetzen, Regel anpassen"></label>
        <label>Verantwortlich<input type="email" id="rmsWer" list="cc-personen" autocomplete="off" value="${esc(Store.benutzer.email)}"></label>
        <label>Frist<input type="date" id="rmsFrist" value="${frist}"></label>
      </div>`,
    aktionen: [{ label: "Im RMS anlegen", klasse: "btn-primary", onClick: async modal => {
      const titel = modal.querySelector("#rmsTitel").value.trim();
      const massnahme = modal.querySelector("#rmsMassnahme").value.trim();
      if (!titel || !massnahme) { toast("Bitte Titel und Korrekturmaßnahme angeben."); return; }
      modal.querySelectorAll("#modalActions button").forEach(b => { b.disabled = true; });
      try {
        const neu = await Rms.abweichungAnlegen({
          titel, massnahme,
          beschreibung: modal.querySelector("#rmsBesch").value,
          herkunftId: "m365:" + a.id,
          verantwortlich: modal.querySelector("#rmsWer").value.trim(),
          frist: modal.querySelector("#rmsFrist").value
        });
        Dialog.schliesse();
        const link = Rms.link("wirksamkeit", { eintrag: (neu && neu.id) || "" });
        toast("Abweichung im RMS angelegt.");
        if (confirm("Abweichung im RMS angelegt. Jetzt im RMS öffnen?")) window.open(link, "_blank", "noopener");
      } catch (e) {
        modal.querySelectorAll("#modalActions button").forEach(b => { b.disabled = false; });
        toast("Anlegen im RMS fehlgeschlagen: " + e.message, 8000);
      }
    } }]
  });
  personenListeLaden();
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
    { key: "pannen", label: "Datenpannen", render: renderDatenpannenHinweis }
  ], tabWunsch("datenschutz"));
}

// Datenpannen laufen als Sicherheitsvorfall über das Ticketsystem und werden im
// RMS bewertet (DSGVO Art. 33: 72 Stunden, NIS2: 24 h / 72 h / 1 Monat).
function renderDatenpannenHinweis(el) {
  el.innerHTML = `
    <p>Datenpannen und Sicherheitsvorfälle werden <strong>als Ticket</strong> erfasst und im
       <strong>RMS unter „Vorfälle“</strong> bewertet. Dort laufen die Meldefristen nach DSGVO Art. 33
       (72 Stunden) und NIS2 Art. 23 (24 Stunden, 72 Stunden, ein Monat) mit, und Korrekturmaßnahmen
       gehen ins Register „Wirksamkeit“.</p>
    <p>So gibt es für jeden Vorfall genau einen Datensatz, auf den sich Meldung, Nachweis und Audit beziehen.</p>
    <div class="btn-reihe">
      <a class="btn-primary" href="${esc(Rms.link("vorfaelle"))}" target="_blank" rel="noopener">Vorfälle im RMS öffnen ↗</a>
    </div>`;
}

// ===========================================================================
// Berichte
// ===========================================================================

async function renderBerichte(el) {
  el.innerHTML = `
    <div class="card no-print">
      <h2>Berichte</h2>
      <p class="hint">Datenschutzbericht und Nachweis-Snapshot aller Microsoft-365-Signale zum Stichtag.
         ISMS-Berichte (SoA, Risiken, C-Level-Report) erstellt das RMS.</p>
      <div class="btn-reihe">
        <button class="btn-primary" id="btnBericht">Datenschutzbericht</button>
        <button class="btn-secondary" id="btnSnapshot">Nachweis-Snapshot M365</button>
        <a class="btn-secondary" href="${esc(Rms.link("abdeckung", { modus: "soa" }))}" target="_blank" rel="noopener">SoA im RMS ↗</a>
        <a class="btn-secondary" href="${esc(Rms.link("cockpit"))}" target="_blank" rel="noopener">ISMS-Kennzahlen im RMS ↗</a>
        <button class="btn-csv" id="btnDruck">Drucken / als PDF speichern</button>
      </div>
    </div>
    <div class="card" id="berichtInhalt"><p class="muted">Bitte einen Bericht auswählen.</p></div>`;

  document.getElementById("btnDruck").onclick = () => window.print();
  document.getElementById("btnBericht").onclick = () => datenschutzBericht(document.getElementById("berichtInhalt"));
  document.getElementById("btnSnapshot").onclick = () => nachweisSnapshot(document.getElementById("berichtInhalt"));
  datenschutzBericht(document.getElementById("berichtInhalt"));
}

async function datenschutzBericht(box) {
  box.innerHTML = ladeBox("Bericht wird erstellt …");
  const { vvt, tom, avv, anfragen, nachweise } = await Store.alle();
  const heute = new Date().toLocaleDateString("de-DE");
  const vorJahr = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const vor90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const anfragenJahr = anfragen.filter(a => (a.Eingang || "") >= vorJahr);
  const quote = fristtreue(anfragenJahr);
  const letzte = letzteNachweise(nachweise);
  const mitSignal = CC_ANNEX_A.filter(c => c.m365);

  box.innerHTML = `
    <div class="bericht">
      <h2>Datenschutzbericht ${esc((Store.konfig && Store.konfig.organisation) || "")}</h2>
      <p class="muted">Stichtag ${heute} · erstellt von ${esc(Store.benutzer.name)}</p>

      <h3>1. Kennzahlen</h3>
      <div class="stat-row">
        ${kachel("Verarbeitungstätigkeiten", vvt.length, `${vvt.filter(v => v.Status === "Freigegeben").length} freigegeben`)}
        ${kachel("DSFA erforderlich", vvt.filter(v => v.DSFA === "Erforderlich").length, "noch nicht durchgeführt")}
        ${kachel("Auftragsverarbeiter", avv.filter(a => a.Status === "Aktiv").length, `${avv.filter(a => a.TOMGeprueft !== "Ja").length} TOM ungeprüft`)}
        ${kachel("TOM umgesetzt", `${tom.filter(t => t.Status === "Umgesetzt").length}/${tom.length}`)}
        ${kachel("Betroffenenanfragen (12 Mon.)", anfragenJahr.length, `${anfragenJahr.filter(anfrageOffen).length} offen`)}
        ${kachel("Fristtreue Anfragen", quote ? quote.prozent + " %" : "–", quote ? `${quote.rechtzeitig} von ${quote.gesamt} rechtzeitig` : "")}
      </div>

      <h3>2. Betroffenenanfragen nach Art</h3>
      ${tabelleHtml(CC_ANFRAGE_ARTEN
        .map(art => ({ art, anzahl: anfragenJahr.filter(a => a.Art === art).length,
                       offen: anfragenJahr.filter(a => a.Art === art && anfrageOffen(a)).length }))
        .filter(z => z.anzahl), [
          { key: "art", label: "Art" }, { key: "anzahl", label: "Anzahl (12 Monate)" }, { key: "offen", label: "davon offen" }
        ], { leer: "Keine Betroffenenanfragen in den letzten 12 Monaten." })}

      <h3>3. Fällige Prüfungen</h3>
      ${tabelleHtml([
        ...vvt.filter(v => v.NaechstePruefung && tageBis(v.NaechstePruefung) <= 30)
          .map(v => ({ art: "Verarbeitungstätigkeit", was: v.Title, datum: v.NaechstePruefung })),
        ...avv.filter(a => a.Status !== "Gekündigt" && a.NaechstePruefung && tageBis(a.NaechstePruefung) <= 30)
          .map(a => ({ art: "Auftragsverarbeiter", was: a.Title, datum: a.NaechstePruefung }))
      ].sort((x, y) => x.datum.localeCompare(y.datum)), [
        { key: "datum", label: "Fällig", render: z => `<span class="${istUeberfaellig(z.datum) ? "ueberfaellig" : ""}">${fmtDatum(z.datum)}</span>` },
        { key: "art", label: "Art" }, { key: "was", label: "Gegenstand" }
      ], { leer: "Keine Prüfungen in den nächsten 30 Tagen fällig." })}

      <h3>4. Drittlandtransfers</h3>
      ${tabelleHtml([
        ...vvt.filter(v => v.Drittland).map(v => ({ quelle: "VVT", was: v.Title, land: v.Drittland, garantie: v.Garantien })),
        ...avv.filter(a => a.Drittland).map(a => ({ quelle: "Auftragsverarbeiter", was: a.Title, land: a.Drittland, garantie: a.Garantien }))
      ], [
        { key: "quelle", label: "Quelle" }, { key: "was", label: "Gegenstand" },
        { key: "land", label: "Drittland" }, { key: "garantie", label: "Garantie", render: z => statusBadge(z.garantie || "–") }
      ], { leer: "Keine Drittlandtransfers erfasst." })}

      <h3>5. M365-Nachweise für Anhang A</h3>
      <div class="stat-row">
        ${kachel("Controls mit M365-Signal", mitSignal.length)}
        ${kachel("Nachweis aktuell (90 Tage)", mitSignal.filter(c => letzte[c.id] && letzte[c.id].Stand >= vor90).length)}
        ${kachel("Ohne Nachweis", mitSignal.filter(c => !letzte[c.id]).length)}
      </div>
      <p class="muted">Anwendbarkeit, Umsetzungsstand und Risiken stehen in der SoA und im Risikoregister des RMS.</p>
    </div>`;
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
