"use strict";

// M365-Nachweise je Annex-A-Control. Die SoA (anwendbar, Status, Begründung)
// kommt aus dem RMS; das Cockpit ruft dazu den Live-Wert aus Microsoft 365 ab
// und sichert ihn mit Stichtag in der Liste Compliance_M365Nachweise. Das RMS
// zeigt den jüngsten gesicherten Wert in seiner SoA an.

function soaText(c) {
  if (!c || (c.anwendbar !== true && c.anwendbar !== false)) return { text: "offen", badge: "st-gray" };
  if (c.anwendbar === false) return { text: "ausgeschlossen", badge: "st-gray" };
  const s = c.status || "anwendbar";
  return { text: s, badge: s === SOA_UMGESETZT ? "st-green" : s === "nicht umgesetzt" ? "st-red" : "st-yellow" };
}

// Jüngster gesicherter Nachweis je Control-ID.
function letzteNachweise(nachweise) {
  const out = {};
  nachweise.forEach(n => {
    if (!out[n.Title] || (n.Zeit || "") > (out[n.Title].Zeit || "")) out[n.Title] = n;
  });
  return out;
}

async function sichereNachweis(ctl, text) {
  const jetzt = new Date();
  await Store.save("nachweise", null, {
    Title: ctl.id,
    Bezeichnung: ctl.titel,
    Signal: CC_SIGNAL_LABELS[ctl.m365] || ctl.m365 || "",
    Wert: text,
    Stand: jetzt.toISOString().slice(0, 10),
    Zeit: jetzt.toISOString(),
    ErfasstVon: (Store.benutzer && Store.benutzer.email) || ""
  });
}

// Ruft jedes Signal genau einmal ab und sichert den Wert für alle Controls,
// die daran hängen. Liefert { gesichert, fehler: [{signal, grund}] }.
async function alleNachweiseSichern(fortschritt = () => {}) {
  const mitSignal = CC_ANNEX_A.filter(c => c.m365 && CC_SIGNALE[c.m365]);
  const signale = [...new Set(mitSignal.map(c => c.m365))];
  const werte = {};
  const fehler = [];
  for (const [i, key] of signale.entries()) {
    fortschritt(`Signal ${i + 1} von ${signale.length}: ${CC_SIGNAL_LABELS[key] || key} …`);
    try { werte[key] = (await CC_SIGNALE[key].laden()).text; }
    catch (e) {
      fehler.push({ signal: CC_SIGNAL_LABELS[key] || key,
        grund: e.name === "BerechtigungFehlt" ? "Berechtigung fehlt" : e.nichtLizenziert ? "nicht lizenziert" : e.message });
    }
  }
  let gesichert = 0;
  const ziele = mitSignal.filter(c => werte[c.m365] !== undefined);
  await parallelAbarbeiten(ziele, 4, async c => {
    await sichereNachweis(c, werte[c.m365]);
    gesichert++;
    fortschritt(`${gesichert} von ${ziele.length} Nachweisen gesichert …`);
  });
  return { gesichert, fehler };
}

// ===========================================================================
// Übersicht
// ===========================================================================

