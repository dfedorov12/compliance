"use strict";

// Ansicht „Admin-Rollen“: PIM nach Anlage 3 der KBV (Rollen- und
// Berechtigungskonzept). Katalog, Graph-Zugriffe und Prüfregeln stehen in pim.js.

function darfRollenVerwalten() {
  return !!(Store.rolle.admin || Store.rolle.ciso);
}

function renderRollen(el) {
  el.innerHTML = `<div class="card">
    <div class="card-head">
      <h2>Admin-Rollen <span class="muted">nach Anlage 3 der KBV</span></h2>
      <div class="btn-reihe-klein">
        <a class="btn-ghost-dark" href="${esc(CC_PIM_PORTAL.rollen)}" target="_blank" rel="noopener">PIM im Entra-Portal ↗</a>
        <button class="btn-ghost-dark" id="btnPimNeu">Aktualisieren</button>
      </div>
    </div>
    <div id="rollenTabs"></div></div>`;
  document.getElementById("btnPimNeu").onclick = () => {
    Pim.invalidate();
    Store.invalidate("rollenregister");
    renderRollen(el);
  };
  subTabs(document.getElementById("rollenTabs"), [
    { key: "uebersicht", label: "Übersicht", render: renderPimUebersicht },
    { key: "register",   label: "Rollenregister", render: renderRollenregister },
    { key: "umstellung", label: "Umstellung auf PIM", render: renderPimUmstellung },
    { key: "regeln",     label: "Aktivierungsregeln", render: renderPimRegeln },
    { key: "technisch",  label: "Technische Identitäten", render: renderTechnischeIdentitaeten },
    { key: "meine",      label: "Meine Rollen", render: renderMeineRollen }
  ], tabWunsch("rollen"));
}

function zeigeRollenTab(tab) {
  _tabWunsch.rollen = tab;
  zeigeAnsicht("rollen");
}

// Verbindet die Kontrollkästchen einer tabelleHtml(…, { auswahl }) mit dem Set.
// sperre(zeile) = true nimmt eine Zeile von der Auswahl aus.
function auswahlVerbinden(box, zeilen, auswahl, geaendert, sperre = () => false) {
  box.querySelectorAll("[data-wahl]").forEach(cb => {
    const z = zeilen[Number(cb.dataset.wahl)];
    if (sperre(z)) { cb.disabled = true; cb.checked = false; auswahl.delete(z.id); return; }
    cb.onclick = ev => ev.stopPropagation();
    cb.onchange = () => {
      if (cb.checked) auswahl.add(z.id); else auswahl.delete(z.id);
      cb.closest("tr").classList.toggle("gewaehlt", cb.checked);
      geaendert();
    };
  });
  const alle = box.querySelector("[data-alle]");
  if (alle) alle.onchange = () => {
    zeilen.filter(z => !sperre(z)).forEach(z => { if (alle.checked) auswahl.add(z.id); else auswahl.delete(z.id); });
    box.querySelectorAll("[data-wahl]").forEach(cb => {
      if (cb.disabled) return;
      cb.checked = alle.checked;
      cb.closest("tr").classList.toggle("gewaehlt", alle.checked);
    });
    geaendert();
  };
}

// „a“, „a und b“, „a, b und c“.
function aufzaehlung(liste) {
  return liste.length < 2 ? (liste[0] || "") : liste.slice(0, -1).join(", ") + " und " + liste[liste.length - 1];
}

// Verständliche Meldung zu einem abgelehnten PIM-Antrag.
function pimFehlerText(e) {
  const t = `${e.code || ""} ${e.message || ""}`;
  if (/acrs|MultiFactor|MfaRule|\bMFA\b/i.test(t)) return "Die Rolle verlangt eine Anmeldung mit MFA. Bitte nach einer MFA-Anmeldung erneut versuchen oder die Rolle im Entra-Portal aktivieren.";
  if (/ExpirationRule|Duration/i.test(t)) return "Die gewählte Dauer ist für diese Rolle nicht erlaubt.";
  if (/JustificationRule/i.test(t)) return "Die Rolle verlangt eine Begründung.";
  if (/TicketingRule/i.test(t)) return "Die Rolle verlangt eine Ticketnummer.";
  if (/RoleAssignmentExists/i.test(t)) return "Die Rolle ist bereits aktiv.";
  if (/PendingRoleAssignmentRequest|already.*pending/i.test(t)) return "Für diese Rolle läuft bereits ein Antrag.";
  if (e.name === "BerechtigungFehlt") return "Zustimmung fehlt: " + e.scopes.join(", ");
  return mitStatus(e);
}

function zuweisungBadge(z) {
  if (z.dauerhaft) return `<span class="status ${z.rolle && z.rolle.p && !z.ausnahme && istPersonenbezogen(z.kontoart) ? "st-red" : "st-gray"}">${esc(z.zuweisung)}</span>`;
  if (z.arten.has("aktiviert")) return `<span class="status st-yellow">aktiv bis ${esc(fmtDatumZeit(z.aktivBis))}</span>`;
  return `<span class="status st-green">${esc(z.zuweisung)}</span>`;
}

// ===========================================================================
// Übersicht: Einführung, Feststellungen, Soll-Ist je Rolle
// ===========================================================================

async function renderPimUebersicht(el) {
  el.innerHTML = ladeBox("Rollen, PIM-Regeln und Rollenregister werden gelesen …");
  const s = await pimStand();
  const b = s.bewertung, k = s.k, kz = b.kennzahlen;
  const darf = darfRollenVerwalten();

  // Aktivierungen nebenher sichern, damit die Quartalsübersicht vollständig bleibt.
  if (darf && s.stand.pimVerfuegbar) Pim.sichereAktivierungen().catch(() => {});

  const hat = id => b.feststellungen.some(f => f.id === id || f.id.startsWith(id + ":"));
  // Einrichtung der Notfallkonten; Test und letzte Verwendung zählen hier nicht.
  const notfallOk = k.notfallkonten.length === 2 &&
    !b.feststellungen.some(f => f.id.startsWith("notfall:") && !f.id.startsWith("notfall:test") && !f.id.startsWith("notfall:anmeldung"));
  const schritte = [
    { titel: "Notfallzugriffskonten hinterlegen", ok: notfallOk, ziel: "einstellungen",
      text: "Zwei cloudbasierte Konten mit dauerhafter Rolle „Globaler Administrator“ (§ 5). Erst dann lassen sich globale Administratoren umstellen." },
    { titel: "Aktivierungsregeln nach Hausstandard setzen", ok: s.regeln ? !hat("regeln") : null, ziel: "regeln",
      text: "Höchstdauer, MFA, Begründung und Genehmigung je Rolle (§ 2.2)." },
    { titel: "Dauerhafte Zuweisungen in PIM überführen", ok: !hat("dauerhaft"), ziel: "umstellung",
      text: "Personen werden berechtigt und aktivieren die Rolle nur bei Bedarf. Ausnahmen werden begründet." },
    { titel: "Rollenregister vervollständigen", ok: !hat("register"), ziel: "register",
      text: "Zweck und genehmigende Stelle je Zuweisung (§ 10). Purview-Rollen von Hand ergänzen." },
    { titel: "Jährliche Überprüfung und Notfalltest", ok: !hat("pruefung") && !hat("notfall:test"), ziel: "register",
      text: "Zuweisungen mindestens jährlich bestätigen, Notfallkonten regelmäßig testen (§ 5, § 11)." }
  ];

  el.innerHTML = `
    ${!s.stand.pimVerfuegbar ? hinweisBox(`<strong>PIM ist für diesen Mandanten noch nicht nutzbar.</strong>
        Prüfen Sie, ob die Lizenz (Entra ID P2 oder Entra ID Governance) im Mandanten aktiv ist. Bis dahin zeigt
        das Cockpit nur die aktiven Zuweisungen.`, "warn") : ""}
    ${s.stand.hinweise.filter(h => s.stand.pimVerfuegbar || !h.startsWith("PIM-Schnittstellen")).map(h => hinweisBox(esc(h), "warn")).join("")}
    ${s.regelFehler ? hinweisBox(`Aktivierungsregeln nicht lesbar: ${esc(pimFehlerText(s.regelFehler))}`, "warn") : ""}

    <div class="stat-row">
      ${kachel("Feststellungen", kz.hoch + kz.mittel, kz.hoch ? `<span class="ueberfaellig">${kz.hoch} hoch</span>, ${kz.mittel} mittel` : `${kz.mittel} mittel`)}
      ${kachel("Über PIM berechtigt", kz.berechtigt, `${kz.aktivJetzt} gerade aktiviert`)}
      ${kachel("Dauerhaft (PIM-Rollen)", kz.dauerhaft, "an Personen, auch über Gruppen")}
      ${kachel("Personen mit Admin-Rollen", kz.personen, `${kz.technisch} technische Identitäten`)}
      ${kachel("Register dokumentiert", kz.dokumentiertQuote + " %", "Zweck und Genehmigung")}
    </div>

    <h3>Einführung in fünf Schritten</h3>
    <ol class="schritte">${schritte.map((x, i) => `
      <li class="schritt ${x.ok === true ? "schritt-ok" : x.ok === false ? "schritt-offen" : ""}">
        <span class="schritt-nr">${x.ok === true ? "✓" : i + 1}</span>
        <span class="schritt-text"><strong>${esc(x.titel)}</strong><br><span class="muted">${esc(x.text)}</span></span>
        <button class="btn-ghost-dark" data-schritt="${esc(x.ziel)}">${x.ok === true ? "Ansehen" : "Erledigen"}</button>
      </li>`).join("")}
    </ol>

    <h3 class="abschnitt">Feststellungen</h3>
    <div id="pimFeststellungen"></div>

    <div class="card-head abschnitt">
      <h3>Rollen der Anlage 3: Soll und Ist</h3>
      <label class="checkline"><input type="checkbox" id="pimAlleRollen"> alle ${CC_ANLAGE3_ROLLEN.length} Rollen anzeigen</label>
    </div>
    <p class="hint">„Aktiv“ zählt Personen mit dauerhafter oder gerade aktivierter Zuweisung (§ 2.3). Nur berechtigte Personen,
      Notfallkonten und technische Identitäten zählen nicht mit. Ein Klick öffnet das Register für die Rolle.</p>
    <div id="pimSollIst"></div>

    ${b.fremd.length ? `<h3 class="abschnitt">Zugewiesene Rollen außerhalb der Anlage 3</h3>
      <div id="pimFremd"></div>` : ""}

    <h3 class="abschnitt">Weitere Rollen der Anlage</h3>
    <p class="hint">Die Purview-Rollen <em>${CC_ANLAGE3_PURVIEW.map(r => esc(r.name)).join("</em> und <em>")}</em> sind Rollengruppen
      im Purview-Portal und über Graph nicht lesbar. Führen Sie sie als manuelle Einträge im Rollenregister
      (derzeit ${s.register.filter(r => r.Quelle === "manuell" && !r.Entzogen).length}). Funktionale SharePoint-Rollen
      vergeben die Site-Besitzer (§ 4); sie sind nicht Teil dieser Prüfung.</p>
    ${s.extra.zugriffspruefungen ? `<p class="hint">Zugriffsüberprüfungen (Access Reviews): ${s.extra.zugriffspruefungen.length} eingerichtet,
      davon ${s.extra.zugriffspruefungen.filter(p => p.rollen).length} für Admin-Rollen.
      <a href="${esc(CC_PIM_PORTAL.pruefungen)}" target="_blank" rel="noopener">Im Entra-Portal verwalten ↗</a></p>` : ""}

    <div class="btn-reihe">
      <button class="btn-secondary" id="btnPimKbr">Quartalsübersicht für den KBR (§ 9)</button>
    </div>`;

  el.querySelectorAll("[data-schritt]").forEach(btn => { btn.onclick = () => pimZiel(btn.dataset.schritt); });
  document.getElementById("btnPimKbr").onclick = () => { _berichtWunsch = "kbr"; zeigeAnsicht("berichte"); };

  // Feststellungen mit Verweis ins RMS
  const fsBox = document.getElementById("pimFeststellungen");
  const zeigeFeststellungen = (imRms = {}) => {
    fsBox.innerHTML = tabelleHtml(b.feststellungen, [
      { key: "schwere", label: "Schwere", render: f => `<span class="status ${f.schwere === "hoch" ? "st-red" : f.schwere === "mittel" ? "st-yellow" : "st-gray"}">${esc(f.schwere)}</span>` },
      { key: "titel", label: "Feststellung", render: f => `<strong>${esc(f.titel)}</strong>${f.text ? `<br><span class="muted">${esc(f.text)}</span>` : ""}` },
      { key: "paragraf", label: "Anlage 3" },
      { key: "aktion", label: "", render: (f) => {
          const i = b.feststellungen.indexOf(f);
          const rms = imRms["anlage3:" + f.id];
          return `<div class="btn-reihe-klein">
            <button class="btn-ghost-dark" data-fs-ziel="${i}">Beheben</button>
            ${rms ? `<a class="btn-ghost-dark" href="${esc(Rms.link("wirksamkeit", { eintrag: rms.id }))}" target="_blank" rel="noopener">im RMS ↗</a>`
              : f.schwere !== "niedrig" && darf ? `<button class="btn-ghost-dark" data-fs-rms="${i}">Ins RMS</button>` : ""}
          </div>`;
        } }
    ], { leer: "Keine Feststellungen. Der Ist-Stand entspricht der Anlage 3." });
    fsBox.querySelectorAll("[data-fs-ziel]").forEach(btn => {
      btn.onclick = ev => { ev.stopPropagation(); pimZiel(b.feststellungen[Number(btn.dataset.fsZiel)].ziel); };
    });
    fsBox.querySelectorAll("[data-fs-rms]").forEach(btn => {
      btn.onclick = ev => {
        ev.stopPropagation();
        const f = b.feststellungen[Number(btn.dataset.fsRms)];
        rmsAbweichungDialog({
          titel: "Anlage 3: " + f.titel,
          beschreibung: `${f.text}\n\nBezug: Anlage 3 zur KBV (Rollen- und Berechtigungskonzept), ${f.paragraf}.\nFestgestellt im Compliance-Cockpit am ${fmtDatum(kz.stand)}.`,
          herkunftId: "anlage3:" + f.id,
          frist: new Date(Date.now() + (f.schwere === "hoch" ? 14 : 30) * 86400000).toISOString().slice(0, 10),
          massnahmeVorschlag: {
            fremd: "Rolle entziehen oder nach § 12 Abs. 2 im Register begründen",
            max: "Zuweisungen auf die Höchstzahl reduzieren oder in PIM überführen",
            tech: "Berechtigung der Personen entziehen",
            dauerhaft: "Zuweisungen in PIM überführen oder Ausnahme begründen",
            notfall: "Notfallkonten nach § 5 einrichten und dokumentieren",
            extern: "Zugriffe der Dienstleister befristen",
            lizenz: "Lizenzen für Entra ID P2 zuweisen",
            regeln: "Hausstandard auf die Rollen anwenden",
            register: "Rollenregister vervollständigen",
            pruefung: "Zuweisungen überprüfen und bestätigen",
            app: "Eigentümer festlegen, Geheimnisse erneuern, nicht benötigte Identitäten entfernen" }[f.id.split(":")[0]] || ""
        });
      };
    });
  };
  zeigeFeststellungen();
  Rms.wirksamkeit().then(liste => {
    const imRms = {};
    // Nur offene Abweichungen; ist die alte erledigt, lässt sich eine neue anlegen.
    liste.filter(w => String(w.herkunftId || "").startsWith("anlage3:") && !["abgeschlossen", "verworfen"].includes(w.status))
      .forEach(w => { imRms[w.herkunftId] = w; });
    if (Object.keys(imRms).length) zeigeFeststellungen(imRms);
  }).catch(() => { /* ohne RMS-Zugriff bleibt es beim Knopf */ });

  // Soll-Ist
  const zeigeSollIst = () => {
    const alle = document.getElementById("pimAlleRollen").checked;
    const zeilen = b.rollen.filter(r => alle || r.belegt);
    const box = document.getElementById("pimSollIst");
    box.innerHTML = tabelleHtml(zeilen, [
      { key: "kat", label: "Kategorie" },
      { key: "name", label: "Rolle" },
      { key: "p", label: "PIM", render: r => r.p ? "P" : "" },
      { key: "max", label: "Höchstzahl", render: r => r.nurTechnisch ? "0 pers." : r.max },
      { key: "aktiv", label: "Aktiv", render: r => `<span class="${r.ueberschritten ? "ueberfaellig" : ""}">${r.aktiv}</span>` },
      { key: "berechtigt", label: "Berechtigt" },
      { key: "dauerhaft", label: "Dauerhaft", render: r => `<span class="${r.p && r.dauerhaft ? "warnung" : ""}">${r.dauerhaft}</span>` },
      { key: "technisch", label: "Technisch / Notfall", render: r => [r.technisch, r.notfall].join(" / ") },
      { key: "status", label: "Status", render: r => r.ueberschritten ? `<span class="status st-red">überschritten</span>`
          : r.p && r.dauerhaft ? `<span class="status st-yellow">nicht über PIM</span>`
          : r.belegt ? `<span class="status st-green">in Ordnung</span>` : `<span class="status st-gray">nicht vergeben</span>` }
    ], { leer: "Keine Rolle der Anlage 3 ist vergeben." });
    box.querySelectorAll("[data-idx]").forEach(tr => {
      tr.onclick = () => {
        filterSchreiben("rollenregister", { ...filterLesen("rollenregister"), q: zeilen[Number(tr.dataset.idx)].name });
        zeigeRollenTab("register");
      };
    });
  };
  document.getElementById("pimAlleRollen").onchange = zeigeSollIst;
  zeigeSollIst();

  const fremdBox = document.getElementById("pimFremd");
  if (fremdBox) {
    fremdBox.innerHTML = tabelleHtml(b.fremd, [
      { key: "name", label: "Rolle" },
      { key: "personen", label: "Personen" },
      { key: "technisch", label: "Technisch" },
      { key: "dokumentiert", label: "Status", render: f => !f.personen ? `<span class="status st-gray">nur technisch</span>`
          : f.dokumentiert ? `<span class="status st-yellow">begründet (§ 12)</span>` : `<span class="status st-red">nicht zugelassen</span>` }
    ]);
    fremdBox.querySelectorAll("[data-idx]").forEach(tr => {
      tr.onclick = () => {
        filterSchreiben("rollenregister", { ...filterLesen("rollenregister"), q: b.fremd[Number(tr.dataset.idx)].name });
        zeigeRollenTab("register");
      };
    });
  }
}

