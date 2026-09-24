"use strict";

// Register für Betroffenenanfragen (Art. 15–21 DSGVO). Ersetzt Microsoft Priva,
// das im Mandanten nicht bereitgestellt ist: Fristüberwachung nach Art. 12 Abs. 3,
// Identitätsprüfung, Suchumfang aus dem VVT, eDiscovery-Fall für die Datensuche
// und Antwortentwürfe.

// Schlagworte, mit denen eine Personengruppe im VVT-Feld „Betroffenengruppen“ gefunden wird.
const CC_GRUPPEN_SCHLAGWORTE = {
  "Beschäftigte": ["beschäftig", "mitarbeit", "personal", "arbeitnehm"],
  "Ehemalige Beschäftigte": ["beschäftig", "mitarbeit", "personal", "ehemalig", "arbeitnehm"],
  "Bewerber": ["bewerb"],
  "Kunden": ["kunde", "ansprechpartner"],
  "Lieferanten": ["lieferant", "dienstleister", "ansprechpartner"],
  "Besucher": ["besuch", "gäste", "gast"]
};

function neueVorgangsnummer() {
  const d = new Date();
  const zwei = n => String(n).padStart(2, "0");
  return `BA-${d.getFullYear()}-${zwei(d.getMonth() + 1)}${zwei(d.getDate())}-${zwei(d.getHours())}${zwei(d.getMinutes())}`;
}

function anfrageVorlage() {
  return berechneAnfrage({
    Title: neueVorgangsnummer(),
    Eingang: new Date().toISOString().slice(0, 10),
    Status: "Eingegangen",
    Identitaet: "Offen",
    Verlaengert: "Nein",
    Ergebnis: "Offen",
    Verantwortlich: (Store.benutzer && Store.benutzer.email) || ""
  });
}

// Fristtreue: Anteil der beantworteten Anfragen, die bis zur Frist beantwortet wurden.
function fristtreue(anfragen) {
  const erledigt = anfragen.filter(a => a.Beantwortet && a.Frist);
  if (!erledigt.length) return null;
  const rechtzeitig = erledigt.filter(a => a.Beantwortet <= a.Frist).length;
  return { prozent: Math.round(rechtzeitig / erledigt.length * 100), rechtzeitig, gesamt: erledigt.length };
}

// Verarbeitungstätigkeiten, die für die Personengruppe der Anfrage relevant sind.
function vvtFuerGruppe(vvt, gruppe) {
  const worte = CC_GRUPPEN_SCHLAGWORTE[gruppe];
  if (!worte) return vvt;
  const treffer = vvt.filter(v => worte.some(w => String(v.Betroffenengruppen || "").toLowerCase().includes(w)));
  return treffer.length ? treffer : vvt;
}

// ===========================================================================
// Liste
// ===========================================================================