async function renderNachweise(el) {
  const gemerkt = filterLesen("nachweise");
  el.innerHTML = `
    <div class="card">
      <div class="card-head">
        <h2>M365-Nachweise je Control</h2>
        <div class="btn-reihe-klein">
          <a class="btn-ghost-dark" href="${esc(Rms.link("abdeckung", { modus: "soa" }))}" target="_blank" rel="noopener">SoA im RMS ↗</a>
          <button class="btn-primary btn-small" id="btnAlleSichern">Alle Signale abrufen und sichern</button>
        </div>
      </div>
      <p class="hint">Anwendbarkeit und Umsetzungsstand stammen aus der SoA im RMS und werden dort gepflegt.
        Hier kommt der Beleg aus Microsoft 365 dazu: Live-Wert abrufen und mit Stichtag sichern. Das RMS zeigt
        den jüngsten gesicherten Wert in seiner SoA.</p>
      <div id="nwHinweis"></div>
      <div class="stat-row" id="nwKacheln"></div>
      <div class="filter-bar">
        <input type="search" id="nwSuche" placeholder="Control oder Maßnahme suchen …" value="${esc(gemerkt.q || "")}">
        <select id="nwKategorie"><option value="">Kategorie: alle</option>${Object.entries(CC_ANNEX_KATEGORIEN)
          .map(([k, v]) => `<option value="${k}"${gemerkt.kat === k ? " selected" : ""}>${k} ${esc(v)}</option>`).join("")}</select>
        <label class="checkline"><input type="checkbox" id="nwNurSignal"${gemerkt.nurSignal === false ? "" : " checked"}> nur mit M365-Signal</label>
      </div>
      <div id="nwTabelle">${ladeBox()}</div>
    </div>`;

  let soa = null, soaFehler = null;
  const [soaErg, nachweise] = await Promise.all([
    Rms.soa().catch(e => { soaFehler = e; return null; }),
    Store.loadOderLeer("nachweise")
  ]);
  soa = soaErg;
  const letzte = letzteNachweise(nachweise);
  const ctl = (soa && soa.controls) || {};

  if (soaFehler) {
    document.getElementById("nwHinweis").innerHTML = fehlerBox(soaFehler, "SoA aus dem RMS");
  } else if (!soa) {
    document.getElementById("nwHinweis").innerHTML = hinweisBox(
      "Im RMS ist noch keine SoA gespeichert. Die Anwendbarkeit wird dort unter IMS-Abdeckung → SoA gepflegt.", "info");
  }
  if (Store.fehlendeListen.has(CC_LISTS.nachweise)) {
    document.getElementById("nwHinweis").insertAdjacentHTML("beforeend", hinweisBox(
      `Die Liste <strong>${esc(CC_LISTS.nachweise)}</strong> fehlt noch. Bitte unter Einstellungen „Listen prüfen / anlegen“.`, "warn"));
  }

  const vor90 = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const mitSignal = CC_ANNEX_A.filter(c => c.m365);
  const k = Rms.soaKennzahlen(soa);
  document.getElementById("nwKacheln").innerHTML =
    kachel("SoA umgesetzt", k.quote === null ? "–" : k.quote + " %", `${k.umgesetzt} von ${k.anwendbar} anwendbar · ${k.offen} offen`) +
    kachel("Controls mit M365-Signal", mitSignal.length, "von 93 in Anhang A") +
    kachel("Nachweis aktuell", mitSignal.filter(c => letzte[c.id] && letzte[c.id].Stand >= vor90).length, "gesichert in den letzten 90 Tagen") +
    kachel("Ohne Nachweis", mitSignal.filter(c => !letzte[c.id]).length, "Signal vorhanden, nie gesichert");

  const zeige = () => {
    const q = document.getElementById("nwSuche").value.toLowerCase();
    const kat = document.getElementById("nwKategorie").value;
    const nurSignal = document.getElementById("nwNurSignal").checked;
    filterSchreiben("nachweise", { q: document.getElementById("nwSuche").value, kat, nurSignal });
    const zeilen = CC_ANNEX_A.filter(c =>
      (!nurSignal || c.m365) &&
      (!kat || c.id.startsWith(kat + ".")) &&
      (!q || (c.id + " " + c.titel).toLowerCase().includes(q)));
    document.getElementById("nwTabelle").innerHTML = tabelleHtml(zeilen, [
      { key: "id", label: "Control", render: c => `<strong>${esc(c.id)}</strong>` },
      { key: "titel", label: "Maßnahme" },
      { key: "soa", label: "SoA (RMS)", render: c => { const s = soaText(ctl[c.id]); return `<span class="status ${s.badge}">${esc(s.text)}</span>`; } },
      { key: "m365", label: "M365-Signal", render: c => c.m365 ? esc(CC_SIGNAL_LABELS[c.m365] || c.m365) : `<span class="muted">–</span>` },
      { key: "nachweis", label: "Letzter Nachweis", render: c => {
          const n = letzte[c.id];
          if (!n) return c.m365 ? `<span class="warnung">noch keiner</span>` : "";
          return `<span class="${n.Stand < vor90 ? "warnung" : ""}">${fmtDatum(n.Stand)}</span>
            <span class="muted">${esc(String(n.Wert || "").slice(0, 70))}${String(n.Wert || "").length > 70 ? "…" : ""}</span>`;
        } }
    ], { leer: "Keine Controls für diesen Filter." });
    document.querySelectorAll("#nwTabelle [data-idx]").forEach(tr => {
      tr.onclick = () => zeigeNachweisControl(zeilen[Number(tr.dataset.idx)].id, () => renderNachweise(el));
    });
  };
  ["nwSuche", "nwKategorie", "nwNurSignal"].forEach(id => {
    const x = document.getElementById(id);
    x.oninput = zeige; x.onchange = zeige;
  });
  zeige();

  document.getElementById("btnAlleSichern").onclick = async () => {
    if (!confirm(`Alle M365-Signale abrufen und für ${mitSignal.length} Controls als Nachweis mit heutigem Stichtag sichern?`)) return;
    const box = document.getElementById("nwHinweis");
    box.innerHTML = ladeBox("Signale werden abgerufen …");
    try {
      const r = await alleNachweiseSichern(t => { box.innerHTML = ladeBox(t); });
      box.innerHTML = hinweisBox(`<strong>${r.gesichert} Nachweise gesichert.</strong>` + (r.fehler.length
        ? `<br>Nicht abrufbar: ${r.fehler.map(f => `${esc(f.signal)} (${esc(f.grund)})`).join(", ")}` : ""),
        r.fehler.length ? "warn" : "info");
      Store.invalidate("nachweise");
      setTimeout(() => renderNachweise(el), 2500);
    } catch (e) {
      box.innerHTML = fehlerBox(e, "Nachweise sichern");
    }
  };
}