// Sprungziele aus Einführung und Feststellungen.
function pimZiel(ziel) {
  if (ziel === "einstellungen") {
    if (Store.rolle.admin) zeigeAnsicht("einstellungen");
    else toast("Notfallkonten trägt ein Administrator unter Einstellungen ein.");
  } else if (ziel === "notfalltest") {
    oeffneNotfalltest();
  } else if (ziel === "pruefungen") {
    window.open(CC_PIM_PORTAL.pruefungen, "_blank", "noopener");
  } else {
    zeigeRollenTab(ziel);
  }
}

function oeffneNotfalltest() {
  const k = pimKonfig();
  if (!darfRollenVerwalten()) { toast("Den Funktionstest dokumentieren Administratoren oder der CISO."); return; }
  Dialog.zeige({
    titel: "Funktionstest der Notfallkonten dokumentieren",
    html: `<p class="hint">Anmeldung mit jedem Notfallkonto prüfen (Kennwort bzw. FIDO2-Schlüssel aus dem Tresor),
        Rolle „Globaler Administrator“ wirksam, Alarmierung bei Anmeldung ausgelöst. Danach Kennwort bzw.
        Schlüssel wieder sicher verwahren (§ 5).</p>
      <p>Hinterlegt: ${k.notfallkonten.length ? k.notfallkonten.map(esc).join(", ") : "<em>keine</em>"}</p>
      <div class="form-grid">
        <label>Getestet am<input type="date" id="nfDatum" value="${new Date().toISOString().slice(0, 10)}"></label>
        <label>Nächster Test nach (Tagen)<input type="number" id="nfIntervall" min="7" max="365" value="${esc(k.notfallIntervall)}"></label>
      </div>`,
    aktionen: [{ label: "Speichern", klasse: "btn-primary", onClick: async modal => {
      try {
        await Store.saveKonfig({ pim: { ...(Store.konfig.pim || {}),
          notfallGeprueft: modal.querySelector("#nfDatum").value,
          notfallIntervall: Number(modal.querySelector("#nfIntervall").value) || 90 } });
        Dialog.schliesse();
        toast("Funktionstest dokumentiert.");
        if (_aktiveAnsicht === "rollen") zeigeAnsicht("rollen");
      } catch (e) { toast("Speichern fehlgeschlagen: " + e.message, 7000); }
    } }]
  });
}

// ===========================================================================
// Rollenregister (§ 10)
// ===========================================================================

// Vorbelegung eines Registereintrags aus einer Live-Zuweisung.
function registerVorlage(z) {
  return {
    Title: registerSchluessel(z), Konto: z.konto, Kontoart: z.kontoart, Rolle: z.rolleName, RolleId: z.rolleId,
    Zuweisung: z.zuweisung, ZugewiesenAm: String(z.seit || "").slice(0, 10), Befristung: String(z.bis || "").slice(0, 10),
    Quelle: "Entra ID"
  };
}

// Öffnet den Registereintrag zu einer Live-Zuweisung (z) und/oder einem
// Listeneintrag (r). Werte aus Entra ID sind gesperrt und werden beim Speichern
// aktualisiert; dokumentiert wird, was PIM nicht kennt.
function oeffneRegisterEintrag(z, r, neuladen) {
  const heute = new Date().toISOString().slice(0, 10);
  const ich = Store.benutzer.email;
  let werte;
  if (z) {
    const v = registerVorlage(z);
    werte = r ? { ...r, Konto: v.Konto, Rolle: v.Rolle, RolleId: v.RolleId, Zuweisung: v.Zuweisung, ZugewiesenAm: r.ZugewiesenAm || v.ZugewiesenAm,
                  Befristung: v.Befristung, Kontoart: r.Kontoart || v.Kontoart, Quelle: "Entra ID" }
              : { ...v, LetztePruefung: heute, GeprueftVon: ich };
  } else {
    werte = r || { Title: "manuell-" + Date.now(), Quelle: "manuell", Kontoart: "Person", Zuweisung: "dauerhaft", LetztePruefung: heute, GeprueftVon: ich };
  }
  const rolle = z ? z.rolle : null;
  const kopf = z ? `<table class="detail-table">
      <tr><td class="dt">Konto</td><td>${esc(z.name)} <span class="muted">${esc(z.konto)}</span></td></tr>
      <tr><td class="dt">Zuweisung in Entra ID</td><td>${zuweisungBadge(z)}${z.bis ? ` <span class="muted">befristet bis ${fmtDatum(z.bis)}</span>` : ""}</td></tr>
      <tr><td class="dt">Anlage 3</td><td>${rolle ? `${esc(rolle.kat)} · ${rolle.p ? "über PIM zu vergeben" : "ohne PIM-Pflicht"} · höchstens ${rolle.nurTechnisch ? "0 personenbezogen" : rolle.max + " gleichzeitig aktiv"}`
        : `<span class="ueberfaellig">nicht in der Anlage 3</span> <span class="muted">(Begründung nach § 12 Abs. 2 unter „Begründete Ausnahme“)</span>`}</td></tr>
    </table>` : `<p class="hint">Manuelle Einträge für Rollen, die das Cockpit nicht lesen kann, etwa
      ${CC_ANLAGE3_PURVIEW.map(x => `„${esc(x.name)}“`).join(" und ")} im Purview-Portal.</p>`;
  const gesperrt = z ? ["Konto", "Rolle", "RolleId", "Zuweisung", "ZugewiesenAm", "Befristung", "Quelle"] : ["Quelle"];
  if (!darfRollenVerwalten()) {
    Dialog.zeige({ titel: z ? `${z.rolleName}: ${z.konto}` : "Registereintrag", breit: true,
      html: kopf + `<table class="detail-table">${CC_SCHEMA.rollenregister.felder.filter(f => f.name !== "Title").map(f =>
        `<tr><td class="dt">${esc(f.label)}</td><td>${esc(f.type === "date" ? fmtDatum(werte[f.name]) : werte[f.name] || "")}</td></tr>`).join("")}</table>` });
    return;
  }
  oeffneEditor("rollenregister", werte, neuladen, {
    gesperrt, html: kopf,
    titel: z ? `${z.rolleName}: ${z.konto}` : (r ? "Registereintrag bearbeiten" : "Manueller Registereintrag")
  });
}