async function renderAnfragen(el) {
  el.innerHTML = `<div id="anfrageFristen"></div><div class="stat-row" id="anfrageKacheln"></div><div id="anfrageListe"></div>`;
  let anfragen;
  try { anfragen = await Store.load("anfragen"); }
  catch (e) {
    // Liste fehlt noch: renderEntity zeigt den Hinweis zum Anlegen.
    renderEntity(document.getElementById("anfrageListe"), "anfragen", { vorlage: anfrageVorlage });
    return;
  }

  const offen = anfragen.filter(anfrageOffen);
  const knapp = offen.filter(a => a.Frist && tageBis(a.Frist) <= 7);
  const quote = fristtreue(anfragen);
  document.getElementById("anfrageKacheln").innerHTML =
    kachel("Offen", offen.length) +
    kachel("Frist ≤ 7 Tage", knapp.filter(a => tageBis(a.Frist) >= 0).length) +
    kachel("Überfällig", offen.filter(a => a.Frist && tageBis(a.Frist) < 0).length) +
    kachel("Identität offen", offen.filter(a => a.Identitaet !== "Geprüft").length) +
    kachel("Fristtreue", quote ? quote.prozent + " %" : "–", quote ? `${quote.rechtzeitig} von ${quote.gesamt} rechtzeitig` : "noch keine Antworten");

  if (knapp.length) {
    document.getElementById("anfrageFristen").innerHTML = hinweisBox(
      `<strong>Antwortfrist nach Art. 12 Abs. 3 DSGVO läuft ab:</strong><ul>${knapp.map(a => {
        const t = tageBis(a.Frist);
        return `<li>${esc(a.Title)} · ${esc(a.Art)} · ${esc(a.PersonName)}: Frist ${fmtDatum(a.Frist)},
          <strong>${t < 0 ? Math.abs(t) + " Tage überfällig" : t === 0 ? "heute" : "noch " + t + " Tage"}</strong></li>`;
      }).join("")}</ul>`, knapp.some(a => tageBis(a.Frist) < 0) ? "fehler" : "warn");
  }

  renderEntity(document.getElementById("anfrageListe"), "anfragen", {
    filter: ["Status", "Art", "Identitaet"],
    vorlage: anfrageVorlage,
    onOeffnen: a => zeigeAnfrage(a, () => renderAnfragen(el))
  });
}

// ===========================================================================
// Detail
// ===========================================================================

