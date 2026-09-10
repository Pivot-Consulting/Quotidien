/* One recoverable editor, stored as field data rather than executable markup. */
function createDrafts(ctx) {
  const key = "quotidien-editor-draft";
  let pending = Promise.resolve(),
    draft = null;
  const form = () => document.querySelector(".modal form[data-draft-kind]");
  function enqueue(work) {
    pending = pending
      .then(work)
      .catch((error) =>
        ctx.error("Brouillon non sauvegardé : " + error.message),
      );
    Q.draftPending = pending;
    return pending;
  }
  async function load() {
    try {
      const raw = await ctx.repository.read(key, "drafts");
      if (raw) {
        const candidate = JSON.parse(raw);
        if (
          candidate.version !== 1 ||
          !Array.isArray(candidate.fields) ||
          typeof candidate.base !== "string"
        )
          throw new Error("Format de brouillon inconnu.");
        draft = candidate;
      }
    } catch (error) {
      ctx.error(error.message);
    }
  }
  function capture() {
    const f = form();
    if (!f || !ctx.dirty()) return;
    const next = {
      version: 1,
      kind: f.dataset.draftKind,
      id: f.dataset.draftId || "",
      base: JSON.stringify(ctx.state()),
      at: new Date().toISOString(),
      fields: Array.from(f.elements)
        .filter((x) => x.name && x.type !== "file")
        .map((x) => ({ name: x.name, value: x.value, checked: x.checked })),
    };
    return enqueue(async () => {
      await ctx.repository.auxiliary(key, JSON.stringify(next));
      draft = next;
    });
  }
  function clear() {
    return enqueue(async () => {
      await ctx.repository.auxiliary(key, null);
      draft = null;
    });
  }
  function controls() {
    return draft
      ? '<p class="meta">Une saisie peut être reprise. Le brouillon ne remplace pas l’enregistrement.</p><button class="mini" data-action="resume-editor">Reprendre la saisie</button><button class="mini" data-action="export-editor">Exporter le brouillon</button><button class="mini" data-action="discard-editor">Supprimer le brouillon</button>'
      : "";
  }
  function resume() {
    if (!draft) return;
    if (draft.base !== JSON.stringify(ctx.state())) {
      ctx.error(
        "Les données ont changé depuis cette saisie. Exporte le brouillon pour récupérer son contenu sans écraser les modifications récentes.",
      );
      return;
    }
    ctx.open(draft.kind, draft.id);
    const f = form();
    if (!f) return;
    const used = new Set();
    for (const field of draft.fields) {
      const input = Array.from(f.elements).find(
        (x) => x.name === field.name && !used.has(x),
      );
      if (!input || input.type === "file") continue;
      used.add(input);
      input.value = field.value;
      if (input.type === "checkbox" || input.type === "radio")
        input.checked = !!field.checked;
    }
  }
  return {
    load,
    capture,
    clear,
    controls,
    resume,
    flush: () => pending,
    hasForm: () => !!form(),
    export: () =>
      draft &&
      ctx.download(JSON.stringify(draft, null, 2), "quotidien-brouillon.json"),
  };
}

function createFocus(ctx) {
  const F = Q.Focus,
    P = Q.Personal,
    e = ctx.esc;
  function panel() {
    const s = ctx.state(),
      f = F.session(s);
    return `<section class="card"><span class="eyebrow">À TON RYTHME</span><h2>Contexte & concentration</h2><form id="context-form" class="form"><label>Contexte<select name="actionContext">${["", "Maison", "Travail", "Transport", "Voyage", "Weekend"].map((x) => `<option value="${e(x)}" ${s.settings.actionContext === x ? "selected" : ""}>${e(x || "Tous")}</option>`).join("")}</select></label><label>Temps disponible (min)<input name="availableMinutes" type="number" min="0" max="1440" value="${e(s.settings.availableMinutes || 0)}"></label><label>Énergie<select name="availableEnergy">${[
      ["", "Non précisée"],
      ["low", "Faible"],
      ["medium", "Moyenne"],
      ["high", "Haute"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${s.settings.availableEnergy === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label><button class="mini" type="submit">Adapter les recommandations</button></form><p class="meta">0 minute = sans contrainte de temps. Ces préférences ajustent le classement sans masquer les urgences.</p><div class="os-actions">${f?.status === "active" ? '<button class="primary" data-focus="open">Reprendre mon Focus</button>' : ""}<button class="mini" data-focus="review">Bilan du soir</button><button class="mini" data-focus="weekly">Préparer la semaine</button></div></section>`;
  }
  function tick() {
    if (!ctx.state()) return;
    const el = document.querySelector("[data-focus-timer]"),
      f = F.session(ctx.state());
    if (!el || !f) return;
    const remaining = Math.max(0, Math.ceil(f.targetSeconds - F.elapsed(f)));
    el.textContent = `${Math.floor(remaining / 60)
      .toString()
      .padStart(2, "0")}:${(remaining % 60).toString().padStart(2, "0")}`;
  }
  function open() {
    const s = ctx.state(),
      f = F.session(s);
    if (!f) return;
    const task = s.tasks.find((t) => t.id === f.taskId),
      checklist = P.meta(task || {}).checklist || [];
    ctx.modal(
      "Focus · " + P.title(task || {}),
      `<p class="meta">Le temps écoulé continue après fermeture, dans la limite prévue. Il ne mesure pas automatiquement ton attention. La tâche ne sera pas cochée à ta place.</p><h2 data-focus-timer aria-label="Temps restant"></h2><form id="focus-form" class="form"><label class="full">Notes de session<textarea name="notes">${e(f.notes)}</textarea></label>${checklist.map((item, i) => `<label class="full"><input type="checkbox" name="check-${i}" ${item.done ? "checked" : ""}>${e(item.text)}</label>`).join("")}<button class="primary" type="submit">Enregistrer les notes et la checklist</button></form><div class="os-actions"><button class="mini" data-focus="pause">${f.runningSince === null ? "Reprendre" : "Pause"}</button><button class="mini" data-focus="finish">Terminer la session</button></div>`,
    );
    ctx.markClean();
    tick();
  }
  function read() {
    const form = document.querySelector("#focus-form"),
      s = ctx.state(),
      f = F.session(s);
    if (!form || !f) return;
    f.notes = form.elements.namedItem("notes").value;
    const task = s.tasks.find((t) => t.id === f.taskId);
    (P.meta(task || {}).checklist || []).forEach((item, i) => {
      item.done = form.elements.namedItem("check-" + i).checked;
    });
  }
  async function click(t) {
    const action = t.dataset.focus;
    if (!action) return false;
    const s = ctx.state();
    if (action === "open") open();
    else if (action === "review" || action === "weekly")
      ctx.review(
        F.review(s, action === "weekly"),
        action === "weekly" ? "Préparation de la semaine" : "Bilan du soir",
      );
    else {
      read();
      try {
        if (action === "start")
          F.start(
            s,
            t.dataset.id,
            ctx.id(),
            Math.min(240, Math.max(1, Number(s.settings.focus || 25))),
          );
        else if (action === "pause") F.toggle(s);
        else if (action === "finish") F.finish(s, ctx.id());
        if (await ctx.save()) {
          if (action === "finish") {
            ctx.close();
            ctx.render();
            ctx.toast("Session enregistrée dans le suivi Focus");
          } else open();
        }
      } catch (error) {
        ctx.error(error.message);
      }
    }
    return true;
  }
  async function submit(form) {
    if (form.id === "context-form") {
      const data = new FormData(form),
        s = ctx.state();
      s.settings.actionContext = data.get("actionContext");
      s.settings.availableMinutes = Number(data.get("availableMinutes"));
      s.settings.availableEnergy = data.get("availableEnergy");
      if (await ctx.save()) ctx.render();
      return true;
    }
    if (form.id !== "focus-form") return false;
    read();
    if (await ctx.save()) {
      ctx.markClean();
      ctx.toast("Notes et checklist enregistrées");
    }
    return true;
  }
  window.setInterval(tick, 1000);
  return { panel, click, submit };
}