// Öffnet einen Listeneintrag (Direktlink, Suche) mit den aktuellen Daten aus Entra ID.
async function oeffneRegisterAusListe(rec, neuladen) {
  let z = null;
  if (rec.Quelle !== "manuell") {
    try {
      const s = await pimStand({ mitRegeln: false, mitExtras: false });
      z = s.bewertung.zuweisungen.find(x => registerSchluessel(x) === rec.Title && x.memberType !== "Group") || null;
    } catch (e) { /* dann nur der Listeneintrag */ }
  }
  oeffneRegisterEintrag(z, rec, neuladen);
}

async function renderRollenregister(el) {
  el.innerHTML = ladeBox("Zuweisungen und Register werden gelesen …");
  const s = await pimStand({ mitRegeln: false, mitExtras: false });
  const b = s.bewertung;
  const darf = darfRollenVerwalten();
  const vorJahr = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const neuladen = () => { Store.invalidate("rollenregister"); renderRollenregister(el); };
  const keinZugriff = Store.ohneZugriff.has(CC_LISTS.rollenregister) ||
    (Store.fehlendeListen.has(CC_LISTS.rollenregister) && !Store.rolle.admin);
  const listeFehlt = Store.fehlendeListen.has(CC_LISTS.rollenregister) || keinZugriff;

  // Gruppenmitglieder erscheinen nicht einzeln; die Gruppe wird dokumentiert.
  const mitglieder = g => b.zuweisungen.filter(m => m.memberType === "Group" && m.rolleId === g.rolleId && m.ueberGruppe === (g.name || g.konto));
  const live = b.zuweisungen.filter(z => z.memberType !== "Group").map(z => ({
    id: registerSchluessel(z), z, r: z.register, konto: z.konto, name: z.name, kontoart: z.kontoart, rolle: z.rolleName,
    zweck: z.register ? z.register.Zweck : "", genehmigt: z.register ? z.register.GenehmigtVon : "",
    geprueft: z.register ? z.register.LetztePruefung : "", dokumentiert: z.dokumentiert, faellig: z.pruefungFaellig,
    art: z.dauerhaft ? "dauerhaft" : z.arten.has("berechtigt") ? "berechtigt" : "aktiviert",
    anzahlMitglieder: z.kontoart === "Gruppe" ? mitglieder(z).length : null
  }));
  const manuell = s.register.filter(r => r.Quelle === "manuell" && !r.Entzogen).map(r => ({
    id: r.Title, z: null, r, konto: r.Konto, name: "", kontoart: r.Kontoart || "Person", rolle: r.Rolle,
    zweck: r.Zweck, genehmigt: r.GenehmigtVon, geprueft: r.LetztePruefung,
    dokumentiert: !!(String(r.Zweck || "").trim() && String(r.GenehmigtVon || "").trim()),
    faellig: !r.LetztePruefung || r.LetztePruefung < vorJahr,
    art: /berechtigt/.test(r.Zuweisung || "") ? "berechtigt" : "dauerhaft"
  }));
  const alle = [...live, ...manuell];
  const gemerkt = filterLesen("rollenregister");
  const auswahl = new Set();

  el.innerHTML = `
    ${keinZugriff ? hinweisBox(`Sie haben keinen Zugriff auf <strong>${esc(CC_LISTS.rollenregister)}</strong>. Das Register ist auf die
      zentrale IT und Compliance beschränkt; angezeigt werden nur die Zuweisungen aus Entra ID.`, "info")
      : listeFehlt ? hinweisBox(`Die Liste <strong>${esc(CC_LISTS.rollenregister)}</strong> gibt es noch nicht. Ein Administrator legt sie unter
      Einstellungen → „Listen prüfen / anlegen“ an. Bis dahin lässt sich nichts dokumentieren.`, "warn") : ""}
    <p class="hint">Das Register nach § 10 der Anlage: Konto, Rolle und Art der Zuweisung kommen live aus Entra ID,
      Zweck, genehmigende Stelle und Überprüfung pflegen Sie hier. Der KBR kann das Register einsehen (CSV).</p>
    <div class="filter-bar">
      <input type="search" data-q placeholder="Konto oder Rolle …" value="${esc(gemerkt.q || "")}">
      <select data-kontoart><option value="">Kontoart: alle</option>${CC_KONTOARTEN.map(x => `<option${gemerkt.kontoart === x ? " selected" : ""}>${x}</option>`).join("")}</select>
      <select data-art><option value="">Zuweisung: alle</option>${["berechtigt", "dauerhaft", "aktiviert"].map(x => `<option${gemerkt.art === x ? " selected" : ""}>${x}</option>`).join("")}</select>
      <label class="checkline"><input type="checkbox" data-offen${gemerkt.offen ? " checked" : ""}> nur unvollständige</label>
      <label class="checkline"><input type="checkbox" data-faellig${gemerkt.faellig ? " checked" : ""}> nur Prüfung fällig</label>
      <button class="btn-csv" data-csv>CSV</button>
      ${darf && !listeFehlt ? `<button class="btn-primary btn-small" data-manuell>+ Manueller Eintrag</button>` : ""}
    </div>
    <div class="sammelleiste" data-leiste hidden>
      <span data-zahl></span>
      <button class="btn-primary btn-small" data-pruefen>Überprüfung bestätigen</button>
      <button class="btn-secondary btn-small" data-dokumentieren>Zweck und Genehmigung setzen</button>
      <button class="btn-ghost-dark" data-leeren>Auswahl aufheben</button>
    </div>
    <div data-tabelle></div>
    <p class="muted" data-anzahl></p>
    ${b.entfallen.length ? `<h3 class="abschnitt">Im Register, aber nicht mehr zugewiesen</h3>
      <p class="hint">Die Rolle wurde entzogen oder ist abgelaufen. Mit „Entzug dokumentieren“ bleibt der Eintrag als Nachweis erhalten.</p>
      <div data-entfallen></div>` : ""}
    <label class="checkline"><input type="checkbox" data-entzogen> entzogene Einträge anzeigen</label>
    <div data-entzogen-liste></div>`;

  const leiste = el.querySelector("[data-leiste]");
  const zeigeLeiste = () => {
    leiste.hidden = auswahl.size === 0;
    el.querySelector("[data-zahl]").textContent = `${auswahl.size} markiert`;
  };

  const spalten = [
    { key: "konto", label: "Konto", render: x => `${esc(x.name || x.konto)}${x.name && x.name !== x.konto ? `<br><span class="muted">${esc(x.konto)}</span>` : ""}` },
    { key: "kontoart", label: "Art", render: x => esc(x.kontoart) + (x.anzahlMitglieder !== null && x.anzahlMitglieder !== undefined ? ` <span class="muted">(${x.anzahlMitglieder} Mitgl.)</span>` : "") },
    { key: "rolle", label: "Rolle", render: x => esc(x.rolle) + (x.z && !x.z.rolle ? ` <span class="status st-red">nicht in Anlage 3</span>` : "") },
    { key: "zuweisung", label: "Zuweisung", render: x => x.z ? zuweisungBadge(x.z) : `<span class="status st-gray">${esc(x.r.Zuweisung || "manuell")}</span>` },
    { key: "zweck", label: "Zweck", render: x => esc(String(x.zweck || "").slice(0, 70)) + (String(x.zweck || "").length > 70 ? "…" : "") },
    { key: "genehmigt", label: "Genehmigt von" },
    { key: "geprueft", label: "Geprüft", render: x => x.geprueft ? `<span class="${x.faellig ? "ueberfaellig" : ""}">${fmtDatum(x.geprueft)}</span>` : `<span class="ueberfaellig">nie</span>` },
    { key: "dokumentiert", label: "Register", render: x => x.dokumentiert ? `<span class="status st-green">vollständig</span>` : `<span class="status st-red">unvollständig</span>` }
  ];

  let sichtbar = [];
  const zeige = () => {
    const q = el.querySelector("[data-q]").value.trim().toLowerCase();
    const kontoart = el.querySelector("[data-kontoart]").value;
    const art = el.querySelector("[data-art]").value;
    const offen = el.querySelector("[data-offen]").checked;
    const faellig = el.querySelector("[data-faellig]").checked;
    filterSchreiben("rollenregister", { q: el.querySelector("[data-q]").value, kontoart, art, offen, faellig });
    sichtbar = alle.filter(x => (!q || `${x.konto} ${x.name} ${x.rolle} ${x.zweck || ""} ${x.genehmigt || ""}`.toLowerCase().includes(q)) &&
      (!kontoart || x.kontoart === kontoart) && (!art || x.art === art) && (!offen || !x.dokumentiert) && (!faellig || x.faellig));
    const box = el.querySelector("[data-tabelle]");
    box.innerHTML = tabelleHtml(sichtbar, spalten, { leer: "Keine Zuweisungen für diese Auswahl.", auswahl: darf && !listeFehlt ? auswahl : null });
    el.querySelector("[data-anzahl]").textContent = `${sichtbar.length} von ${alle.length} Zuweisungen`;
    box.querySelectorAll("[data-idx]").forEach(tr => {
      tr.onclick = ev => {
        if (ev.target.closest(".auswahl-zelle")) return;
        const x = sichtbar[Number(tr.dataset.idx)];
        oeffneRegisterEintrag(x.z, x.r, neuladen);
      };
    });
    auswahlVerbinden(box, sichtbar, auswahl, zeigeLeiste);
  };
  el.querySelectorAll("[data-q]").forEach(x => { x.oninput = zeige; });
  el.querySelectorAll("[data-kontoart], [data-art], [data-offen], [data-faellig]").forEach(x => { x.onchange = zeige; });
  zeige();

  el.querySelector("[data-leeren]").onclick = () => { auswahl.clear(); zeige(); zeigeLeiste(); };
  const gewaehlt = () => alle.filter(x => auswahl.has(x.id));
  const sammelSpeichern = async (aenderung, text) => {
    const liste = gewaehlt();
    let n = 0;
    const fehler = [];
    await parallelAbarbeiten(liste, 4, async x => {
      try {
        if (x.r) await Store.save("rollenregister", x.r.id, aenderung);
        else await Store.save("rollenregister", null, { ...registerVorlage(x.z), ...aenderung });
        n++;
        toast(`${n} von ${liste.length} gespeichert …`);
      } catch (e) { fehler.push(`${x.konto}: ${e.message}`); }
    });
    toast(fehler.length ? `${n} gespeichert, ${fehler.length} fehlgeschlagen (${fehler[0]})` : `${n} Zuweisungen ${text}.`, fehler.length ? 9000 : 4000);
    neuladen();
  };
  el.querySelector("[data-pruefen]").onclick = () => {
    const n = auswahl.size;
    if (!confirm(`${n} Zuweisung(en) als überprüft bestätigen? Damit erklären Sie, dass die Rollen weiterhin erforderlich sind (§ 11).`)) return;
    sammelSpeichern({ LetztePruefung: new Date().toISOString().slice(0, 10), GeprueftVon: Store.benutzer.email }, "als überprüft bestätigt");
  };
  el.querySelector("[data-dokumentieren]").onclick = () => {
    Dialog.zeige({
      titel: `${auswahl.size} Zuweisung(en) dokumentieren`,
      breit: true,
      html: `<p class="hint">Nur ausgefüllte Felder werden übernommen. Praktisch für gleichartige Zuweisungen,
          etwa alle Exchange-Administratoren eines Teams.</p>
        <div class="form-grid">
          <label class="span2">Betrieblicher Zweck / Zuständigkeitsbereich<textarea id="sdZweck" rows="2"></textarea></label>
          <label>Zuständige genehmigende Stelle<input type="text" id="sdGenehmigt" placeholder="z. B. Leitung IT"></label>
          <label>Letzte Überprüfung<input type="date" id="sdPruefung" value="${new Date().toISOString().slice(0, 10)}"></label>
        </div>`,
      aktionen: [{ label: "Übernehmen", klasse: "btn-primary", onClick: modal => {
        const aenderung = {};
        const zweck = modal.querySelector("#sdZweck").value.trim();
        const gen = modal.querySelector("#sdGenehmigt").value.trim();
        const pr = modal.querySelector("#sdPruefung").value;
        if (zweck) aenderung.Zweck = zweck;
        if (gen) aenderung.GenehmigtVon = gen;
        if (pr) { aenderung.LetztePruefung = pr; aenderung.GeprueftVon = Store.benutzer.email; }
        if (!Object.keys(aenderung).length) { toast("Bitte mindestens ein Feld ausfüllen."); return; }
        Dialog.schliesse();
        sammelSpeichern(aenderung, "dokumentiert");
      } }]
    });
  };

  const btnManuell = el.querySelector("[data-manuell]");
  if (btnManuell) btnManuell.onclick = () => oeffneRegisterEintrag(null, null, neuladen);

  el.querySelector("[data-csv]").onclick = () => csvExport(`Rollenregister_${new Date().toISOString().slice(0, 10)}.csv`, sichtbar, [
    { key: "konto", label: "Konto" }, { key: "kontoart", label: "Kontoart" }, { key: "rolle", label: "Rolle" },
    { label: "Art der Zuweisung", csv: x => x.z ? x.z.zuweisung : (x.r.Zuweisung || "") },
    { label: "Zugewiesen am", csv: x => (x.r && x.r.ZugewiesenAm) || (x.z ? String(x.z.seit || "").slice(0, 10) : "") },
    { label: "Befristet bis", csv: x => x.z ? String(x.z.bis || "").slice(0, 10) : (x.r.Befristung || "") },
    { key: "zweck", label: "Zweck" }, { key: "genehmigt", label: "Genehmigende Stelle" },
    { key: "geprueft", label: "Letzte Überprüfung" }, { label: "Ausnahme", csv: x => x.r ? x.r.Ausnahme || "" : "" },
    { label: "Quelle", csv: x => x.z ? "Entra ID" : "manuell" }
  ]);

  // Entfallene Zuweisungen
  const entfallenBox = el.querySelector("[data-entfallen]");
  if (entfallenBox) {
    entfallenBox.innerHTML = tabelleHtml(b.entfallen, [
      { key: "Konto", label: "Konto" }, { key: "Rolle", label: "Rolle" }, { key: "Zuweisung", label: "Zuletzt" },
      { key: "aktion", label: "", render: () => darf ? `<button class="btn-ghost-dark" data-entzug>Entzug dokumentieren</button>` : "" }
    ]);
    entfallenBox.querySelectorAll("[data-entzug]").forEach((btn, i) => {
      btn.onclick = async ev => {
        ev.stopPropagation();
        try {
          await Store.save("rollenregister", b.entfallen[i].id, { Entzogen: new Date().toISOString().slice(0, 10) });
          toast("Entzug dokumentiert.");
          neuladen();
        } catch (e) { toast("Speichern fehlgeschlagen: " + e.message, 7000); }
      };
    });
    entfallenBox.querySelectorAll("[data-idx]").forEach(tr => {
      tr.onclick = () => oeffneRegisterEintrag(null, b.entfallen[Number(tr.dataset.idx)], neuladen);
    });
  }

  el.querySelector("[data-entzogen]").onchange = ev => {
    const box = el.querySelector("[data-entzogen-liste]");
    if (!ev.target.checked) { box.innerHTML = ""; return; }
    const entzogen = s.register.filter(r => r.Entzogen).sort((x, y) => String(y.Entzogen).localeCompare(String(x.Entzogen)));
    box.innerHTML = tabelleHtml(entzogen, [
      { key: "Konto", label: "Konto" }, { key: "Rolle", label: "Rolle" },
      { key: "Entzogen", label: "Entzogen am", render: r => fmtDatum(r.Entzogen) }, { key: "Zweck", label: "Zweck" }
    ], { leer: "Keine entzogenen Einträge." });
    box.querySelectorAll("[data-idx]").forEach(tr => { tr.onclick = () => oeffneRegisterEintrag(null, entzogen[Number(tr.dataset.idx)], neuladen); });
  };
}

