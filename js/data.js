"use strict";

// Datenzugriff auf die SharePoint-Listen: Cache, CRUD, Provisionierung,
// Konfiguration und Rollen.

const Store = {
  cache: {},          // entity -> { zeit, items }
  konfig: null,
  benutzer: null,     // { name, email }
  rolle: { admin: false, auditor: false, dsb: false },

  // ---------------------------------------------------------------- Laden ---

  async load(entity, force = false) {
    const c = this.cache[entity];
    if (!force && c && (Date.now() - c.zeit) < CC_CONFIG.cacheTtlMs) return c.items;
    const roh = await spGetAll(CC_SCHEMA[entity].list);
    const items = roh.map(it => normalisiere(entity, it));
    const sort = CC_SCHEMA[entity].sort;
    if (sort) items.sort(sort);
    this.cache[entity] = { zeit: Date.now(), items };
    return items;
  },

  // Wie load(), liefert aber eine leere Liste, wenn die SharePoint-Liste noch
  // nicht existiert (404). So bleibt das Dashboard nutzbar, wenn nach einem
  // Update eine neue Liste hinzukommt; fehlendeListen zeigt den Hinweis an.
  fehlendeListen: new Set(),

  async loadOderLeer(entity) {
    try {
      const items = await this.load(entity);
      this.fehlendeListen.delete(CC_SCHEMA[entity].list);
      return items;
    } catch (e) {
      if (e.status === 404) {
        this.fehlendeListen.add(CC_SCHEMA[entity].list);
        return [];
      }
      throw e;
    }
  },

  // Alle Datensätze aller Bereiche (für Suche und Arbeitsvorrat).
  async alle() {
    const out = {};
    await Promise.all(Object.keys(CC_SCHEMA).map(async e => { out[e] = await this.loadOderLeer(e); }));
    return out;
  },

  // Personen aus dem Verzeichnis für die Auswahlfelder (User.ReadBasic.All).
  async personen() {
    if (this._personen) return this._personen;
    const roh = await graphFetchAll("/users?$select=displayName,mail&$top=999", {}, 3000);
    this._personen = roh
      .filter(u => u.mail)
      .map(u => ({ name: u.displayName || u.mail, mail: u.mail.toLowerCase() }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
    return this._personen;
  },

  // Liefert bereits geladene Daten ohne Netzwerkzugriff (für Dashboard-Kacheln).
  cached(entity) {
    return (this.cache[entity] && this.cache[entity].items) || [];
  },

  invalidate(entity) {
    if (entity) delete this.cache[entity];
    else this.cache = {};
  },

  async save(entity, id, werte) {
    const felder = denormalisiere(entity, werte);
    if (id) await spUpdate(CC_SCHEMA[entity].list, id, felder);
    else await spCreate(CC_SCHEMA[entity].list, felder);
    this.invalidate(entity);
  },

  async remove(entity, id) {
    await spDelete(CC_SCHEMA[entity].list, id);
    this.invalidate(entity);
  },

  // ------------------------------------------------------- Provisionierung ---

  // Legt alle Listen und die Konfigurationsliste an bzw. ergänzt fehlende Spalten.
  async ensureAll(protokoll = () => {}) {
    const bericht = [];
    for (const entity of Object.keys(CC_SCHEMA)) {
      const liste = CC_SCHEMA[entity].list;
      protokoll(`Prüfe ${liste} …`);
      try {
        const r = await spEnsureList(liste, spaltenFuer(entity));
        bericht.push({ liste, ...r });
      } catch (e) {
        bericht.push({ liste, fehler: e.message });
      }
    }
    protokoll(`Prüfe ${CC_LISTS.konfig} …`);
    try {
      const r = await spEnsureList(CC_LISTS.konfig, [{ name: "WertJson", type: "note" }]);
      bericht.push({ liste: CC_LISTS.konfig, ...r });
    } catch (e) {
      bericht.push({ liste: CC_LISTS.konfig, fehler: e.message });
    }
    protokoll(`Prüfe Bibliothek ${CC_CONFIG.nachweiseLibrary} …`);
    try {
      const r = await spEnsureLibrary(CC_CONFIG.nachweiseLibrary);
      bericht.push({ liste: CC_CONFIG.nachweiseLibrary + " (Bibliothek)", ...r });
    } catch (e) {
      bericht.push({ liste: CC_CONFIG.nachweiseLibrary + " (Bibliothek)", fehler: e.message });
    }
    return bericht;
  },

  // Importiert fehlende Controls der gewählten Frameworks in die Control-Liste.
  async importFrameworks(keys, protokoll = () => {}) {
    const vorhanden = new Set((await this.load("controls", true)).map(c => c.Title));
    let neu = 0;
    for (const key of keys) {
      const fw = CC_FRAMEWORKS[key];
      if (!fw) continue;
      for (const ctl of fw.controls) {
        if (vorhanden.has(ctl.id)) continue;
        await spCreate(CC_LISTS.controls, {
          Title: ctl.id,
          Framework: key,
          Kategorie: ctl.id.split(".").slice(0, 2).join("."),
          Bezeichnung: ctl.titel,
          Anforderung: ctl.anforderung || "",
          Status: "Offen",
          Reifegrad: "0 – nicht vorhanden",
          M365Signal: ctl.m365 || ""
        });
        neu++;
        protokoll(`${neu} Controls importiert …`);
      }
    }
    this.invalidate("controls");
    return neu;
  },

  // ---------------------------------------------------------- Konfiguration ---

  async loadKonfig() {
    const standard = {
      adminEmails: [],
      auditorEmails: [],
      dsbEmail: "",
      cisoEmail: "",
      mailSender: "",
      frameworks: ["ISO27001", "DSGVO"],
      pruefzyklusMonate: 12,
      erinnerungTageVorher: 14,
      eskalationTageNach: 7,
      erinnerungenAktiv: true,
      rmsUrl: "https://rms.dihag.de/",
      organisation: "DIHAG Foundry Group"
    };
    try {
      const items = await spGetAll(CC_LISTS.konfig);
      const zeile = items.find(i => (i.fields || {}).Title === "Allgemein");
      const json = zeile && zeile.fields && zeile.fields.WertJson;
      this.konfigItemId = zeile ? zeile.id : null;
      this.konfig = Object.assign(standard, json ? JSON.parse(json) : {});
    } catch (e) {
      this.konfigItemId = null;
      this.konfig = standard;
      this.konfigFehler = e.message;
    }
    return this.konfig;
  },

  async saveKonfig(neu) {
    this.konfig = Object.assign({}, this.konfig, neu);
    const felder = { Title: "Allgemein", WertJson: JSON.stringify(this.konfig) };
    if (this.konfigItemId) {
      await spUpdate(CC_LISTS.konfig, this.konfigItemId, { WertJson: felder.WertJson });
    } else {
      const r = await spCreate(CC_LISTS.konfig, felder);
      this.konfigItemId = r.id;
    }
  },

  // Rollen aus der Konfiguration ableiten. Ist noch kein Admin eingetragen
  // (Erstinstallation), gilt der angemeldete Benutzer als Admin, damit die
  // Einrichtung überhaupt möglich ist.
  bestimmeRolle() {
    const mail = (this.benutzer.email || "").toLowerCase();
    const k = this.konfig || {};
    const inListe = liste => (liste || []).map(e => String(e).toLowerCase().trim()).includes(mail);
    const keineAdmins = !(k.adminEmails || []).length;
    this.rolle = {
      admin: keineAdmins || inListe(k.adminEmails),
      auditor: inListe(k.auditorEmails),
      dsb: mail && mail === String(k.dsbEmail || "").toLowerCase().trim(),
      ciso: mail && mail === String(k.cisoEmail || "").toLowerCase().trim(),
      erstinstallation: keineAdmins
    };
    return this.rolle;
  }
};

// ------------------------------------------------------------- Umwandlung ---

function normalisiere(entity, item) {
  const f = item.fields || {};
  const out = { id: item.id, _erstellt: f.Created || item.createdDateTime, _geaendert: item.lastModifiedDateTime };
  for (const feld of CC_SCHEMA[entity].felder) {
    let v = f[feld.name];
    if (feld.type === "date" && v) v = String(v).slice(0, 10);
    out[feld.name] = v === undefined || v === null ? "" : v;
  }
  return out;
}

function denormalisiere(entity, werte) {
  const out = {};
  for (const feld of CC_SCHEMA[entity].felder) {
    if (!(feld.name in werte)) continue;
    let v = werte[feld.name];
    if (feld.type === "number") {
      v = v === "" || v === null || v === undefined ? null : Number(v);
      if (v !== null && isNaN(v)) v = null;
    } else if (feld.type === "date") {
      v = v ? new Date(v + "T12:00:00Z").toISOString() : null;
    } else {
      v = v === undefined || v === null ? "" : String(v);
    }
    out[feld.name] = v;
  }
  return out;
}

// -------------------------------------------------------------- Ableitung ---

// Risikowert und Restrisiko berechnen (wird beim Speichern gesetzt).
function berechneRisiko(werte) {
  const e = Number(werte.Eintritt) || 0;
  const a = Number(werte.Auswirkung) || 0;
  werte.Bewertung = e * a;
  return werte;
}

// Antwortfrist einer Betroffenenanfrage: ein Monat ab Eingang, bei Verlängerung
// drei Monate (Art. 12 Abs. 3 DSGVO).
function berechneAnfrage(werte) {
  werte.Frist = werte.Eingang ? addiereMonate(werte.Eingang, werte.Verlaengert === "Ja" ? 3 : 1) : "";
  return werte;
}

// Fristende nach VO (EWG, Euratom) Nr. 1182/71: gleicher Kalendertag im
// Zielmonat, gibt es ihn nicht, der letzte Tag des Monats; fällt das Ende auf
// Samstag oder Sonntag, verschiebt es sich auf den folgenden Montag.
// Feiertage werden nicht berücksichtigt.
function addiereMonate(iso, monate) {
  const [j, m, t] = String(iso).slice(0, 10).split("-").map(Number);
  const ersterZiel = new Date(Date.UTC(j, m - 1 + monate, 1));
  const letzterTag = new Date(Date.UTC(ersterZiel.getUTCFullYear(), ersterZiel.getUTCMonth() + 1, 0)).getUTCDate();
  const ende = new Date(Date.UTC(ersterZiel.getUTCFullYear(), ersterZiel.getUTCMonth(), Math.min(t, letzterTag)));
  const wochentag = ende.getUTCDay();
  if (wochentag === 6) ende.setUTCDate(ende.getUTCDate() + 2);
  if (wochentag === 0) ende.setUTCDate(ende.getUTCDate() + 1);
  return ende.toISOString().slice(0, 10);
}

function risikoStufe(wert) {
  const w = Number(wert) || 0;
  if (w >= 15) return { klasse: "st-red", label: "Hoch" };
  if (w >= 8)  return { klasse: "st-yellow", label: "Mittel" };
  if (w > 0)   return { klasse: "st-green", label: "Gering" };
  return { klasse: "st-gray", label: "–" };
}

// Reifegrad als Zahl aus dem Label „3 – definiert".
function reifegradWert(label) {
  const m = String(label || "").match(/^\s*(\d)/);
  return m ? Number(m[1]) : 0;
}

// Umsetzungsgrad eines Control-Bestands in Prozent (Nicht anwendbar zählt nicht mit).
function umsetzungsgrad(controls) {
  const relevant = controls.filter(c => c.Status !== "Nicht anwendbar");
  if (!relevant.length) return 0;
  const punkte = relevant.reduce((s, c) => s + (c.Status === "Umgesetzt" ? 1 : c.Status === "In Umsetzung" ? 0.5 : 0), 0);
  return Math.round(punkte / relevant.length * 100);
}

function istUeberfaellig(datum) {
  if (!datum) return false;
  return new Date(datum + "T23:59:59") < new Date();
}

function tageBis(datum) {
  if (!datum) return null;
  return Math.ceil((new Date(datum + "T12:00:00") - new Date()) / 86400000);
}

// 72-Stunden-Meldefrist einer Datenpanne (Art. 33 DSGVO).
function meldefrist(vorfall) {
  if (!vorfall.Entdeckt) return null;
  const uhr = /^\d{1,2}:\d{2}$/.test(vorfall.EntdecktUhr || "") ? vorfall.EntdecktUhr : "00:00";
  const start = new Date(`${vorfall.Entdeckt}T${uhr.padStart(5, "0")}:00`);
  return new Date(start.getTime() + 72 * 3600 * 1000);
}
