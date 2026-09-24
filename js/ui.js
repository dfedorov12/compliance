"use strict";

// Wiederverwendbare Oberflächen-Bausteine: Tabellen, Filter, CSV, Dialoge.

function esc(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmtDatum(iso) {
  if (!iso) return "";
  const d = new Date(String(iso).length <= 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString("de-DE");
}

function fmtDatumZeit(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

let _toastTimer = null;
function toast(text, dauer = 3800) {
  const t = document.getElementById("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.hidden = true; }, dauer);
}

function ladeBox(text = "Daten werden geladen …") {
  return `<div class="ladebox"><span class="spinner-inline"></span>${esc(text)}</div>`;
}

function hinweisBox(text, typ = "info") {
  const klasse = typ === "warn" ? "banner-yellow" : typ === "fehler" ? "banner-red" : "banner-info";
  return `<div class="banner ${klasse}">${text}</div>`;
}

// „403 Forbidden“ statt „403 403 Forbidden“: Status nur voranstellen, wenn die
// Meldung nicht ohnehin damit beginnt.
function mitStatus(e) {
  const msg = String((e && e.message) || "");
  if (!e || !e.status || msg.startsWith(String(e.status))) return msg;
  return e.status + " " + msg;
}

// Fehlerdarstellung, die fehlende Berechtigungen als Hinweis (nicht als Absturz) zeigt.
function fehlerBox(e, kontext = "") {
  if (e && e.name === "BerechtigungFehlt") {
    return hinweisBox(
      `<strong>Berechtigung fehlt.</strong> Für ${esc(kontext || "diese Ansicht")} wird
       <code>${esc(e.scopes.join(", "))}</code> benötigt. Ein Administrator muss die Berechtigung
       in der App-Registrierung „DIHAG Compliance" hinzufügen und die Administratorzustimmung erteilen.`, "warn");
  }
  if (e && e.nichtLizenziert) {
    return hinweisBox(`<strong>Nicht verfügbar: ${esc(kontext || "Dienst")}.</strong> ${esc(e.message)}`, "info");
  }
  const zusatz = e && e.berechtigung ? ` Benötigtes Recht: <code>${esc(e.berechtigung.join(", "))}</code>.` : "";
  return hinweisBox(`<strong>${esc(kontext || "Fehler")}:</strong> ${esc(e && e.message || e)}${zusatz}`, "fehler");
}

function statusBadge(status) {
  const map = {
    "Umgesetzt": "st-green", "Erledigt": "st-green", "Abgeschlossen": "st-green",
    "Freigegeben": "st-green", "Aktiv": "st-green", "Erfolgt": "st-green", "Ja": "st-green",
    "In Umsetzung": "st-yellow", "In Arbeit": "st-yellow", "In Bearbeitung": "st-yellow",
    "In Behandlung": "st-yellow", "Teilweise": "st-yellow", "Überarbeitung": "st-yellow",
    "In Prüfung": "st-yellow", "Erforderlich": "st-yellow", "Entwurf": "st-yellow", "Geplant": "st-yellow",
    "Offen": "st-red", "Hoch": "st-red", "Keine – Risiko": "st-red",
    "Nicht anwendbar": "st-gray", "Verworfen": "st-gray", "Nicht erforderlich": "st-gray",
    "Akzeptiert": "st-gray", "Geschlossen": "st-gray", "Gekündigt": "st-gray", "Nein": "st-gray"
  };
  return `<span class="status ${map[status] || "st-gray"}">${esc(status || "–")}</span>`;
}

// -------------------------------------------------------------- Tabellen ---

// spalten: [{key, label, render?(row), breite?}]
function tabelleHtml(zeilen, spalten, opts = {}) {
  if (!zeilen.length) return `<p class="muted">${esc(opts.leer || "Keine Einträge vorhanden.")}</p>`;
  const kopf = spalten.map(s => `<th>${esc(s.label)}</th>`).join("");
  const body = zeilen.map((z, i) => {
    const zellen = spalten.map(s => `<td>${s.render ? s.render(z) : esc(z[s.key])}</td>`).join("");
    return `<tr class="row-click" data-idx="${i}">${zellen}</tr>`;
  }).join("");
  return `<div class="table-scroll"><table class="report-table"><thead><tr>${kopf}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function csvExport(dateiname, zeilen, spalten) {
  const kopf = spalten.map(s => `"${String(s.label).replace(/"/g, '""')}"`).join(";");
  const body = zeilen.map(z => spalten.map(s => {
    const v = s.csv ? s.csv(z) : (z[s.key] === undefined ? "" : z[s.key]);
    return `"${String(v === null || v === undefined ? "" : v).replace(/"/g, '""')}"`;
  }).join(";")).join("\n");
  const blob = new Blob(["﻿" + kopf + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = dateiname;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ------------------------------------------------------------- Dialoge ----

const Dialog = {
  offen: null,

  zeige({ titel, html, aktionen = [], breit = false }) {
    const modal = document.getElementById("detailModal");
    modal.querySelector(".modal-content").classList.toggle("modal-wide", !!breit);
    document.getElementById("modalTitle").textContent = titel;
    document.getElementById("modalBody").innerHTML = html;
    const leiste = document.getElementById("modalActions");
    leiste.innerHTML = "";
    aktionen.forEach(a => {
      const b = document.createElement("button");
      b.className = a.klasse || "btn-primary";
      b.textContent = a.label;
      b.onclick = () => a.onClick(modal);
      leiste.appendChild(b);
    });
    leiste.hidden = aktionen.length === 0;
    modal.hidden = false;
    this.offen = true;
  },

  schliesse() {
    document.getElementById("detailModal").hidden = true;
    this.offen = false;
  }
};

// Bearbeiten-Dialog aus dem Schema erzeugen.
function oeffneEditor(entity, datensatz, onGespeichert) {
  const def = CC_SCHEMA[entity];
  const werte = datensatz || {};
  const neu = !werte.id;

  const felderHtml = def.felder.map(f => {
    const wert = werte[f.name] === undefined ? "" : werte[f.name];
    const span = f.span2 ? " span2" : "";
    const ro = f.readonly ? " readonly disabled" : "";
    let eingabe;
    if (f.type === "note") {
      eingabe = `<textarea rows="3" data-feld="${f.name}"${ro}>${esc(wert)}</textarea>`;
    } else if (f.type === "select") {
      const opts = ["", ...f.options()].map(o =>
        `<option${String(o) === String(wert) ? " selected" : ""}>${esc(o)}</option>`).join("");
      eingabe = `<select data-feld="${f.name}"${ro}>${opts}</select>`;
    } else if (f.type === "number") {
      eingabe = `<input type="number" data-feld="${f.name}" value="${esc(wert)}"${f.min !== undefined ? ` min="${f.min}"` : ""}${f.max !== undefined ? ` max="${f.max}"` : ""}${ro}>`;
    } else if (f.type === "date") {
      eingabe = `<input type="date" data-feld="${f.name}" value="${esc(wert)}"${ro}>`;
    } else if (f.type === "person") {
      eingabe = `<input type="email" data-feld="${f.name}" value="${esc(wert)}" placeholder="vorname.nachname@dihag.com"${ro}>`;
    } else {
      eingabe = `<input type="text" data-feld="${f.name}" value="${esc(wert)}" maxlength="255"${ro}>`;
    }
    const hint = f.hint ? `<span class="feld-hint">${esc(f.hint)}</span>` : "";
    return `<label class="${span.trim()}">${esc(f.label)}${f.required ? " *" : ""}${eingabe}${hint}</label>`;
  }).join("");

  const aktionen = [
    { label: "Speichern", klasse: "btn-primary", onClick: async (modal) => {
        const eingaben = modal.querySelectorAll("[data-feld]");
        const neueWerte = {};
        let fehlend = null;
        eingaben.forEach(inp => {
          neueWerte[inp.dataset.feld] = inp.value;
          const feld = def.felder.find(f => f.name === inp.dataset.feld);
          inp.classList.remove("input-error");
          if (feld && feld.required && !String(inp.value).trim()) {
            inp.classList.add("input-error");
            fehlend = fehlend || feld.label;
          }
        });
        if (fehlend) { toast("Bitte ausfüllen: " + fehlend); return; }
        if (entity === "risiken") berechneRisiko(neueWerte);
        try {
          await Store.save(entity, werte.id, neueWerte);
          Dialog.schliesse();
          toast(neu ? `${def.singular} angelegt.` : "Änderungen gespeichert.");
          if (onGespeichert) onGespeichert();
        } catch (e) {
          toast("Speichern fehlgeschlagen: " + e.message, 6000);
        }
      } }
  ];
  if (!neu && Store.rolle.admin) {
    aktionen.push({ label: "Löschen", klasse: "btn-reject", onClick: async () => {
      if (!confirm(`${def.singular} „${werte.Title}" wirklich löschen?`)) return;
      try {
        await Store.remove(entity, werte.id);
        Dialog.schliesse();
        toast("Gelöscht.");
        if (onGespeichert) onGespeichert();
      } catch (e) { toast("Löschen fehlgeschlagen: " + e.message, 6000); }
    } });
  }

  Dialog.zeige({
    titel: neu ? `Neu: ${def.singular}` : `${def.singular} bearbeiten`,
    html: `<div class="form-grid">${felderHtml}</div>`,
    aktionen,
    breit: true
  });
}

// -------------------------------------------------- Generische Listenansicht ---

// Rendert Filterleiste + Tabelle + „Neu"-Schaltfläche für eine Schema-Entität.
async function renderEntity(container, entity, opts = {}) {
  const def = CC_SCHEMA[entity];
  container.innerHTML = ladeBox();
  let items;
  try {
    items = await Store.load(entity, opts.force);
  } catch (e) {
    container.innerHTML = fehlerBox(e, `Liste „${def.list}"`) +
      hinweisBox(`Fehlt die Liste noch? Ein Administrator kann sie unter
        <strong>Einstellungen → Listen prüfen/anlegen</strong> erzeugen.`, "info");
    return;
  }

  const spalten = (opts.spalten || def.tabelle).map(name => {
    const feld = def.felder.find(f => f.name === name) || { name, label: name, type: "text" };
    return {
      key: name,
      label: name === "Title" ? def.titelLabel : (feld.kurz || feld.label),
      render: row => {
        const v = row[name];
        if (feld.type === "date") {
          const spaet = istUeberfaellig(v) && !["Erledigt", "Abgeschlossen", "Verworfen"].includes(row.Status);
          return v ? `<span class="${spaet ? "ueberfaellig" : ""}">${fmtDatum(v)}</span>` : "";
        }
        if (name === "Status" || name === "Prioritaet" || name === "Risiko" || name === "MeldungBehoerde" || name === "Garantien") {
          return statusBadge(v);
        }
        if (name === "Bewertung") {
          const st = risikoStufe(v);
          return `<span class="status ${st.klasse}">${esc(v || "–")} · ${st.label}</span>`;
        }
        return esc(v);
      },
      csv: row => row[name]
    };
  });

  const filterFelder = (opts.filter || def.felder.filter(f => f.type === "select").slice(0, 3).map(f => f.name));

  container.innerHTML = `
    <div class="filter-bar">
      <input type="search" id="q_${entity}" placeholder="Suchen …">
      ${filterFelder.map(f => {
        const feld = def.felder.find(x => x.name === f);
        if (!feld || feld.type !== "select") return "";
        return `<select data-filter="${f}"><option value="">${esc(feld.label)}: alle</option>${
          feld.options().map(o => `<option>${esc(o)}</option>`).join("")}</select>`;
      }).join("")}
      <button class="btn-csv" data-csv>CSV</button>
      ${opts.readonly ? "" : `<button class="btn-primary btn-small" data-neu>+ ${esc(def.singular)}</button>`}
    </div>
    <div data-tabelle></div>
    <p class="muted" data-anzahl></p>`;

  const zeigeTabelle = () => {
    const q = (container.querySelector(`#q_${entity}`).value || "").toLowerCase();
    const filter = {};
    container.querySelectorAll("[data-filter]").forEach(s => { if (s.value) filter[s.dataset.filter] = s.value; });
    let gefiltert = items.filter(it => {
      for (const k in filter) if (String(it[k]) !== filter[k]) return false;
      if (!q) return true;
      return def.felder.some(f => String(it[f.name] || "").toLowerCase().includes(q));
    });
    if (opts.vorfilter) gefiltert = gefiltert.filter(opts.vorfilter);
    container.querySelector("[data-tabelle]").innerHTML = tabelleHtml(gefiltert, spalten, { leer: opts.leer });
    container.querySelector("[data-anzahl]").textContent = `${gefiltert.length} von ${items.length} Einträgen`;
    container.querySelectorAll("[data-idx]").forEach(tr => {
      tr.onclick = () => {
        const rec = gefiltert[Number(tr.dataset.idx)];
        if (opts.onOeffnen) opts.onOeffnen(rec);
        else oeffneEditor(entity, rec, () => renderEntity(container, entity, { ...opts, force: true }));
      };
    });
    container._gefiltert = gefiltert;
  };

  container.querySelector(`#q_${entity}`).oninput = zeigeTabelle;
  container.querySelectorAll("[data-filter]").forEach(s => { s.onchange = zeigeTabelle; });
  container.querySelector("[data-csv]").onclick = () =>
    csvExport(`${def.list}_${new Date().toISOString().slice(0, 10)}.csv`,
      container._gefiltert || items,
      def.felder.map(f => ({ key: f.name, label: f.label })));
  const btnNeu = container.querySelector("[data-neu]");
  if (btnNeu) btnNeu.onclick = () => oeffneEditor(entity, opts.vorlage ? { ...opts.vorlage } : null,
    () => renderEntity(container, entity, { ...opts, force: true }));

  zeigeTabelle();
}