// ===========================================================================
// Umstellung auf PIM (§ 2.2)
// ===========================================================================

async function renderPimUmstellung(el) {
  el.innerHTML = ladeBox();
  const s = await pimStand({ mitRegeln: false, mitExtras: false });
  const b = s.bewertung, k = s.k;
  const darf = darfRollenVerwalten();
  const ich = String(Store.benutzer.email || "").toLowerCase();
  const neuladen = () => { Pim.invalidate(); Store.invalidate("rollenregister"); renderPimUmstellung(el); };

  const notfallOk = k.notfallkonten.length >= 2 && k.notfallkonten.every(upn =>
    b.zuweisungen.some(z => String(z.konto).toLowerCase() === upn && z.rolleId === CC_ROLLE_GA && z.arten.has("dauerhaft")));
  const kandidaten = b.zuweisungen.filter(umstellungKandidat).map(z => ({
    id: z.key, z,
    gesperrt: z.rolleId === CC_ROLLE_GA && !notfallOk ? "Notfallkonten fehlen oder haben die Rolle nicht dauerhaft" : "",
    hinweis: String(z.konto).toLowerCase() === ich ? "Ihr eigenes Konto: Sie aktivieren die Rolle danach selbst."
      : z.kontoart === "Gruppe" ? "Die Gruppe wird berechtigt; ihre Mitglieder aktivieren die Rolle." : ""
  }));
  const ausnahmen = b.zuweisungen.filter(z => z.rolle && z.rolle.p && z.dauerhaft && z.ausnahme &&
    (istPersonenbezogen(z.kontoart) || z.kontoart === "Gruppe"));
  const auswahl = new Set();

  el.innerHTML = `
    <p class="hint">Personenbezogene Admin-Rollen werden nach § 2.2 grundsätzlich über PIM vergeben: Die Person ist für die
      Rolle <strong>berechtigt</strong> und aktiviert sie bei Bedarf befristet, mit Begründung und MFA. Beim Überführen legt
      das Cockpit die Berechtigung an und entfernt danach die dauerhafte Zuweisung. Beide Schritte stehen im
      Entra-Überwachungsprotokoll.</p>
    ${!s.stand.pimVerfuegbar ? hinweisBox("PIM ist im Mandanten noch nicht nutzbar (Lizenz). Die Umstellung ist erst danach möglich.", "warn") : ""}
    ${!notfallOk ? hinweisBox(`<strong>Globale Administratoren bleiben vorerst unverändert.</strong> Erst wenn zwei Notfallkonten
      hinterlegt sind und die Rolle dauerhaft haben, lässt das Cockpit die Umstellung zu. Sonst könnte sich der Mandant aussperren.`, "warn") : ""}
    ${hinweisBox(`Vorher prüfen: Jede berechtigte Person braucht eine Lizenz für Entra ID P2 oder ID Governance und eine
      funktionierende MFA. Die Aktivierungsregeln (Reiter „Aktivierungsregeln“) sollten bereits gesetzt sein.`, "info")}
    <div class="sammelleiste" data-leiste hidden>
      <span data-zahl></span>
      <button class="btn-primary btn-small" data-ueberfuehren>Ausgewählte in PIM überführen</button>
    </div>
    <div data-kandidaten></div>
    <div data-protokoll></div>
    <h3 class="abschnitt">Begründete Ausnahmen (bleiben dauerhaft)</h3>
    <div data-ausnahmen></div>`;

  const box = el.querySelector("[data-kandidaten]");
  const zeigeLeiste = () => {
    el.querySelector("[data-leiste]").hidden = auswahl.size === 0;
    el.querySelector("[data-zahl]").textContent = `${auswahl.size} markiert`;
  };
  box.innerHTML = tabelleHtml(kandidaten, [
    { key: "konto", label: "Konto", render: x => `${esc(x.z.name || x.z.konto)}<br><span class="muted">${esc(x.z.konto)} · ${esc(x.z.kontoart)}</span>` },
    { key: "rolle", label: "Rolle", render: x => esc(x.z.rolleName) },
    { key: "art", label: "Zuweisung", render: x => zuweisungBadge(x.z) },
    { key: "seit", label: "Seit", render: x => fmtDatum(x.z.seit) },
    { key: "hinweis", label: "Hinweis", render: x => x.gesperrt ? `<span class="ueberfaellig">${esc(x.gesperrt)}</span>` : `<span class="muted">${esc(x.hinweis)}</span>` },
    { key: "aktion", label: "", render: () => darf ? `<button class="btn-ghost-dark" data-ausnahme>Ausnahme begründen</button>` : "" }
  ], { leer: "Keine dauerhaften Zuweisungen von PIM-Rollen an Personen. Die Umstellung ist abgeschlossen.",
       auswahl: darf && s.stand.pimVerfuegbar ? auswahl : null });
  auswahlVerbinden(box, kandidaten, auswahl, zeigeLeiste, x => !!x.gesperrt);
  box.querySelectorAll("[data-ausnahme]").forEach((btn, i) => {
    btn.onclick = ev => { ev.stopPropagation(); oeffneRegisterEintrag(kandidaten[i].z, kandidaten[i].z.register, neuladen); };
  });
  box.querySelectorAll("[data-idx]").forEach(tr => {
    tr.onclick = ev => {
      if (ev.target.closest(".auswahl-zelle")) return;
      const x = kandidaten[Number(tr.dataset.idx)];
      oeffneRegisterEintrag(x.z, x.z.register, neuladen);
    };
  });

  el.querySelector("[data-ausnahmen]").innerHTML = tabelleHtml(ausnahmen, [
    { key: "konto", label: "Konto", render: z => esc(z.konto) },
    { key: "rolle", label: "Rolle", render: z => esc(z.rolleName) },
    { key: "grund", label: "Begründung", render: z => esc(z.register.Ausnahme) }
  ], { leer: "Keine Ausnahmen dokumentiert." });
  el.querySelectorAll("[data-ausnahmen] [data-idx]").forEach(tr => {
    tr.onclick = () => { const z = ausnahmen[Number(tr.dataset.idx)]; oeffneRegisterEintrag(z, z.register, neuladen); };
  });

  el.querySelector("[data-ueberfuehren]").onclick = () => {
    const liste = kandidaten.filter(x => auswahl.has(x.id) && !x.gesperrt);
    Dialog.zeige({
      titel: `${liste.length} Zuweisung(en) in PIM überführen`,
      breit: true,
      html: `<p>Für jede Zuweisung legt das Cockpit eine PIM-Berechtigung an und entfernt danach die dauerhafte Zuweisung:</p>
        <ul>${liste.map(x => `<li>${esc(x.z.rolleName)}: ${esc(x.z.konto)}${x.hinweis ? ` <span class="muted">(${esc(x.hinweis)})</span>` : ""}</li>`).join("")}</ul>
        <p class="hint">Die Personen sehen die Rolle danach unter „Meine Rollen“ bzw. im Entra-Portal und aktivieren sie dort.</p>`,
      aktionen: [{ label: "Überführen", klasse: "btn-primary", onClick: async modal => {
        modal.querySelectorAll("#modalActions button").forEach(x => { x.disabled = true; });
        const protokoll = [];
        for (const x of liste) {
          try {
            await Pim.ueberfuehren(x.z, "Umstellung auf PIM nach Anlage 3 der KBV (Rollen- und Berechtigungskonzept), Compliance-Cockpit");
            protokoll.push({ was: `${x.z.rolleName}: ${x.z.konto}`, ergebnis: "überführt", ok: true });
            if (x.z.register) await Store.save("rollenregister", x.z.register.id, { Zuweisung: "berechtigt (PIM)" }).catch(() => {});
          } catch (e) {
            protokoll.push({ was: `${x.z.rolleName}: ${x.z.konto}`, ergebnis: pimFehlerText(e), ok: false });
          }
          toast(`${protokoll.length} von ${liste.length} bearbeitet …`);
        }
        Dialog.schliesse();
        Pim.invalidate();
        Store.invalidate("rollenregister");
        await renderPimUmstellung(el);
        el.querySelector("[data-protokoll]").innerHTML = `<h3 class="abschnitt">Ergebnis</h3>` + tabelleHtml(protokoll, [
          { key: "was", label: "Zuweisung" },
          { key: "ergebnis", label: "Ergebnis", render: p => p.ok ? `<span class="status st-green">${esc(p.ergebnis)}</span>` : `<span class="ueberfaellig">${esc(p.ergebnis)}</span>` }
        ]);
      } }]
    });
  };
}