/* Domain workspaces. All changes go through the application's existing repository. */
function createLifeOS(ctx) {
  "use strict";
  const O = Q.OS,
    e = ctx.esc;
  let selected = "",
    selectedType = "",
    filter = "",
    query = "",
    period = Q.day(),
    editingId = null,
    editType = "",
    pendingRules = [],
    pendingCSV = [];
  const state = () => ctx.state();
  const rs = (kind) => O.rows(state(), kind);
  const num = O.n;
  const format = (value) =>
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
  const euro = (value) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(value === 0 ? 0 : value);
  const dateText = (value) =>
    value
      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
          new Date(value + "T12:00:00"),
        )
      : "Sans date";
  const lookup = (id) => state().os.find((r) => r.id === id);
  const refTitle = (id) => lookup(id)?.title || "Non lié";
  const button = (action, label, attrs = "", cls = "mini") =>
    `<button class="${cls}" data-os="${action}" ${attrs}>${e(label)}</button>`;
  const metric = (label, value, detail = "") =>
    `<div class="kpi"><strong>${e(value)}</strong><span>${e(label)}</span>${detail ? `<small>${e(detail)}</small>` : ""}</div>`;
  const line = (title, value, note = "", id = "") =>
    `<div class="os-insight"><div>${id ? button("edit", title, `data-id="${e(id)}"`, "text-button") : `<strong>${e(title)}</strong>`}${note ? `<p class="meta">${e(note)}</p>` : ""}</div><strong>${e(value)}</strong></div>`;
  const progress = (label, value, detail = "") =>
    `<div class="os-progress"><div><strong>${e(label)}</strong><span>${e(detail || format(value) + " %")}</span></div><progress max="100" value="${O.clamp(value)}" aria-label="${e(label)}"></progress></div>`;
  const noData = (text) => `<p class="empty">${e(text)}</p>`;
  const statusOptions = ["Idée", "En cours", "En attente", "Terminé"];
  const latest = (kind, key = "date") =>
    [...rs(kind)].sort(
      (a, b) =>
        String(b[key] || "").localeCompare(String(a[key] || "")) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
    );
  const monthRows = (kind, key = "date") =>
    rs(kind).filter((r) => String(r[key] || "").startsWith(period.slice(0, 7)));
  function overview() {
    return `<div class="page-title"><div><span class="eyebrow">TON SYSTÈME PERSONNEL</span><h1>Les 20 Life OS</h1><p class="meta">Des espaces reliés pour organiser, mesurer et avancer.</p></div>${button("legacy", "＋ Capture libre")}</div><section class="life-grid">${O.domains
      .map((d) => {
        const count = state().os.filter(
          (r) => !r.deleted && O.domainFor(r.kind)?.id === d.id,
        ).length;
        return `<article class="life-card"><span class="os-symbol" aria-hidden="true">${e(d.icon)}</span><h2>${e(d.name)}</h2><p>${e(d.description)}</p><div class="os-card-footer"><small>${count} fiche${count > 1 ? "s" : ""}</small>${button("open", "Ouvrir", `data-domain="${d.id}"`)}</div></article>`;
      })
      .join("")}</section>${legacyPanel()}`;
  }
  function legacyPanel(domain) {
    const captures = state().life.filter(
      (r) => !r.deleted && (!domain || r.domain === domain.name),
    );
    const keys =
      domain?.id === "finance"
        ? ["finances"]
        : domain?.id === "documents"
          ? ["documents"]
          : domain?.id === "home"
            ? ["assets"]
            : domain?.id === "health"
              ? ["health", "workouts"]
              : domain?.id === "projects"
                ? ["goals"]
                : domain?.id === "automation"
                  ? ["automations"]
                  : [];
    const labels = {
      finances: "Mouvements financiers",
      documents: "Documents déjà enregistrés",
      assets: "Équipements déjà enregistrés",
      health: "Mesures de santé",
      workouts: "Séances de sport",
      goals: "Objectifs existants",
      automations: "Idées de règles",
    };
    let html = captures.length
      ? `<details class="card os-legacy"><summary>Captures libres conservées (${captures.length})</summary>${ctx.listLife(captures)}</details>`
      : "";
    for (const key of keys) {
      const data = state()[key].filter((r) => !r.deleted);
      html += `<section class="card os-legacy"><div class="section-head"><h2>${labels[key]}</h2><div class="os-actions"><button class="mini" data-create="${ctx.kinds[key]}">＋ Ajouter</button>${key === "finances" ? button("csv", "Importer CSV") : ""}</div></div>${data.length ? data.map((r) => `<div class="os-insight"><button class="text-button" data-edit="${key}" data-id="${e(r.id)}">${e(r.title || r.label || r.kind || r.type)} · ${e(r.date || "")}</button><span>${key === "finances" ? e(euro(Number(r.amount))) : ""}</span></div>`).join("") : noData("Tes données de cet espace apparaîtront ici.")}</section>`;
    }
    return html;
  }
  function dashboard(d) {
    const s = state(),
      today = period,
      month = period.slice(0, 7);
    let k = [],
      body = "";
    const remaining = (kind) =>
      rs(kind).filter((r) => Q.Personal.visible(r) && !O.done(r));
    const late = (kind) =>
      remaining(kind).filter((r) => r.due && r.due < today);
    if (d.id === "finance") {
      const tx = s.finances.filter((r) => !r.deleted),
        current = tx.filter((r) => String(r.date || "").startsWith(month));
      const income = O.sum(
          current.filter((r) => Number(r.amount) > 0),
          "amount",
        ),
        expense = -O.sum(
          current.filter((r) => Number(r.amount) < 0),
          "amount",
        );
      const holdings = rs("holding");
      k = [
        metric("Revenus du mois", euro(income)),
        metric("Dépenses du mois", euro(expense)),
        metric("Solde des flux du mois", euro(income - expense)),
        metric(
          "Patrimoine net déclaré",
          euro(
            O.sum(
              holdings.filter((r) => r.assetType === "Actif"),
              "valuation",
            ) -
              O.sum(
                holdings.filter((r) => r.assetType === "Dette"),
                "valuation",
              ),
          ),
          "Valeurs saisies, comptes non ajoutés automatiquement",
        ),
      ];
      body += rs("account")
        .map((r) =>
          line(
            r.title,
            euro(
              num(r, "opening") +
                O.sum(
                  tx.filter((t) => t.accountId === r.id),
                  "amount",
                ),
            ),
            "Solde initial + mouvements liés",
            r.id,
          ),
        )
        .join("");
      body += rs("budget")
        .filter((r) => r.month === month)
        .map((r) => {
          const spent = -O.sum(
            current.filter(
              (t) =>
                Number(t.amount) < 0 &&
                String(t.category || "")
                  .trim()
                  .toLocaleLowerCase("fr") ===
                  String(r.category).trim().toLocaleLowerCase("fr"),
            ),
            "amount",
          );
          return progress(
            r.title,
            num(r, "limit") ? (spent / num(r, "limit")) * 100 : 0,
            `${euro(spent)} / ${euro(num(r, "limit"))} · reste ${euro(num(r, "limit") - spent)}`,
          );
        })
        .join("");
      body += line(
        "Abonnements actifs",
        euro(remaining("subscription").reduce((v, r) => v + O.annual(r), 0)) +
          "/an",
        "Estimation annualisée : mois × 12, semaine × 52 ; ne crée pas de mouvements.",
      );
      const months = Array.from({ length: 6 }, (_, i) => {
        const dt = new Date(period + "T12:00:00");
        dt.setDate(1);
        dt.setMonth(dt.getMonth() - 5 + i);
        return Q.day(dt).slice(0, 7);
      });
      body +=
        `<details><summary>Flux sur six mois</summary>` +
        months
          .map((m) =>
            line(
              m,
              euro(
                O.sum(
                  tx.filter((t) => String(t.date).startsWith(m)),
                  "amount",
                ),
              ),
            ),
          )
          .join("") +
        "</details>";
    } else if (d.id === "projects") {
      k = [
        metric("Projets actifs", remaining("project").length),
        metric("Jalons terminés", rs("milestone").filter(O.done).length),
        metric("Jalons en retard", late("milestone").length),
      ];
      body = rs("project")
        .map((r) => {
          const tasks = s.tasks.filter(
            (t) => !t.deleted && t.osSourceId === r.id,
          );
          return (
            progress(r.title, O.projectProgress(s, r.id)) +
            line(
              "Budget restant",
              euro(num(r, "budget") - Q.Connected.projectSpent(s, r)),
              `${r.spendMode === "Transactions" ? "Transactions liées, remboursements déduits" : "Dépenses manuelles"} : ${euro(Q.Connected.projectSpent(s, r))} / ${euro(num(r, "budget"))} · ${tasks.filter((t) => t.done).length}/${tasks.length} actions terminées${Q.Connected.projectSpent(s, r) > num(r, "budget") ? " · Budget dépassé" : ""}`,
            )
          );
        })
        .join("");
    } else if (d.id === "learning") {
      k = [
        metric(
          "Étude ce mois",
          format(O.sum(monthRows("study"), "minutes") / 60) + " h",
        ),
        metric(
          "Cartes à revoir",
          remaining("flashcard").filter((r) => !r.due || r.due <= today).length,
        ),
        metric("Parcours actifs", remaining("course").length),
      ];
      body = rs("course")
        .map((r) => {
          const hours =
            O.sum(
              rs("study").filter((x) => x.courseId === r.id),
              "minutes",
            ) / 60;
          return progress(
            r.title,
            num(r, "targetHours") ? (hours / num(r, "targetHours")) * 100 : 0,
            `${format(hours)} / ${format(num(r, "targetHours"))} h · contenu ${num(r, "progress")} %`,
          );
        })
        .join("");
      body += remaining("flashcard")
        .filter((r) => !r.due || r.due <= today)
        .map(
          (r) =>
            `<div class="os-insight"><strong>${e(r.title)}</strong>${button("review", "Réviser", `data-id="${e(r.id)}"`)}</div>`,
        )
        .join("");
    } else if (d.id === "documents") {
      const soon = remaining("document").filter(
        (r) => r.due && r.due >= today && r.due <= O.addDays(today, 30),
      );
      k = [
        metric("Documents", rs("document").length),
        metric("Expirés", late("document").length),
        metric("À renouveler sous 30 jours", soon.length),
      ];
      body = [...late("document"), ...soon, ...late("procedure")]
        .map((r) => line(r.title, dateText(r.due), "Échéance à traiter", r.id))
        .join("");
    } else if (d.id === "home") {
      k = [
        metric(
          "Valeur de l’inventaire",
          euro(O.sum(rs("equipment"), "valuation")),
        ),
        metric("Entretiens en retard", late("maintenance").length),
        metric(
          "Coût des entretiens ouverts",
          euro(O.sum(remaining("maintenance"), "cost")),
        ),
      ];
      body = rs("equipment")
        .filter((r) => r.warranty)
        .map((r) =>
          line(
            r.title,
            dateText(r.warranty),
            r.warranty < today ? "Garantie échue" : "Fin de garantie",
            r.id,
          ),
        )
        .join("");
    } else if (d.id === "nutrition") {
      const meals = rs("meal").filter((r) => r.date === today),
        target = latest("nutritionTarget").find(
          (r) => r.date && r.date <= today,
        );
      k = [
        metric("Énergie du jour", format(O.sum(meals, "calories")) + " kcal"),
        metric("Protéines", format(O.sum(meals, "protein")) + " g"),
        metric("Hydratation", format(O.sum(meals, "water")) + " ml"),
      ];
      body = line(
        "Glucides / lipides",
        `${format(O.sum(meals, "carbs"))} g / ${format(O.sum(meals, "fat"))} g`,
        "Valeurs saisies pour les portions consommées.",
      );
      if (target)
        for (const [key, label] of [
          ["calories", "Énergie"],
          ["protein", "Protéines"],
          ["water", "Eau"],
        ])
          body += progress(
            label,
            num(target, key) ? (O.sum(meals, key) / num(target, key)) * 100 : 0,
            `${format(O.sum(meals, key))} / ${format(num(target, key))}`,
          );
      else
        body += noData(
          "Ajoute tes propres objectifs quotidiens pour comparer tes apports.",
        );
    } else if (d.id === "health") {
      const sleeps = rs("sleep").filter(
          (r) => r.date <= today && r.date >= O.addDays(today, -6),
        ),
        observations = rs("symptom").filter(
          (r) => r.date <= today && r.date >= O.addDays(today, -6),
        );
      k = [
        metric(
          "Sommeil moyen · 7 jours",
          sleeps.length
            ? format(O.sum(sleeps, "hours") / sleeps.length) + " h"
            : "—",
          sleeps.length + " nuits renseignées",
        ),
        metric("Observations · 7 jours", observations.length),
        metric(
          "Rendez-vous à venir",
          remaining("appointment").filter((r) => r.due >= today).length,
        ),
      ];
      body =
        latest("symptom")
          .slice(0, 8)
          .map((r) =>
            line(
              r.title,
              num(r, "severity") + "/10",
              dateText(r.date) + " · " + String(r.context || ""),
              r.id,
            ),
          )
          .join("") +
        '<p class="meta">Ce carnet conserve tes observations et prépare tes rendez-vous. Il ne fournit ni diagnostic ni conseil de traitement.</p>';
    } else if (d.id === "relations") {
      const contacts = rs("contact").filter(Q.Personal.visible);
      let count = 0;
      body = contacts
        .map((r) => {
          const last =
            latest("interaction").find(
              (x) => x.contactId === r.id && x.date <= today,
            )?.date || r.date;
          const elapsed = last ? O.daysBetween(String(last), today) : null;
          const needs = elapsed === null || elapsed >= num(r, "cadence");
          if (needs) count++;
          return line(
            r.title,
            needs ? "Reprendre contact" : "À jour",
            last
              ? "Dernier échange " + dateText(last)
              : "Aucun échange enregistré",
            r.id,
          );
        })
        .join("");
      const birthdays = contacts.filter(
        (r) => r.birthday && String(r.birthday).slice(5, 7) === month.slice(5),
      );
      k = [
        metric("Contacts", contacts.length),
        metric("À recontacter", count),
        metric("Anniversaires ce mois", birthdays.length),
      ];
      body += birthdays
        .map((r) =>
          line(
            "Anniversaire · " + r.title,
            String(r.birthday).slice(8) + "/" + String(r.birthday).slice(5, 7),
            "",
            r.id,
          ),
        )
        .join("");
    } else if (d.id === "travel") {
      k = [
        metric("Voyages ouverts", remaining("trip").length),
        metric("Réservations", rs("booking").length),
        metric("Préparatifs restants", remaining("packing").length),
      ];
      body = rs("trip")
        .map((r) => {
          const bookings = rs("booking")
            .filter((b) => b.tripId === r.id)
            .sort(
              (a, b) =>
                String(a.date).localeCompare(String(b.date)) ||
                String(a.time || "").localeCompare(String(b.time || "")),
            );
          return (
            `<h3>${e(r.title)} · ${e(r.destination)}</h3>` +
            line(
              "Budget restant",
              euro(num(r, "budget") - O.sum(bookings, "cost")),
              dateText(r.date) + " → " + dateText(r.end),
            ) +
            bookings
              .map((b) =>
                line(
                  b.title,
                  euro(num(b, "cost")),
                  dateText(b.date) +
                    " " +
                    String(b.time || "") +
                    " · " +
                    String(b.location || ""),
                  b.id,
                ),
              )
              .join("")
          );
        })
        .join("");
    } else if (d.id === "career") {
      k = [
        metric("Candidatures", rs("application").length),
        metric(
          "Entretiens",
          rs("application").filter((r) => r.stage === "Entretien").length,
        ),
        metric(
          "Offres / acceptées",
          rs("application").filter((r) =>
            ["Offre", "Acceptée"].includes(r.stage),
          ).length,
        ),
      ];
      body = [
        "À explorer",
        "Envoyée",
        "Entretien",
        "Offre",
        "Refus",
        "Acceptée",
      ]
        .map((stage) =>
          line(
            stage,
            rs("application").filter((r) => r.stage === stage).length,
          ),
        )
        .join("");
      body += rs("careerSkill")
        .map((r) =>
          progress(
            r.title,
            num(r, "desired")
              ? (num(r, "current") / num(r, "desired")) * 100
              : 0,
            `${num(r, "current")} / ${num(r, "desired")}`,
          ),
        )
        .join("");
    } else if (d.id === "decisions") {
      k = [
        metric("Décisions ouvertes", remaining("decision").length),
        metric("Options comparées", rs("option").length),
        metric("Bilans", rs("decisionReview").length),
      ];
      body = rs("decision")
        .map(
          (r) =>
            `<h3>${e(r.title)}</h3><p class="meta">Poids bénéfice / coût faible / risque faible : ${num(r, "benefitWeight")} / ${num(r, "costWeight")} / ${num(r, "riskWeight")}</p>` +
            O.decisionScores(s, r.id)
              .map((x, i) =>
                line(
                  `${i + 1}. ${x.record.title}`,
                  format(x.score) + "/10",
                  String(x.record.evidence || ""),
                  x.record.id,
                ),
              )
              .join(""),
        )
        .join("");
    } else if (d.id === "journal") {
      const entries = monthRows("journal");
      const days = new Set(rs("journal").map((r) => r.date));
      let streak = 0;
      let cursor = days.has(today) ? today : O.addDays(today, -1);
      while (days.has(cursor)) {
        streak++;
        cursor = O.addDays(cursor, -1);
      }
      k = [
        metric(
          "Jours écrits ce mois",
          new Set(entries.map((r) => r.date)).size,
        ),
        metric("Série actuelle", streak + " j"),
        metric(
          "Humeur moyenne",
          entries.length
            ? format(O.sum(entries, "mood") / entries.length) + "/10"
            : "—",
        ),
      ];
      body = latest("journal")
        .slice(0, 7)
        .map((r) =>
          line(
            r.title,
            num(r, "mood") + "/10",
            dateText(r.date) + " · " + String(r.wins || r.gratitude || ""),
            r.id,
          ),
        )
        .join("");
    } else if (d.id === "automation") {
      const suggestions = O.proposals(s, today);
      k = [
        metric(
          "Règles actives",
          remaining("rule").filter((r) => r.enabled === "Active").length,
        ),
        metric("Actions proposées", suggestions.length),
        metric(
          "Actions déjà créées",
          s.tasks.filter((t) => t.automationToken && !t.deleted).length,
        ),
      ];
      body =
        "<p>Les règles s’exécutent uniquement lorsque tu les lances. Examine les tâches proposées avant de les ajouter ; une même règle ne recrée pas la même échéance.</p>" +
        button("rules-preview", "Prévisualiser les actions", "", "primary");
    } else if (d.id === "assistant") {
      const plan = O.dayPlan(s, today);
      k = [
        metric("Capacité du jour", plan.capacity + " min"),
        metric("Plan proposé", plan.used + " min"),
        metric("Autres tâches éligibles", plan.remaining),
      ];
      body =
        '<p class="meta">Plan calculé localement à partir de tes tâches non terminées, sans échéance ou dues à cette date. Estimation par défaut : 25 minutes. Aucun service d’IA connecté.</p>' +
        plan.tasks
          .map(
            (r) =>
              `<div class="os-insight"><button class="text-button" data-edit="tasks" data-id="${e(r.id)}">${e(r.title)}</button><span>${num(r, "estimate") || 25} min</span></div>`,
          )
          .join("") +
        button("weekly", "Créer une note de bilan");
    } else if (d.id === "digital") {
      const logs = rs("screenTime").filter((r) => r.date === today);
      k = [
        metric("Temps d’écran saisi", O.sum(logs, "minutes") + " min"),
        metric(
          "Services à vérifier",
          remaining("service").filter(
            (r) => r.mfa === "À vérifier" || r.mfa === "Désactivée",
          ).length,
        ),
        metric("Revues en retard", late("service").length),
      ];
      body =
        logs
          .map((r) =>
            progress(
              r.title,
              num(r, "limit") ? (num(r, "minutes") / num(r, "limit")) * 100 : 0,
              `${num(r, "minutes")} / ${num(r, "limit")} min`,
            ),
          )
          .join("") +
        '<p class="meta">Les durées sont saisies manuellement. Cet espace ne collecte pas l’activité de tes appareils.</p>';
    } else if (d.id === "security") {
      const risks = remaining("risk").sort(
        (a, b) =>
          num(b, "impact") * num(b, "likelihood") -
          num(a, "impact") * num(a, "likelihood"),
      );
      k = [
        metric("Risques ouverts", risks.length),
        metric(
          "Criticité ≥ 15/25",
          risks.filter((r) => num(r, "impact") * num(r, "likelihood") >= 15)
            .length,
        ),
        metric("Vérifications en retard", late("backupCheck").length),
      ];
      body =
        risks
          .map((r) =>
            line(
              r.title,
              num(r, "impact") * num(r, "likelihood") + "/25",
              String(r.mitigation || "Mesure de réduction à définir"),
              r.id,
            ),
          )
          .join("") +
        '<p class="meta">Registre de suivi uniquement : aucun scan de sécurité. Ne saisis pas de mots de passe, clés privées ou codes de récupération.</p>';
    } else if (d.id === "impact") {
      k = [
        metric("Engagements", rs("impactGoal").length),
        metric("Contributions ce mois", monthRows("contribution").length),
        metric(
          "Engagements atteints",
          rs("impactGoal").filter(
            (r) =>
              O.sum(
                rs("contribution").filter((x) => x.impactGoalId === r.id),
                "quantity",
              ) >= num(r, "targetValue"),
          ).length,
        ),
      ];
      body = rs("impactGoal")
        .map((r) => {
          const value = O.sum(
            rs("contribution").filter((x) => x.impactGoalId === r.id),
            "quantity",
          );
          return progress(
            r.title,
            num(r, "targetValue") ? (value / num(r, "targetValue")) * 100 : 0,
            `${format(value)} / ${format(num(r, "targetValue"))} ${r.unit || ""}`,
          );
        })
        .join("");
    } else if (d.id === "household") {
      k = [
        metric("Membres", rs("member").length),
        metric("Tâches ouvertes", remaining("chore").length),
        metric("Dépenses partagées", euro(O.sum(rs("sharedExpense"), "cost"))),
      ];
      body = O.balances(s)
        .map((r) =>
          line(
            r.title,
            euro(r.cents / 100),
            r.cents > 0
              ? "À recevoir"
              : r.cents < 0
                ? "À rembourser"
                : "Équilibré",
          ),
        )
        .join("");
      body +=
        "<h3>Remboursements proposés</h3>" +
        O.settlements(s)
          .map((r) => line(r.from + " → " + r.to, euro(r.cents / 100)))
          .join("") +
        '<p class="meta">Répartition à parts égales entre les participants de chaque dépense. Les virements ne sont pas exécutés.</p>';
      body += rs("member")
        .map((r) =>
          line(
            "Charge · " + r.title,
            O.sum(
              remaining("chore").filter((x) => x.memberId === r.id),
              "minutes",
            ) + " min",
          ),
        )
        .join("");
    } else if (d.id === "progress") {
      k = [
        metric("Indicateurs", rs("indicator").length),
        metric("Mesures", rs("measurement").length),
        metric(
          "Cibles atteintes",
          rs("indicator").filter(
            (r) => O.indicatorProgress(s, r).progress === 100,
          ).length,
        ),
      ];
      body = rs("indicator")
        .map((r) => {
          const p = O.indicatorProgress(s, r);
          return (
            progress(
              r.title,
              p.progress,
              `${format(p.value)} / ${format(num(r, "targetValue"))} ${r.unit || ""}`,
            ) +
            `<p class="meta">Départ ${format(num(r, "baseline"))} · historique : ${
              p.history
                .slice(-8)
                .map((x) =>
                  e(dateText(x.date) + " : " + format(num(x, "reading"))),
                )
                .join(" → ") || "aucune mesure"
            }</p>`
          );
        })
        .join("");
    } else if (d.id === "balance") {
      const entry = latest("energyDay").find((r) => r.date === today),
        ratings = latest("lifeRating").filter((r) => r.date <= today),
        areas = [...new Set(ratings.map((r) => r.area))];
      const current = areas.map((a) => ratings.find((r) => r.area === a));
      const margin = entry
        ? num(entry, "capacity") -
          num(entry, "obligations") -
          num(entry, "recovery")
        : null;
      k = [
        metric(
          "Marge après engagements et récupération",
          margin === null ? "—" : margin + " min",
        ),
        metric("Domaines évalués", areas.length),
        metric(
          "Satisfaction moyenne",
          current.length
            ? format(O.sum(current, "score") / current.length) + "/10"
            : "—",
        ),
      ];
      body = current
        .map((r) =>
          progress(
            r.area,
            num(r, "score") * 10,
            `${num(r, "score")}/10 · ${dateText(r.date)}`,
          ),
        )
        .join("");
      if (margin !== null && margin < 0)
        body +=
          '<p class="error">La journée dépasse le temps disponible de ' +
          -margin +
          " minutes. Ajuste les engagements dans ton bilan.</p>";
    }
    return `<section class="os-metrics">${k.join("")}</section><section class="card os-summary"><h2>Synthèse</h2>${body || noData("Ajoute tes premières fiches pour obtenir les calculs et les échéances de cet espace.")}</section>`;
  }
  function fieldValue(f, r) {
    const v = r[f.key];
    if (v === undefined || v === "") return "";
    if (f.type === "ref") return refTitle(v);
    if (f.type === "refs")
      return Array.isArray(v) ? v.map(refTitle).join(", ") : "";
    if (f.type === "number") return format(Number(v));
    if (f.type === "date") return dateText(v);
    return String(v);
  }
  function recordCard(r, m) {
    const fields = m.fields.filter(
      (f) => r[f.key] !== undefined && r[f.key] !== "" && f.key !== "answer",
    );
    const overdue = r.due && r.due < Q.day() && !O.done(r);
    const links = fields.filter((f) => f.type === "ref");
    return `<article class="card os-record"><div class="section-head"><h3>${button("edit", r.title, `data-id="${e(r.id)}"`, "text-button")}</h3><span class="tag ${overdue ? "os-late" : ""}">${e(overdue ? "En retard" : r.status)}</span></div><dl>${fields
      .filter((f) => !["textarea", "url", "ref"].includes(f.type))
      .slice(0, 6)
      .map(
        (f) =>
          `<div><dt>${e(f.label)}</dt><dd>${e(fieldValue(f, r))}</dd></div>`,
      )
      .join(
        "",
      )}</dl>${links.map((f) => `<p class="meta">${e(f.label)} : ${lookup(r[f.key]) ? button("edit", refTitle(r[f.key]), `data-id="${e(r[f.key])}"`, "text-button") : e("Référence indisponible")}</p>`).join("")}${r.details ? `<p class="os-excerpt">${e(r.details)}</p>` : ""}<div class="os-actions">${button("edit", "Ouvrir", `data-id="${e(r.id)}"`)}${r.kind === "flashcard" ? button("review", "Réviser", `data-id="${e(r.id)}"`) : ""}${button("task", "Créer une action", `data-id="${e(r.id)}"`)}${m.scheduled ? button("complete", r.kind === "subscription" ? "Avancer l’échéance" : O.done(r) ? "Rouvrir" : "Terminer", `data-id="${e(r.id)}"`) : ""}${button("duplicate", "Dupliquer", `data-id="${e(r.id)}"`)}<button class="danger" data-del="os" data-id="${e(r.id)}" aria-label="Retirer ${e(r.title)}">×</button></div></article>`;
  }
  function filteredRecords() {
    return rs(selectedType)
      .filter((r) => Q.Personal.visible(r))
      .filter(
        (r) =>
          (!filter || r.status === filter) &&
          [r.title, r.details, ...Q.Personal.tags(r)]
            .join(" ")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes(
              query
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase(),
            ),
      )
      .sort(
        (a, b) =>
          String(a.due || a.date || "9999").localeCompare(
            String(b.due || b.date || "9999"),
          ) || String(b.createdAt).localeCompare(String(a.createdAt)),
      );
  }
  function recordList() {
    const m = O.getModel(selectedType);
    const records = filteredRecords();
    return records.length
      ? records.map((r) => recordCard(r, m)).join("")
      : noData(
          `Aucune fiche ${m.label.toLowerCase()}${query || filter ? " pour ces filtres" : ""}. Utilise « Ajouter » pour commencer.`,
        );
  }
  function view() {
    const d = O.domains.find((d) => d.id === selected);
    if (!d) return overview();
    if (!d.models.some((m) => m.id === selectedType))
      selectedType = d.models[0].id;
    return `<div class="os-breadcrumb">${button("home", "← Tous les OS")}<span>${e(d.name)}</span></div><div class="page-title"><div><span class="eyebrow">LIFE OS / ${e(d.icon)}</span><h1>${e(d.name)}</h1><p class="meta">${e(d.description)}</p></div><div class="os-header-actions">${button("new", "＋ Ajouter", `data-type="${selectedType}"`, "primary")}<label>Date de référence<input type="date" data-os-period value="${e(period)}"></label></div></div>${dashboard(d)}<section class="os-workspace"><div class="tabs os-tabs" role="tablist" aria-label="Sections ${e(d.name)}">${d.models.map((m) => `<button role="tab" aria-selected="${selectedType === m.id}" class="${selectedType === m.id ? "active" : ""}" data-os="type" data-type="${m.id}">${e(m.label)} <small>${rs(m.id).length}</small></button>`).join("")}</div><div class="os-toolbar"><label>Rechercher<input type="search" data-os-query value="${e(query)}" placeholder="Titre, détails…"></label><label>Statut<select data-os-filter><option value="">Tous</option>${statusOptions.map((x) => `<option ${x === filter ? "selected" : ""}>${e(x)}</option>`).join("")}</select></label><div class="os-actions">${button("export", "Exporter CSV")}</div></div><div class="os-records" id="os-records" role="tabpanel">${recordList()}</div></section>${legacyPanel(d)}`;
  }
  function input(f, r) {
    let v = r[f.key] ?? f.default ?? "";
    if (!r.id && v === "") {
      if (f.type === "date" && f.key === "date") v = Q.day();
      if (f.type === "month") v = Q.day().slice(0, 7);
      if (f.type === "number") v = f.min > 0 ? f.min : 0;
    }
    const attr = `name="${e(f.key)}" ${f.required ? "required" : ""}`;
    let html = "";
    if (f.type === "select")
      html = `<select ${attr}>${f.options.map((x) => `<option ${v === x ? "selected" : ""}>${e(x)}</option>`).join("")}</select>`;
    else if (f.type === "ref")
      html = `<select ${attr}><option value="">Choisir…</option>${state()
        .os.filter((x) => x.kind === f.ref && (!x.deleted || x.id === v))
        .map(
          (x) =>
            `<option value="${e(x.id)}" ${v === x.id ? "selected" : ""}>${e(x.title)}${x.deleted ? " (retiré)" : ""}</option>`,
        )
        .join(
          "",
        )}</select>${rs(f.ref).length ? "" : `<small>Crée d’abord une fiche dans « ${e(O.getModel(f.ref).label)} ».</small>`}`;
    else if (f.type === "refs")
      html = `<div class="os-checks">${
        state()
          .os.filter(
            (x) =>
              x.kind === f.ref &&
              (!x.deleted || (Array.isArray(v) && v.includes(x.id))),
          )
          .map(
            (x) =>
              `<label><input type="checkbox" name="${e(f.key)}" value="${e(x.id)}" ${Array.isArray(v) && v.includes(x.id) ? "checked" : ""}>${e(x.title)}</label>`,
          )
          .join("") || "<small>Ajoute d’abord les membres du foyer.</small>"
      }</div>`;
    else if (f.type === "textarea")
      html = `<textarea ${attr} rows="3">${e(v)}</textarea>`;
    else
      html = `<input ${attr} type="${f.type}" value="${e(v)}" ${f.type === "number" ? `step="any" ${f.min !== undefined ? `min="${f.min}"` : ""} ${f.max !== undefined ? `max="${f.max}"` : ""}` : ""}>`;
    return f.type === "refs"
      ? `<fieldset class="full"><legend>${e(f.label)}</legend>${html}</fieldset>`
      : `<label class="${f.type === "textarea" ? "full" : ""}">${e(f.label)}${html}</label>`;
  }
  function edit(kind, record) {
    const m = O.getModel(kind);
    if (!m) return;
    editingId = record?.id || null;
    editType = kind;
    const r = record || { title: "", status: "En cours" };
    const fields = [
      {
        key: "title",
        label: kind === "flashcard" ? "Question" : "Titre",
        type: "text",
        required: true,
      },
      {
        key: "status",
        label: "Statut",
        type: "select",
        options: statusOptions,
      },
      ...m.fields,
      { key: "details", label: "Notes et contexte", type: "textarea" },
    ];
    const related = record
      ? state().tasks.filter((t) => !t.deleted && t.osSourceId === record.id)
      : [];
    const urls = record
      ? m.fields
          .filter((f) => f.type === "url" && O.safeURL(record[f.key]))
          .map(
            (f) =>
              `<a class="mini" href="${e(O.safeURL(record[f.key]))}" target="_blank" rel="noopener noreferrer">${e(f.label)} ↗</a>`,
          )
          .join("")
      : "";
    ctx.modal(
      `${record ? "Modifier" : "Ajouter"} · ${m.label}`,
      `<form id="os-form" class="form">${fields.map((f) => input(f, r)).join("")}${ctx.commonFields(r)}<div class="full os-actions"><button class="primary" type="submit">Enregistrer</button>${urls}</div></form>${record ? ctx.commonFooter({ key: "os", id: record.id }) : ""}${related.length ? "<h3>Actions liées</h3>" + related.map((t) => `<p><button class="text-button" data-edit="tasks" data-id="${e(t.id)}">${t.done ? "✓ " : ""}${e(t.title)}</button></p>`).join("") : ""}`,
    );
    ctx.markClean();
    const draftForm = document.getElementById("os-form");
    draftForm.dataset.draftKind = "os:" + kind;
    draftForm.dataset.draftId = record?.id || "";
  }
  async function persist() {
    if (!(await ctx.save())) return false;
    ctx.close();
    ctx.render();
    ctx.toast("Enregistré");
    return true;
  }
  function review(r) {
    ctx.modal(
      "Réviser une carte",
      `<h3>${e(r.title)}</h3><details class="os-answer"><summary>Afficher la réponse</summary><p>${e(r.answer || "Réponse à compléter")}</p></details><p class="meta">Choisis après avoir tenté de retrouver la réponse.</p><div class="os-actions">${[
        ["again", "À revoir"],
        ["hard", "Difficile"],
        ["good", "Acquis"],
      ]
        .map(([q, label]) =>
          button("grade", label, `data-id="${e(r.id)}" data-grade="${q}"`),
        )
        .join("")}</div>`,
    );
  }
  function route(hash) {
    const parts = hash.replace(/^#/, "").split("/");
    if (parts[0] !== "life") return false;
    const domain = O.domains.find((d) => d.id === parts[1]);
    const nextDomain = domain?.id || "";
    const nextType =
      domain?.models.find((m) => m.id === parts[2])?.id ||
      domain?.models[0]?.id ||
      "";
    if (selected !== nextDomain || selectedType !== nextType) {
      query = "";
      filter = "";
    }
    selected = nextDomain;
    selectedType = nextType;
    return true;
  }
  function open(domain) {
    selected =
      O.domains.find((d) => d.id === domain || d.name === domain)?.id || "";
    selectedType = "";
    query = "";
    filter = "";
    state().screen = "life";
    ctx.close();
    ctx.render();
    history.pushState(null, "", "#life" + (selected ? "/" + selected : ""));
  }
  async function handleClick(t) {
    const action = t.dataset.os;
    if (!action) return false;
    const r = lookup(t.dataset.id);
    if (action === "open") open(t.dataset.domain);
    else if (action === "home") open("");
    else if (action === "legacy") ctx.openForm("life");
    else if (action === "type") {
      selectedType = t.dataset.type;
      query = "";
      filter = "";
      ctx.render();
      history.pushState(null, "", "#life/" + selected + "/" + selectedType);
    } else if (action === "new") edit(t.dataset.type);
    else if (action === "edit" && r) edit(r.kind, r);
    else if (action === "review" && r) review(r);
    else if (action === "grade" && r) {
      Object.assign(r, O.reviewCard(r, t.dataset.grade));
      await persist();
    } else if (action === "complete" && r) {
      Object.assign(r, O.completeRecord(r));
      await persist();
    } else if (action === "duplicate" && r) {
      const copy = Q.Personal.duplicate(
        state(),
        { key: "os", id: r.id },
        ctx.id(),
      );
      state().os.unshift(copy);
      await persist();
    } else if (action === "task" && r) {
      if (
        state().tasks.some(
          (t) => !t.deleted && !t.done && t.osSourceId === r.id,
        )
      ) {
        ctx.toast("Une action ouverte est déjà liée à cette fiche.");
        return true;
      }
      state().tasks.unshift({
        id: ctx.id(),
        title: r.title,
        due: r.due || "",
        project: O.domainFor(r.kind).name,
        details: r.details || "",
        osSourceId: r.id,
        estimate: 25,
        done: false,
        createdAt: new Date().toISOString(),
      });
      await persist();
    } else if (action === "export") {
      const m = O.getModel(selectedType),
        fields = [
          { key: "title", label: "Titre" },
          { key: "status", label: "Statut" },
          ...m.fields,
          { key: "details", label: "Notes" },
        ];
      ctx.download(
        O.csv(
          fields.map((f) => f.label),
          filteredRecords().map((r) => fields.map((f) => fieldValue(f, r))),
        ),
        "quotidien-" + selectedType + "-" + Q.day() + ".csv",
      );
    } else if (action === "rules-preview") {
      pendingRules = O.proposals(state(), period);
      ctx.modal(
        "Actions proposées",
        `<p>${pendingRules.length} tâche(s) à créer. Les actions restent dans Quotidien.</p>${pendingRules.map((r) => line(r.title, r.due)).join("")}${pendingRules.length ? button("rules-apply", "Créer ces tâches", "", "primary") : noData("Aucune nouvelle échéance pour tes règles actives.")}`,
      );
    } else if (action === "rules-apply") {
      const valid = new Set(O.proposals(state(), period).map((r) => r.token));
      for (const p of pendingRules.filter((p) => valid.has(p.token)))
        state().tasks.unshift({
          id: ctx.id(),
          title: p.title,
          due: p.due,
          project: "Automatisations",
          done: false,
          automationToken: p.token,
          osSourceId: p.sourceKey === "os" ? p.sourceId : undefined,
          sourceKey: p.sourceKey,
          sourceId: p.sourceId,
          createdAt: new Date().toISOString(),
        });
      if (await persist()) pendingRules = [];
    } else if (action === "weekly") {
      const start = O.addDays(period, -6),
        journals = rs("journal").filter(
          (r) => r.date >= start && r.date <= period,
        ),
        completed = state().tasks.filter(
          (r) =>
            !r.deleted &&
            r.done &&
            String(r.completedAt || "").slice(0, 10) >= start &&
            String(r.completedAt || "").slice(0, 10) <= period,
        ),
        workouts = state().workouts.filter(
          (r) => !r.deleted && r.date >= start && r.date <= period,
        );
      const title = "Bilan du " + start + " au " + period;
      if (state().notes.some((n) => !n.deleted && n.reviewPeriod === period)) {
        ctx.toast("Ce bilan existe déjà dans tes notes.");
        return true;
      }
      state().notes.unshift({
        id: ctx.id(),
        title,
        tags: "bilan, life-os",
        reviewPeriod: period,
        body: `${completed.length} tâches terminées\n${O.sum(workouts, "minutes")} minutes de sport\n${journals.length} entrées de journal\n\nVictoires\n${journals
          .map((r) => String(r.wins || ""))
          .filter(Boolean)
          .join("\n")}\n\nÀ retenir\n${journals
          .map((r) => String(r.lesson || ""))
          .filter(Boolean)
          .join("\n")}\n\nPriorités de la semaine prochaine\n`,
        createdAt: new Date().toISOString(),
      });
      await persist();
    } else if (action === "csv") {
      ctx.modal(
        "Importer des mouvements CSV",
        '<p>Colonnes : <code>date;libelle;montant;categorie</code>. Dates AAAA-MM-JJ, dépenses négatives, revenus positifs.</p><label>Fichier CSV<input type="file" accept=".csv,text/csv" data-os-csv></label><div id="csv-preview"></div>',
      );
    } else if (action === "csv-apply") {
      const fingerprint = (r) =>
        JSON.stringify([r.date, r.label, Number(r.amount), r.category || ""]);
      const existing = new Set(state().finances.map(fingerprint));
      for (const r of pendingCSV) {
        const fp = fingerprint(r);
        if (!existing.has(fp)) {
          state().finances.unshift({
            ...r,
            id: ctx.id(),
            createdAt: new Date().toISOString(),
          });
          existing.add(fp);
        }
      }
      if (await persist()) pendingCSV = [];
    }
    return true;
  }
  async function submit(f) {
    if (f.id !== "os-form") return false;
    if (!f.reportValidity()) return true;
    const m = O.getModel(editType),
      fd = new FormData(f),
      original = editingId ? lookup(editingId) : null;
    const record = {
      id: ctx.id(),
      createdAt: new Date().toISOString(),
      ...original,
      ...Object.fromEntries(fd),
      kind: editType,
      updatedAt: new Date().toISOString(),
    };
    for (const f of m.fields)
      if (f.type === "refs") record[f.key] = fd.getAll(f.key);
    for (const key of Object.keys(record))
      if (typeof record[key] === "string") record[key] = record[key].trim();
    ctx.commonRead(f, record);
    try {
      O.validate(record);
      for (const f of m.fields.filter(
        (f) => f.type === "ref" || f.type === "refs",
      )) {
        const ids = f.type === "refs" ? record[f.key] : [record[f.key]];
        for (const id of ids)
          if (id && !state().os.some((r) => r.id === id && r.kind === f.ref))
            throw new Error(f.label + " : référence introuvable.");
      }
      if (
        record.kind === "decisionReview" &&
        lookup(record.optionId)?.decisionId !== record.decisionId
      )
        throw new Error("L’option doit appartenir à la décision choisie.");
    } catch (err) {
      ctx.error(err.message);
      return true;
    }
    if (original)
      state().os = state().os.map((r) => (r.id === original.id ? record : r));
    else state().os.unshift(record);
    if (await persist()) {
      editingId = null;
      editType = "";
    }
    return true;
  }
  function inputEvent(target) {
    if (!target.hasAttribute("data-os-query")) return;
    query = target.value;
    document.getElementById("os-records").innerHTML = recordList();
  }
  function changeEvent(target) {
    if (target.hasAttribute("data-os-filter")) {
      filter = target.value;
      document.getElementById("os-records").innerHTML = recordList();
    }
    if (target.hasAttribute("data-os-period") && Q.validDate(target.value)) {
      period = target.value;
      ctx.render();
    }
    if (target.hasAttribute("data-os-csv")) {
      const file = target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        ctx.error("CSV limité à 2 Mo.");
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => ctx.error("Lecture impossible.");
      reader.onload = () => {
        try {
          pendingCSV = O.parseCSV(String(reader.result));
          const existing = new Set(
            state().finances.map((r) =>
              JSON.stringify([
                r.date,
                r.label,
                Number(r.amount),
                r.category || "",
              ]),
            ),
          );
          const seen = new Set(existing);
          let count = 0;
          for (const r of pendingCSV) {
            const token = JSON.stringify([
              r.date,
              r.label,
              r.amount,
              r.category,
            ]);
            if (!seen.has(token)) {
              count++;
              seen.add(token);
            }
          }
          const box = document.getElementById("csv-preview");
          if (box)
            box.innerHTML = `<p>${pendingCSV.length} lignes lues · ${count} nouvelles · ${pendingCSV.length - count} doublons exacts ignorés (y compris éléments retirés).</p>${pendingCSV
              .slice(0, 5)
              .map((r) => line(r.label, euro(r.amount), r.date))
              .join(
                "",
              )}${count ? button("csv-apply", "Importer les nouvelles lignes", "", "primary") : ""}`;
        } catch (err) {
          pendingCSV = [];
          ctx.error(err.message);
        }
      };
      reader.readAsText(file);
    }
  }
  return {
    view,
    open,
    edit,
    route,
    handleClick,
    submit,
    inputEvent,
    changeEvent,
  };
}

