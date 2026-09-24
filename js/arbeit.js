"use strict";

// Werkzeuge für das tägliche Arbeiten: Datensätze direkt öffnen (auch per Link),
// Arbeitsvorrat über alle Bereiche, globale Suche und der Nachweisbereich, den
// mehrere Detaildialoge gemeinsam nutzen.

// In welcher Ansicht (und welchem Unterreiter) ein Bereich zu Hause ist.
// Controls, Risiken, Vorfälle und Maßnahmen liegen im RMS (siehe rms.js).
const CC_ORT = {
  vvt:       { ansicht: "datenschutz", tab: "vvt" },
  tom:       { ansicht: "datenschutz", tab: "tom" },
  avv:       { ansicht: "datenschutz", tab: "avv" },
  anfragen:  { ansicht: "datenschutz", tab: "anfragen" },
  nachweise: { ansicht: "nachweise" }
};

// Wunsch-Unterreiter für die nächste Darstellung einer Ansicht (z. B. nach Direktlink).
const _tabWunsch = {};
function tabWunsch(ansicht) {
  const t = _tabWunsch[ansicht];
  delete _tabWunsch[ansicht];
  return t;
}

function linkZuEintrag(entity, id) {
  const ort = CC_ORT[entity] || {};
  // Nachweise hängen an der Control-ID; so verlinkt auch das RMS aus seiner SoA.
  const p = entity === "nachweise"
    ? new URLSearchParams({ ansicht: "nachweise", control: id })
    : new URLSearchParams({ ansicht: ort.ansicht || "dashboard", eintrag: `${entity}:${id}` });
  // Im Demo-Modus bleibt der Link im Demo-Modus, sonst führte er zur Anmeldung.
  if (new URLSearchParams(location.search).has("demo")) p.set("demo", "1");
  return `${location.origin}${location.pathname}?${p.toString()}`;
}

// Öffnet einen Datensatz im passenden Dialog. Mit ansichtWechseln springt die App
// vorher in die Heimat-Ansicht des Bereichs (für Direktlinks), sonst bleibt man,
// wo man ist (z. B. im Arbeitsvorrat auf dem Dashboard).
async function oeffneEintrag(entity, id, { ansichtWechseln = false } = {}) {
  if (!CC_SCHEMA[entity]) { toast("Unbekannter Bereich im Link."); return; }
  const ort = CC_ORT[entity] || {};
  if (ansichtWechseln && ort.ansicht && _aktiveAnsicht !== ort.ansicht) {
    if (ort.tab) _tabWunsch[ort.ansicht] = ort.tab;
    zeigeAnsicht(ort.ansicht);
  }
  // Nachweise öffnen immer das Control; die id ist die Control-ID oder ein Listeneintrag.
  if (entity === "nachweise") {
    let control = String(id);
    if (!control.startsWith("A.")) {
      const n = (await Store.loadOderLeer("nachweise")).find(x => String(x.id) === control);
      control = n ? n.Title : control;
    }
    zeigeNachweisControl(control, () => zeigeAnsicht(_aktiveAnsicht));
    return;
  }
  let items;
  try { items = await Store.load(entity); }
  catch (e) { toast("Eintrag konnte nicht geladen werden: " + e.message, 6000); return; }
  const rec = items.find(i => String(i.id) === String(id));
  if (!rec) { toast("Eintrag nicht gefunden. Wurde er gelöscht?"); return; }
  const neuladen = () => zeigeAnsicht(_aktiveAnsicht);
  const oeffner = { anfragen: zeigeAnfrage }[entity];
  if (oeffner) oeffner(rec, neuladen);
  else oeffneEditor(entity, rec, neuladen);
}

// ===========================================================================
// Arbeitsvorrat: alle Fristen aus allen Bereichen an einer Stelle
// ===========================================================================

async function sammleArbeitsvorrat() {
  const d = await Store.alle();
  const k = Store.konfig || {};
  const dsb = String(k.dsbEmail || "").toLowerCase();
  const liste = [];
  const neu = (entity, rec, datum, art, was, wer, extra = {}) =>
    liste.push({ entity, id: rec.id, datum, art, was, wer: String(wer || "").toLowerCase(), ...extra });

  d.vvt.filter(v => v.NaechstePruefung)
    .forEach(v => neu("vvt", v, v.NaechstePruefung, "VVT-Prüfung", v.Title, v.DSBFreigabe || dsb));
  d.avv.filter(a => a.NaechstePruefung && a.Status !== "Gekündigt")
    .forEach(a => neu("avv", a, a.NaechstePruefung, "AV-Prüfung", a.Title, a.Verantwortlich));
  d.avv.filter(a => a.Ablauf && a.Status === "Aktiv")
    .forEach(a => neu("avv", a, a.Ablauf, "Vertragsende", a.Title, a.Verantwortlich));
  d.anfragen.filter(a => anfrageOffen(a) && a.Frist)
    .forEach(a => neu("anfragen", a, a.Frist, "Betroffenenanfrage", `${a.Title} · ${a.Art}`, a.Verantwortlich || dsb, { dringend: true }));
  // ISMS-Fristen aus dem RMS (Risiko-Reviews, Maßnahmen); öffnen sich dort.
  liste.push(...await rmsArbeitsvorrat());

  return liste.sort((a, b) => a.datum.localeCompare(b.datum));
}