// ===========================================================================
// Aktivierungsregeln (Hausstandard)
// ===========================================================================

async function renderPimRegeln(el) {
  el.innerHTML = ladeBox("Aktivierungsregeln werden gelesen …");
  const k = pimKonfig(), std = k.standard;
  const darf = darfRollenVerwalten();
  let regeln;
  try { regeln = await Pim.regeln(); }
  catch (e) {
    el.innerHTML = fehlerBox(e, "Aktivierungsregeln") + hinweisBox("Ohne PIM-Lizenz gibt es keine Aktivierungsregeln.", "info");
    return;
  }
  const auswahl = new Set();
  const gemerkt = filterLesen("pimregeln");
  const name = id => (anlage3Rolle(id) || {}).name || id;
  const ja = (w, soll = true) => w ? `<span class="status st-green">ja</span>` : `<span class="status ${soll ? "st-red" : "st-gray"}">nein</span>`;

  el.innerHTML = `
    <div class="card-inline">
      <div class="card-head"><h3>Hausstandard</h3>
        ${darf ? `<button class="btn-secondary btn-small" id="btnStdBearbeiten">Bearbeiten</button>` : ""}</div>
      <p>Aktivierung höchstens <strong>${std.dauer} Stunden</strong>, kritische Rollen höchstens <strong>${std.dauerKritisch} Stunden</strong>.
        Verlangt werden ${aufzaehlung([std.mfa && "MFA", std.begruendung && "eine Begründung", std.ticket && "eine Ticketnummer"].filter(Boolean)) || "keine weiteren Angaben"}.
        ${std.genehmigungKritisch ? `Kritische Rollen brauchen eine <strong>Genehmigung</strong>${std.genehmiger.length ? ` durch ${std.genehmiger.map(esc).join(", ")}` : ""}.` : "Genehmigungen sind nicht vorgesehen."}
        ${std.benachrichtigung.length ? `Jede Aktivierung meldet PIM zusätzlich an ${std.benachrichtigung.map(esc).join(", ")}.` : ""}</p>
      <p class="muted">Kritisch: ${std.kritisch.map(name).map(esc).join(", ") || "keine"}.</p>
      ${std.genehmigungKritisch && std.genehmiger.length < 2 ? hinweisBox(`Für die Genehmigung ${std.genehmiger.length ? "ist nur eine Person" : "sind keine Personen"} hinterlegt.
        Niemand kann den eigenen Antrag genehmigen; mindestens zwei Genehmiger sind sinnvoll.`, "warn") : ""}
    </div>
    <div class="filter-bar">
      <label class="checkline"><input type="checkbox" data-alle-rollen${gemerkt.alle ? " checked" : ""}> auch Rollen ohne PIM-Pflicht</label>
      <label class="checkline"><input type="checkbox" data-nur-abw${gemerkt.nurAbw ? " checked" : ""}> nur Abweichungen</label>
    </div>
    <div class="sammelleiste" data-leiste hidden>
      <span data-zahl></span>
      <button class="btn-primary btn-small" data-anwenden>Hausstandard anwenden</button>
    </div>
    <div data-tabelle></div>
    <div data-protokoll></div>`;

  const btnStd = document.getElementById("btnStdBearbeiten");
  if (btnStd) btnStd.onclick = () => oeffneHausstandard(() => renderPimRegeln(el));

  const zeigeLeiste = () => {
    el.querySelector("[data-leiste]").hidden = auswahl.size === 0;
    el.querySelector("[data-zahl]").textContent = `${auswahl.size} markiert`;
  };
  let zeilen = [];
  const zeige = () => {
    const alle = el.querySelector("[data-alle-rollen]").checked;
    const nurAbw = el.querySelector("[data-nur-abw]").checked;
    filterSchreiben("pimregeln", { alle, nurAbw });
    zeilen = CC_ANLAGE3_ROLLEN.filter(r => alle || r.p).map(r => ({ id: r.id, rolle: r, ...bewerteRegeln(regeln[r.id], r.id, std) }))
      .filter(x => !nurAbw || !x.ok);
    const box = el.querySelector("[data-tabelle]");
    box.innerHTML = tabelleHtml(zeilen, [
      { key: "rolle", label: "Rolle", render: x => esc(x.rolle.name) + (x.kritisch ? ` <span class="status st-yellow">kritisch</span>` : "") + (x.rolle.p ? "" : ` <span class="muted">(ohne PIM-Pflicht)</span>`) },
      { key: "dauer", label: "Höchstdauer", render: x => x.werte.dauer === null || x.werte.dauer === undefined ? "–"
          : `<span class="${x.werte.dauer > x.sollDauer ? "ueberfaellig" : ""}">${esc(String(Math.round(x.werte.dauer * 10) / 10).replace(".", ","))} h</span>` },
      { key: "mfa", label: "MFA", render: x => ja(x.werte.mfa, std.mfa) + (x.werte.kontext ? ` <span class="muted">(Auth.-Kontext)</span>` : "") },
      { key: "begr", label: "Begründung", render: x => ja(x.werte.begruendung, std.begruendung) },
      { key: "ticket", label: "Ticket", render: x => ja(x.werte.ticket, std.ticket) },
      { key: "gen", label: "Genehmigung", render: x => ja(x.werte.genehmigung, x.kritisch && std.genehmigungKritisch) +
          (x.werte.genehmigung ? ` <span class="muted">${x.werte.genehmigerAnzahl || "Standard"}</span>` : "") },
      { key: "ok", label: "Bewertung", render: x => x.ok ? `<span class="status st-green">entspricht</span>`
          : `<span class="status st-red">weicht ab</span><br><span class="muted">${esc(x.abweichungen.join("; "))}</span>` }
    ], { leer: "Alle Rollen entsprechen dem Hausstandard.", auswahl: darf ? auswahl : null });
    auswahlVerbinden(box, zeilen, auswahl, zeigeLeiste, x => !x.vorhanden);
  };
  el.querySelectorAll("[data-alle-rollen], [data-nur-abw]").forEach(x => { x.onchange = () => { auswahl.clear(); zeigeLeiste(); zeige(); }; });
  zeige();

  el.querySelector("[data-anwenden]").onclick = async () => {
    const ziele = CC_ANLAGE3_ROLLEN.filter(r => auswahl.has(r.id));
    if (!confirm(`Hausstandard auf ${ziele.length} Rolle(n) anwenden? Die PIM-Einstellungen dieser Rollen werden in Entra ID geändert.`)) return;
    const protokoll = [];
    for (const r of ziele) {
      try {
        const e = await Pim.regelnAnwenden(r.id, std);
        protokoll.push({ rolle: r.name, ok: true, ergebnis: [e.geaendert.length ? e.geaendert.join("; ") : "bereits passend", ...e.hinweise].join(" · ") });
      } catch (e) {
        protokoll.push({ rolle: r.name, ok: false, ergebnis: pimFehlerText(e) });
      }
      toast(`${protokoll.length} von ${ziele.length} Rollen bearbeitet …`);
    }
    Pim.invalidate();
    await renderPimRegeln(el);
    el.querySelector("[data-protokoll]").innerHTML = `<h3 class="abschnitt">Ergebnis</h3>` + tabelleHtml(protokoll, [
      { key: "rolle", label: "Rolle" },
      { key: "ergebnis", label: "Ergebnis", render: p => p.ok ? esc(p.ergebnis) : `<span class="ueberfaellig">${esc(p.ergebnis)}</span>` }
    ]);
  };
}

function oeffneHausstandard(fertig) {
  const k = pimKonfig(), std = k.standard;
  const pRollen = CC_ANLAGE3_ROLLEN.filter(r => r.p);
  Dialog.zeige({
    titel: "Hausstandard für die Aktivierung",
    breit: true,
    html: `<p class="hint">Die Anlage 3 lässt offen, welche Bedingungen gelten (§ 2.2: Begründung, MFA, Genehmigung,
        zeitliche Begrenzung, Benachrichtigung, Protokollierung). Der Hausstandard legt sie fest; das Cockpit prüft jede
        Rolle dagegen und kann ihn anwenden.</p>
      <div class="form-grid">
        <label>Höchstdauer (Stunden)<input type="number" id="hsDauer" min="1" max="24" value="${esc(std.dauer)}"></label>
        <label>Höchstdauer kritischer Rollen (Stunden)<input type="number" id="hsDauerK" min="1" max="24" value="${esc(std.dauerKritisch)}"></label>
        <label class="checkline"><input type="checkbox" id="hsMfa"${std.mfa ? " checked" : ""}> MFA bei Aktivierung</label>
        <label class="checkline"><input type="checkbox" id="hsBegr"${std.begruendung ? " checked" : ""}> Begründung verlangen</label>
        <label class="checkline"><input type="checkbox" id="hsTicket"${std.ticket ? " checked" : ""}> Ticketnummer verlangen</label>
        <label class="checkline"><input type="checkbox" id="hsGen"${std.genehmigungKritisch ? " checked" : ""}> Genehmigung für kritische Rollen</label>
        <label class="span2">Genehmiger (E-Mail, kommagetrennt)<input type="text" id="hsGenehmiger" list="cc-personen" value="${esc(std.genehmiger.join(", "))}">
          <span class="feld-hint">Mindestens zwei Personen, da niemand den eigenen Antrag genehmigen kann. Genehmiger brauchen ebenfalls eine P2-Lizenz.</span></label>
        <label class="span2">Zusätzliche Benachrichtigung bei jeder Aktivierung (E-Mail, kommagetrennt)<input type="text" id="hsInfo" value="${esc(std.benachrichtigung.join(", "))}">
          <span class="feld-hint">„Benachrichtigung der zuständigen Stellen“, z. B. CISO oder Postfach der IT-Sicherheit.</span></label>
      </div>
      <h3>Kritische Rollen</h3>
      <div class="checkbox-reihe">${pRollen.map(r => `<label class="checkline"><input type="checkbox" data-kritisch="${r.id}"${std.kritisch.includes(r.id) ? " checked" : ""}> ${esc(r.name)}</label>`).join("")}</div>`,
    aktionen: [{ label: "Speichern", klasse: "btn-primary", onClick: async modal => {
      const zahl = (id, def) => Math.min(24, Math.max(1, Number(modal.querySelector(id).value) || def));
      const neu = {
        dauer: zahl("#hsDauer", 8), dauerKritisch: zahl("#hsDauerK", 4),
        mfa: modal.querySelector("#hsMfa").checked, begruendung: modal.querySelector("#hsBegr").checked,
        ticket: modal.querySelector("#hsTicket").checked, genehmigungKritisch: modal.querySelector("#hsGen").checked,
        genehmiger: teileListe(modal.querySelector("#hsGenehmiger").value).map(x => x.toLowerCase()),
        benachrichtigung: teileListe(modal.querySelector("#hsInfo").value).map(x => x.toLowerCase()),
        kritisch: [...modal.querySelectorAll("[data-kritisch]")].filter(c => c.checked).map(c => c.dataset.kritisch)
      };
      try {
        await Store.saveKonfig({ pim: { ...(Store.konfig.pim || {}), standard: neu } });
        Dialog.schliesse();
        toast("Hausstandard gespeichert.");
        if (fertig) fertig();
      } catch (e) { toast("Speichern fehlgeschlagen: " + e.message, 7000); }
    } }]
  });
  personenListeLaden();
}