async function zeigeAnfrage(a, neuladen) {
  const offen = anfrageOffen(a);
  const rest = a.Frist ? tageBis(a.Frist) : null;
  const fristBanner = !a.Frist ? "" : offen
    ? hinweisBox(`<strong>Antwortfrist:</strong> ${fmtDatum(a.Frist)} ·
        ${rest < 0 ? `<strong>${Math.abs(rest)} Tage überfällig</strong>` : rest === 0 ? "<strong>heute</strong>" : `noch ${rest} Tage`}
        ${a.Verlaengert === "Ja" ? " (verlängert nach Art. 12 Abs. 3 S. 2)" : ""}`,
        rest < 0 ? "fehler" : rest <= 7 ? "warn" : "info")
    : hinweisBox(`Beantwortet am ${fmtDatum(a.Beantwortet) || "–"} · Frist war ${fmtDatum(a.Frist)} ·
        ${a.Beantwortet && a.Beantwortet <= a.Frist ? "fristgerecht" : "<strong>nach Fristablauf</strong>"}`,
        a.Beantwortet && a.Beantwortet <= a.Frist ? "info" : "warn");

  const aktionen = [
    { label: "Bearbeiten", klasse: "btn-primary", onClick: () => { Dialog.schliesse(); oeffneEditor("anfragen", a, neuladen); } },
    { label: "Antwortentwurf", klasse: "btn-secondary", onClick: () => zeigeAnfrageEntwurf(a) }
  ];
  if (CC_CONFIG.erlaubeSchreibaktionen && !a.EdiscoveryFall) {
    aktionen.push({ label: "eDiscovery-Fall anlegen", klasse: "btn-secondary", onClick: () => anfrageEdiscovery(a, neuladen) });
  }
  if (offen) {
    aktionen.push({ label: "Als beantwortet erfassen", klasse: "btn-approve", onClick: () => {
      Dialog.schliesse();
      oeffneEditor("anfragen", {
        ...a,
        Status: "Beantwortet",
        Beantwortet: a.Beantwortet || new Date().toISOString().slice(0, 10),
        Ergebnis: a.Ergebnis && a.Ergebnis !== "Offen" ? a.Ergebnis : ""
      }, neuladen);
      toast("Bitte Ergebnis wählen und speichern.");
    } });
  }
  aktionen.push({ label: "Aufgabe anlegen", klasse: "btn-secondary", onClick: () => {
    Dialog.schliesse();
    oeffneEditor("aufgaben", {
      Title: `${a.Title}: `, ControlId: "D.2.1", Status: "Offen", Prioritaet: "Hoch",
      Verantwortlich: a.Verantwortlich || "", Quelle: "Betroffenenanfrage " + a.Title,
      Faellig: a.Frist || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    }, () => toast("Aufgabe angelegt."));
  } });

  Dialog.zeige({
    titel: `${a.Title} · ${a.Art}`,
    breit: true,
    link: linkZuEintrag("anfragen", a.id),
    html: `
      ${fristBanner}
      <table class="detail-table">
        <tr><td class="dt">Betroffene Person</td><td>${esc(a.PersonName)}${a.PersonKontakt ? " · " + esc(a.PersonKontakt) : ""}</td></tr>
        <tr><td class="dt">Personengruppe</td><td>${esc(a.Personengruppe || "–")}</td></tr>
        <tr><td class="dt">Eingang</td><td>${fmtDatum(a.Eingang)} über ${esc(a.Kanal || "–")}</td></tr>
        <tr><td class="dt">Anliegen</td><td>${esc(a.Anliegen || "–")}</td></tr>
        <tr><td class="dt">Identität</td><td>${statusBadge(a.Identitaet || "Offen")} ${esc(a.IdentitaetNachweis || "")}</td></tr>
        <tr><td class="dt">Status</td><td>${statusBadge(a.Status)} · Ergebnis: ${statusBadge(a.Ergebnis || "Offen")}</td></tr>
        <tr><td class="dt">Durchsuchte Systeme</td><td>${esc(a.Systeme || "–")}</td></tr>
        <tr><td class="dt">eDiscovery-Fall</td><td>${esc(a.EdiscoveryFall || "–")}</td></tr>
        ${a.Begruendung ? `<tr><td class="dt">Begründung</td><td>${esc(a.Begruendung)}</td></tr>` : ""}
        <tr><td class="dt">Bearbeitet von</td><td>${esc(a.Verantwortlich || "–")}</td></tr>
      </table>
      ${a.Identitaet !== "Geprüft" && offen ? hinweisBox(`Die Identität ist noch nicht geprüft. Vor einer Auskunft
        muss feststehen, dass die Anfrage wirklich von der betroffenen Person stammt (Art. 12 Abs. 6 DSGVO).`, "warn") : ""}
      <div class="signal-box">
        <strong>Suchumfang aus dem Verzeichnis der Verarbeitungstätigkeiten</strong>
        <div id="anfrageSuchumfang">${ladeBox("VVT wird ausgewertet …")}</div>
      </div>
      ${nachweisHtml()}`,
    aktionen
  });

  nachweiseVerbinden("Anfrage-" + a.Title);

  // Suchumfang: welche Verarbeitungen und Systeme betreffen diese Personengruppe?
  try {
    const vvt = await Store.loadOderLeer("vvt");
    const relevant = vvtFuerGruppe(vvt, a.Personengruppe);
    const box = document.getElementById("anfrageSuchumfang");
    if (!box) return;
    if (!vvt.length) {
      box.innerHTML = `<p class="muted">Im VVT sind noch keine Verarbeitungstätigkeiten erfasst.</p>`;
      return;
    }
    const systeme = [...new Set(relevant.flatMap(v => String(v.Systeme || "").split(/[,;]/).map(s => s.trim()).filter(Boolean)))];
    box.innerHTML = `
      <p class="muted">${a.Personengruppe && CC_GRUPPEN_SCHLAGWORTE[a.Personengruppe]
        ? `${relevant.length} Verarbeitungstätigkeiten betreffen „${esc(a.Personengruppe)}“.`
        : "Keine Personengruppe gewählt, daher alle Verarbeitungstätigkeiten."}</p>
      <ul class="kompakt">${relevant.map(v => `<li><strong>${esc(v.Title)}</strong>
        <span class="muted">${esc(v.Systeme || "Systeme nicht erfasst")} · Löschfrist ${esc(v.Loeschfrist || "–")}</span></li>`).join("")}</ul>
      ${systeme.length ? `<p>Zu durchsuchende Systeme: <strong>${esc(systeme.join(", "))}</strong></p>
        <button class="btn-csv" id="btnSuchumfang">In „Durchsuchte Systeme“ übernehmen</button>` : ""}`;
    const btn = document.getElementById("btnSuchumfang");
    if (btn) btn.onclick = async () => {
      const text = relevant.map(v => `${v.Title}${v.Systeme ? " (" + v.Systeme + ")" : ""}`).join("; ");
      try {
        await Store.save("anfragen", a.id, { Systeme: a.Systeme ? a.Systeme + "; " + text : text });
        toast("Suchumfang übernommen.");
        Dialog.schliesse();
        neuladen();
      } catch (e) { toast("Speichern fehlgeschlagen: " + e.message, 6000); }
    };
  } catch (e) {
    const box = document.getElementById("anfrageSuchumfang");
    if (box) box.innerHTML = fehlerBox(e, "VVT");
  }
}

