"use strict";

// Anbindung an das Richtlinienmanagementsystem (RMS, rms.dihag.de).
//
// Das RMS ist führend für das ISMS: SoA, Risiken, Vorfälle und Maßnahmen
// (Register „Wirksamkeit“) gibt es nur dort. Das Cockpit liest diese Daten mit,
// um sie im Dashboard, im Arbeitsvorrat und bei den M365-Nachweisen zu zeigen,
// und verlinkt zum Bearbeiten ins RMS. Schreibend greift es nur an einer
// Stelle zu: Aus einer Microsoft-365-Warnung lässt sich eine Abweichung mit
// Korrekturmaßnahme im Register „Wirksamkeit“ anlegen, im selben Format, das
// das RMS selbst schreibt.
//
// Speicherorte (siehe richtlinienmanagementsystem/js/sharepoint.js):
//   Risiken      Liste „Risiken“ auf /sites/ISMS
//   Wirksamkeit  Liste „Wirksamkeit“ auf /sites/ISMS
//   SoA          Datei Richtlinienmanagement/soa-config.json in der
//                Dokumentbibliothek von /sites/IT

const CC_RMS = {
  url: "https://rms.dihag.de/",
  ismsSite: "/sites/ISMS",
  appSite: "/sites/IT",
  risikoListe: "Risiken",
  wirkListe: "Wirksamkeit",
  konfigOrdner: "Richtlinienmanagement",
  soaDatei: "soa-config.json",
  quelle: "Microsoft 365 (Compliance-Cockpit)"
};

const SOA_UMGESETZT = "umgesetzt";