// ===========================================================================
// Meine Rollen: Just-in-time-Aktivierung und Genehmigungen
// ===========================================================================

async function renderMeineRollen(el) {
  el.innerHTML = ladeBox("Ihre Rollen werden gelesen …");
  const m = await Pim.meineRollen();
  const neuladen = () => renderMeineRollen(el);
  const aktivNach = {};
  m.aktiv.forEach(a => { aktivNach[a.rolleId + "|" + a.scope] = a; });
  const berechtigt = m.berechtigt.map(b => ({ ...b, aktiv: aktivNach[b.rolleId + "|" + b.scope] && aktivNach[b.rolleId + "|" + b.scope].art === "Activated" ? aktivNach[b.rolleId + "|" + b.scope] : null }));
  const dauerhaft = m.aktiv.filter(a => a.art !== "Activated");

  el.innerHTML = `
    <p class="hint">Aktivieren Sie eine Rolle nur für die konkrete Aufgabe und geben Sie den Zweck nach § 8 der Anlage an.
      Der Zweck fließt ohne Namen in die Quartalsübersicht für den KBR ein.</p>
    <h3>Berechtigte Rollen</h3>
    <div data-berechtigt></div>
    ${dauerhaft.length ? `<h3 class="abschnitt">Dauerhaft zugewiesen</h3><div data-dauerhaft></div>` : ""}
    ${m.antraege.length ? `<h3 class="abschnitt">Ihre offenen Anträge</h3><div data-antraege></div>` : ""}
    <h3 class="abschnitt">Zu genehmigen</h3>
    <div data-genehmigen>${ladeBox()}</div>
    <p class="muted">Alternativ im Entra-Portal: <a href="${esc(CC_PIM_PORTAL.meine)}" target="_blank" rel="noopener">Meine Rollen ↗</a>
      · <a href="${esc(CC_PIM_PORTAL.genehmigen)}" target="_blank" rel="noopener">Anträge genehmigen ↗</a></p>`;

  const bBox = el.querySelector("[data-berechtigt]");
  bBox.innerHTML = tabelleHtml(berechtigt, [
    { key: "rolle", label: "Rolle", render: x => esc(x.rolle) + (x.scope !== "/" ? ` <span class="muted">(${esc(x.scope)})</span>` : "") + (x.ueberGruppe ? ` <span class="muted">über Gruppe</span>` : "") },
    { key: "ende", label: "Berechtigt bis", render: x => x.ende ? fmtDatum(x.ende) : "unbefristet" },
    { key: "status", label: "Status", render: x => x.aktiv ? `<span class="status st-yellow">aktiv bis ${esc(fmtDatumZeit(x.aktiv.ende))}</span>` : `<span class="status st-gray">nicht aktiv</span>` },
    { key: "aktion", label: "", render: x => x.aktiv ? `<button class="btn-ghost-dark" data-deaktivieren>Zurückgeben</button>` : `<button class="btn-primary btn-small" data-aktivieren>Aktivieren</button>` }
  ], { leer: "Sie sind für keine Rolle über PIM berechtigt." });
  bBox.querySelectorAll("[data-idx]").forEach(tr => {
    const x = berechtigt[Number(tr.dataset.idx)];
    const akt = tr.querySelector("[data-aktivieren]");
    if (akt) akt.onclick = ev => { ev.stopPropagation(); oeffneAktivierung(x, neuladen); };
    const de = tr.querySelector("[data-deaktivieren]");
    if (de) de.onclick = async ev => {
      ev.stopPropagation();
      if (!confirm(`Rolle „${x.rolle}“ jetzt zurückgeben?`)) return;
      try { await Pim.deaktivieren(x.rolleId, x.scope); toast("Rolle zurückgegeben."); neuladen(); }
      catch (e) { toast("Zurückgeben fehlgeschlagen: " + pimFehlerText(e), 8000); }
    };
  });

  const dBox = el.querySelector("[data-dauerhaft]");
  if (dBox) dBox.innerHTML = tabelleHtml(dauerhaft, [
    { key: "rolle", label: "Rolle" },
    { key: "ende", label: "Bis", render: x => x.ende ? fmtDatum(x.ende) : "unbefristet" },
    { key: "hinweis", label: "", render: x => (anlage3Rolle(x.rolleId) || {}).p ? `<span class="warnung">laut Anlage 3 über PIM zu vergeben</span>` : "" }
  ]);

  const aBox = el.querySelector("[data-antraege]");
  if (aBox) {
    aBox.innerHTML = tabelleHtml(m.antraege, [
      { key: "rolle", label: "Rolle" },
      { key: "zeit", label: "Gestellt", render: x => fmtDatumZeit(x.zeit) },
      { key: "begruendung", label: "Begründung" },
      { key: "aktion", label: "", render: () => `<button class="btn-ghost-dark" data-zurueck>Zurückziehen</button>` }
    ]);
    aBox.querySelectorAll("[data-zurueck]").forEach((btn, i) => {
      btn.onclick = async ev => {
        ev.stopPropagation();
        try { await Pim.antragZurueckziehen(m.antraege[i].id); toast("Antrag zurückgezogen."); neuladen(); }
        catch (e) { toast("Fehlgeschlagen: " + pimFehlerText(e), 8000); }
      };
    });
  }

  const gBox = el.querySelector("[data-genehmigen]");
  try {
    const offen = await Pim.zuGenehmigen();
    gBox.innerHTML = tabelleHtml(offen, [
      { key: "wer", label: "Antragsteller" },
      { key: "rolle", label: "Rolle" },
      { key: "dauer", label: "Dauer", render: x => esc(dauerText(x.dauer)) },
      { key: "begruendung", label: "Begründung" },
      { key: "zeit", label: "Gestellt", render: x => fmtDatumZeit(x.zeit) },
      { key: "aktion", label: "", render: () => `<div class="btn-reihe-klein"><button class="btn-approve btn-small" data-ja>Genehmigen</button>
          <button class="btn-reject btn-small" data-nein>Ablehnen</button></div>` }
    ], { leer: "Keine Anträge warten auf Ihre Genehmigung." });
    gBox.querySelectorAll("[data-idx]").forEach(tr => {
      const x = offen[Number(tr.dataset.idx)];
      tr.querySelector("[data-ja]").onclick = ev => { ev.stopPropagation(); oeffneEntscheidung(x, "Approve", neuladen); };
      tr.querySelector("[data-nein]").onclick = ev => { ev.stopPropagation(); oeffneEntscheidung(x, "Deny", neuladen); };
    });
  } catch (e) {
    gBox.innerHTML = `<p class="muted">Offene Genehmigungen nicht lesbar (${esc(pimFehlerText(e))}).</p>`;
  }
}

function oeffneAktivierung(rolle, neuladen) {
  const std = pimKonfig().standard;
  const max = std.kritisch.includes(rolle.rolleId) ? std.dauerKritisch : std.dauer;
  const stufen = [...new Set([1, 2, 4, 8, max].filter(h => h <= max))].sort((a, b) => a - b);
  Dialog.zeige({
    titel: `Rolle aktivieren: ${rolle.rolle}`,
    html: `<div class="form-grid">
        <label class="span2">Zweck (Anlage 3 § 8) *<select id="akZweck">${CC_PIM_ZWECKE.map(z => `<option>${esc(z)}</option>`).join("")}</select></label>
        <label class="span2">Begründung *<input type="text" id="akText" maxlength="400" placeholder="Was ist zu tun? z. B. Postfachberechtigung für Ticket 4711 setzen"></label>
        <label>Dauer<select id="akDauer">${stufen.map(h => `<option value="${h}"${h === Math.min(max, 2) ? " selected" : ""}>${h} Stunde${h === 1 ? "" : "n"}</option>`).join("")}</select></label>
        <label>Ticketnummer${std.ticket ? " *" : ""}<input type="text" id="akTicket" maxlength="60"></label>
      </div>
      <p class="hint">Die Rolle endet automatisch nach Ablauf. Geben Sie sie früher zurück, wenn die Aufgabe erledigt ist.
        Verlangt die Rolle eine Genehmigung, wird zunächst ein Antrag gestellt.</p>`,
    aktionen: [{ label: "Aktivieren", klasse: "btn-primary", onClick: async modal => {
      const text = modal.querySelector("#akText").value.trim();
      const ticket = modal.querySelector("#akTicket").value.trim();
      if (text.length < 10) { toast("Bitte die Aufgabe kurz beschreiben (mindestens 10 Zeichen)."); return; }
      if (std.ticket && !ticket) { toast("Bitte die Ticketnummer angeben."); return; }
      modal.querySelectorAll("#modalActions button").forEach(x => { x.disabled = true; });
      try {
        const r = await Pim.aktivieren({ rolleId: rolle.rolleId, scope: rolle.scope, zweck: modal.querySelector("#akZweck").value,
          text, stunden: Number(modal.querySelector("#akDauer").value), ticket });
        Dialog.schliesse();
        toast(r && /Pending/i.test(r.status || "") ? "Antrag gestellt. Er wartet auf Genehmigung." : "Rolle aktiviert. Die Rechte greifen in der Regel nach wenigen Minuten.", 7000);
        neuladen();
      } catch (e) {
        modal.querySelectorAll("#modalActions button").forEach(x => { x.disabled = false; });
        const box = modal.querySelector("#akFehler") || modal.querySelector("#modalBody").appendChild(Object.assign(document.createElement("div"), { id: "akFehler" }));
        box.innerHTML = hinweisBox(`<strong>Nicht aktiviert:</strong> ${esc(pimFehlerText(e))}
          <a href="${esc(CC_PIM_PORTAL.meine)}" target="_blank" rel="noopener">Im Entra-Portal aktivieren ↗</a>`, "fehler");
      }
    } }]
  });
}

function oeffneEntscheidung(antrag, ergebnis, neuladen) {
  const ja = ergebnis === "Approve";
  Dialog.zeige({
    titel: `${ja ? "Genehmigen" : "Ablehnen"}: ${antrag.rolle} für ${antrag.wer}`,
    html: `<p class="hint">Begründung des Antrags: ${esc(antrag.begruendung || "keine")}</p>
      <label>Ihre Begründung *<input type="text" id="enText" maxlength="400"></label>`,
    aktionen: [{ label: ja ? "Genehmigen" : "Ablehnen", klasse: ja ? "btn-approve" : "btn-reject", onClick: async modal => {
      const text = modal.querySelector("#enText").value.trim();
      if (!text) { toast("Bitte eine Begründung angeben."); return; }
      try {
        await Pim.entscheide(antrag, ergebnis, text);
        Dialog.schliesse();
        toast(ja ? "Genehmigt." : "Abgelehnt.");
        neuladen();
      } catch (e) {
        toast(`Nicht möglich: ${pimFehlerText(e)}. Bitte im Entra-Portal entscheiden.`, 9000);
        window.open(CC_PIM_PORTAL.genehmigen, "_blank", "noopener");
      }
    } }]
  });
}

// ===========================================================================
// Quartalsübersicht für den Konzernbetriebsrat (Anlage 3 § 9)
// ===========================================================================

// Allgemeine Bezeichnung je Feststellungsart, ohne Namen und Sicherheitsdetails.
const CC_KBR_ABWEICHUNG = {
  fremd: "Nicht in der Anlage zugelassene Rolle personenbezogen zugewiesen",
  max: "Höchstzahl gleichzeitig aktiver Rolleninhaber überschritten",
  tech: "Rolle für technische Identitäten an Personen vergeben",
  dauerhaft: "Dauerhafte Zuweisung einer PIM-Rolle ohne Ausnahme",
  notfall: "Abweichung bei den Notfallzugriffskonten",
  extern: "Unbefristeter Zugriff externer Dienstleister",
  adminkonto: "Kein getrenntes Administratorkonto",
  lizenz: "PIM-Nutzung ohne passende Lizenz",
  register: "Rollenregister unvollständig",
  pruefung: "Keine Überprüfung in den letzten zwölf Monaten",
  entfallen: "Entzug nicht dokumentiert",
  regeln: "Aktivierungsregeln weichen vom Hausstandard ab",
  accessreview: "Keine automatische Zugriffsüberprüfung",
  app: "Technische Identitäten nicht vollständig dokumentiert oder gepflegt"
};