// Legt in Purview einen eDiscovery-Fall für die Datensuche an. Datenquellen
// (Postfach, OneDrive, Teams der Person), Suche und Export folgen im Portal.
async function anfrageEdiscovery(a, neuladen) {
  const name = `${a.Title} Betroffenenanfrage`;
  if (!confirm(`In Microsoft Purview den eDiscovery-Fall „${name}“ anlegen?`)) return;
  try {
    const fall = await Purview.createEdiscoveryCase({
      name,
      beschreibung: `${a.Art}. Eingang ${fmtDatum(a.Eingang)}, Antwortfrist ${fmtDatum(a.Frist)}. Angelegt aus dem Compliance-Cockpit.`
    });
    const kennung = fall && fall.id ? `${fall.displayName || name} (${fall.id})` : name;
    await Store.save("anfragen", a.id, { EdiscoveryFall: kennung });
    Dialog.schliesse();
    toast("eDiscovery-Fall angelegt. Datenquellen und Suche jetzt im Purview-Portal unter eDiscovery ergänzen.", 9000);
    neuladen();
  } catch (e) {
    toast("eDiscovery-Fall konnte nicht angelegt werden: " + e.message, 8000);
  }
}

// ===========================================================================
// Antwortentwürfe
// ===========================================================================

function anfrageEntwurf(a, typ, vvt) {
  const org = (Store.konfig && Store.konfig.organisation) || "";
  const dsb = (Store.konfig && Store.konfig.dsbEmail) || "";
  const anrede = a.PersonName ? `Guten Tag ${a.PersonName},` : "Sehr geehrte Damen und Herren,";
  const gruss = `Mit freundlichen Grüßen\n\n${org}\nDatenschutz${dsb ? "\n" + dsb : ""}`;
  const zeichen = `Unser Zeichen: ${a.Title}`;
  const rechte = `Ihnen stehen außerdem die Rechte auf Berichtigung (Art. 16), Löschung (Art. 17), ` +
    `Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) zu. ` +
    `Sie können sich zudem bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO).`;

  if (typ === "eingang") {
    return `${zeichen}\n\n${anrede}\n\nwir bestätigen den Eingang Ihrer Anfrage vom ${fmtDatum(a.Eingang)} ` +
      `(${a.Art}). Wir beantworten sie spätestens bis zum ${fmtDatum(a.Frist)}.\n\n` +
      (a.Identitaet !== "Geprüft"
        ? `Damit Ihre Daten nicht an Unbefugte gelangen, bitten wir Sie, Ihre Identität nachzuweisen, ` +
          `zum Beispiel durch eine Kopie Ihres Ausweises, auf der Sie alle Angaben außer Name, Anschrift ` +
          `und Geburtsdatum schwärzen. Bis zum Nachweis können wir Ihre Anfrage nicht abschließend bearbeiten.\n\n`
        : "") +
      gruss;
  }
  if (typ === "verlaengerung") {
    return `${zeichen}\n\n${anrede}\n\nwir bearbeiten Ihre Anfrage vom ${fmtDatum(a.Eingang)}. ` +
      `Wegen ${a.VerlaengerungGrund || "der Komplexität und Anzahl der Anträge"} verlängern wir die Frist ` +
      `nach Art. 12 Abs. 3 Satz 2 DSGVO um zwei Monate. Sie erhalten unsere Antwort spätestens bis zum ` +
      `${fmtDatum(addiereMonate(a.Eingang, 3))}.\n\n${gruss}`;
  }
  if (a.Ergebnis === "Abgelehnt (mit Begründung)") {
    return `${zeichen}\n\n${anrede}\n\nwir haben Ihre Anfrage vom ${fmtDatum(a.Eingang)} (${a.Art}) geprüft ` +
      `und können ihr nicht nachkommen.\n\nBegründung: ${a.Begruendung || "[Begründung ergänzen]"}\n\n` +
      `Gegen diese Entscheidung können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren ` +
      `(Art. 77 DSGVO) oder gerichtlich vorgehen (Art. 79 DSGVO).\n\n${gruss}`;
  }
  if (a.Ergebnis === "Keine Daten vorhanden") {
    return `${zeichen}\n\n${anrede}\n\nwir haben auf Ihre Anfrage vom ${fmtDatum(a.Eingang)} hin unsere Systeme ` +
      `geprüft${a.Systeme ? " (" + a.Systeme + ")" : ""}. Wir verarbeiten keine personenbezogenen Daten zu Ihrer Person.\n\n${gruss}`;
  }

  const art = String(a.Art || "");
  if (art.startsWith("Auskunft")) {
    const vvtText = vvt.length ? vvt.map(v =>
      `• ${v.Title}\n  Zweck: ${v.Zweck || "–"}\n  Rechtsgrundlage: ${v.Rechtsgrundlage || "–"}\n` +
      `  Datenkategorien: ${v.Datenkategorien || "–"}\n  Empfänger: ${v.Empfaenger || "–"}\n` +
      `  Speicherdauer: ${v.Loeschfrist || "–"}` +
      (v.Drittland ? `\n  Drittland: ${v.Drittland}${v.Garantien ? " (" + v.Garantien + ")" : ""}` : "")
    ).join("\n\n") : "[Verarbeitungen ergänzen]";
    return `${zeichen}\n\n${anrede}\n\nauf Ihre Anfrage vom ${fmtDatum(a.Eingang)} erteilen wir Ihnen nach ` +
      `Art. 15 DSGVO Auskunft. Wir verarbeiten personenbezogene Daten zu Ihrer Person in folgenden Zusammenhängen:\n\n` +
      `${vvtText}\n\nEine Kopie der Daten, die Gegenstand der Verarbeitung sind (Art. 15 Abs. 3 DSGVO), ` +
      `finden Sie in der Anlage. Die Daten stammen, soweit nicht anders angegeben, von Ihnen selbst. ` +
      `Eine automatisierte Entscheidungsfindung einschließlich Profiling findet nicht statt.\n\n${rechte}\n\n${gruss}`;
  }
  if (art.startsWith("Löschung")) {
    return `${zeichen}\n\n${anrede}\n\nIhrer Anfrage vom ${fmtDatum(a.Eingang)} auf Löschung nach Art. 17 DSGVO ` +
      `sind wir nachgekommen. Gelöscht haben wir Ihre Daten in: ${a.Systeme || "[Systeme ergänzen]"}.\n\n` +
      `Ausgenommen sind Daten, die wir wegen gesetzlicher Aufbewahrungspflichten (zum Beispiel § 257 HGB, ` +
      `§ 147 AO) weiter speichern müssen. Diese Daten sind für jede andere Verwendung gesperrt ` +
      `(Art. 17 Abs. 3 lit. b, Art. 18 DSGVO) und werden nach Ablauf der Frist gelöscht.\n\n${gruss}`;
  }
  if (art.startsWith("Berichtigung")) {
    return `${zeichen}\n\n${anrede}\n\nwir haben Ihre Daten wie gewünscht berichtigt (Art. 16 DSGVO). ` +
      `Empfänger, denen wir die Daten offengelegt haben, informieren wir über die Berichtigung (Art. 19 DSGVO).\n\n${gruss}`;
  }
  if (art.startsWith("Widerspruch") || art.startsWith("Widerruf")) {
    return `${zeichen}\n\n${anrede}\n\nwir haben Ihren ${art.startsWith("Widerruf") ? "Widerruf Ihrer Einwilligung" : "Widerspruch"} ` +
      `vom ${fmtDatum(a.Eingang)} umgesetzt. Die betroffene Verarbeitung findet ab sofort nicht mehr statt. ` +
      `Die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.\n\n${gruss}`;
  }
  if (art.startsWith("Datenübertragbarkeit")) {
    return `${zeichen}\n\n${anrede}\n\nIhre Daten, die Sie uns bereitgestellt haben, erhalten Sie in der Anlage ` +
      `in einem strukturierten, gängigen und maschinenlesbaren Format (Art. 20 DSGVO).\n\n${gruss}`;
  }
  if (art.startsWith("Einschränkung")) {
    return `${zeichen}\n\n${anrede}\n\nwir haben die Verarbeitung Ihrer Daten wie gewünscht eingeschränkt ` +
      `(Art. 18 DSGVO). Bevor wir die Einschränkung aufheben, informieren wir Sie.\n\n${gruss}`;
  }
  return `${zeichen}\n\n${anrede}\n\n[Antwort auf Ihre Anfrage vom ${fmtDatum(a.Eingang)} ergänzen]\n\n${gruss}`;
}