// ===========================================================================
// Detail je Control
// ===========================================================================

async function zeigeNachweisControl(id, neuladen = () => {}) {
  const c = annexControl(id);
  if (!c) { toast(`Control ${id} ist nicht im Anhang A.`); return; }
  const signal = c.m365 ? CC_SIGNALE[c.m365] : null;

  Dialog.zeige({
    titel: `${c.id} · ${c.titel}`,
    breit: true,
    link: linkZuEintrag("nachweise", c.id),
    html: `
      <table class="detail-table">
        <tr><td class="dt">Anforderung</td><td>${esc(c.anforderung || "–")}</td></tr>
        <tr><td class="dt">SoA im RMS</td><td id="nwSoa">${ladeBox("wird gelesen …")}</td></tr>
      </table>
      ${signal ? `<div class="signal-box">
        <strong>Live-Wert aus Microsoft 365:</strong> ${esc(CC_SIGNAL_LABELS[c.m365] || c.m365)}
        <div id="signalWert">${ladeBox("Signal wird abgerufen …")}</div>
      </div>` : hinweisBox("Für dieses Control gibt es kein automatisches M365-Signal. Nachweise bitte als Datei hinterlegen.", "info")}
      <div class="verknuepfungen">
        <strong>Gesicherte Nachweise</strong>
        <div id="nwVerlauf">${ladeBox()}</div>
      </div>
      ${nachweisHtml()}`,
    aktionen: [
      { label: "In der SoA des RMS öffnen ↗", klasse: "btn-secondary",
        onClick: () => window.open(Rms.link("abdeckung", { modus: "soa", control: c.id }), "_blank", "noopener") }
    ]
  });

  nachweiseVerbinden(c.id);

  Rms.soa().then(soa => {
    const box = document.getElementById("nwSoa");
    if (!box) return;
    const e = soa && soa.controls && soa.controls[c.id];
    const s = soaText(e);
    box.innerHTML = `<span class="status ${s.badge}">${esc(s.text)}</span>` +
      (e && e.begruendung ? `<div class="muted">${esc(e.begruendung)}</div>` : "");
  }).catch(err => {
    const box = document.getElementById("nwSoa");
    if (box) box.innerHTML = `<span class="muted">nicht lesbar: ${esc(err.message)}</span>`;
  });

  const zeigeVerlauf = async () => {
    const box = document.getElementById("nwVerlauf");
    if (!box) return;
    const liste = (await Store.loadOderLeer("nachweise")).filter(n => n.Title === c.id).slice(0, 10);
    box.innerHTML = liste.length
      ? `<ul class="kompakt">${liste.map(n => `<li><strong>${fmtDatum(n.Stand)}</strong> ${esc(n.Wert)}
          <span class="muted">· ${esc(n.ErfasstVon || "")}</span></li>`).join("")}</ul>`
      : `<p class="muted">Noch nichts gesichert.</p>`;
  };
  zeigeVerlauf();

  if (signal) {
    signal.laden().then(r => {
      const box = document.getElementById("signalWert");
      if (!box) return;
      box.innerHTML = `<p class="signal-text">${esc(r.text)}</p>` +
        (r.link ? `<a href="${esc(r.link)}" target="_blank" rel="noopener">Zum System</a> ` : "") +
        `<button class="btn-csv" id="btnNachweisSichern">Als Nachweis sichern</button>`;
      document.getElementById("btnNachweisSichern").onclick = async () => {
        try {
          await sichereNachweis(c, r.text);
          toast("Nachweis mit heutigem Stichtag gesichert.");
          zeigeVerlauf();
          neuladen();
        } catch (e) { toast("Sichern fehlgeschlagen: " + e.message, 7000); }
      };
    }).catch(e => {
      const box = document.getElementById("signalWert");
      if (box) box.innerHTML = fehlerBox(e, CC_SIGNAL_LABELS[c.m365] || c.m365);
    });
  }
}