function quartale(anzahl = 6) {
  const out = [];
  const d = new Date();
  let j = d.getFullYear(), q = Math.floor(d.getMonth() / 3);
  for (let i = 0; i < anzahl; i++) {
    const von = new Date(Date.UTC(j, q * 3, 1)), bis = new Date(Date.UTC(j, q * 3 + 3, 1));
    out.push({ key: `${j}-Q${q + 1}`, label: `${q + 1}. Quartal ${j}`, von: von.toISOString(), bis: bis.toISOString(), laufend: i === 0 });
    q--; if (q < 0) { q = 3; j--; }
  }
  return out;
}

async function kbrBericht(box, quartalKey) {
  const liste = quartale();
  const qu = liste.find(q => q.key === quartalKey) || liste[1];
  box.innerHTML = ladeBox("Aktivierungen werden gesichert und ausgewertet …");
  if (darfRollenVerwalten()) await Pim.sichereAktivierungen().catch(() => {});
  Store.invalidate("aktivierungen");
  const akt = await Store.loadOderLeer("aktivierungen");
  const listeFehlt = Store.fehlendeListen.has(CC_LISTS.aktivierungen);
  let stand = null;
  try { stand = (await pimStand({ mitExtras: false })).bewertung; } catch (e) { /* Abschnitt 3 und 4 entfallen */ }

  const imQuartal = akt.filter(a => a.Zeit >= qu.von && a.Zeit < qu.bis);
  const erfolgt = imQuartal.filter(a => !/Denied|Canceled|Failed|Pending/i.test(a.Status || ""));
  const abgelehnt = imQuartal.filter(a => /Denied/i.test(a.Status || "")).length;
  const aelteste = akt.reduce((m, a) => (!m || a.Zeit < m ? a.Zeit : m), "");
  const zaehle = (liste, f) => {
    const out = {};
    liste.forEach(x => { const k = f(x); out[k] = (out[k] || 0) + 1; });
    return Object.entries(out).sort((a, b) => b[1] - a[1]);
  };
  const auditIds = new Set(CC_ANLAGE3_ROLLEN.filter(r => r.audit).map(r => r.id));
  const auditAkt = erfolgt.filter(a => auditIds.has(a.RolleId));
  const nachZweck = zaehle(erfolgt, a => a.Zweck || CC_ZWECK_OHNE).map(([zweck, anzahl]) => ({ zweck, anzahl }));
  // Je Rollen-ID zählen; der Cron speichert die englischen Namen aus Entra ID.
  const nachRolle = {};
  erfolgt.forEach(a => {
    const id = a.RolleId || a.Rolle;
    const e = nachRolle[id] = nachRolle[id] || { rolle: (anlage3Rolle(id) || {}).name || a.Rolle, aktivierungen: 0, personen: new Set(), berechtigt: "", dauerhaft: "" };
    e.aktivierungen++;
    e.personen.add(String(a.Konto).toLowerCase());
  });
  if (stand) stand.rollen.filter(r => r.belegt).forEach(r => {
    const e = nachRolle[r.id] = nachRolle[r.id] || { rolle: r.name, aktivierungen: 0, personen: new Set() };
    e.berechtigt = r.berechtigt;
    e.dauerhaft = r.dauerhaft;
    e.technisch = r.technisch + r.notfall;
  });
  const rollenZeilen = Object.values(nachRolle).map(e => ({ ...e, personen: e.personen.size }))
    .sort((a, b) => b.aktivierungen - a.aktivierungen || a.rolle.localeCompare(b.rolle));
  // Je Art die Zahl der betroffenen Fälle (zusammengefasste Feststellungen tragen sie in „anzahl“).
  const abwNach = {};
  if (stand) stand.feststellungen.filter(f => f.schwere !== "niedrig").forEach(f => {
    const art = f.id.split(":")[0];
    abwNach[art] = (abwNach[art] || 0) + (f.anzahl || 1);
  });
  const abweichungen = Object.entries(abwNach).sort((a, b) => b[1] - a[1])
    .map(([art, anzahl]) => ({ art: CC_KBR_ABWEICHUNG[art] || art, anzahl }));

  box.innerHTML = `
    <div class="bericht">
      <div class="card-head no-print">
        <span></span>
        <select id="kbrQuartal">${liste.map(q => `<option value="${q.key}"${q.key === qu.key ? " selected" : ""}>${esc(q.label)}${q.laufend ? " (laufend)" : ""}</option>`).join("")}</select>
      </div>
      <h2>Übersicht nach Anlage 3 § 9 für den Konzernbetriebsrat</h2>
      <p class="muted">${esc(qu.label)}${qu.laufend ? " (bis heute)" : ""} · ${esc((Store.konfig && Store.konfig.organisation) || "")} · erstellt am ${new Date().toLocaleDateString("de-DE")}</p>
      ${listeFehlt ? hinweisBox(`Die Liste ${esc(CC_LISTS.aktivierungen)} fehlt noch. Ohne sie gibt es keine Aktivierungszahlen.`, "warn") : ""}
      ${aelteste && aelteste > qu.von ? hinweisBox(`Aktivierungen liegen erst ab dem ${fmtDatum(aelteste)} vor. Für den Zeitraum davor ist die Übersicht unvollständig.`, "info") : ""}

      <h3>1. Zugriffe auf Audit- und Protokolldaten</h3>
      <div class="stat-row">
        ${kachel("Aktivierungen insgesamt", erfolgt.length, abgelehnt ? `${abgelehnt} Anträge abgelehnt` : "über PIM")}
        ${kachel("davon Rollen mit Zugriff auf Audit-/Protokolldaten", auditAkt.length, "Globaler Leser, Sicherheits-, Compliance-, Berichtsrollen")}
        ${kachel("Personen mit Aktivierungen", new Set(erfolgt.map(a => String(a.Konto).toLowerCase())).size, "Anzahl, ohne Namen")}
      </div>
      <p class="hint">Gezählt werden Aktivierungen über PIM. Dauerhaft zugewiesene Leserollen (z. B. Berichtleseberechtigter)
        werden nicht je Zugriff protokolliert; sie stehen in Abschnitt 3.</p>

      <h3>2. Zweckkategorien (Anlage 3 § 8)</h3>
      ${tabelleHtml(nachZweck, [{ key: "zweck", label: "Zweck" }, { key: "anzahl", label: "Aktivierungen" }], { leer: "Keine Aktivierungen im Zeitraum." })}

      <h3>3. Verwendete administrative Rollen</h3>
      ${tabelleHtml(rollenZeilen, [
        { key: "rolle", label: "Rolle" }, { key: "aktivierungen", label: "Aktivierungen" }, { key: "personen", label: "Personen (Anzahl)" },
        { key: "berechtigt", label: "derzeit berechtigt" }, { key: "dauerhaft", label: "derzeit dauerhaft (Personen)" },
        { key: "technisch", label: "technisch / Notfall" }
      ], { leer: "Keine Angaben." })}

      <h3>4. Wesentliche Abweichungen vom Rollen- und Berechtigungskonzept</h3>
      ${stand ? tabelleHtml(abweichungen, [{ key: "art", label: "Art der Abweichung" }, { key: "anzahl", label: "Anzahl" }],
        { leer: "Keine wesentlichen Abweichungen festgestellt." }) : `<p class="muted">Der aktuelle Stand ist nicht lesbar.</p>`}
      <p class="muted">Stand der Abweichungen: Tag der Erstellung. Die Übersicht ist zusammengefasst und enthält keine Namen von
        Administratoren, keine Suchinhalte, keine Sicherheitsdetails und keine Angaben zu laufenden Untersuchungen (§ 9 Satz 2).</p>
      <div class="btn-reihe no-print">
        <button class="btn-csv" id="btnKbrCsv">CSV</button>
      </div>
    </div>`;
  document.getElementById("kbrQuartal").onchange = ev => kbrBericht(box, ev.target.value);
  document.getElementById("btnKbrCsv").onclick = () => csvExport(`KBR_Anlage3_${qu.key}.csv`, [
    ...[{ teil: "1", was: "Aktivierungen insgesamt", wert: erfolgt.length }, { teil: "1", was: "davon Audit-/Protokolldaten", wert: auditAkt.length }],
    ...nachZweck.map(z => ({ teil: "2", was: z.zweck, wert: z.anzahl })),
    ...rollenZeilen.map(r => ({ teil: "3", was: r.rolle, wert: r.aktivierungen })),
    ...abweichungen.map(a => ({ teil: "4", was: a.art, wert: a.anzahl }))
  ], [{ key: "teil", label: "Abschnitt" }, { key: "was", label: "Angabe" }, { key: "wert", label: "Anzahl" }]);
}

// ===========================================================================
// Arbeitsvorrat: jährliche Überprüfung und Notfalltest
// ===========================================================================

function pimArbeitsvorrat(register) {
  if (!darfRollenVerwalten()) return [];
  const k = pimKonfig();
  const out = [];
  const nachDatum = {};
  (register || []).filter(r => !r.Entzogen && r.LetztePruefung).forEach(r => {
    const f = addiereMonate(r.LetztePruefung, 12);
    (nachDatum[f] = nachDatum[f] || []).push(r);
  });
  Object.entries(nachDatum).forEach(([datum, liste]) => out.push({
    entity: "rollenregister", id: liste.length === 1 ? liste[0].id : "", datum, art: "Überprüfung (Anlage 3)",
    was: liste.length === 1 ? `${liste[0].Rolle} · ${liste[0].Konto}` : `${liste.length} Zuweisungen und Identitäten überprüfen`,
    wer: k.verantwortlich,
    aktion: liste.every(x => String(x.Title).startsWith("app:")) ? () => zeigeRollenTab("technisch") : () => zeigeRollenTab("register")
  }));
  if (k.notfallkonten.length) out.push({
    entity: "", id: "", datum: k.notfallGeprueft ? addiereTage(k.notfallGeprueft, k.notfallIntervall) : new Date().toISOString().slice(0, 10),
    art: "Notfallkonten-Test", was: `${k.notfallkonten.length} Notfallzugriffskonten auf Funktion prüfen`,
    wer: k.verantwortlich, aktion: oeffneNotfalltest
  });
  return out;
}

// ===========================================================================
// Technische Identitäten (§ 6)
// ===========================================================================

function appGeheimnisText(z) {
  if (!z.geheimnisse.length) return `<span class="muted">${z.typ === "eigene App" ? "keine" : z.typ === "verwaltete Identität" ? "verwaltet Azure" : "beim Hersteller"}</span>`;
  const teile = [];
  if (z.naechsterAblauf) {
    const t = Math.ceil((new Date(z.naechsterAblauf) - new Date()) / 86400000);
    teile.push(`<span class="${z.laeuftAb ? "ueberfaellig" : ""}">gültig bis ${esc(fmtDatum(z.naechsterAblauf))}</span>${t <= 60 ? ` <span class="muted">(${t} T.)</span>` : ""}`);
  }
  if (z.langeLaufzeit.length) teile.push(`<span class="status st-yellow">Laufzeit über 2 Jahre</span>`);
  if (z.abgelaufen.length) teile.push(`<span class="muted">${z.abgelaufen.length} abgelaufen</span>`);
  return teile.join("<br>") || `<span class="muted">alle abgelaufen</span>`;
}

function appVorlage(z) {
  return {
    Title: "app:" + z.appId, Konto: z.name, Kontoart: "Technisch",
    Rolle: z.rollen.length ? "Anwendungsberechtigungen und Verzeichnisrollen" : "Anwendungsberechtigungen",
    RolleId: z.appId, Zuweisung: "dauerhaft", Eigentuemer: z.eigentuemer[0] || "", Quelle: "Entra ID"
  };
}

