/* Calendar and analysis projections: all mutations use the host repository. */
function createCockpit(ctx) {
  "use strict";
  const P = Q.Personal,
    I = Q.Intelligence,
    C = Q.Planning,
    e = ctx.esc;
  let selectedDay = Q.day(),
    month = selectedDay.slice(0, 7),
    domain = "",
    includeDone = false;
  let category = "",
    disposition = "active";
  const button = (action, label, extra = "", cls = "mini") =>
    `<button type="button" class="${cls}" data-cockpit="${action}" ${extra}>${e(label)}</button>`;
  const refButton = (ref, label) =>
    `<button type="button" class="mini" data-personal="detail" data-key="${e(ref.key)}" data-id="${e(ref.id)}">${e(label)}</button>`;
  const option = (value, label, current) =>
    `<option value="${e(value)}" ${value === current ? "selected" : ""}>${e(label)}</option>`;
  function calendar() {
    const entries = C.entries(ctx.state(), includeDone).filter(
      (x) => !domain || P.domain(x.hit) === domain,
    );
    const label = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(new Date(month + "-01T12:00:00"));
    const days = C.monthDays(month);
    const list = C.onDay(entries, selectedDay);
    return `<section class="card" data-plan-section="calendar"><div class="section-head"><div><span class="eyebrow">AGENDA COMMUN</span><h2>${e(label)}</h2></div>${button("calendar-today", "Aujourd’hui")}</div>
      <div class="calendar-toolbar">${button("month-previous", "‹", 'aria-label="Mois précédent"')}<label>Mois<input type="month" data-cockpit-field="month" value="${e(month)}"></label>${button("month-next", "›", 'aria-label="Mois suivant"')}</div>
      <details><summary>Filtrer le calendrier</summary><div class="form"><label>OS<select data-cockpit-field="domain">${option("", "Tous les OS", domain)}${Q.OS.domains.map((d) => option(d.id, d.name, domain)).join("")}</select></label><label><input type="checkbox" data-cockpit-field="completed" ${includeDone ? "checked" : ""}>Inclure les éléments terminés</label></div></details>
      <p class="meta">Événements, voyages, séances et échéances. Le nombre indique les éléments du jour ; touche une date pour les ouvrir.</p>
      <div class="calendar-grid" role="group" aria-label="Jours du mois">${["L", "M", "M", "J", "V", "S", "D"].map((x, i) => `<span class="calendar-weekday" aria-label="${["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][i]}">${x}</span>`).join("")}${days
        .map((d) => {
          const n = C.onDay(entries, d).length;
          return button(
            "calendar-day",
            d.slice(8).replace(/^0/, ""),
            `data-day="${d}" aria-pressed="${d === selectedDay}" aria-label="${d} · ${n} élément(s)" ${d === Q.day() ? 'aria-current="date"' : ""}`,
            `calendar-day ${d.startsWith(month) ? "" : "outside"}`,
          ).replace(
            "</button>",
            `<small aria-hidden="true">${n || "·"}</small></button>`,
          );
        })
        .join("")}</div>
      <section class="calendar-agenda" aria-live="polite"><h3>${e(new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(selectedDay + "T12:00:00")))}</h3>${list.map((x) => `<article class="shared-result"><p class="meta">${e(x.time || "Sans heure")} · ${e(x.label)} · ${e(P.describe(x.hit))}${x.end !== x.start ? ` · ${e(x.start)} → ${e(x.end)}` : ""}${P.completed(x.hit.record) ? " · Terminé" : ""}</p>${refButton(x.hit, P.title(x.hit.record))}</article>`).join("") || '<p class="empty">Aucun élément pour cette journée avec ces filtres.</p>'}${button("create-event", "＋ Événement", "", "primary")}</section>
    </section>`;
  }
  function summary() {
    const findings = I.analyze(ctx.state()).filter(
      (f) => I.disposition(ctx.state(), f) === "active",
    );
    return `<section class="card"><div class="section-head"><div><span class="eyebrow">VUE TRANSVERSALE</span><h2>${findings.length} point(s) à examiner</h2></div>${button("intelligence", "Centre d’analyse")}</div><p class="meta">Échéances, budgets, projets, relations et charge : des constats calculés à partir de tes données.</p>${findings
      .slice(0, 2)
      .map(
        (f) => `<p><span class="tag">${e(f.category)}</span> ${e(f.title)}</p>`,
      )
      .join("")}</section>`;
  }
  function intelligence() {
    const s = ctx.state(),
      findings = I.analyze(s);
    const filtered = findings.filter(
      (f) =>
        (!category || f.category === category) &&
        (disposition === "all" || I.disposition(s, f) === disposition),
    );
    return `<div class="page-title"><div><span class="eyebrow">COMPRENDRE ET AGIR</span><h1>Centre d’analyse</h1><p class="meta">Analyse locale à l’ouverture de l’écran, à partir des données enregistrées.</p></div>${button("refresh", "Actualiser")}</div>
      <section class="card"><div class="form"><label>Catégorie<select data-cockpit-field="category">${option("", "Toutes", category)}${I.categories.map((c) => option(c, c, category)).join("")}</select></label><label>Suivi<select data-cockpit-field="disposition">${[
        ["active", "À examiner"],
        ["accepted", "Acceptés"],
        ["snoozed", "Reportés"],
        ["ignored", "Ignorés"],
        ["all", "Tous les constats actuels"],
      ]
        .map(([v, l]) => option(v, l, disposition))
        .join("")}</select></label></div>
      <details><summary>Comprendre les calculs</summary><p class="meta">Les règles recherchent des échéances, dépassements de budget, projets sans progression enregistrée depuis 30 jours, contacts selon ta cadence, surcharge selon tes disponibilités, conflits horaires et doublons possibles. Chaque constat expose ses sources. Sans données suffisantes, aucun constat n’est inventé. Accepter relie une tâche de suivi ; ignorer masque ce constat ; reporter le fait revenir dans 7 jours. Une échéance modifiée produit un nouveau constat.</p></details>
      <p role="status" class="meta">${filtered.length} constat(s)</p><div class="insight-list">${
        filtered
          .map((f) => {
            const status = I.disposition(s, f),
              decision = I.decisions(s).find((x) => x.id === f.id);
            return `<article class="shared-result insight-card"><span class="tag">${e(f.category)}</span><h2>${e(f.title)}</h2><p>${e(f.explanation)}</p><details><summary>Sources · ${f.refs.length}</summary><div class="os-actions">${f.refs.map((r) => refButton(r, P.title(P.resolve(s, r)))).join("")}</div></details>${decision?.until && status === "snoozed" ? `<p class="meta">Reporté jusqu’au ${e(decision.until)}</p>` : ""}
        ${
          status === "accepted"
            ? `<p class="meta">Accepté : le constat reste présent tant que sa cause existe.</p>${decision.taskId ? refButton({ key: "tasks", id: decision.taskId }, "Ouvrir la tâche de suivi") : ""}`
            : `<div class="os-actions">${button("accept", f.refs.length === 1 && f.refs[0].key === "tasks" ? "Accepter · suivre cette tâche" : "Accepter · créer une tâche", `data-finding="${e(f.id)}"`, "primary")}${button("snooze", "Reporter 7 jours", `data-finding="${e(f.id)}"`)}${button("ignore", "Ignorer", `data-finding="${e(f.id)}"`)}</div>`
        }
        ${status !== "active" ? button("reactivate", "Réexaminer", `data-finding="${e(f.id)}"`) : ""}</article>`;
          })
          .join("") ||
        `<div class="empty"><p>${findings.length ? "Aucun constat ne correspond à ces filtres." : "Aucun point détecté avec les données disponibles. Ajoute tes échéances et budgets pour enrichir l’analyse."}</p>${button("reset-filters", "Réinitialiser les filtres")}<button class="mini" data-action="quick">＋ Capturer</button></div>`
      }</div>
      <details class="shared-fields"><summary>Historique du suivi · ${I.decisions(s).length}</summary>${
        I.decisions(s)
          .map(
            (d) =>
              `<p class="meta">${e(d.at)} · ${e(d.title)} · ${findings.some((f) => f.id === d.id) ? e({ accepted: "Accepté", ignored: "Ignoré", snoozed: "Reporté" }[d.status]) : "Ne se présente plus dans l’analyse actuelle"}</p>`,
          )
          .join("") || '<p class="empty">Aucune décision enregistrée.</p>'
      }</details></section>`;
  }
  function handleClick(t) {
    const a = t.dataset.cockpit;
    if (!a) return false;
    if (a === "create-event") ctx.createEvent(selectedDay);
    else if (a === "intelligence") ctx.navigate("intelligence");
    else if (a === "month-previous" || a === "month-next") {
      month = C.shiftMonth(month, a === "month-next" ? 1 : -1);
      selectedDay = month + "-01";
      ctx.render();
    } else if (a === "calendar-today" || a === "calendar-day") {
      selectedDay = a === "calendar-today" ? Q.day() : t.dataset.day;
      month = selectedDay.slice(0, 7);
      ctx.render();
    } else if (a === "reset-filters") {
      category = "";
      disposition = "active";
      ctx.render();
    } else if (a === "refresh") ctx.render();
    else {
      const f = I.analyze(ctx.state()).find((x) => x.id === t.dataset.finding);
      if (!f) {
        ctx.render();
        return true;
      }
      if (a === "reactivate")
        ctx.state().insightDecisions = I.decisions(ctx.state()).filter(
          (x) => x.id !== f.id,
        );
      else
        I.decide(
          ctx.state(),
          f,
          { accept: "accepted", snooze: "snoozed", ignore: "ignored" }[a],
          ctx.id(),
        );
      if (ctx.save()) {
        ctx.render();
        ctx.toast("Suivi enregistré");
      }
    }
    return true;
  }
  function changeEvent(t) {
    const f = t.dataset.cockpitField;
    if (!f) return;
    if (f === "month") {
      if (!Q.validDate(t.value + "-01")) return;
      month = t.value;
      selectedDay = month + "-01";
    } else if (f === "domain") domain = t.value;
    else if (f === "completed") includeDone = t.checked;
    else if (f === "category") category = t.value;
    else if (f === "disposition") disposition = t.value;
    ctx.render();
    document.querySelector(`[data-cockpit-field="${f}"]`)?.focus();
  }
  return { calendar, summary, intelligence, handleClick, changeEvent };
}