const Rms = {
  _site: {},
  _liste: {},
  _cache: {},

  // Direktlink ins RMS. Die Parameter versteht rms.dihag.de (js/app.js dort).
  link(ansicht, extra = {}) {
    const url = (Store.konfig && Store.konfig.rmsUrl) || CC_RMS.url;
    const p = new URLSearchParams({ ansicht, ...extra });
    return `${url.replace(/\/?$/, "/")}?${p.toString()}`;
  },

  async _siteId(pfad) {
    if (this._site[pfad]) return this._site[pfad];
    const s = await graphFetch(`/sites/${CC_CONFIG.siteHostname}:${pfad}`);
    this._site[pfad] = s.id;
    return s.id;
  },

  // Liste über Anzeige- oder internen Namen finden (wie das RMS: groß/klein egal).
  async _listId(pfad, name) {
    const key = pfad + "|" + name;
    if (this._liste[key]) return this._liste[key];
    const siteId = await this._siteId(pfad);
    const listen = await graphFetchAll(`/sites/${siteId}/lists?$select=id,displayName,name&$top=200`);
    const ziel = name.toLowerCase();
    const treffer = listen.find(l => String(l.displayName).toLowerCase() === ziel || String(l.name).toLowerCase() === ziel);
    if (!treffer) {
      const e = new Error(`Liste „${name}“ auf ${pfad} nicht gefunden. Wurde sie im RMS schon angelegt?`);
      e.status = 404;
      throw e;
    }
    this._liste[key] = treffer.id;
    return treffer.id;
  },

  async _items(pfad, name) {
    const siteId = await this._siteId(pfad);
    const listId = await this._listId(pfad, name);
    return graphFetchAll(`/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=200`, {}, 5000);
  },

  // Kurzzeit-Cache, damit Dashboard, Arbeitsvorrat und Suche nicht dreimal laden.
  async _gecacht(schluessel, laden) {
    const c = this._cache[schluessel];
    if (c && Date.now() - c.zeit < CC_CONFIG.cacheTtlMs) return c.wert;
    const wert = await laden();
    this._cache[schluessel] = { zeit: Date.now(), wert };
    return wert;
  },

  invalidate() { this._cache = {}; },

  // ---------------------------------------------------------------- Risiken ---

  async risiken() {
    return this._gecacht("risiken", async () => {
      const json = (s, leer) => { try { return s ? JSON.parse(s) : leer; } catch (e) { return leer; } };
      return (await this._items(CC_RMS.ismsSite, CC_RMS.risikoListe)).map(it => {
        const f = it.fields || {};
        const brutto = { e: Number(f.BruttoEintritt) || 0, a: Number(f.BruttoAuswirkung) || 0 };
        const netto = { e: Number(f.NettoEintritt) || 0, a: Number(f.NettoAuswirkung) || 0 };
        const eff = netto.e && netto.a ? netto : brutto;
        return {
          id: it.id,
          titel: f.Title || "",
          beschreibung: f.Beschreibung || "",
          kategorie: f.Kategorie || "",
          eigner: String(f.Eigner || "").toLowerCase(),
          wert: eff.e * eff.a,
          status: f.RiskStatus || "offen",
          naechsteReview: f.NaechsteReview ? String(f.NaechsteReview).slice(0, 10) : "",
          massnahmen: json(f.MassnahmenJson, []),
          controls: json(f.ControlsJson, [])
        };
      });
    });
  },

  // --------------------------------------------------------- Wirksamkeit ---

  async wirksamkeit() {
    return this._gecacht("wirksamkeit", async () => {
      const json = (s, leer) => { try { return s ? JSON.parse(s) : leer; } catch (e) { return leer; } };
      return (await this._items(CC_RMS.ismsSite, CC_RMS.wirkListe)).map(it => {
        const f = it.fields || {};
        return {
          id: it.id,
          titel: f.Title || "",
          art: f.Art || "abweichung",
          status: f.WStatus || "offen",
          quelle: f.Quelle || "",
          herkunftId: f.HerkunftId || "",
          verantwortlich: String(f.Verantwortlich || "").toLowerCase(),
          massnahmen: json(f.MassnahmenJson, [])
        };
      });
    });
  },

  // Legt im RMS-Register „Wirksamkeit“ eine Abweichung mit Korrekturmaßnahme an.
  // Geschrieben werden nur Spalten, die es in der Liste gibt (wie im RMS selbst).
  async abweichungAnlegen({ titel, beschreibung, herkunftId, verantwortlich, massnahme, frist }) {
    const siteId = await this._siteId(CC_RMS.ismsSite);
    const listId = await this._listId(CC_RMS.ismsSite, CC_RMS.wirkListe);
    const spalten = new Set((await graphFetch(`/sites/${siteId}/lists/${listId}/columns?$select=name&$top=200`)).value.map(c => c.name));
    const jetzt = new Date().toISOString();
    const wer = (Store.benutzer && Store.benutzer.email) || "";
    const alle = {
      Title: String(titel || "(ohne Titel)").slice(0, 255),
      Art: "abweichung",
      Beschreibung: beschreibung || "",
      WDatum: jetzt,
      Verantwortlich: String(verantwortlich || wer).slice(0, 255),
      Beteiligte: "",
      Werke: "",
      WStatus: "offen",
      Quelle: CC_RMS.quelle,
      HerkunftId: String(herkunftId || "").slice(0, 100),
      Ursache: "",
      MassnahmenJson: JSON.stringify(massnahme
        ? [{ titel: massnahme, verantwortlich: verantwortlich || wer, frist: frist || "", status: "offen" }] : []),
      Wirksamkeit: "",
      Umfang: "",
      EingabenJson: "[]",
      Ergebnis: "",
      Normbezug: "ISO 27001 10.2",
      HistorieJson: JSON.stringify([{ datum: jetzt, wer, aktion: "angelegt aus dem Compliance-Cockpit" }])
    };
    const fields = {};
    Object.keys(alle).forEach(k => { if (k === "Title" || spalten.has(k)) fields[k] = alle[k]; });
    const neu = await graphFetch(`/sites/${siteId}/lists/${listId}/items`, {
      method: "POST", body: JSON.stringify({ fields })
    });
    delete this._cache.wirksamkeit;
    return neu;
  },

  // ---------------------------------------------------------------- SoA ----

  // Liefert { controls: { "A.5.1": { anwendbar, begruendung, status } }, meta } oder null.
  async soa() {
    return this._gecacht("soa", async () => {
      const siteId = await this._siteId(CC_RMS.appSite);
      const drives = await graphFetch(`/sites/${siteId}/drives`);
      const drive = (drives.value || []).find(d =>
        ["Dokumente", "Documents", "Freigegebene Dokumente", "Shared Documents"].includes(d.name)) || (drives.value || [])[0];
      if (!drive) return null;
      // Direkter Abruf wie im RMS: Die Inhalts-URL leitet auf einen vorsignierten
      // Download um. Ohne Content-Type-Kopf, sonst scheitert die Weiterleitung an CORS.
      const token = await getToken();
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/drives/${drive.id}/root:/${CC_RMS.konfigOrdner}/${CC_RMS.soaDatei}:/content`,
        { headers: { Authorization: "Bearer " + token, Accept: "application/json" } });
      if (res.status === 404) return null;
      if (!res.ok) { const e = new Error("SoA nicht lesbar (" + res.status + ")"); e.status = res.status; throw e; }
      const d = await res.json();
      return { controls: d.controls || {}, meta: d.meta || {} };
    });
  },

  // Kennzahlen wie im RMS: entschieden wird nur über Annex A.
  soaKennzahlen(soa) {
    const ids = CC_ANNEX_A.map(c => c.id);
    const ctl = (soa && soa.controls) || {};
    const k = { gesamt: ids.length, anwendbar: 0, ausgeschlossen: 0, offen: 0, umgesetzt: 0 };
    ids.forEach(id => {
      const c = ctl[id];
      if (!c || (c.anwendbar !== true && c.anwendbar !== false)) { k.offen++; return; }
      if (c.anwendbar === false) { k.ausgeschlossen++; return; }
      k.anwendbar++;
      if (c.status === SOA_UMGESETZT) k.umgesetzt++;
    });
    k.quote = k.anwendbar ? Math.round(k.umgesetzt / k.anwendbar * 100) : null;
    return k;
  }
};

// Einträge aus dem RMS für den Arbeitsvorrat: Risiko-Reviews, offene Maßnahmen
// aus Risiken und aus dem Register „Wirksamkeit“. Sie öffnen sich im RMS.
async function rmsArbeitsvorrat() {
  const [risiken, wirk] = await Promise.all([
    Rms.risiken().catch(() => []),
    Rms.wirksamkeit().catch(() => [])
  ]);
  const out = [];
  risiken.filter(r => r.status !== "geschlossen").forEach(r => {
    const link = Rms.link("risiken", { risiko: r.id });
    if (r.naechsteReview) out.push({ extern: link, datum: r.naechsteReview, art: "Risiko-Review (RMS)", was: r.titel, wer: r.eigner });
    (r.massnahmen || []).filter(m => m.status !== "erledigt" && m.frist).forEach(m =>
      out.push({ extern: link, datum: String(m.frist).slice(0, 10), art: "Risiko-Maßnahme (RMS)",
                 was: `${m.titel || "Maßnahme"} · ${r.titel}`, wer: String(m.verantwortlich || r.eigner || "").toLowerCase() }));
  });
  wirk.filter(w => !["abgeschlossen", "verworfen"].includes(w.status)).forEach(w => {
    const link = Rms.link("wirksamkeit", { eintrag: w.id });
    (w.massnahmen || []).filter(m => m.status !== "erledigt" && m.frist).forEach(m =>
      out.push({ extern: link, datum: String(m.frist).slice(0, 10), art: "Korrekturmaßnahme (RMS)",
                 was: `${m.titel || "Maßnahme"} · ${w.titel}`, wer: String(m.verantwortlich || w.verantwortlich || "").toLowerCase() }));
  });
  return out;
}