// Registereintrag zu einer technischen Identität, mit allen Rechten im Kopf.
function oeffneAppEintrag(z, neuladen) {
  const heute = new Date().toISOString().slice(0, 10);
  const v = appVorlage(z);
  const werte = z.register ? { ...z.register, Konto: v.Konto, Rolle: v.Rolle, RolleId: v.RolleId, Zuweisung: v.Zuweisung, Quelle: v.Quelle }
    : { ...v, LetztePruefung: heute, GeprueftVon: Store.benutzer.email };
  const nachApi = {};
  z.rechte.forEach(r => { (nachApi[r.api] = nachApi[r.api] || []).push(r); });
  const kopf = `<table class="detail-table">
      <tr><td class="dt">Art</td><td>${esc(z.typ)}${z.aktiviert === false ? ` <span class="status st-gray">deaktiviert</span>` : ""} · App-ID <code>${esc(z.appId)}</code>
        · <a href="${esc(z.portal)}" target="_blank" rel="noopener">im Entra-Portal ↗</a></td></tr>
      ${Object.entries(nachApi).map(([api, liste]) => `<tr><td class="dt">${esc(api)}</td><td>${liste.sort((a, b) => (b.kritisch - a.kritisch) || a.wert.localeCompare(b.wert))
        .map(r => `<span class="chip${r.kritisch ? " chip-kritisch" : ""}" title="${esc(r.beschreibung)}">${esc(r.wert)}</span>`).join(" ")}</td></tr>`).join("")}
      ${z.rollen.length ? `<tr><td class="dt">Verzeichnisrollen</td><td>${z.rollen.map(esc).join(", ")}</td></tr>` : ""}
      <tr><td class="dt">Eigentümer in Entra ID</td><td>${z.eigentuemer.length ? z.eigentuemer.map(esc).join(", ") : `<span class="ueberfaellig">keine</span>`}</td></tr>
      <tr><td class="dt">Geheimnisse</td><td>${z.geheimnisse.length ? z.geheimnisse.slice().sort((a, b) => String(b.ende).localeCompare(String(a.ende))).map(g =>
        `${esc(g.art)}${g.name ? " „" + esc(g.name) + "“" : ""}: ${esc(fmtDatum(g.start))} bis <span class="${g.ende < new Date().toISOString() ? "muted" : ""}">${esc(fmtDatum(g.ende))}</span>`).join("<br>")
        : `<span class="muted">${z.typ === "eigene App" ? "keine hinterlegt" : z.typ === "verwaltete Identität" ? "verwaltet Azure" : "verwaltet der Hersteller"}</span>`}</td></tr>
      <tr><td class="dt">Letzte Anmeldung</td><td>${z.letzteAnmeldung === null ? `<span class="muted">nicht lesbar</span>` : z.letzteAnmeldung ? esc(fmtDatumZeit(z.letzteAnmeldung)) : `<span class="ueberfaellig">keine gefunden</span>`}</td></tr>
    </table>
    <p class="hint">§ 6: Rechte auf den Zweck beschränken, Eigentümer dokumentieren, Anmeldeinformationen schützen und
      regelmäßig erneuern, nicht mehr benötigte Identitäten unverzüglich entfernen.</p>`;
  if (!darfRollenVerwalten()) {
    Dialog.zeige({ titel: z.name, breit: true, html: kopf });
    return;
  }
  oeffneEditor("rollenregister", werte, neuladen, {
    titel: `Technische Identität: ${z.name}`, html: kopf,
    gesperrt: ["Konto", "Rolle", "RolleId", "Zuweisung", "ZugewiesenAm", "Befristung", "Quelle"]
  });
}

async function renderTechnischeIdentitaeten(el) {
  el.innerHTML = ladeBox("Anwendungen, Rechte und Anmeldungen werden gelesen …");
  const neuladen = () => { Store.invalidate("rollenregister"); renderTechnischeIdentitaeten(el); };
  let apps;
  try { apps = await Pim.technischeIdentitaeten({ mitAnmeldung: true }); }
  catch (e) { el.innerHTML = fehlerBox(e, "Technische Identitäten"); return; }
  const register = await Store.loadOderLeer("rollenregister");
  const t = bewerteTechnisch(apps, register);
  const kz = t.kennzahlen;
  const gemerkt = filterLesen("technisch");

  el.innerHTML = `
    <p class="hint">Anwendungen, Dienstprinzipale und verwaltete Identitäten mit Anwendungsberechtigungen auf Microsoft-Dienste
      oder mit Verzeichnisrollen. Nach § 6 der Anlage gehören zu jeder ein Zweck und ein Eigentümer; Geheimnisse sind
      regelmäßig zu erneuern, nicht mehr benötigte Identitäten zu entfernen. Microsoft-eigene Dienste werden gezeigt,
      aber nicht bewertet.</p>
    <div class="stat-row">
      ${kachel("Technische Identitäten", kz.gesamt, `${kz.kritisch} mit weitreichenden Rechten`)}
      ${kachel("Ohne Eigentümer", kz.ohneEigentuemer, "in Entra ID und Register")}
      ${kachel("Geheimnis läuft ab", kz.laeuftAb, "in den nächsten 30 Tagen")}
      ${kachel("Ohne Anmeldung", kz.anmeldungBekannt ? kz.inaktiv : "–", kz.anmeldungBekannt ? "seit 90 Tagen" : "nicht lesbar")}
      ${kachel("Im Register", `${kz.dokumentiert}/${kz.gesamt}`, "Zweck und Eigentümer")}
    </div>
    ${t.feststellungen.length ? `<div class="banner banner-yellow"><strong>Feststellungen</strong><ul>${t.feststellungen.map(f =>
      `<li>${esc(f.titel)} <span class="muted">(${esc(f.paragraf)})</span></li>`).join("")}</ul></div>` : ""}
    <div class="filter-bar">
      <input type="search" data-q placeholder="Anwendung oder Recht …" value="${esc(gemerkt.q || "")}">
      <select data-typ><option value="">Art: alle</option>${["eigene App", "Fremd-App", "verwaltete Identität", "Microsoft-Dienst"]
        .map(x => `<option${gemerkt.typ === x ? " selected" : ""}>${x}</option>`).join("")}</select>
      <label class="checkline"><input type="checkbox" data-bedarf${gemerkt.bedarf ? " checked" : ""}> nur mit Handlungsbedarf</label>
      <label class="checkline"><input type="checkbox" data-ms${gemerkt.ms ? " checked" : ""}> Microsoft-Dienste zeigen</label>
      <button class="btn-csv" data-csv>CSV</button>
    </div>
    <div data-tabelle></div>
    <p class="muted" data-anzahl></p>`;

  let sichtbar = [];
  const zeige = () => {
    const q = el.querySelector("[data-q]").value.trim().toLowerCase();
    const typ = el.querySelector("[data-typ]").value;
    const bedarf = el.querySelector("[data-bedarf]").checked;
    const ms = el.querySelector("[data-ms]").checked;
    filterSchreiben("technisch", { q: el.querySelector("[data-q]").value, typ, bedarf, ms });
    sichtbar = t.zeilen.filter(z => (ms || z.typ !== "Microsoft-Dienst" || typ === "Microsoft-Dienst") && (!typ || z.typ === typ) &&
      (!q || `${z.name} ${z.appId} ${z.rechte.map(r => r.wert).join(" ")} ${z.rollen.join(" ")} ${z.eigentuemerAlle.join(" ")}`.toLowerCase().includes(q)) &&
      (!bedarf || z.ohneEigentuemer || z.laeuftAb || z.inaktiv || z.langeLaufzeit.length || (z.bewertet && !z.dokumentiert)));
    const box = el.querySelector("[data-tabelle]");
    box.innerHTML = tabelleHtml(sichtbar, [
      { key: "name", label: "Anwendung", render: z => `<strong>${esc(z.name)}</strong><br><span class="muted">${esc(z.typ)} · ${esc(String(z.appId || "").slice(0, 8))}${z.aktiviert === false ? ", deaktiviert" : ""}</span>` },
      { key: "rechte", label: "Rechte", render: z => {
          const k = z.rechte.filter(r => r.kritisch);
          return `${z.rechte.length}${k.length ? ` <span class="muted">davon ${k.length} weitreichend</span><br>` + k.slice(0, 3).map(r => `<span class="chip chip-kritisch">${esc(r.wert)}</span>`).join(" ") + (k.length > 3 ? ` <span class="muted">+${k.length - 3}</span>` : "") : ""}` +
            (z.rollen.length ? `<br><span class="muted">Rollen: ${esc(z.rollen.join(", "))}</span>` : "");
        } },
      { key: "eigentuemer", label: "Eigentümer", render: z => z.eigentuemerAlle.length ? esc(z.eigentuemerAlle.join(", ")) : z.bewertet ? `<span class="ueberfaellig">keiner</span>` : `<span class="muted">Microsoft</span>` },
      { key: "geheim", label: "Geheimnisse", render: appGeheimnisText },
      { key: "anmeldung", label: "Letzte Anmeldung", render: z => z.letzteAnmeldung === null ? `<span class="muted">–</span>`
          : z.letzteAnmeldung ? `<span class="${z.inaktiv ? "ueberfaellig" : ""}">${esc(fmtDatum(z.letzteAnmeldung))}</span>` : `<span class="ueberfaellig">keine</span>` },
      { key: "register", label: "Register", render: z => !z.bewertet ? "" : z.dokumentiert
          ? `<span class="status ${z.pruefungFaellig ? "st-yellow" : "st-green"}">${z.pruefungFaellig ? "Prüfung fällig" : "vollständig"}</span>`
          : `<span class="status st-red">unvollständig</span>` }
    ], { leer: "Keine technischen Identitäten für diese Auswahl." });
    el.querySelector("[data-anzahl]").textContent = `${sichtbar.length} von ${t.zeilen.length} Identitäten`;
    box.querySelectorAll("[data-idx]").forEach(tr => { tr.onclick = () => oeffneAppEintrag(sichtbar[Number(tr.dataset.idx)], neuladen); });
  };
  el.querySelector("[data-q]").oninput = zeige;
  el.querySelectorAll("[data-typ], [data-bedarf], [data-ms]").forEach(x => { x.onchange = zeige; });
  el.querySelector("[data-csv]").onclick = () => csvExport(`Technische_Identitaeten_${new Date().toISOString().slice(0, 10)}.csv`, sichtbar, [
    { key: "name", label: "Anwendung" }, { key: "typ", label: "Art" }, { key: "appId", label: "App-ID" },
    { label: "Anwendungsberechtigungen", csv: z => z.rechte.map(r => `${r.api}: ${r.wert}`).join(", ") },
    { label: "Verzeichnisrollen", csv: z => z.rollen.join(", ") },
    { label: "Eigentümer", csv: z => z.eigentuemerAlle.join(", ") },
    { label: "Nächster Ablauf", csv: z => String(z.naechsterAblauf).slice(0, 10) },
    { label: "Letzte Anmeldung", csv: z => z.letzteAnmeldung === null ? "" : String(z.letzteAnmeldung).slice(0, 10) },
    { label: "Zweck", csv: z => z.register ? z.register.Zweck || "" : "" },
    { label: "Genehmigt von", csv: z => z.register ? z.register.GenehmigtVon || "" : "" },
    { label: "Letzte Überprüfung", csv: z => z.register ? z.register.LetztePruefung || "" : "" }
  ]);
  zeige();
}

// Ablaufende Geheimnisse für den Arbeitsvorrat (nur für die zentrale IT).
async function pimArbeitsvorratApps() {
  if (!darfRollenVerwalten()) return [];
  let apps;
  try { apps = await Pim.technischeIdentitaeten(); } catch (e) { return []; }
  const jetzt = new Date().toISOString();
  const k = pimKonfig();
  return apps.filter(a => a.typ !== "Microsoft-Dienst").flatMap(a => a.geheimnisse
    .filter(g => g.ende && g.ende >= jetzt)
    .map(g => ({ entity: "", id: "", datum: g.ende.slice(0, 10), art: "Geheimnis läuft ab", dringend: true,
      was: `${a.name}: ${g.art}${g.name ? " „" + g.name + "“" : ""}`, wer: k.verantwortlich,
      aktion: () => zeigeRollenTab("technisch") })));
}