/* Shared user journeys. The host remains responsible for persistence and dialogs. */
function createPersonalOS(ctx) {
  "use strict";
  const P = Q.Personal,
    e = ctx.esc,
    state = ctx.state;
  let filter = {},
    view = "list",
    current = null,
    pendingRevision = null;
  const button = (action, label, attrs = "", cls = "mini") =>
    `<button type="button" class="${cls}" data-personal="${action}" ${attrs}>${e(label)}</button>`;
  const attrs = (ref) => `data-key="${e(ref.key)}" data-id="${e(ref.id)}"`;
  const select = (name, label, values, value = "") =>
    `<label>${e(label)}<select name="${name}" data-personal-filter="${name}">${values.map(([v, t]) => `<option value="${e(v)}" ${v === value ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label>`;
  function fields(r = {}, key = "os") {
    const m = P.meta(r);
    return `<details class="full shared-fields"><summary>Propriétés avancées · tags, priorité, contexte</summary><div class="form">
    <label class="full">Tags communs (séparés par des virgules)<input name="personal_tags" value="${e((m.tags || []).join(", "))}"></label>
    ${select("personal_priority", "Priorité", [["", "Non définie"], ...Array.from({ length: 5 }, (_, i) => [String(i + 1), String(i + 1) + (i === 4 ? " · Haute" : "")])], String(m.priority || ""))}
    ${select(
      "personal_energy",
      "Énergie nécessaire",
      [
        ["", "Non définie"],
        ["low", "Faible"],
        ["medium", "Moyenne"],
        ["high", "Élevée"],
      ],
      m.energy || "",
    )}
    <label>Contexte<input name="personal_context" placeholder="Maison, travail, transport…" value="${e(m.context || "")}"></label>
    ${key === "tasks" ? "" : `<label>Durée prévue (min)<input type="number" name="personal_duration" min="1" value="${e(m.duration || "")}"></label>`}
    <label>Responsable<input name="personal_owner" value="${e(m.owner || "")}"></label>
    <label>Lieu<input name="personal_location" value="${e(m.location || "")}"></label>
    <label class="full">Description commune<textarea name="personal_description">${e(m.description || "")}</textarea></label>
    <label><input type="checkbox" name="personal_favorite" ${m.favorite ? "checked" : ""}>Favori</label>
    <label class="full">Checklist (une étape par ligne ; [x] pour terminée)<textarea name="personal_checklist" rows="3">${e((m.checklist || []).map((x) => (x.done ? "[x] " : "") + x.text).join("\n"))}</textarea></label>
    </div></details>`;
  }
  function readFields(form, record) {
    if (!form.elements.namedItem("personal_tags")) return;
    const fd = new FormData(form),
      m = { ...P.meta(record) };
    m.tags = [
      ...new Set(
        String(fd.get("personal_tags") || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ];
    for (const key of ["energy", "context", "owner", "location", "description"])
      m[key] = String(fd.get("personal_" + key) || "").trim();
    for (const key of ["priority", "duration"]) {
      const v = fd.get("personal_" + key);
      if (v) m[key] = Number(v);
      else delete m[key];
    }
    if (form.elements.namedItem("estimate"))
      m.duration = Number(fd.get("estimate") || 25);
    m.favorite = fd.has("personal_favorite");
    m.checklist = String(fd.get("personal_checklist") || "")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({
        text: t.replace(/^\[x\]\s*/i, "").trim(),
        done: /^\[x\]/i.test(t),
      }))
      .filter((x) => x.text);
    record.personal = m;
    for (const key of Object.keys(record))
      if (key.startsWith("personal_")) delete record[key];
  }
  function footer(ref) {
    return `<div class="shared-footer">${button("detail", "Relations, checklist et historique", attrs(ref))}<p class="meta">Les propriétés et relations sont communes à tous les espaces.</p></div>`;
  }
  function hitCard(h) {
    const r = h.record,
      m = P.meta(r);
    return `<article class="shared-result"><button class="search-result" data-edit="${e(h.key)}" data-id="${e(h.id)}"><strong>${m.favorite ? "★ " : ""}${e(P.title(r))}</strong><span>${e(P.describe(h))}${P.date(r) ? " · " + e(P.date(r)) : ""}${m.archived ? " · Archivé" : ""}</span></button><div class="shared-result-bottom"><span class="meta">${e(P.tags(r).join(" · "))}</span>${button("detail", "Relations & détails", attrs(h))}</div></article>`;
  }
  function searchView() {
    return `<div class="page-title"><div><span class="eyebrow">TOUT EST CONNECTÉ</span><h1>Explorer</h1><p class="meta">Retrouve tes objets dans les vingt OS et les outils quotidiens.</p></div>${button("quick", "＋ Capturer", "", "primary")}</div>
    <section class="card"><form id="global-search-form" class="shared-search-form"><label>Rechercher<input type="search" id="global-search" value="${e(filter.query || "")}" placeholder="Titre, contenu, tags, personne…"></label><button class="mini" type="submit">Rechercher</button></form>
    ${
      (state().settings.searchHistory || []).length
        ? `<details><summary>Recherches récentes</summary><div class="os-actions">${state()
            .settings.searchHistory.map((q, i) =>
              button("recent-search", q, `data-index="${i}"`),
            )
            .join(
              "",
            )}${button("clear-history", "Effacer cet historique")}</div></details>`
        : ""
    }
    <details class="shared-fields"><summary>Filtres et recherches enregistrées</summary><div class="form">
    ${select("key", "Type", [["", "Tous les objets"], ...Object.entries(P.labels)], filter.key)}
    ${select(
      "scope",
      "Périmètre",
      [
        ["", "Tous les éléments"],
        ["deadlines", "Échéances uniquement"],
      ],
      filter.scope,
    )}
    ${select("domain", "OS", [["", "Tous les OS"], ...Q.OS.domains.map((d) => [d.id, d.name])], filter.domain)}
    ${select(
      "status",
      "État",
      [
        ["", "Tous"],
        ["open", "À faire / en cours"],
        ["done", "Terminés"],
        ["overdue", "Échéance en retard"],
      ],
      filter.status,
    )}
    ${select(
      "archive",
      "Archives",
      [
        ["", "Actifs"],
        ["archived", "Archives"],
        ["all", "Actifs et archives"],
      ],
      filter.archive,
    )}
    <label>Tag exact<input data-personal-filter="tag" name="tag" value="${e(filter.tag || "")}"></label>
    <label>À partir du<input type="date" data-personal-filter="from" value="${e(filter.from || "")}"></label>
    <label>Jusqu’au<input type="date" data-personal-filter="to" value="${e(filter.to || "")}"></label>
    <label><input type="checkbox" data-personal-filter="favorite" ${filter.favorite ? "checked" : ""}>Favoris uniquement</label>
    </div><div class="os-actions">${button("reset-search", "Réinitialiser les filtres")}${button("save-search", "Enregistrer cette recherche")}</div><div class="shared-saved">${(state().settings.searches || []).map((s, i) => `<span>${button("load-search", s.name, `data-index="${i}"`)}${button("remove-search", "×", `data-index="${i}" aria-label="Supprimer la recherche ${e(s.name)}"`)}</span>`).join("")}</div></details>
    <div class="os-actions shared-views" role="group" aria-label="Vue des résultats">${[
      ["list", "Liste"],
      ["kanban", "Kanban"],
      ["timeline", "Chronologie"],
    ]
      .map(([v, l]) =>
        button("view", l, `data-view="${v}" aria-pressed="${view === v}"`),
      )
      .join(
        "",
      )}</div><div id="search-results" aria-live="polite">${results()}</div></section>`;
  }
  function results() {
    const hits = P.search(state(), filter),
      shown = hits.slice(0, 100);
    let body = "";
    if (view === "kanban")
      body = `<div class="shared-kanban">${[
        ["open", "À faire / en cours"],
        ["blocked", "Bloqués"],
        ["done", "Terminés"],
      ]
        .map(([v, l]) => {
          const list = shown.filter((h) =>
            P.completed(h.record, state())
              ? v === "done"
              : P.blockers(state(), h).length
                ? v === "blocked"
                : v === "open",
          );
          return `<section><h2>${l} · ${list.length}</h2>${list.map(hitCard).join("") || '<p class="empty">Aucun élément.</p>'}</section>`;
        })
        .join("")}</div>`;
    else if (view === "timeline") {
      const dates = [
        ...new Set(shown.map((h) => P.date(h.record) || "Sans date")),
      ].sort();
      body = dates
        .map(
          (d) =>
            `<section class="shared-timeline"><h2>${e(d)}</h2>${shown
              .filter((h) => (P.date(h.record) || "Sans date") === d)
              .map(hitCard)
              .join("")}</section>`,
        )
        .join("");
    } else body = shown.map(hitCard).join("");
    return `<p class="meta">${hits.length} résultat(s)${hits.length > 100 ? " · 100 affichés, affine les filtres" : ""}</p>${body || `<div class="empty"><p>Aucun résultat. Essaie un autre filtre ou capture un nouvel élément.</p>${button("reset-search", "Effacer les filtres")}${button("quick", "＋ Capturer")}</div>`}`;
  }
  function refreshResults() {
    const target = document.getElementById("search-results");
    if (target) target.innerHTML = results();
  }
  function search(initial) {
    if (initial) filter = { ...initial };
    ctx.navigate("explore");
    document.getElementById("global-search")?.focus();
  }
  function remember() {
    const q = (filter.query || "").trim();
    if (!q) return;
    state().settings.searchHistory = [
      q,
      ...(state().settings.searchHistory || []).filter((x) => x !== q),
    ].slice(0, 10);
  }
  function detail(ref) {
    const r = P.resolve(state(), ref);
    if (!r) return;
    current = { key: ref.key, id: ref.id };
    pendingRevision = null;
    const edges = P.related(state(), ref),
      m = P.meta(r),
      hit = { ...ref, record: r };
    const revisions = P.revisions(state()).filter((h) => P.same(h.ref, ref));
    ctx.modal(
      P.title(r),
      `<p class="meta">${e(P.describe(hit))}${r.deleted ? " · Retiré" : m.archived ? " · Archivé" : ""}</p>
    <div class="os-actions">${button("edit-current", "Modifier la fiche")}${button("favorite", m.favorite ? "★ Retirer des favoris" : "☆ Favori")}${button("archive", m.archived ? "Désarchiver" : "Archiver")}${button("duplicate", "Dupliquer")}</div>
    ${m.description ? `<p class="shared-prose">${e(m.description)}</p>` : ""}<p class="meta">${e(P.tags(r).join(" · "))}${m.context ? " · " + e(m.context) : ""}</p>
    <h3>Checklist</h3>${(m.checklist || []).map((x, i) => `<label class="shared-check"><input type="checkbox" data-personal-check="${i}" ${x.done ? "checked" : ""}>${e(x.text)}</label>`).join("") || '<p class="empty">Ajoute des étapes dans les propriétés avancées de la fiche.</p>'}
    <h3>Relations · ${edges.length}</h3><p class="meta">« Dépend de » signifie que cet élément attend la fin de l’autre.</p><div class="list">${
      edges
        .map((c) => {
          const outgoing = P.same(c.from, ref),
            other = outgoing ? c.to : c.from,
            target = P.resolve(state(), other);
          return `<div class="shared-edge"><div><span class="meta">${e(c.label || (outgoing ? P.relationTypes[c.type] : c.type === "depends" ? "Bloque" : c.type === "contributes" ? "Reçoit une contribution de" : "Est lié à"))}${c.inferred ? " · lien métier" : ""}</span>${button("detail", P.title(target), attrs(other), "text-button")}${target.deleted ? '<span class="tag">Retiré</span>' : P.meta(target).archived ? '<span class="tag">Archivé</span>' : ""}</div>${!c.inferred ? button("unlink", "Délier", `data-edge="${e(c.id)}"`) : ""}</div>`;
        })
        .join("") ||
      '<p class="empty">Relie ce premier objet à un projet, une personne, un budget ou un objectif.</p>'
    }</div>
    <form id="relation-form" class="form shared-fields">${select("relationType", "Relation", Object.entries(P.relationTypes), "related")}<label>Chercher un objet<input id="relation-query" type="search" placeholder="Titre ou tag"></label><label class="full">Objet à relier<select name="target" id="relation-target" required>${relationOptions("")}</select></label><button class="primary" type="submit">Relier</button></form>
    <details class="shared-fields"><summary>Historique · ${revisions.length} révision(s)</summary><p class="meta">Historique depuis la version 2.3 : jusqu’à 10 révisions par objet, 300 au total. Les exports incluent cet historique.</p>${revisions.map((h) => `<article class="shared-revision"><p><strong>${e(h.action)}</strong> · ${e(new Date(h.at).toLocaleString("fr-FR"))}</p><details><summary>Voir les valeurs</summary><pre>${e(JSON.stringify(h.after, null, 2))}</pre></details>${h.before ? button("revision", "Restaurer la version précédente", `data-revision="${e(h.id)}"`) : ""}</article>`).join("") || '<p class="empty">Aucune modification enregistrée depuis la mise à jour.</p>'}</details>`,
    );
  }
  function relationOptions(query) {
    return (
      '<option value="">Choisir un objet…</option>' +
      P.search(state(), { query })
        .filter((h) => !P.same(h, current))
        .slice(0, 100)
        .map(
          (h) =>
            `<option value="${e(P.token(h))}">${e(P.title(h.record))} · ${e(P.describe(h))}</option>`,
        )
        .join("")
    );
  }
  async function saveDetail() {
    if (await ctx.save()) {
      ctx.render();
      detail(current);
      return true;
    }
    return false;
  }
  function today() {
    const actions = P.nextActions(state())
      .filter((a) => !a.blocked.length)
      .slice(0, 3);
    const late = P.search(state(), { status: "overdue" });
    const upcoming = P.all(state()).filter(
      (h) =>
        P.visible(h.record) &&
        !P.completed(h.record, state()) &&
        h.record.due &&
        String(h.record.due) >= Q.day() &&
        String(h.record.due) <= Q.OS.addDays(Q.day(), 7),
    );
    const fav = P.search(state(), { favorite: true }).slice(0, 4);
    return `<section class="card shared-cockpit"><div class="section-head"><div><span class="eyebrow">TON FIL CONDUCTEUR</span><h2>Prochaines actions</h2></div>${button("explore", "Tout explorer")}</div><details class="shared-method"><summary>Comment sont choisies les actions ?</summary><p>Classement local selon les échéances, l’importance, la priorité et les liens. Les actions bloquées sont écartées.</p></details><div class="shared-actions">${actions.map((a) => `<article class="shared-action"><div class="section-head"><h3><button class="text-button" data-edit="tasks" data-id="${e(a.hit.id)}">${e(P.title(a.hit.record))}</button></h3><span class="tag">${a.score} pts</span></div><details><summary>Pourquoi cette action ?</summary><ul>${a.reasons.map((r) => `<li>${e(r)}</li>`).join("")}</ul></details><div class="os-actions"><button class="mini" data-toggle="task" data-id="${e(a.hit.id)}">Terminer</button><button class="mini" data-focus="start" data-id="${e(a.hit.id)}">Focus</button>${button("detail", "Relations & checklist", attrs(a.hit))}<button class="danger" data-del="tasks" data-id="${e(a.hit.id)}" aria-label="Retirer cette tâche">×</button></div></article>`).join("") || `<p class="empty">Aucune action disponible. Capture une tâche ou consulte les dépendances dans Explorer.</p>`}</div><div class="os-actions">${button("late", `${late.length} échéance(s) en retard`)}${button("upcoming", `${upcoming.length} échéance(s) dans les 7 jours`)}${button("quick", "＋ Capture rapide", "", "primary")}</div>${fav.length ? `<details><summary>Mes favoris · ${fav.length}</summary>${fav.map(hitCard).join("")}</details>` : ""}</section>`;
  }
  function dirtyDialog() {
    const form = document.querySelector(".modal form");
    if (
      !form ||
      ![
        "os-form",
        "focus-form",
        "task-form",
        "event-form",
        "note-form",
        "goal-form",
        "habit-form",
        "routine-form",
        "workout-form",
        "track-form",
        "life-form",
        "finance-form",
        "document-form",
        "asset-form",
        "automation-form",
      ].includes(form.id)
    )
      return false;
    return Array.from(form.elements).some(
      (x) =>
        x.dataset.initialValue !== undefined &&
        x.dataset.initialValue !==
          (x.type === "checkbox" ? String(x.checked) : x.value),
    );
  }
  function markClean() {
    document
      .querySelectorAll(".modal input,.modal select,.modal textarea")
      .forEach(
        (x) =>
          (x.dataset.initialValue =
            x.type === "checkbox" ? String(x.checked) : x.value),
      );
  }
  async function handleClick(t) {
    const a = t.dataset.personal;
    if (!a) return false;
    if (a === "detail") {
      if (dirtyDialog()) {
        ctx.error("Enregistre tes modifications avant d’ouvrir les relations.");
        return true;
      }
      detail({ key: t.dataset.key, id: t.dataset.id });
    } else if (a === "quick") ctx.quick();
    else if (a === "explore") search({});
    else if (a === "late") search({ status: "overdue" });
    else if (a === "upcoming")
      search({
        from: Q.day(),
        to: Q.OS.addDays(Q.day(), 7),
        status: "open",
        scope: "deadlines",
      });
    else if (a === "recent-search") {
      filter.query = state().settings.searchHistory[Number(t.dataset.index)];
      ctx.render();
    } else if (a === "clear-history") {
      state().settings.searchHistory = [];
      if (await ctx.save()) ctx.render();
    } else if (a === "view") {
      view = t.dataset.view;
      ctx.render();
    } else if (a === "reset-search") {
      filter = {};
      ctx.render();
    } else if (a === "save-search")
      ctx.modal(
        "Enregistrer la recherche",
        `<form id="saved-search-form" class="form"><label class="full">Nom<input name="name" required placeholder="Mes projets prioritaires"></label><button class="primary">Enregistrer</button></form>`,
      );
    else if (a === "load-search") {
      filter = { ...state().settings.searches[Number(t.dataset.index)].filter };
      ctx.render();
    } else if (a === "remove-search") {
      state().settings.searches.splice(Number(t.dataset.index), 1);
      if (await ctx.save()) ctx.render();
    } else if (a === "revision") {
      pendingRevision = P.revisions(state()).find(
        (h) => h.id === t.dataset.revision && P.same(h.ref, current),
      );
      ctx.modal(
        "Restaurer cette version ?",
        `<p>Les propriétés de cette fiche seront remplacées par leur état avant le ${e(new Date(pendingRevision.at).toLocaleString("fr-FR"))}. Les relations globales sont conservées. Une nouvelle révision gardera l’état actuel.</p>${button("confirm-revision", "Restaurer cette version", "", "primary")}${button("cancel-revision", "Annuler")}`,
      );
    } else if (a === "cancel-revision") detail(current);
    else if (a === "confirm-revision" && pendingRevision?.before) {
      state()[current.key] = state()[current.key].map((r) =>
        r.id === current.id ? Q.clone(pendingRevision.before) : r,
      );
      await saveDetail();
    } else if (current) {
      const r = P.resolve(state(), current);
      if (!r) return true;
      if (a === "edit-current") ctx.edit(current);
      else if (a === "favorite" || a === "archive") {
        r.personal = {
          ...P.meta(r),
          [a === "favorite" ? "favorite" : "archived"]:
            !P.meta(r)[a === "favorite" ? "favorite" : "archived"],
        };
        await saveDetail();
      } else if (a === "duplicate") {
        const copy = P.duplicate(state(), current, ctx.id());
        state()[current.key].unshift(copy);
        if (await ctx.save()) {
          ctx.render();
          detail({ key: current.key, id: copy.id });
          ctx.toast("Copie créée ; relations globales non dupliquées");
        }
      } else if (a === "unlink") {
        const c = P.connections(state()).find((c) => c.id === t.dataset.edge);
        if (c) {
          c.deleted = true;
          await saveDetail();
        }
      }
    }
    return true;
  }
  async function submit(form) {
    if (form.id === "global-search-form") {
      remember();
      if (await ctx.save()) ctx.render();
      return true;
    }
    if (form.id === "saved-search-form") {
      const name = String(new FormData(form).get("name") || "").trim();
      if (!name) {
        ctx.error("Donne un nom à cette recherche.");
        return true;
      }
      const list = state().settings.searches || [];
      if (list.some((x) => x.name === name)) {
        ctx.error("Ce nom de recherche existe déjà.");
        return true;
      }
      state().settings.searches = [...list, { name, filter: { ...filter } }];
      remember();
      if (await ctx.save()) {
        ctx.close();
        ctx.render();
        ctx.toast("Recherche enregistrée");
      }
      return true;
    }
    if (form.id !== "relation-form") return false;
    try {
      const fd = new FormData(form),
        [key, id] = JSON.parse(String(fd.get("target")));
      const edge = {
        id: ctx.id(),
        from: { ...current },
        to: { key, id },
        type: String(fd.get("relationType")),
      };
      const next = {
        ...state(),
        connections: [...P.connections(state()), edge],
      };
      P.validate(next);
      state().connections = next.connections;
      await saveDetail();
    } catch (err) {
      ctx.error(err.message);
    }
    return true;
  }
  function inputEvent(target) {
    if (target.id === "global-search") {
      filter.query = target.value;
      refreshResults();
    }
    if (target.id === "relation-query")
      document.getElementById("relation-target").innerHTML = relationOptions(
        target.value,
      );
    if (target.dataset.personalFilter && !target.name.startsWith("personal_")) {
      filter[target.dataset.personalFilter] =
        target.type === "checkbox" ? target.checked : target.value;
      refreshResults();
    }
  }
  async function changeEvent(target) {
    inputEvent(target);
    if (target.dataset.personalCheck !== undefined && current) {
      const r = P.resolve(state(), current),
        index = Number(target.dataset.personalCheck);
      r.personal = {
        ...P.meta(r),
        checklist: P.meta(r).checklist.map((x, i) =>
          i === index ? { ...x, done: target.checked } : x,
        ),
      };
      await saveDetail();
    }
  }
  return {
    fields,
    readFields,
    footer,
    search,
    searchView,
    detail,
    handleClick,
    submit,
    inputEvent,
    changeEvent,
    today,
    markClean,
    dirtyDialog,
  };
}

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
      <section class="calendar-agenda" aria-live="polite"><h3>${e(new Intl.DateTimeFormat("fr-FR", { dateStyle: "full" }).format(new Date(selectedDay + "T12:00:00")))}</h3>${list.map((x) => `<article class="shared-result"><p class="meta">${e(x.time || "Sans heure")} · ${e(x.label)} · ${e(P.describe(x.hit))}${x.end !== x.start ? ` · ${e(x.start)} → ${e(x.end)}` : ""}${P.completed(x.hit.record, ctx.state()) ? " · Terminé" : ""}</p>${refButton(x.hit, P.title(x.hit.record))}</article>`).join("") || '<p class="empty">Aucun élément pour cette journée avec ces filtres.</p>'}${button("create-event", "＋ Événement", "", "primary")}</section>
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
  async function handleClick(t) {
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
      if (await ctx.save()) {
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

Q.ready = (async function () {
  "use strict";
  var KEY = "quotidien-rebuild-2";
  var LIFE = [
    "Finances",
    "Projets de vie",
    "Apprentissage",
    "Documents",
    "Maison",
    "Nutrition",
    "Santé avancée",
    "Relations",
    "Voyages",
    "Carrière",
    "Décisions",
    "Journal",
    "Automatisations",
    "Assistant",
    "Vie numérique",
    "Sécurité",
    "Impact",
    "Foyer",
    "Progression",
    "Équilibre",
  ];
  var state, repository, committed, bootError;
  var lastExportRequested = null;
  var root = document.getElementById("app");
  var editing = null,
    planTab = "tasks",
    lastFocus = null,
    modalRoute = "",
    pendingImport = null,
    draft = null;
  try {
    repository = new Q.Durable.Repository(localStorage, window.indexedDB);
    await repository.open();
    state = await repository.load();
    committed = Q.clone(state);
  } catch (error) {
    bootError = error;
  }
  var os = createLifeOS({
    state: () => state,
    esc,
    id,
    save,
    modal,
    close: closeModal,
    render,
    toast,
    error: showError,
    download,
    listLife,
    openForm,
    commonFields: (r) => personal.fields(r),
    commonRead: (f, r) => personal.readFields(f, r),
    commonFooter: (ref) => personal.footer(ref),
    markClean: () => personal.markClean(),
    get kinds() {
      return kinds;
    },
  });
  var personal = createPersonalOS({
    state: () => state,
    esc,
    id,
    save,
    modal,
    close: closeModal,
    render,
    toast,
    error: showError,
    navigate,
    quick,
    edit: (ref) => {
      const r = Q.Personal.resolve(state, ref);
      if (r) {
        if (ref.key === "os") os.edit(r.kind, r);
        else openForm(kinds[ref.key], r);
      }
    },
  });
  var cockpit = createCockpit({
    state: () => state,
    esc,
    id,
    save,
    render,
    navigate,
    toast,
    createEvent: (date) => {
      openForm("event");
      document.querySelector("#event-form [name=date]").value = date;
      personal.markClean();
    },
  });
  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  var editorDrafts = createDrafts({
    repository,
    state: () => committed,
    dirty: () => personal.dirtyDialog(),
    error: showError,
    download,
    open: (kind, recordId) => {
      if (kind.startsWith("os:"))
        os.edit(
          kind.slice(3),
          state.os.find((x) => x.id === recordId),
        );
      else {
        const key = Object.keys(kinds).find((k) => kinds[k] === kind);
        if (key)
          openForm(
            kind,
            state[key].find((x) => x.id === recordId),
          );
      }
    },
  });
  var focusUI = createFocus({
    state: () => state,
    esc,
    id,
    save,
    modal,
    close: closeModal,
    render,
    toast,
    error: showError,
    markClean: () => personal.markClean(),
    review: (body, title) => {
      openForm("note");
      document.querySelector('#note-form [name="title"]').value =
        title + " · " + day();
      document.querySelector('#note-form [name="body"]').value = body;
      editorDrafts.capture();
    },
  });
  function day() {
    return Q.day();
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  async function save(checkpoint) {
    try {
      state = await repository.commit(state, !!checkpoint);
      committed = Q.clone(state);
      draft = null;
      if (submittingEditor) await editorDrafts.clear();
      return true;
    } catch (error) {
      draft = Q.clone(state);
      state = Q.clone(committed);
      showError(
        "Sauvegarde impossible. " +
          error.message +
          " La saisie reste dans le formulaire.",
      );
      return false;
    }
  }
  function showError(message) {
    var parent =
      document.querySelector(".modal") ||
      document.querySelector(".shell") ||
      root;
    var box = parent.querySelector("[role=alert]");
    if (!box) {
      box = document.createElement("p");
      box.setAttribute("role", "alert");
      box.className = "error";
      parent.prepend(box);
    }
    box.textContent = message;
  }
  function download(text, name) {
    var blob = new Blob([text], { type: "application/json" }),
      link = document.createElement("a"),
      url = URL.createObjectURL(blob);
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }
  function recovery(error) {
    root.innerHTML =
      '<main class="shell recovery"><h1>Retrouvons tes données</h1><p>Le chargement a échoué. Aucune donnée existante n’a été remplacée.</p><p role="alert"></p><div class="list"><button id="raw-export" class="primary">Exporter les données brutes</button><button id="previous-export" class="mini">Exporter la copie précédente</button><button id="retry" class="mini">Réessayer le chargement</button></div><p>Conserve les exports avant toute réparation.</p></main>';
    root.querySelector("[role=alert]").textContent = error.message;
    root.querySelector("#retry").onclick = function () {
      location.reload();
    };
    var legacyButton = document.createElement("button");
    legacyButton.id = "legacy-export";
    legacyButton.className = "mini";
    legacyButton.textContent = "Exporter la copie avant migration";
    root.querySelector(".list").appendChild(legacyButton);
    ["raw-export", "previous-export", "legacy-export"].forEach(function (name) {
      root.querySelector("#" + name).onclick = async function () {
        try {
          var raw =
            name === "legacy-export"
              ? localStorage.getItem(KEY)
              : await repository.read(
                  name === "raw-export" ? "current" : Q.BACKUP_KEY,
                );
          if (raw === null) throw new Error("Aucune copie disponible.");
          download(raw, "quotidien-recuperation-" + name + ".json");
        } catch (err) {
          showError(err.message);
        }
      };
    });
  }
  function toast(t) {
    var e = document.createElement("div");
    e.className = "toast";
    e.setAttribute("role", "status");
    e.textContent = t;
    document.body.appendChild(e);
    setTimeout(function () {
      e.remove();
    }, 1700);
  }
  function fmt(d) {
    try {
      return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
      }).format(new Date(d + "T12:00:00"));
    } catch (e) {
      return esc(d);
    }
  }
  function active(arr) {
    return arr.filter(function (x) {
      return Q.Personal.visible(x);
    });
  }
  function shell(content) {
    return (
      '<div class="shell"><header class="topbar"><div><div class="brand">QUOTIDIEN <span>2.7</span></div><div class="date">' +
      esc(
        new Intl.DateTimeFormat("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date()),
      ) +
      '</div></div><div class="top-actions"><button class="icon" aria-label="Rechercher" data-action="search">⌕</button><button class="icon" aria-label="Ajouter" data-action="quick">＋</button><button class="icon" aria-label="Réglages" data-action="settings">⚙</button></div></header>' +
      content +
      "</div>" +
      nav() +
      '<div id="modal"></div>'
    );
  }
  function nav() {
    var items = [
      ["today", "⌂", "Aujourd’hui"],
      ["plan", "▦", "Planifier"],
      ["notes", "◇", "Notes"],
      ["tracking", "↗", "Suivi"],
      ["life", "✦", "Life OS"],
      ["wave", "◆", "Pilotage"],
    ];
    return (
      '<nav class="bottom"><div class="inner">' +
      items
        .map(function (i) {
          return (
            '<button class="nav ' +
            (state.screen === i[0] ? "active" : "") +
            '" data-screen="' +
            i[0] +
            '"><span>' +
            i[1] +
            "</span>" +
            i[2] +
            "</button>"
          );
        })
        .join("") +
      "</div></nav>"
    );
  }
  function render() {
    document.documentElement.dataset.theme = state.settings.theme;
    var c =
      state.screen === "intelligence"
        ? cockpit.intelligence()
        : state.screen === "explore"
          ? personal.searchView()
          : state.screen === "today"
            ? todayView()
            : state.screen === "plan"
              ? planView()
              : state.screen === "notes"
                ? notesView()
                : state.screen === "tracking"
                  ? trackingView()
                  : state.screen === "life"
                    ? lifeView()
                    : waveView();
    document.body.classList.remove("modal-open");
    root.innerHTML = shell(c);
    decorateForms();
    root.querySelectorAll(".nav").forEach(function (button) {
      button.setAttribute(
        "aria-current",
        button.dataset.screen === state.screen ? "page" : "false",
      );
    });
    if (state.screen === "plan") {
      root.querySelectorAll("[data-plan-section]").forEach(function (section) {
        section.hidden = section.dataset.planSection !== planTab;
      });
      root.querySelectorAll("[data-tab]").forEach(function (button) {
        button.classList.toggle("active", button.dataset.tab === planTab);
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.tab === planTab),
        );
      });
    }
  }
  function todayView() {
    var open = active(state.tasks).filter(function (t) {
      return !t.done;
    });
    var due = open.filter(function (t) {
      return t.due === day();
    });
    var ev = active(state.events)
      .filter(function (e) {
        return e.date === day();
      })
      .sort(function (a, b) {
        return (a.time || "").localeCompare(b.time || "");
      });
    var doneWeek = active(state.tasks).filter(function (t) {
      return t.done;
    }).length;
    var focus = Q.focusMinutes(state);
    return (
      '<section class="hero"><span class="eyebrow">AUJOURD’HUI</span><h1>Bonjour Raphaël</h1><p>' +
      (ev[0]
        ? "Aujourd’hui : <strong>" +
          esc(ev[0].time || "Journée") +
          " · " +
          esc(ev[0].title) +
          "</strong>"
        : "Aucun événement prévu aujourd’hui.") +
      '</p><button class="primary" data-screen="plan">Planifier</button></section>' +
      personal.today() +
      (!lastExportRequested ||
      Date.now() - Date.parse(lastExportRequested) > 30 * 86400000
        ? '<section class="card"><h2>Une copie hors du navigateur</h2><p class="meta">Aucun export demandé depuis 30 jours. Une sauvegarde externe protège contre la perte du stockage local.</p><button class="mini" data-action="export">Exporter mes données</button></section>'
        : "") +
      focusUI.panel() +
      cockpit.summary() +
      '<section class="grid stat-grid"><article class="card stat"><strong>' +
      doneWeek +
      '</strong><span>tâches terminées</span></article><article class="card stat"><strong>' +
      focus +
      '</strong><span>min focus</span></article><article class="card stat"><strong>' +
      active(state.workouts).length +
      '</strong><span>séances sport</span></article><article class="card stat"><strong>' +
      due.length +
      '</strong><span>échéances aujourd’hui</span></article><article class="card wide"><div class="section-head"><div><span class="eyebrow">CHRONOLOGIE</span><h2>Ma journée</h2></div><button class="mini" data-action="add-event">＋ Événement</button></div>' +
      listEvents(ev) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">HABITUDES</span><h2>À cocher</h2></div></div>' +
      listHabits(active(state.habits)) +
      '</article><article class="card wide"><div class="section-head"><div><span class="eyebrow">OBJECTIFS</span><h2>Cap</h2></div><button class="mini" data-action="add-goal">＋</button></div>' +
      listGoals(active(state.goals)) +
      "</article></section>"
    );
  }
  function planView() {
    return (
      '<div class="page-title"><div><span class="eyebrow">ORGANISER</span><h1>Planifier</h1></div><button class="primary" data-action="quick">＋ Ajouter</button></div><div class="tabs"><button class="active" data-tab="tasks">Tâches</button><button data-tab="agenda">Agenda</button><button data-tab="calendar">Calendrier</button><button data-tab="goals">Objectifs</button><button data-tab="routines">Routines</button></div><section class="card" data-plan-section="tasks"><form class="form" id="inline-task-form"><input name="title" class="full" placeholder="Nouvelle tâche" required><input name="due" type="date"><select name="project"><option>Personnel</option><option>Travail</option><option>Santé</option><option>Finances</option></select><label><input name="important" type="checkbox"> Important</label><label><input name="urgent" type="checkbox"> Urgente</label><button class="primary">Ajouter</button></form></section><section class="card" data-plan-section="tasks"><div class="section-head"><div><span class="eyebrow">MES TÂCHES</span><h2>' +
      active(state.tasks).filter(function (t) {
        return !t.done;
      }).length +
      " ouvertes</h2></div></div>" +
      listTasks(active(state.tasks)) +
      '</section><section class="card" data-plan-section="agenda"><div class="section-head"><div><span class="eyebrow">AGENDA</span><h2>Événements</h2></div><button class="mini" data-action="add-event">＋</button></div>' +
      listEvents(
        active(state.events).sort(function (a, b) {
          return String(a.date || "").localeCompare(String(b.date || ""));
        }),
      ) +
      '</section><section class="card" data-plan-section="routines"><div class="section-head"><div><span class="eyebrow">ROUTINES</span><h2>Mes séquences</h2></div><button class="mini" data-action="add-routine">＋</button></div>' +
      listRoutines(active(state.routines)) +
      '</section><section class="card" data-plan-section="goals"><div class="section-head"><h2>Objectifs</h2><button class="mini" data-action="add-goal">＋ Objectif</button></div>' +
      listGoals(active(state.goals)) +
      "</section>" +
      cockpit.calendar()
    );
  }
  function notesView() {
    return (
      '<div class="page-title"><div><span class="eyebrow">SECOND CERVEAU</span><h1>Notes</h1></div><button class="primary" data-action="add-note">＋ Note</button></div><section class="card"><form class="form" id="inline-note-form"><input name="title" placeholder="Titre" required><input name="tags" placeholder="Tags"><textarea name="body" class="full" placeholder="Écris en Markdown ou en texte libre…"></textarea><button class="primary">Enregistrer</button></form></section><section class="grid">' +
      (active(state.notes).length
        ? ""
        : '<p class="empty">Conserve ici tes idées et informations. Crée ta première note avec « + Note ».</p>') +
      active(state.notes)
        .map(function (n) {
          return (
            '<article class="card"><div class="section-head"><div><span class="eyebrow">' +
            esc(n.tags || "NOTE") +
            '</span><h2><button class="text-button" data-edit="notes" data-id="' +
            esc(n.id) +
            '">' +
            esc(n.title) +
            '</button></h2></div><button class="danger" data-del="notes" data-id="' +
            esc(n.id) +
            '">×</button></div><p class="meta">' +
            esc(n.body).replace(/\n/g, "<br>") +
            "</p></article>"
          );
        })
        .join("") +
      "</section>"
    );
  }
  function trackingView() {
    return (
      '<div class="page-title"><div><span class="eyebrow">SUIVI</span><h1>Santé & progression</h1></div><button class="primary" data-action="track">＋ Mesure</button></div><section class="grid"><article class="card"><div class="section-head"><div><span class="eyebrow">HABITUDES</span><h2>Régularité</h2></div><button class="mini" data-action="add-habit">＋</button></div>' +
      listHabits(active(state.habits)) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">SPORT</span><h2>Séances</h2></div><button class="mini" data-action="add-workout">＋</button></div>' +
      listWorkouts(active(state.workouts)) +
      '</article><article class="card wide"><div class="section-head"><div><span class="eyebrow">SANTÉ</span><h2>Dernières mesures</h2></div><button class="mini" data-action="track">＋</button></div><div class="health-grid">' +
      active(state.health)
        .slice(0, 8)
        .map(function (h) {
          return (
            '<div class="kpi"><strong>' +
            esc(h.value) +
            " " +
            esc(h.unit || "") +
            "</strong><span>" +
            esc(h.kind) +
            " · " +
            fmt(h.date) +
            "</span></div>"
          );
        })
        .join("") +
      "</div></article></section>"
    );
  }
  function lifeView() {
    return os.view();
  }
  function waveView() {
    return (
      cockpit.summary() +
      '<div class="page-title"><div><span class="eyebrow">PILOTAGE</span><h1>Pilotage avancé</h1></div></div><section class="grid"><article class="card"><div class="section-head"><div><span class="eyebrow">PROJETS DE VIE</span><h2>Objectifs</h2></div><button class="mini" data-action="add-goal">＋</button></div>' +
      listGoals(active(state.goals)) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">FINANCES</span><h2>' +
      money(balance()) +
      '</h2></div><button class="mini" data-action="finance">＋</button></div>' +
      listFinance(active(state.finances)) +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">DOCUMENTS</span><h2>Échéances</h2></div><button class="mini" data-action="document">＋</button></div>' +
      listGeneric(state.documents, "documents") +
      '</article><article class="card"><div class="section-head"><div><span class="eyebrow">MAISON</span><h2>Équipements</h2></div><button class="mini" data-action="asset">＋</button></div>' +
      listGeneric(state.assets, "assets") +
      '</article><article class="card wide"><div class="section-head"><div><span class="eyebrow">AUTOMATISATIONS</span><h2>Idées de règles</h2></div><button class="mini" data-action="automation">＋</button></div>' +
      listGeneric(state.automations, "automations") +
      "</article></section>"
    );
  }
  function listTasks(arr) {
    if (!arr.length) return '<p class="empty">Aucune tâche.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (t) {
          return (
            '<article class="item ' +
            (t.done ? "done" : "") +
            '"><button class="check" data-toggle="task" data-id="' +
            esc(t.id) +
            '">' +
            (t.done ? "✓" : "") +
            '</button><div><div class="title"><button class="text-button" data-edit="tasks" data-id="' +
            esc(t.id) +
            '">' +
            esc(t.title) +
            '</button></div><div class="meta">' +
            esc(t.project || "Personnel") +
            (t.due ? " · " + fmt(t.due) : "") +
            (t.urgent ? " · 🔥 urgente" : "") +
            (t.important ? " · ⭐ importante" : "") +
            '</div></div><button class="danger" data-del="tasks" data-id="' +
            esc(t.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listEvents(arr) {
    if (!arr.length) return '<p class="empty">Aucun événement.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (e) {
          return (
            '<article class="item"><div class="check">' +
            esc(e.time || "•") +
            '</div><div><div class="title"><button class="text-button" data-edit="events" data-id="' +
            esc(e.id) +
            '">' +
            esc(e.title) +
            '</button></div><div class="meta">' +
            fmt(e.date) +
            " · " +
            esc(e.category || "Personnel") +
            '</div></div><button class="danger" data-del="events" data-id="' +
            esc(e.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listHabits(arr) {
    if (!arr.length) return '<p class="empty">Aucune habitude.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (h) {
          var done = !!(h.days && h.days[day()]);
          return (
            '<article class="item ' +
            (done ? "done" : "") +
            '"><button class="check" data-toggle="habit" data-id="' +
            esc(h.id) +
            '">' +
            (done ? "✓" : "") +
            '</button><div><div class="title"><button class="text-button" data-edit="habits" data-id="' +
            esc(h.id) +
            '">' +
            esc(h.name) +
            '</button></div><div class="meta">Objectif ' +
            esc(h.target || 1) +
            " " +
            esc(h.unit || "fois") +
            '</div></div><button class="danger" data-del="habits" data-id="' +
            esc(h.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listGoals(arr) {
    if (!arr.length) return '<p class="empty">Aucun objectif.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (g) {
          return (
            '<article class="item"><div class="check">' +
            Math.round(Q.Connected.progress(state, g)) +
            '%</div><div><div class="title"><button class="text-button" data-edit="goals" data-id="' +
            esc(g.id) +
            '">' +
            esc(g.title) +
            '</button></div><div class="progress"><i style="width:' +
            Math.max(0, Math.min(100, Q.Connected.progress(state, g))) +
            '%"></i></div><div class="meta">' +
            esc(g.area || "Personnel") +
            (g.date ? " · " + fmt(g.date) : "") +
            savingsSummary(g) +
            '</div></div><button class="danger" data-del="goals" data-id="' +
            esc(g.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listRoutines(arr) {
    if (!arr.length) return '<p class="empty">Aucune routine.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (r) {
          return (
            '<article class="item"><div class="check">↻</div><div><div class="title"><button class="text-button" data-edit="routines" data-id="' +
            esc(r.id) +
            '">' +
            esc(r.name) +
            '</button></div><div class="meta">' +
            esc(r.time || "Sans horaire") +
            " · " +
            esc(r.steps || "") +
            '</div></div><button class="danger" data-del="routines" data-id="' +
            esc(r.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function savingsSummary(goal) {
    const value = Q.Connected.savings(state, goal);
    if (!value) return "";
    return (
      " · " +
      esc(value.current.toFixed(2)) +
      " / " +
      esc(value.target.toFixed(2)) +
      " € · " +
      (value.months === 0
        ? "Cible atteinte"
        : value.months === null
          ? "Renseigne un versement mensuel pour simuler la durée"
          : "Simulation : " +
            value.months +
            " mois, à versements constants, sans intérêts ni retraits")
    );
  }
  function listWorkouts(arr) {
    if (!arr.length) return '<p class="empty">Aucune séance.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (w) {
          return (
            '<article class="item"><div class="check">↗</div><div><div class="title"><button class="text-button" data-edit="workouts" data-id="' +
            esc(w.id) +
            '">' +
            esc(w.type) +
            '</button></div><div class="meta">' +
            fmt(w.date) +
            " · " +
            esc(w.minutes) +
            " min · effort " +
            esc(w.effort) +
            '/10</div></div><button class="danger" data-del="workouts" data-id="' +
            esc(w.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listLife(arr) {
    if (!arr.length) return '<p class="empty">Aucune capture.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (x) {
          return (
            '<article class="item"><div class="check">✦</div><div><div class="title"><button class="text-button" data-edit="life" data-id="' +
            esc(x.id) +
            '">' +
            esc(x.title) +
            '</button></div><div class="meta">' +
            esc(x.domain) +
            " · " +
            esc(x.status || "En cours") +
            '</div></div><button class="danger" data-del="life" data-id="' +
            esc(x.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listFinance(arr) {
    if (!arr.length) return '<p class="empty">Aucun mouvement.</p>';
    return (
      '<div class="list">' +
      arr
        .map(function (x) {
          return (
            '<article class="item"><div class="check">€</div><div><div class="title"><button class="text-button" data-edit="finances" data-id="' +
            esc(x.id) +
            '">' +
            esc(x.label) +
            '</button></div><div class="meta">' +
            fmt(x.date) +
            " · " +
            esc(x.category) +
            "</div></div><strong>" +
            money(x.amount) +
            '</strong><button class="danger" data-del="finances" data-id="' +
            esc(x.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function listGeneric(arr, key) {
    if (!active(arr).length) return '<p class="empty">Aucun élément.</p>';
    return (
      '<div class="list">' +
      active(arr)
        .map(function (x) {
          return (
            '<article class="item"><div class="check">•</div><div><div class="title"><button class="text-button" data-edit="' +
            key +
            '" data-id="' +
            esc(x.id) +
            '">' +
            esc(x.title) +
            '</button></div><div class="meta">' +
            esc(x.category || "Général") +
            (x.date ? " · " + fmt(x.date) : "") +
            '</div></div><button class="danger" data-del="' +
            key +
            '" data-id="' +
            esc(x.id) +
            '">×</button></article>'
          );
        })
        .join("") +
      "</div>"
    );
  }
  function balance() {
    return state.finances
      .filter((x) => !x.deleted)
      .reduce(function (s, x) {
        return s + (+x.amount || 0);
      }, 0);
  }
  function money(v) {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(+v || 0);
  }
  function dismissModal() {
    if (!personal.dirtyDialog()) {
      closeModal();
      return;
    }
    let prompt = document.querySelector(".discard-prompt");
    if (!prompt) {
      prompt = document.createElement("div");
      prompt.className = "discard-prompt";
      prompt.setAttribute("role", "group");
      prompt.setAttribute("aria-label", "Saisie non enregistrée");
      prompt.innerHTML =
        '<p>Cette saisie n’est pas enregistrée.</p><div class="os-actions"><button class="primary" data-keep-draft="1">Continuer la saisie</button><button class="danger" data-discard-draft="1">Abandonner les modifications</button></div>';
      document.querySelector(".modal header").after(prompt);
    }
    prompt.querySelector("button").focus();
  }
  function closeModal() {
    document.getElementById("modal").innerHTML = "";
    document.body.classList.remove("modal-open");
    root.querySelector(".shell")?.removeAttribute("inert");
    root.querySelector(".bottom")?.removeAttribute("inert");
    editing = null;
    pendingImport = null;
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }
  function modal(title, body) {
    if (!document.querySelector(".modal")) {
      lastFocus = document.activeElement;
      modalRoute = location.hash;
    }
    editing = null;
    document.getElementById("modal").innerHTML =
      '<div class="modal-wrap"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><header><h2 id="modal-title">' +
      esc(title) +
      '</h2><button class="icon" aria-label="Fermer" data-close="1">×</button></header>' +
      body +
      "</section></div>";
    document.body.classList.add("modal-open");
    root.querySelector(".shell").setAttribute("inert", "");
    root.querySelector(".bottom").setAttribute("inert", "");
    decorateForms();
    (
      document.querySelector(".modal input,.modal select,.modal textarea") ||
      document.querySelector(".modal button")
    )?.focus();
  }
  function form(fields, idf) {
    return (
      '<form class="form" id="' +
      idf +
      '">' +
      fields +
      '<button class="primary">Enregistrer</button></form>'
    );
  }
  function quick() {
    modal(
      "Capture rapide",
      '<div class="quick-grid">' +
        [
          ["task", "Tâche"],
          ["event", "Événement"],
          ["finance", "Dépense / revenu"],
          ["note", "Note"],
          ["workout", "Séance"],
          ["habit", "Habitude"],
          ["goal", "Objectif"],
          ["routine", "Routine"],
          ["document", "Document"],
          ["life", "Idée / capture libre"],
        ]
          .map(function (x) {
            return (
              '<button class="mini" data-create="' +
              x[0] +
              '">' +
              x[1] +
              "</button>"
            );
          })
          .join("") +
        '</div><h3>Fiches spécialisées</h3><div class="quick-grid"><button class="mini" data-os="new" data-type="project">Projet</button><button class="mini" data-os="new" data-type="contact">Contact</button><button class="mini" data-os="new" data-type="journal">Journal</button><button class="mini" data-os="new" data-type="trip">Voyage</button></div>',
    );
  }
  function settings() {
    modal(
      "Réglages & données",
      '<div class="list">' +
        editorDrafts.controls() +
        '<button class="primary" data-action="export">Exporter mes données</button><button class="mini" data-action="import">Importer une sauvegarde</button><button class="mini" data-action="trash">Éléments retirés</button><button class="mini" data-action="restore">Récupérer la copie précédente</button><button class="mini" data-action="checkpoint">Récupérer avant le dernier import</button><button class="mini" data-action="theme">Passer au thème ' +
        (state.settings.theme === "dark" ? "clair" : "sombre") +
        "</button>" +
        (draft
          ? '<button class="mini" data-action="export-draft">Exporter la saisie non enregistrée</button>'
          : "") +
        '<button class="mini" data-action="clear">Réinitialiser les données</button><p class="meta">Tes données restent dans ce navigateur. Exporte régulièrement une sauvegarde pour les conserver ailleurs. Version ' +
        Q.RELEASE +
        (lastExportRequested
          ? " · Dernier téléchargement demandé : " +
            esc(lastExportRequested.slice(0, 10)) +
            " (vérifie le fichier téléchargé)"
          : " · Aucun export demandé") +
        '.</p><p class="meta">Stockage : ' +
        esc(repository.mode) +
        '. Une copie locale ne remplace pas une sauvegarde externe.</p><button class="mini" data-action="persist-storage">Demander la conservation du stockage local</button></div>',
    );
  }
  function importPreview(next) {
    modal(
      "Vérifier la restauration",
      "<p>Cette sauvegarde remplacera les données actuelles. Une copie de celles-ci sera conservée avant le remplacement.</p><p>" +
        esc(Q.summary(next)) +
        '</p><button class="primary" data-action="confirm-import">Restaurer cette sauvegarde</button>',
    );
    pendingImport = next;
  }
  function trash() {
    var rows = [];
    Q.collections.forEach(function (key) {
      state[key]
        .filter(function (x) {
          return x.deleted;
        })
        .forEach(function (x) {
          rows.push(
            '<div class="item"><div><strong>' +
              esc(
                x.title || x.name || x.label || x.type || x.kind || "Élément",
              ) +
              '</strong><p class="meta">' +
              esc(collectionLabels[key]) +
              '</p></div><button class="mini" data-restore="' +
              key +
              '" data-id="' +
              esc(x.id) +
              '">Rétablir</button></div>',
          );
        });
    });
    modal(
      "Éléments retirés",
      '<p>Rétablis un élément sans remplacer les autres données.</p><div class="list">' +
        (rows.join("") || '<p class="empty">Aucun élément retiré.</p>') +
        "</div>",
    );
  }
  function search() {
    personal.search();
  }
  var collectionLabels = {
    os: "Life OS spécialisé",
    tasks: "Tâches",
    events: "Événements",
    notes: "Notes",
    habits: "Habitudes",
    routines: "Routines",
    goals: "Objectifs",
    workouts: "Séances",
    health: "Mesures",
    life: "Life OS",
    finances: "Finances",
    documents: "Documents",
    assets: "Équipements",
    automations: "Idées d’automatisation",
  };
  var kinds = {
    tasks: "task",
    events: "event",
    notes: "note",
    habits: "habit",
    routines: "routine",
    goals: "goal",
    workouts: "workout",
    health: "track",
    life: "life",
    finances: "finance",
    documents: "document",
    assets: "asset",
    automations: "automation",
  };
  function decorateForms() {
    var labels = {
      title: "Titre",
      name: "Nom",
      label: "Libellé",
      date: "Date",
      due: "Échéance",
      time: "Heure",
      category: "Catégorie",
      project: "Projet / liste",
      area: "Domaine",
      progress: "Progression (%)",
      target: "Objectif",
      unit: "Unité",
      type: "Sport",
      minutes: "Durée (minutes)",
      effort: "Effort (1 à 10)",
      kind: "Mesure",
      value: "Valeur",
      domain: "Domaine de vie",
      status: "Statut",
      body: "Contenu",
      tags: "Tags",
      details: "Détails",
      steps: "Étapes",
      amount: "Montant (€)",
      important: "Important",
      urgent: "Urgente",
    };
    root.querySelectorAll("input,textarea,select").forEach(function (input) {
      if (input.closest("label")) return;
      var label = document.createElement("label");
      label.textContent =
        labels[input.name] || input.placeholder || "Recherche";
      label.className = input.classList.contains("full") ? "full" : "";
      input.before(label);
      label.appendChild(input);
    });
    root.querySelectorAll("[data-del]").forEach(function (button) {
      button.setAttribute("aria-label", "Supprimer cet élément");
    });
    root.querySelectorAll("[data-toggle]").forEach(function (button) {
      button.setAttribute(
        "aria-label",
        button.dataset.toggle === "task"
          ? "Terminer ou rouvrir la tâche"
          : "Cocher ou décocher l’habitude",
      );
      button.setAttribute("aria-pressed", String(button.textContent === "✓"));
    });
  }
  function openForm(kind, extra) {
    var map = {
      task: [
        "Nouvelle tâche",
        '<input name="title" required><input name="due" type="date"><input name="project" value="Personnel"><label><input name="important" type="checkbox"> Important</label><label><input name="urgent" type="checkbox"> Urgente</label><textarea name="details" class="full"></textarea>',
      ],
      note: [
        "Nouvelle note",
        '<input name="title" required><input name="tags"><textarea name="body" class="full"></textarea>',
      ],
      event: [
        "Nouvel événement",
        '<input name="title" placeholder="Titre" required><input name="date" type="date" value="' +
          day() +
          '"><input name="time" type="time"><select name="category"><option>Personnel</option><option>Travail</option><option>Santé</option></select>',
      ],
      goal: [
        "Nouvel objectif",
        '<input name="title" placeholder="Objectif" required><select name="area"><option>Personnel</option><option>Travail</option><option>Santé</option><option>Finances</option><option>Apprentissage</option></select><input name="date" type="date"><input name="progress" type="number" min="0" max="100" value="0">',
      ],
      habit: [
        "Nouvelle habitude",
        '<input name="name" placeholder="Habitude" required><input name="target" type="number" min="1" value="1"><input name="unit" value="fois"><input name="time" type="time">',
      ],
      routine: [
        "Nouvelle routine",
        '<input name="name" placeholder="Routine" required><input name="time" type="time"><textarea name="steps" class="full" placeholder="Étapes séparées par des virgules"></textarea>',
      ],
      workout: [
        "Nouvelle séance",
        '<input name="type" placeholder="Type de séance" required><input name="date" type="date" value="' +
          day() +
          '"><input name="minutes" type="number" min="1" value="45"><input name="effort" type="number" min="1" max="10" value="6">',
      ],
      track: [
        "Nouvelle mesure",
        '<select name="kind"><option>Poids</option><option>Sommeil</option><option>Hydratation</option><option>Humeur</option><option>Énergie</option><option>Stress</option><option>Focus</option></select><input name="value" type="number" step="0.1" required><input name="unit" placeholder="kg, h, ml, /5, min"><input name="date" type="date" value="' +
          day() +
          '">',
      ],
      life: [
        "Capture Life OS",
        '<select name="domain">' +
          LIFE.map(function (x) {
            return "<option>" + esc(x) + "</option>";
          }).join("") +
          '</select><input name="title" placeholder="Élément" required><select name="status"><option>Idée</option><option>En cours</option><option>En attente</option><option>Terminé</option></select><textarea name="details" class="full" placeholder="Contexte et prochaine étape"></textarea>',
      ],
      finance: [
        "Mouvement financier",
        '<input name="label" placeholder="Libellé" required><input name="amount" type="number" step="0.01" placeholder="Positif = revenu, négatif = dépense" required><input name="category" placeholder="Catégorie"><input name="date" type="date" value="' +
          day() +
          '">',
      ],
      document: [
        "Document",
        '<input name="title" placeholder="Nom du document" required><input name="category" placeholder="Catégorie"><input name="date" type="date"><textarea name="details" class="full" placeholder="Notes, emplacement, renouvellement"></textarea>',
      ],
      asset: [
        "Maison / équipement",
        '<input name="title" placeholder="Équipement ou entretien" required><input name="category" placeholder="Catégorie"><input name="date" type="date"><textarea name="details" class="full" placeholder="Garantie, entretien, notes"></textarea>',
      ],
      automation: [
        "Idée d’automatisation",
        '<input name="title" placeholder="Nom de la règle" required><input name="category" placeholder="Déclencheur"><textarea name="details" class="full" placeholder="Décrire une idée (aucune exécution automatique)"></textarea>',
      ],
    };
    if (kind === "task")
      map.task[1] +=
        '<label>Durée estimée (min)<input name="estimate" type="number" min="1" value="25"></label><label>Fiche Life OS liée<select name="osSourceId"><option value="">Aucune</option>' +
        state.os
          .filter((x) => !x.deleted || x.id === extra?.osSourceId)
          .map(
            (x) =>
              '<option value="' + esc(x.id) + '">' + esc(x.title) + "</option>",
          )
          .join("") +
        "</select></label>";
    if (kind === "finance")
      map.finance[1] +=
        '<label>Compte<select name="accountId"><option value="">Non affecté</option>' +
        state.os
          .filter(
            (x) =>
              x.kind === "account" && (!x.deleted || x.id === extra?.accountId),
          )
          .map(
            (x) =>
              '<option value="' + esc(x.id) + '">' + esc(x.title) + "</option>",
          )
          .join("") +
        "</select></label>";
    var m = map[kind];
    function linkedSelect(name, label, type) {
      return (
        "<label>" +
        label +
        '<select name="' +
        name +
        '"><option value="">Non lié</option>' +
        state.os
          .filter(
            (r) => r.kind === type && (!r.deleted || r.id === extra?.[name]),
          )
          .map(
            (r) =>
              '<option value="' + esc(r.id) + '">' + esc(r.title) + "</option>",
          )
          .join("") +
        "</select></label>"
      );
    }
    if (kind === "finance" || kind === "goal")
      map[kind][1] += linkedSelect("projectId", "Projet lié", "project");
    if (kind === "goal")
      map.goal[1] +=
        '<details class="full"><summary>Objectif d’épargne connecté</summary><p class="meta">Le solde total du compte détermine la progression. Un seul objectif actif par compte. Sans compte, la progression reste manuelle.</p>' +
        linkedSelect(
          "savingsAccountId",
          "Compte réservé à cet objectif",
          "account",
        ) +
        '<label>Cible (€)<input name="savingsTarget" type="number" min="0" step="0.01"></label><label>Versement mensuel simulé (€)<input name="monthlyContribution" type="number" min="0" step="0.01"></label></details>';
    if (!m) return;
    const collection = Object.keys(kinds).find((key) => kinds[key] === kind);
    modal(
      extra ? "Modifier · " + m[0] : m[0],
      form(m[1] + personal.fields(extra || {}, collection), kind + "-form") +
        (extra ? personal.footer({ key: collection, id: extra.id }) : ""),
    );
    if (extra) {
      editing = {
        key: Object.keys(kinds).find(function (key) {
          return kinds[key] === kind;
        }),
        id: extra.id,
      };
      var f = document.getElementById(kind + "-form");
      Object.keys(extra).forEach(function (key) {
        var input = f.elements.namedItem(key);
        if (!input) return;
        if (input.type === "checkbox") input.checked = !!extra[key];
        else input.value = extra[key] == null ? "" : String(extra[key]);
      });
    }
    personal.markClean();
    const draftForm = document.getElementById(kind + "-form");
    draftForm.dataset.draftKind = kind;
    draftForm.dataset.draftId = extra?.id || "";
  }
  var busy = false;
  var submittingEditor = false;
  function on(type, handler) {
    root.addEventListener(type, function (event) {
      if (
        type === "click" &&
        !event.target.closest?.("button") &&
        !event.target.classList?.contains("modal-wrap")
      )
        return;
      if (type === "submit") event.preventDefault();
      if (
        type === "click" &&
        event.target.closest?.("button")?.type === "submit" &&
        event.target.closest("button").form
      )
        return;
      if (busy) return;
      busy = true;
      root.setAttribute("aria-busy", "true");
      const enabledButtons = Array.from(
        root.querySelectorAll("button:not(:disabled)"),
      );
      enabledButtons.forEach((button) => {
        button.disabled = true;
      });
      Q.pending = Promise.resolve()
        .then(() => handler(event))
        .catch((err) => showError(err.message))
        .finally(() => {
          submittingEditor = false;
          busy = false;
          enabledButtons.forEach((button) => {
            if (button.isConnected) button.disabled = false;
          });
          root.removeAttribute("aria-busy");
        });
    });
  }
  on("click", async function (e) {
    if (!(e.target instanceof Element)) return;
    // The backdrop closes only when it is the direct target, never for an input inside it.
    if (e.target.classList.contains("modal-wrap")) {
      dismissModal();
      return;
    }
    var t = e.target.closest("button");
    if (!t) return;
    if (t.dataset.discardDraft) {
      await editorDrafts.clear();
      closeModal();
      return;
    }
    if (t.dataset.keepDraft) {
      t.closest(".discard-prompt").remove();
      document
        .querySelector(".modal input,.modal textarea,.modal select")
        ?.focus();
      return;
    }
    if (t.dataset.close) {
      dismissModal();
      return;
    }
    if (t.dataset.screen) {
      navigate(t.dataset.screen);
      return;
    }
    if (t.dataset.tab) {
      planTab = t.dataset.tab;
      render();
      return;
    }
    if (t.dataset.create) {
      openForm(t.dataset.create);
      if (t.dataset.domain) {
        var select = document.querySelector(".modal [name=domain]");
        if (select) select.value = t.dataset.domain;
      }
      return;
    }
    if (await cockpit.handleClick(t)) return;
    if (await focusUI.click(t)) return;
    if (await personal.handleClick(t)) return;
    if (await os.handleClick(t)) return;
    if (t.dataset.edit === "os") {
      var osRecord = state.os.find((x) => x.id === t.dataset.id);
      if (osRecord) os.edit(osRecord.kind, osRecord);
      return;
    }
    if (t.dataset.edit) {
      var record = state[t.dataset.edit]?.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (record) openForm(kinds[t.dataset.edit], record);
      return;
    }
    if (t.dataset.restore) {
      var removed = state[t.dataset.restore]?.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (removed) {
        removed.deleted = false;
        if (await save()) {
          render();
          trash();
          toast("Élément rétabli");
        }
      }
      return;
    }
    if (t.dataset.del) {
      var item = state[t.dataset.del]?.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (!item) return;
      item.deleted = true;
      if (await save()) {
        render();
        toast("Élément retiré. Retrouve-le dans les éléments retirés.");
      }
      return;
    }
    if (t.dataset.toggle === "task") {
      var task = state.tasks.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (task) {
        task.done = !task.done;
        task.completedAt = task.done ? new Date().toISOString() : null;
        if (await save()) render();
      }
      return;
    }
    if (t.dataset.toggle === "habit") {
      var habit = state.habits.find(function (x) {
        return x.id === t.dataset.id;
      });
      if (habit) {
        habit.days = Object.assign({}, habit.days || {});
        habit.days[day()] = !habit.days[day()];
        if (await save()) render();
      }
      return;
    }
    if (t.dataset.life) {
      os.open(t.dataset.life);
      return;
    }
    var a = t.dataset.action;
    if (a === "quick") quick();
    else if (a === "settings") settings();
    else if (a === "trash") trash();
    else if (a === "search") search();
    else if (a === "add-note") openForm("note");
    else if (a === "add-event") openForm("event");
    else if (a === "add-goal") openForm("goal");
    else if (a === "add-habit") openForm("habit");
    else if (a === "add-routine") openForm("routine");
    else if (a === "add-workout") openForm("workout");
    else if (a === "track") openForm("track");
    else if (a === "life-entry") openForm("life");
    else if (["finance", "document", "asset", "automation"].includes(a))
      openForm(a);
    else if (a === "resume-editor") editorDrafts.resume();
    else if (a === "export-editor") editorDrafts.export();
    else if (a === "discard-editor") {
      await editorDrafts.clear();
      settings();
    } else if (a === "persist-storage") {
      if (!navigator.storage?.persist)
        toast(
          "Cette demande n’est pas disponible dans ce navigateur. Garde une sauvegarde externe.",
        );
      else
        toast(
          (await navigator.storage.persist())
            ? "Conservation accordée ; les exports restent nécessaires"
            : "Conservation non accordée par le navigateur",
        );
    } else if (a === "export") {
      download(Q.backup(state), "quotidien-backup-" + day() + ".json");
      lastExportRequested = new Date().toISOString();
      try {
        await repository.auxiliary(
          "last-export-requested",
          lastExportRequested,
        );
      } catch (error) {
        showError(
          "Export demandé, mais sa date n’a pas pu être mémorisée : " +
            error.message,
        );
      }
      toast(
        "Téléchargement demandé. Vérifie le fichier avant de supprimer une ancienne sauvegarde.",
      );
    } else if (a === "export-draft" && draft)
      download(
        Q.backup(draft),
        "quotidien-saisie-non-enregistree-" + day() + ".json",
      );
    else if (a === "theme") {
      state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
      if (await save()) {
        render();
        settings();
      }
    } else if (a === "restore" || a === "checkpoint") {
      try {
        var raw = await repository.read(
          a === "restore" ? Q.BACKUP_KEY : Q.CHECKPOINT_KEY,
        );
        if (!raw) throw new Error("Aucune copie disponible.");
        importPreview(Q.parseBackup(raw));
      } catch (err) {
        showError(err.message);
      }
    } else if (a === "import") {
      var i = document.createElement("input");
      i.type = "file";
      i.accept = ".json,application/json";
      i.onchange = function () {
        var file = i.files && i.files[0];
        if (!file) return;
        if (file.size > 20 * 1024 * 1024) {
          showError("Fichier trop volumineux (20 Mo maximum).");
          return;
        }
        var reader = new FileReader();
        reader.onerror = function () {
          showError("Lecture du fichier impossible.");
        };
        reader.onload = function () {
          try {
            importPreview(Q.parseBackup(String(reader.result)));
          } catch (err) {
            showError("Import refusé : " + err.message);
          }
        };
        reader.readAsText(file);
      };
      i.click();
    } else if (a === "confirm-import" && pendingImport) {
      state = Q.clone(pendingImport);
      if (await save(true)) {
        closeModal();
        render();
        toast("Sauvegarde restaurée");
      }
    } else if (a === "clear") {
      modal(
        "Réinitialiser les données",
        '<p>Une copie sera conservée avant le remplacement. Tu peux aussi exporter tes données avant cette action.</p><button class="mini" data-action="export">Exporter mes données</button><button class="primary" data-action="confirm-clear">Confirmer la réinitialisation</button>',
      );
    } else if (a === "confirm-clear") {
      state = Q.empty();
      if (await save(true)) {
        closeModal();
        render();
        toast("Données réinitialisées ; copie conservée");
      }
    }
  });
  on("submit", async function (e) {
    e.preventDefault();
    var f = e.target;
    if (!(f instanceof HTMLFormElement) || !f.reportValidity()) return;
    submittingEditor = editorDrafts.hasForm();
    await editorDrafts.flush();
    if (await focusUI.submit(f)) return;
    if (await personal.submit(f)) return;
    if (await os.submit(f)) return;
    var d = Object.fromEntries(new FormData(f).entries());
    Object.keys(d).forEach(function (key) {
      if (typeof d[key] === "string") d[key] = d[key].trim();
    });
    if (
      ["title", "name", "label"].some(function (key) {
        var input = f.elements.namedItem(key);
        return input && input.required && !d[key];
      })
    ) {
      showError("Renseigne un titre ou un nom non vide.");
      return;
    }
    var kind = f.id.replace("inline-", "").replace("-form", ""),
      key = Object.keys(kinds).find(function (k) {
        return kinds[k] === kind;
      });
    if (!key) return;
    var original =
      editing &&
      state[key].find(function (x) {
        return x.id === editing.id;
      });
    var obj = Object.assign(
      { id: id(), createdAt: new Date().toISOString() },
      original || {},
      d,
      { updatedAt: new Date().toISOString() },
    );
    if (kind === "task") {
      obj.important = !!f.elements.namedItem("important").checked;
      obj.urgent = !!f.elements.namedItem("urgent").checked;
      obj.done = original ? original.done : false;
    }
    personal.readFields(f, obj);
    if (kind === "habit") obj.days = original ? original.days || {} : {};
    if (original)
      state[key] = state[key].map(function (x) {
        return x.id === original.id ? obj : x;
      });
    else state[key].unshift(obj);
    if (await save()) {
      closeModal();
      render();
      toast("Enregistré");
    }
  });
  root.addEventListener("input", function (e) {
    editorDrafts.capture();
    os.inputEvent(e.target);
    personal.inputEvent(e.target);
  });
  on("change", async function (e) {
    await editorDrafts.capture();
    os.changeEvent(e.target);
    await personal.changeEvent(e.target);
    cockpit.changeEvent(e.target);
  });
  function navigate(screen) {
    if (!Q.screens.includes(screen)) screen = "today";
    state.screen = screen;
    closeModal();
    render();
    if (location.hash !== "#" + screen) location.hash = screen;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", function () {
    if (bootError) return;
    if (busy) return;
    if (personal.dirtyDialog()) {
      history.replaceState(null, "", modalRoute || "#today");
      showError("Enregistre ou ferme cette saisie avant de changer de page.");
      return;
    }
    if (os.route(location.hash)) {
      state.screen = "life";
      closeModal();
      render();
      return;
    }
    var screen = Q.screens.includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "today";
    if (screen !== state.screen) navigate(screen);
  });
  document.addEventListener("keydown", function (e) {
    if (busy) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (!bootError) {
        if (personal.dirtyDialog())
          showError("Enregistre ou ferme cette saisie avant de rechercher.");
        else search();
      }
      return;
    }
    var dialog = document.querySelector(".modal");
    if (!dialog) return;
    if (e.key === "Escape") {
      e.preventDefault();
      dismissModal();
      return;
    }
    if (e.key === "Tab") {
      var controls = Array.from(
        dialog.querySelectorAll(
          'button,input,select,textarea,summary,[tabindex="0"]',
        ),
      ).filter(function (el) {
        return (
          !el.disabled &&
          !el.hidden &&
          !el.closest("[hidden]") &&
          !Array.from(dialog.querySelectorAll("details:not([open])")).some(
            (d) => d.contains(el) && el.tagName !== "SUMMARY",
          )
        );
      });
      var first = controls[0],
        last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  window.addEventListener("beforeunload", function (e) {
    if (!bootError && personal.dirtyDialog()) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  window.addEventListener("storage", function (e) {
    if (e.key === KEY && !bootError)
      showError(
        "Données modifiées dans un autre onglet. Termine ou exporte ta saisie, puis recharge pour utiliser la dernière version.",
      );
  });
  window.addEventListener("pageshow", async function (e) {
    if (e.persisted && !bootError) {
      if (document.querySelector(".modal")) return;
      try {
        state = await repository.load();
        committed = Q.clone(state);
        if (os.route(location.hash)) state.screen = "life";
        else if (Q.screens.includes(location.hash.slice(1)))
          state.screen = location.hash.slice(1);
        render();
      } catch (err) {
        recovery(err);
      }
    }
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(function (registrations) {
        var scope = new URL("./", location.href).href;
        return Promise.all(
          registrations
            .filter(function (r) {
              return r.scope === scope;
            })
            .map(function (r) {
              return r.unregister();
            }),
        );
      })
      .catch(function () {
        /* Optional cleanup must never prevent opening the application. */
      });
  }
  if (!bootError) {
    await editorDrafts.load();
    try {
      lastExportRequested = await repository.read(
        "last-export-requested",
        "drafts",
      );
    } catch (error) {
      lastExportRequested = null;
    }
  }
  if (bootError) recovery(bootError);
  else {
    if (location.hash)
      state.screen = Q.screens.includes(location.hash.slice(1))
        ? location.hash.slice(1)
        : "today";
    if (os.route(location.hash)) state.screen = "life";
    render();
  }
})();