async function renderArbeitsvorrat(box) {
  const gemerkt = filterLesen("arbeitsvorrat");
  box.innerHTML = `
    <div class="filter-bar">
      <label class="checkline"><input type="checkbox" data-meine${gemerkt.meine ? " checked" : ""}> Nur meine</label>
      <select data-zeitraum>
        ${[["14", "nächste 14 Tage"], ["30", "nächste 30 Tage"], ["90", "nächste 90 Tage"], ["alle", "alle Termine"]]
          .map(([w, l]) => `<option value="${w}"${(gemerkt.zeitraum || "30") === w ? " selected" : ""}>${l}</option>`).join("")}
      </select>
      <select data-art><option value="">Art: alle</option></select>
    </div>
    <div data-liste>${ladeBox()}</div>`;

  let eintraege;
  try { eintraege = await sammleArbeitsvorrat(); }
  catch (e) { box.querySelector("[data-liste]").innerHTML = fehlerBox(e, "Arbeitsvorrat"); return; }

  const artWahl = box.querySelector("[data-art]");
  [...new Set(eintraege.map(e => e.art))].forEach(a => {
    artWahl.insertAdjacentHTML("beforeend", `<option${a === gemerkt.art ? " selected" : ""}>${esc(a)}</option>`);
  });

  const zeige = () => {
    const meine = box.querySelector("[data-meine]").checked;
    const zeitraum = box.querySelector("[data-zeitraum]").value;
    const art = artWahl.value;
    filterSchreiben("arbeitsvorrat", { meine, zeitraum, art });
    const ich = String(Store.benutzer.email || "").toLowerCase();
    // Überfälliges bleibt immer sichtbar, egal welcher Zeitraum gewählt ist.
    const sichtbar = eintraege.filter(e => {
      if (meine && e.wer !== ich) return false;
      if (art && e.art !== art) return false;
      if (zeitraum === "alle") return true;
      return tageBis(e.datum) <= Number(zeitraum);
    });
    const ueberfaellig = sichtbar.filter(e => tageBis(e.datum) < 0).length;
    box.querySelector("[data-liste]").innerHTML =
      (ueberfaellig ? `<p class="ueberfaellig">${ueberfaellig} überfällig</p>` : "") +
      tabelleHtml(sichtbar, [
        { key: "datum", label: "Fällig", render: r => {
            if (r.fristZeit) {
              const h = Math.round((r.fristZeit - new Date()) / 3600000);
              return `<span class="${h < 24 ? "ueberfaellig" : "warnung"}">${fmtDatumZeit(r.fristZeit)}</span>
                <span class="muted">(${h < 0 ? "abgelaufen" : "noch " + h + " h"})</span>`;
            }
            const t = tageBis(r.datum);
            const text = t < 0 ? Math.abs(t) + " T. überfällig" : t === 0 ? "heute" : "in " + t + " T.";
            return `<span class="${t < 0 ? "ueberfaellig" : t <= 7 && r.dringend ? "warnung" : ""}">${fmtDatum(r.datum)}</span>
              <span class="muted">(${text})</span>`;
          } },
        { key: "art", label: "Art", render: r => (r.dringend ? `<strong>${esc(r.art)}</strong>` : esc(r.art)) + (r.extern ? " ↗" : "") },
        { key: "was", label: "Gegenstand" },
        { key: "wer", label: "Verantwortlich", render: r => esc(r.wer || "–") }
      ], { leer: meine ? "Für Sie steht im gewählten Zeitraum nichts an." : "Im gewählten Zeitraum steht nichts an." });
    box.querySelectorAll("[data-idx]").forEach(tr => {
      tr.onclick = () => {
        const e = sichtbar[Number(tr.dataset.idx)];
        if (e.extern) window.open(e.extern, "_blank", "noopener");
        else oeffneEintrag(e.entity, e.id);
      };
    });
  };
  box.querySelectorAll("[data-meine], [data-zeitraum], [data-art]").forEach(x => { x.onchange = zeige; });
  zeige();
}

// ===========================================================================
// Globale Suche über alle Bereiche
// ===========================================================================

