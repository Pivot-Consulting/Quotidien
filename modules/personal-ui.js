/* Shared user journeys. The host remains responsible for persistence and dialogs. */
function createPersonalOS(ctx) {
  "use strict";
  const P = Q.Personal,
    e = ctx.esc,
    state = ctx.state;
  let filter = { ...(state()?.settings.explorer?.filter || {}) },
    view = state()?.settings.explorer?.view || "list",
    current = null,
    pendingRevision = null;
  const button = (action, label, attrs = "", cls = "mini") =>
    `<button type="button" class="${cls}" data-personal="${action}" ${attrs}>${e(label)}</button>`;
  const attrs = (ref) => `data-key="${e(ref.key)}" data-id="${e(ref.id)}"`;
  const select = (name, label, values, value = "") =>
    `<label>${e(label)}<select name="${name}" data-personal-filter="${name}">${values.map(([v, t]) => `<option value="${e(v)}" ${v === value ? "selected" : ""}>${e(t)}</option>`).join("")}</select></label>`;
  function customRow(c = {}) {
    return `<div class="custom-row full"><label>Nom<input name="custom_name" data-custom-name value="${e(c.name || "")}"></label><label>Type<select name="custom_type" data-custom-type>${[
      ["text", "Texte"],
      ["number", "Nombre"],
      ["date", "Date AAAA-MM-JJ"],
      ["boolean", "Oui / non"],
    ]
      .map(
        ([v, t]) =>
          `<option value="${v}" ${v === c.type ? "selected" : ""}>${t}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Valeur<input name="custom_value" data-custom-value value="${e(typeof c.value === "boolean" ? (c.value ? "oui" : "non") : (c.value ?? ""))}"></label>${button("remove-custom", "Retirer")}</div>`;
  }
  function linkedOptions(rows, selected) {
    return (
      `<option value="">Non lié</option>` +
      rows
        .map(
          (x) =>
            `<option value="${e(x.id)}" ${x.id === selected ? "selected" : ""}>${e(P.title(x))}</option>`,
        )
        .join("")
    );
  }
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
    <label>Contact responsable<select name="assigneeId">${linkedOptions(
      state().os.filter(
        (x) => x.kind === "contact" && (!x.deleted || x.id === r.assigneeId),
      ),
      r.assigneeId,
    )}</select></label>
    ${
      key === "tasks"
        ? `<label>Tâche parente<select name="parentTaskId">${linkedOptions(
            state().tasks.filter(
              (x) => x.id !== r.id && (!x.deleted || x.id === r.parentTaskId),
            ),
            r.parentTaskId,
          )}</select></label>`
        : ""
    }
    ${
      key === "finances"
        ? `<label>Voyage lié<select name="tripId">${linkedOptions(
            state().os.filter(
              (x) => x.kind === "trip" && (!x.deleted || x.id === r.tripId),
            ),
            r.tripId,
          )}</select></label>`
        : ""
    }
    <div class="full"><p>Champs personnalisés</p><div data-custom-rows>${(r.customFields || []).map(customRow).join("")}</div>${button("add-custom", "+ Champ")}</div>
    <label>Responsable<input name="personal_owner" value="${e(m.owner || "")}"></label>
    <label>Lieu<input name="personal_location" value="${e(m.location || "")}"></label>
    <label class="full">Description commune<textarea name="personal_description">${e(m.description || "")}</textarea></label>
    <label><input type="checkbox" name="personal_favorite" ${m.favorite ? "checked" : ""}>Favori</label>
    <label class="full">Checklist (une étape par ligne ; [x] pour terminée)<textarea name="personal_checklist" rows="3">${e((m.checklist || []).map((x) => (x.done ? "[x] " : "") + x.text).join("\n"))}</textarea></label>
    </div></details>`;
  }
  function restoreDraftFields(form, values) {
    const container = form.querySelector("[data-custom-rows]");
    if (!container) return;
    const names = values.filter((x) => x.name === "custom_name"),
      types = values.filter((x) => x.name === "custom_type"),
      fields = values.filter((x) => x.name === "custom_value");
    container.innerHTML = names
      .map((x, i) =>
        customRow({
          name: x.value,
          type: types[i]?.value,
          value: fields[i]?.value,
        }),
      )
      .join("");
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
    record.assigneeId = String(fd.get("assigneeId") || "");
    if (form.elements.namedItem("parentTaskId"))
      record.parentTaskId = String(fd.get("parentTaskId") || "");
    if (form.elements.namedItem("tripId"))
      record.tripId = String(fd.get("tripId") || "");
    record.customFields = [...form.querySelectorAll(".custom-row")].map(
      (row) => {
        const name = row.querySelector("[data-custom-name]").value.trim(),
          type = row.querySelector("[data-custom-type]").value,
          raw = row.querySelector("[data-custom-value]").value.trim();
        if (type === "number" && !raw)
          throw new Error(
            "Renseigne la valeur numérique du champ personnalisé.",
          );
        if (type === "boolean" && !["oui", "non"].includes(raw.toLowerCase()))
          throw new Error("Un champ Oui / non attend oui ou non.");
        return {
          name,
          type,
          value:
            type === "number"
              ? Number(raw)
              : type === "boolean"
                ? raw.toLowerCase() === "oui"
                : raw,
        };
      },
    );
    record.personal = m;
    for (const key of Object.keys(record))
      if (key.startsWith("personal_") || key.startsWith("custom_"))
        delete record[key];
  }
  function footer(ref) {
    const children =
      ref.key === "tasks" ? Q.Evolution.children(state(), ref.id) : [];
    return `<div class="shared-footer">${children.length ? `<p>Sous-tâches : ${children.filter((x) => x.done).length}/${children.length} terminées</p>${children.map((x) => `<a class="mini" href="${e(P.route({ key: "tasks", id: x.id }))}">${e(P.title(x))}</a>`).join("")}` : ""}${button("detail", "Relations, checklist et historique", attrs(ref))}<a class="mini" href="${e(P.route(ref))}">Lien direct vers cette fiche</a><p class="meta">Les propriétés et relations sont communes à tous les espaces.</p></div>`;
  }
  function hitCard(h) {
    const r = h.record,
      m = P.meta(r),
      options = view === "kanban" ? P.statusOptions(state(), h) : [];
    const control = options.length
      ? `<label>Statut de ${e(P.title(r))}<select data-kanban-key="${e(h.key)}" data-kanban-id="${e(h.id)}">${options.map((x) => `<option ${x === (h.key === "tasks" ? (r.done ? "Terminé" : "À faire") : r.status) ? "selected" : ""}>${e(x)}</option>`).join("")}</select></label>`
      : "";
    return `<article class="shared-result"><button class="search-result" data-edit="${e(h.key)}" data-id="${e(h.id)}"><strong>${m.favorite ? "★ " : ""}${e(P.title(r))}</strong><span>${e(P.describe(h))}${P.date(r) ? " · " + e(P.date(r)) : ""}${m.archived ? " · Archivé" : ""}</span></button><div class="shared-result-bottom"><span class="meta">${e(P.tags(r).join(" · "))}</span>${button("detail", "Relations & détails", attrs(h))}</div>${control}</article>`;
  }
  function searchView() {
    return `<div class="page-title"><div><span class="eyebrow">TOUT EST CONNECTÉ</span><h1>Explorer</h1><p class="meta">Retrouve tes objets dans les vingt OS et les outils quotidiens.</p></div>${button("quick", "+ Capturer", "", "primary")}</div>
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
    return `<p class="meta">${hits.length} résultat(s)${hits.length > 100 ? " · 100 affichés, affine les filtres" : ""}</p>${body || `<div class="empty"><p>Aucun résultat. Essaie un autre filtre ou capture un nouvel élément.</p>${button("reset-search", "Effacer les filtres")}${button("quick", "+ Capturer")}</div>`}`;
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
  function rememberView() {
    state().settings.explorer = { view, filter: { ...filter } };
  }
  function remember() {
    rememberView();
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
    return `<section class="card shared-cockpit"><div class="section-head"><div><span class="eyebrow">TON FIL CONDUCTEUR</span><h2>Prochaines actions</h2></div>${button("explore", "Tout explorer")}</div><details class="shared-method"><summary>Comment sont choisies les actions ?</summary><p>Classement local selon les échéances, l’importance, la priorité et les liens. Les actions bloquées sont écartées.</p></details><div class="shared-actions">${actions.map((a) => `<article class="shared-action"><div class="section-head"><h3><button class="text-button" data-edit="tasks" data-id="${e(a.hit.id)}">${e(P.title(a.hit.record))}</button></h3><span class="tag">${a.score} pts</span></div><details><summary>Pourquoi cette action ?</summary><ul>${a.reasons.map((r) => `<li>${e(r)}</li>`).join("")}</ul></details><div class="os-actions"><button class="mini" data-toggle="task" data-id="${e(a.hit.id)}">Terminer</button><button class="mini" data-focus="start" data-id="${e(a.hit.id)}">Focus</button>${button("tomorrow", "Demain", `data-id="${e(a.hit.id)}"`)}${button("detail", "Relations & checklist", attrs(a.hit))}<button class="danger" data-del="tasks" data-id="${e(a.hit.id)}" aria-label="Retirer cette tâche">×</button></div></article>`).join("") || `<p class="empty">Aucune action disponible. Capture une tâche ou consulte les dépendances dans Explorer.</p>`}</div><div class="os-actions">${button("late", `${late.length} échéance(s) en retard`)}${button("upcoming", `${upcoming.length} échéance(s) dans les 7 jours`)}${button("quick", "+ Capture rapide", "", "primary")}</div>${fav.length ? `<details><summary>Mes favoris · ${fav.length}</summary>${fav.map(hitCard).join("")}</details>` : ""}</section>`;
  }
  const customSnapshot = (form) =>
    JSON.stringify(
      [...form.querySelectorAll(".custom-row input,.custom-row select")].map(
        (x) => x.value,
      ),
    );
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
        "vault-form",
        "automation-builder",
      ].includes(form.id)
    )
      return false;
    if (
      form.dataset.initialCustom !== undefined &&
      form.dataset.initialCustom !== customSnapshot(form)
    )
      return true;
    return Array.from(form.elements).some(
      (x) =>
        x.dataset.initialValue !== undefined &&
        x.dataset.initialValue !==
          (x.type === "checkbox" ? String(x.checked) : x.value),
    );
  }
  function markClean() {
    const form = document.querySelector(".modal form");
    if (form) form.dataset.initialCustom = customSnapshot(form);
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
    if (a === "add-custom") {
      t.parentElement
        .querySelector("[data-custom-rows]")
        .insertAdjacentHTML("beforeend", customRow());
      t.closest("form").dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    if (a === "remove-custom") {
      const form = t.closest("form");
      t.closest(".custom-row").remove();
      form.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
    if (a === "detail") {
      if (dirtyDialog()) {
        ctx.error("Enregistre tes modifications avant d’ouvrir les relations.");
        return true;
      }
      detail({ key: t.dataset.key, id: t.dataset.id });
    } else if (a === "tomorrow") {
      const task = state().tasks.find((x) => x.id === t.dataset.id);
      if (task) {
        task.due = Q.OS.addDays(Q.day(), 1);
        if (await ctx.save()) {
          ctx.render();
          ctx.toast("Tâche reportée à demain");
        }
      }
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
      rememberView();
      if (await ctx.save()) ctx.render();
    } else if (a === "reset-search") {
      filter = {};
      rememberView();
      if (await ctx.save()) ctx.render();
    } else if (a === "save-search")
      ctx.modal(
        "Enregistrer la recherche",
        `<form id="saved-search-form" class="form"><label class="full">Nom<input name="name" required placeholder="Mes projets prioritaires"></label><button class="primary">Enregistrer</button></form>`,
      );
    else if (a === "load-search") {
      const saved = state().settings.searches[Number(t.dataset.index)];
      filter = { ...saved.filter };
      view = ["list", "kanban", "timeline"].includes(saved.view)
        ? saved.view
        : "list";
      rememberView();
      if (await ctx.save()) ctx.render();
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
      state().settings.searches = [
        ...list,
        { name, view, filter: { ...filter } },
      ];
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
    if (target.dataset.kanbanKey) {
      try {
        P.changeStatus(
          state(),
          { key: target.dataset.kanbanKey, id: target.dataset.kanbanId },
          target.value,
        );
        if (await ctx.save()) {
          ctx.render();
          ctx.toast("Statut enregistré");
        }
      } catch (error) {
        refreshResults();
        ctx.error(error.message);
      }
      return;
    }
    if (
      target.id === "global-search" ||
      (target.dataset.personalFilter && !target.name.startsWith("personal_"))
    ) {
      rememberView();
      await ctx.save();
    }
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
    restoreDraftFields,
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
