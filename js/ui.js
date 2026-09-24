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
    "Akzeptiert": "st-gray", "Geschlossen": "st-gray", "Gekündigt": "st-gray", "Nein": "st-gray",
    // Betroffenenanfragen
    "Eingegangen": "st-red", "Identität prüfen": "st-yellow", "Beantwortet": "st-green",
    "Geprüft": "st-green", "Nicht nachweisbar": "st-red",
    "Vollständig erfüllt": "st-green", "Teilweise erfüllt": "st-yellow",
    "Abgelehnt (mit Begründung)": "st-gray", "Keine Daten vorhanden": "st-gray"
  };
  return `<span class="status ${map[status] || "st-gray"}">${esc(status || "–")}</span>`;
}

// -------------------------------------------------------------- Tabellen ---

// spalten: [{key, label, render?(row), breite?}]
// opts.auswahl: Set der markierten ids → zusätzliche Spalte mit Kontrollkästchen.
function tabelleHtml(zeilen, spalten, opts = {}) {
  if (!zeilen.length) return `<p class="muted">${esc(opts.leer || "Keine Einträge vorhanden.")}</p>`;
  const wahl = opts.auswahl;
  const alleGewaehlt = wahl && zeilen.every(z => wahl.has(z.id));
  const kopf = (wahl ? `<th class="auswahl-zelle"><input type="checkbox" data-alle title="Alle angezeigten markieren"${alleGewaehlt ? " checked" : ""}></th>` : "") +
    spalten.map(s => `<th>${esc(s.label)}</th>`).join("");
  const body = zeilen.map((z, i) => {
    const zellen = spalten.map(s => `<td>${s.render ? s.render(z) : esc(z[s.key])}</td>`).join("");
    const box = wahl ? `<td class="auswahl-zelle"><input type="checkbox" data-wahl="${i}"${wahl.has(z.id) ? " checked" : ""}></td>` : "";
    return `<tr class="row-click${wahl && wahl.has(z.id) ? " gewaehlt" : ""}" data-idx="${i}">${box}${zellen}</tr>`;
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

  zeige({ titel, html, aktionen = [], breit = false, link = null }) {
    const modal = document.getElementById("detailModal");
    modal.querySelector(".modal-content").classList.toggle("modal-wide", !!breit);
    // Direktlink auf den Datensatz (z. B. für Mails oder Teams).
    const linkKnopf = document.getElementById("btnModalLink");
    linkKnopf.hidden = !link;
    linkKnopf.onclick = () => navigator.clipboard.writeText(link)
      .then(() => toast("Link kopiert."))
      .catch(() => prompt("Link zum Kopieren:", link));
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

// ------------------------------------------------------- Personenauswahl ---

// Füllt einmalig eine <datalist> mit den Personen aus dem Verzeichnis. Alle
// Personenfelder verweisen darauf; ohne Leserecht bleibt die freie Eingabe.
let _personenGeladen = null;
function personenListeLaden() {
  if (_personenGeladen) return _personenGeladen;
  let liste = document.getElementById("cc-personen");
  if (!liste) {
    liste = document.createElement("datalist");
    liste.id = "cc-personen";
    document.body.appendChild(liste);
  }
  _personenGeladen = Store.personen()
    .then(p => { liste.innerHTML = p.map(x => `<option value="${esc(x.mail)}">${esc(x.name)}</option>`).join(""); })
    .catch(() => { /* freie Eingabe genügt */ });
  return _personenGeladen;
}

// ----------------------------------------------------- Gespeicherte Filter ---

function filterLesen(schluessel) {
  try { return JSON.parse(localStorage.getItem("cc-filter-" + schluessel) || "{}"); }
  catch (e) { return {}; }
}

function filterSchreiben(schluessel, wert) {
  try { localStorage.setItem("cc-filter-" + schluessel, JSON.stringify(wert)); }
  catch (e) { /* ohne Browserspeicher geht es auch */ }
}

// Führt fn für alle Elemente aus, höchstens `gleichzeitig` Aufrufe parallel.
async function parallelAbarbeiten(liste, gleichzeitig, fn) {
  let i = 0;
  const arbeiter = Array.from({ length: Math.min(gleichzeitig, liste.length) }, async () => {
    while (i < liste.length) {
      const element = liste[i++];
      await fn(element);
    }
  });
  await Promise.all(arbeiter);
}

// ---------------------------------------------------------------- Editor ---

function eingabeHtml(f, wert) {
  const ro = f.readonly ? " readonly disabled" : "";
  if (f.type === "note") {
    return `<textarea rows="3" data-feld="${f.name}"${ro}>${esc(wert)}</textarea>`;
  }
  if (f.type === "select") {
    const opts = ["", ...f.options()].map(o =>
      `<option${String(o) === String(wert) ? " selected" : ""}>${esc(o)}</option>`).join("");
    return `<select data-feld="${f.name}"${ro}>${opts}</select>`;
  }
  if (f.type === "number") {
    return `<input type="number" data-feld="${f.name}" value="${esc(wert)}"${f.min !== undefined ? ` min="${f.min}"` : ""}${f.max !== undefined ? ` max="${f.max}"` : ""}${ro}>`;
  }
  if (f.type === "date") {
    return `<input type="date" data-feld="${f.name}" value="${esc(wert)}"${ro}>`;
  }
  if (f.type === "person") {
    return `<input type="email" data-feld="${f.name}" value="${esc(wert)}" list="cc-personen" autocomplete="off" placeholder="Name oder E-Mail eingeben"${ro}>`;
  }
  return `<input type="text" data-feld="${f.name}" value="${esc(wert)}" maxlength="255"${ro}>`;
}

// Bearbeiten-Dialog aus dem Schema erzeugen.
function oeffneEditor(entity, datensatz, onGespeichert) {
  const def = CC_SCHEMA[entity];
  const werte = datensatz || {};
  const neu = !werte.id;

  const felderHtml = def.felder.map(f => {
    const wert = werte[f.name] === undefined ? "" : werte[f.name];
    const hint = f.hint ? `<span class="feld-hint">${esc(f.hint)}</span>` : "";
    return `<label class="${f.span2 ? "span2" : ""}">${esc(f.label)}${f.required ? " *" : ""}${eingabeHtml(f, wert)}${hint}</label>`;
  }).join("");

  const leseWerte = modal => {
    const w = {};
    modal.querySelectorAll("[data-feld]").forEach(inp => { w[inp.dataset.feld] = inp.value; });
    return w;
  };

  const aktionen = [
    { label: "Speichern", klasse: "btn-primary", onClick: async (modal) => {
        const neueWerte = leseWerte(modal);
        let fehlend = null;
        modal.querySelectorAll("[data-feld]").forEach(inp => {
          const feld = def.felder.find(f => f.name === inp.dataset.feld);
          inp.classList.remove("input-error");
          if (feld && feld.required && !String(inp.value).trim()) {
            inp.classList.add("input-error");
            fehlend = fehlend || feld.label;
          }
        });
        if (fehlend) { toast("Bitte ausfüllen: " + fehlend); return; }
        if (def.beimSpeichern) def.beimSpeichern(neueWerte);
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
    breit: true,
    link: neu ? null : linkZuEintrag(entity, werte.id)
  });
  personenListeLaden();

  // Berechnete Felder (Risikowert, Antwortfrist) schon beim Tippen aktualisieren.
  if (def.beimSpeichern) {
    const modal = document.getElementById("detailModal");
    const aktualisiere = () => {
      const w = def.beimSpeichern(leseWerte(modal));
      def.felder.filter(f => f.readonly).forEach(f => {
        const inp = modal.querySelector(`[data-feld="${f.name}"]`);
        if (inp && w[f.name] !== undefined && w[f.name] !== null) inp.value = w[f.name];
      });
    };
    modal.querySelectorAll("[data-feld]").forEach(inp => { inp.addEventListener("change", aktualisiere); });
    aktualisiere();
  }
}

// -------------------------------------------------------- Sammelbearbeitung ---

// Setzt ausgewählte Felder bei mehreren Datensätzen gleichzeitig. Leere Felder
// bleiben unverändert; berechnete Felder (Frist, Risikowert) werden je Datensatz
// neu ermittelt.
function oeffneSammelbearbeitung(entity, datensaetze, fertig) {
  const def = CC_SCHEMA[entity];
  const felder = def.felder.filter(f => !f.readonly && f.name !== "Title" && ["select", "person", "date"].includes(f.type));
  const html = `<p class="hint">Nur ausgefüllte Felder werden bei allen <strong>${datensaetze.length}</strong>
      markierten Einträgen überschrieben. Leere Felder bleiben unverändert.</p>
    <div class="form-grid">${felder.map(f => {
      let eingabe;
      if (f.type === "select") {
        eingabe = `<select data-sammel="${f.name}"><option value="">– unverändert –</option>${
          f.options().map(o => `<option>${esc(o)}</option>`).join("")}</select>`;
      } else if (f.type === "date") {
        eingabe = `<input type="date" data-sammel="${f.name}">`;
      } else {
        eingabe = `<input type="email" data-sammel="${f.name}" list="cc-personen" autocomplete="off" placeholder="– unverändert –">`;
      }
      return `<label>${esc(f.label)}${eingabe}</label>`;
    }).join("")}</div>`;

  Dialog.zeige({
    titel: `${datensaetze.length} × ${def.singular} bearbeiten`,
    html,
    breit: true,
    aktionen: [{ label: "Übernehmen", klasse: "btn-primary", onClick: async modal => {
      const aenderung = {};
      modal.querySelectorAll("[data-sammel]").forEach(i => {
        if (String(i.value).trim()) aenderung[i.dataset.sammel] = i.value.trim();
      });
      if (!Object.keys(aenderung).length) { toast("Bitte mindestens ein Feld setzen."); return; }
      modal.querySelectorAll("#modalActions button").forEach(b => { b.disabled = true; });

      let gespeichert = 0;
      const fehler = [];
      await parallelAbarbeiten(datensaetze, 4, async d => {
        const vorher = { ...d, ...aenderung };
        const nachher = def.beimSpeichern ? def.beimSpeichern({ ...vorher }) : vorher;
        const zuSpeichern = { ...aenderung };
        Object.keys(nachher).forEach(k => { if (nachher[k] !== vorher[k]) zuSpeichern[k] = nachher[k]; });
        try {
          await Store.save(entity, d.id, zuSpeichern);
          gespeichert++;
          toast(`${gespeichert} von ${datensaetze.length} gespeichert …`);
        } catch (e) {
          fehler.push(`${d.Title}: ${e.message}`);
        }
      });
      Dialog.schliesse();
      toast(fehler.length
        ? `${gespeichert} gespeichert, ${fehler.length} fehlgeschlagen (${fehler[0]})`
        : `${gespeichert} Einträge aktualisiert.`, fehler.length ? 9000 : 4000);
      if (fertig) fertig();
    } }]
  });
  personenListeLaden();
}

// -------------------------------------------------- Generische Listenansicht ---

// Rendert Filterleiste + Tabelle + „Neu"-Schaltfläche für eine Schema-Entität.
// Filter und Suchbegriff bleiben je Ansicht im Browser gespeichert; markierte
// Einträge lassen sich gemeinsam bearbeiten.
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

  const neuLaden = () => renderEntity(container, entity, { ...opts, force: true });
  const badgeFelder = ["Status", "Garantien", "Identitaet", "Ergebnis", "TOMGeprueft"];

  const spalten = (opts.spalten || def.tabelle).map(name => {
    const feld = def.felder.find(f => f.name === name) || { name, label: name, type: "text" };
    return {
      key: name,
      label: name === "Title" ? def.titelLabel : (feld.kurz || feld.label),
      render: row => {
        const v = row[name];
        if (feld.type === "date") {
          if (!v) return "";
          const offen = !CC_ERLEDIGT.includes(row.Status);
          const spaet = offen && istUeberfaellig(v);
          // Bei Fristen zusätzlich die verbleibenden Tage zeigen.
          const rest = name === "Frist" && offen ? tageBis(v) : null;
          const zusatz = rest === null ? ""
            : ` <span class="muted">(${rest < 0 ? Math.abs(rest) + " T. überfällig" : rest === 0 ? "heute" : "noch " + rest + " T."})</span>`;
          return `<span class="${spaet ? "ueberfaellig" : rest !== null && rest <= 7 ? "warnung" : ""}">${fmtDatum(v)}</span>${zusatz}`;
        }
        if (badgeFelder.includes(name)) return statusBadge(v);
        return esc(v);
      },
      csv: row => row[name]
    };
  });

  const filterFelder = (opts.filter || def.felder.filter(f => f.type === "select").slice(0, 3).map(f => f.name));
  const schluessel = opts.filterSchluessel || entity;
  const gemerkt = filterLesen(schluessel);
  const auswahl = new Set();
  const sammel = opts.sammel !== false && !opts.readonly;

  container.innerHTML = `
    <div class="filter-bar">
      <input type="search" data-suche placeholder="Suchen …" value="${esc(gemerkt.q || "")}">
      ${filterFelder.map(f => {
        const feld = def.felder.find(x => x.name === f);
        if (!feld || feld.type !== "select") return "";
        const aktiv = (gemerkt.f || {})[f] || "";
        return `<select data-filter="${f}"><option value="">${esc(feld.kurz || feld.label)}: alle</option>${
          feld.options().map(o => `<option${o === aktiv ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      }).join("")}
      <button class="btn-csv" data-csv>CSV</button>
      ${opts.readonly ? "" : `<button class="btn-primary btn-small" data-neu>+ ${esc(def.singular)}</button>`}
    </div>
    <div class="sammelleiste" data-sammelleiste hidden>
      <span data-sammelzahl></span>
      <button class="btn-primary btn-small" data-sammelbearbeiten>Auswahl bearbeiten</button>
      <button class="btn-ghost-dark" data-sammelleeren>Auswahl aufheben</button>
    </div>
    <div data-tabelle></div>
    <p class="muted" data-anzahl></p>`;

  const sucheFeld = container.querySelector("[data-suche]");
  const leiste = container.querySelector("[data-sammelleiste]");

  const zeigeLeiste = () => {
    leiste.hidden = auswahl.size === 0;
    container.querySelector("[data-sammelzahl]").textContent = `${auswahl.size} markiert`;
  };

  const zeigeTabelle = () => {
    const q = (sucheFeld.value || "").toLowerCase();
    const filter = {};
    container.querySelectorAll("[data-filter]").forEach(s => { if (s.value) filter[s.dataset.filter] = s.value; });
    filterSchreiben(schluessel, { q: sucheFeld.value || "", f: filter });

    let gefiltert = items.filter(it => {
      for (const k in filter) if (String(it[k]) !== filter[k]) return false;
      if (!q) return true;
      return def.felder.some(f => String(it[f.name] || "").toLowerCase().includes(q));
    });
    if (opts.vorfilter) gefiltert = gefiltert.filter(opts.vorfilter);

    container.querySelector("[data-tabelle]").innerHTML =
      tabelleHtml(gefiltert, spalten, { leer: opts.leer, auswahl: sammel ? auswahl : null });
    const aktiveFilter = Object.keys(filter).length + (q ? 1 : 0);
    container.querySelector("[data-anzahl]").textContent =
      `${gefiltert.length} von ${items.length} Einträgen` + (aktiveFilter ? " (gefiltert)" : "");

    container.querySelectorAll("[data-idx]").forEach(tr => {
      tr.onclick = ev => {
        if (ev.target.closest(".auswahl-zelle")) return;
        const rec = gefiltert[Number(tr.dataset.idx)];
        if (opts.onOeffnen) opts.onOeffnen(rec);
        else oeffneEditor(entity, rec, neuLaden);
      };
    });
    container.querySelectorAll("[data-wahl]").forEach(box => {
      box.onchange = () => {
        const rec = gefiltert[Number(box.dataset.wahl)];
        if (box.checked) auswahl.add(rec.id); else auswahl.delete(rec.id);
        box.closest("tr").classList.toggle("gewaehlt", box.checked);
        zeigeLeiste();
      };
    });
    const alle = container.querySelector("[data-alle]");
    if (alle) alle.onchange = () => {
      gefiltert.forEach(r => { if (alle.checked) auswahl.add(r.id); else auswahl.delete(r.id); });
      zeigeTabelle();
      zeigeLeiste();
    };
    container._gefiltert = gefiltert;
  };

  sucheFeld.oninput = zeigeTabelle;
  container.querySelectorAll("[data-filter]").forEach(s => { s.onchange = zeigeTabelle; });
  container.querySelector("[data-csv]").onclick = () =>
    csvExport(`${def.list}_${new Date().toISOString().slice(0, 10)}.csv`,
      container._gefiltert || items,
      def.felder.map(f => ({ key: f.name, label: f.label })));
  const btnNeu = container.querySelector("[data-neu]");
  if (btnNeu) btnNeu.onclick = () => {
    const vorlage = typeof opts.vorlage === "function" ? opts.vorlage() : (opts.vorlage ? { ...opts.vorlage } : null);
    oeffneEditor(entity, vorlage, neuLaden);
  };
  container.querySelector("[data-sammelbearbeiten]").onclick = () =>
    oeffneSammelbearbeitung(entity, items.filter(i => auswahl.has(i.id)), neuLaden);
  container.querySelector("[data-sammelleeren]").onclick = () => { auswahl.clear(); zeigeTabelle(); zeigeLeiste(); };

  zeigeTabelle();
}