async function globaleSuche(begriff) {
  const q = String(begriff || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const d = await Store.alle();
  const treffer = [];
  for (const [entity, items] of Object.entries(d)) {
    const def = CC_SCHEMA[entity];
    for (const it of items) {
      const feld = def.felder.find(f => String(it[f.name] || "").toLowerCase().includes(q));
      if (!feld) continue;
      const text = String(it[feld.name]);
      const pos = text.toLowerCase().indexOf(q);
      const auszug = (pos > 40 ? "…" : "") + text.slice(Math.max(0, pos - 40), pos + q.length + 60) +
        (pos + q.length + 60 < text.length ? "…" : "");
      treffer.push({
        entity, id: it.id, bereich: def.label, titel: it.Title,
        untertitel: it.Bezeichnung || it.Art || it.Kategorie || it.Leistung || "",
        feld: feld.label, auszug, status: it.Status
      });
    }
  }
  // Risiken aus dem RMS: Treffer öffnen sich dort.
  try {
    (await Rms.risiken()).filter(r => (r.titel + " " + r.beschreibung).toLowerCase().includes(q)).forEach(r => {
      const text = r.titel.toLowerCase().includes(q) ? r.titel : r.beschreibung;
      const pos = text.toLowerCase().indexOf(q);
      treffer.push({
        extern: Rms.link("risiken", { risiko: r.id }), bereich: "Risiken (RMS)", titel: r.titel,
        untertitel: r.kategorie, feld: r.titel.toLowerCase().includes(q) ? "Titel" : "Beschreibung",
        auszug: text.slice(Math.max(0, pos - 40), pos + q.length + 60), status: ""
      });
    });
  } catch (e) { /* ohne RMS-Zugriff nur lokale Treffer */ }
  return treffer;
}

async function zeigeSuche(begriff) {
  Dialog.zeige({ titel: `Suche: „${begriff}“`, breit: true, html: ladeBox("Alle Bereiche werden durchsucht …") });
  let treffer;
  try { treffer = await globaleSuche(begriff); }
  catch (e) { document.getElementById("modalBody").innerHTML = fehlerBox(e, "Suche"); return; }
  const markiere = s => esc(s).replace(new RegExp(esc(begriff).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), m => `<mark>${m}</mark>`);
  const gruppen = {};
  treffer.forEach(t => { (gruppen[t.bereich] = gruppen[t.bereich] || []).push(t); });
  document.getElementById("modalBody").innerHTML = treffer.length
    ? `<p class="muted">${treffer.length} Treffer</p>` + Object.entries(gruppen).map(([bereich, liste]) => `
        <h3 class="abschnitt">${esc(bereich)} <span class="muted">(${liste.length})</span></h3>
        <div class="suchtreffer">${liste.slice(0, 30).map(t => `
          <button class="suchtreffer-zeile" data-entity="${t.entity || ""}" data-id="${esc(t.id || "")}" data-extern="${esc(t.extern || "")}">
            <span><strong>${esc(t.titel)}</strong> ${esc(t.untertitel)} ${t.status ? statusBadge(t.status) : ""}${t.extern ? " ↗" : ""}</span>
            <span class="muted">${esc(t.feld)}: ${markiere(t.auszug)}</span>
          </button>`).join("")}
          ${liste.length > 30 ? `<p class="muted">… und ${liste.length - 30} weitere. Bitte Suchbegriff eingrenzen.</p>` : ""}
        </div>`).join("")
    : `<p class="muted">Keine Treffer im Datenschutz, bei den M365-Nachweisen und in den RMS-Risiken.</p>`;
  document.querySelectorAll(".suchtreffer-zeile").forEach(b => {
    b.onclick = () => {
      if (b.dataset.extern) { window.open(b.dataset.extern, "_blank", "noopener"); return; }
      Dialog.schliesse();
      oeffneEintrag(b.dataset.entity, b.dataset.id);
    };
  });
}

// ===========================================================================
// Nachweisdateien (gemeinsam für M365-Nachweise und Anfragen)
// ===========================================================================

function nachweisHtml() {
  return `<div class="anlagen-box">
    <strong>Nachweise</strong>
    <div id="nachweisListe">${ladeBox("Nachweise werden geladen …")}</div>
    <label class="upload-label">Datei hinzufügen<input type="file" id="nachweisDatei"></label>
  </div>`;
}

function nachweiseVerbinden(ordner) {
  const zeige = async () => {
    const box = document.getElementById("nachweisListe");
    if (!box) return;
    const dateien = await listNachweise(ordner);
    box.innerHTML = dateien.length
      ? `<div class="anlagen-list">${dateien.map(f =>
          `<a href="${esc(f.webUrl)}" target="_blank" rel="noopener">${esc(f.name)}
           <span class="muted">${(f.size / 1024).toFixed(0)} KB · ${fmtDatum(f.geaendert)}</span></a>`).join("")}</div>`
      : `<p class="muted">Noch keine Dateien hinterlegt.</p>`;
  };
  zeige();
  const inp = document.getElementById("nachweisDatei");
  if (inp) inp.onchange = async () => {
    const datei = inp.files[0];
    inp.value = "";
    if (!datei) return;
    if (datei.size > CC_CONFIG.maxAttachmentBytes) { toast("Datei zu groß (max. 10 MB)."); return; }
    toast("Datei wird hochgeladen …");
    try { await uploadNachweis(ordner, datei); toast("Nachweis hochgeladen."); zeige(); }
    catch (e) { toast("Upload fehlgeschlagen: " + e.message, 7000); }
  };
}