async function zeigeAnfrageEntwurf(a) {
  const vvt = vvtFuerGruppe(await Store.loadOderLeer("vvt").catch(() => []), a.Personengruppe);
  const typen = [
    ["antwort", "Antwort (passend zu Art und Ergebnis)"],
    ["eingang", "Eingangsbestätigung"],
    ["verlaengerung", "Mitteilung der Fristverlängerung"]
  ];
  Dialog.zeige({
    titel: `Entwurf zu ${a.Title}`,
    breit: true,
    link: linkZuEintrag("anfragen", a.id),
    html: `<p class="hint">Entwurf prüfen und ergänzen, bevor er versendet wird. Die Auskunft nach Art. 15 füllt
        sich aus dem VVT; bitte nur die Verarbeitungen stehen lassen, die die Person wirklich betreffen.</p>
      <label class="feldzeile">Vorlage
        <select id="entwurfTyp">${typen.map(([w, l]) => `<option value="${w}">${l}</option>`).join("")}</select></label>
      <textarea id="entwurfText" rows="22" class="voll"></textarea>`,
    aktionen: [
      { label: "In Zwischenablage", klasse: "btn-primary", onClick: () => {
          navigator.clipboard.writeText(document.getElementById("entwurfText").value)
            .then(() => toast("In die Zwischenablage kopiert."))
            .catch(() => toast("Kopieren nicht möglich, bitte manuell markieren."));
        } },
      { label: "An mich senden", klasse: "btn-secondary", onClick: async () => {
          try {
            await sendMail(Store.benutzer.email, `Entwurf ${a.Title} (${a.Art})`,
              `<pre style="font-family:Segoe UI,sans-serif;white-space:pre-wrap">${esc(document.getElementById("entwurfText").value)}</pre>`);
            toast("Entwurf an Ihr Postfach gesendet.");
          } catch (e) { toast("Versand fehlgeschlagen: " + e.message, 7000); }
        } }
    ]
  });
  const wahl = document.getElementById("entwurfTyp");
  const fuelle = () => { document.getElementById("entwurfText").value = anfrageEntwurf(a, wahl.value, vvt); };
  wahl.onchange = fuelle;
  fuelle();
}
