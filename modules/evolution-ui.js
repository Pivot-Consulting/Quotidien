/* Connected journeys, explicit commands and opt-in local agents. */
function createEvolutionUI(ctx) {
  "use strict";
  const E = Q.Evolution,
    C = Q.Commands,
    P = Q.Personal,
    O = Q.OS,
    e = ctx.esc;
  const rows = (kind) => O.rows(ctx.state(), kind).filter(P.visible);
  const money = (n) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n);
  const link = (key, r) =>
    `<a class="evo-link" href="${e(P.route({ key, id: r.id }))}">${e(P.title(r))}</a>`;
  const button = (action, label, id = "") =>
    `<button type="button" class="mini" data-evo="${action}" data-id="${e(id)}">${e(label)}</button>`;
  const options = (rs) =>
    rs
      .map((r) => `<option value="${e(r.id)}">${e(P.title(r))}</option>`)
      .join("");
  const create = (kind, label) =>
    `<button class="mini" data-evo="new" data-id="${e(kind)}">+ ${e(label)}</button>`;
  const empty = '<p class="meta">Aucune donnée pour cette période.</p>';
  let tab = "commands",
    preview = null,
    search = [],
    message = "",
    from = Q.day(),
    until = O.addDays(Q.day(), 7),
    horizon = O.addDays(Q.day(), 90);
  let remote = null,
    endpoint = "",
    token = "",
    identity = null,
    syncPreview = "";
  function view() {
    const tabs = [
      ["commands", "Command Center"],
      ["flows", "Parcours métier"],
      ["review", "Bilan & progression"],
      ["agents", "Agents"],
      ["sync", "Synchronisation"],
    ];
    return `<div class="page-title"><div><span class="eyebrow">PERSONAL OS</span><h1>Centre de pilotage</h1><p class="meta">Agir sur les mêmes objets, du projet à l’action.</p></div></div><div class="tabs">${tabs.map(([id, label]) => `<button data-evo="tab" data-id="${id}" class="${tab === id ? "active" : ""}" aria-pressed="${tab === id}">${label}</button>`).join("")}</div>${message ? `<p role="status">${e(message)}</p>` : ""}${tab === "commands" ? commands() : tab === "flows" ? flows() : tab === "review" ? review() : tab === "agents" ? agents() : sync()}`;
  }
  function commands() {
    return `<section class="card"><h2>Une intention, une prévisualisation</h2><p>Commandes locales : créer une tâche ou une note, rechercher et planifier une tâche par son titre exact. Toutes les écritures demandent une validation.</p><form id="evo-command" class="form"><label class="full">Commande<input name="command" required placeholder="tâche Appeler Paul le 2026-10-01"></label><button class="primary">Prévisualiser</button></form><details><summary>Syntaxe disponible</summary><ul>${C.examples.map((x) => `<li>${e(x)}</li>`).join("")}</ul></details>${preview ? `<div class="card"><strong>${e(preview.type)} · ${e(preview.text)}</strong><p>${e(preview.date || "Sans échéance")}</p>${button("apply-command", "Confirmer cette action")}${button("cancel-command", "Annuler")}</div>` : ""}${search.length ? `<ul>${search.map((h) => `<li>${link(h.key, h.record)}</li>`).join("")}</ul>` : ""}</section>${history()}`;
  }
  function history() {
    return `<section class="card"><h2>Historique des actions validées</h2><p class="meta">Annulation possible tant que l’objet n’a pas été modifié. Les créations annulées restent dans la corbeille.</p>${
      C.history(ctx.state())
        .slice(0, 30)
        .map(
          (h) =>
            `<div class="os-insight"><span>${e(h.label)}<small> · ${e(h.at.slice(0, 16))}${h.agent ? " · Agent " + e(h.agent) : ""}</small></span>${h.undone ? "Annulée" : button("undo", "Annuler", h.id)}</div>`,
        )
        .join("") || empty
    }</section>`;
  }
  function flows() {
    const s = ctx.state();
    return `<section class="card"><h2>Trésorerie réelle et prévisionnelle</h2><p>Les échéances non réglées, y compris en retard, s’ajoutent au solde comptabilisé. Un règlement crée un mouvement lié et retire l’échéance du prévisionnel. Les abonnements ne sont pas ajoutés automatiquement.</p><form id="evo-horizon" class="form"><label>Horizon<input type="date" name="horizon" required value="${horizon}"></label><button class="mini">Actualiser</button></form><div class="os-actions">${create("commitment", "Échéance")}${create("scenario", "Scénario")}</div><div class="table-scroll"><table><thead><tr><th>Compte</th><th>Réel</th><th>À venir</th><th>Prévision</th></tr></thead><tbody>${rows(
      "account",
    )
      .map((a) => {
        const f = E.forecast(s, a.id, horizon);
        return `<tr><td>${link("os", a)}</td><td>${money(f.actual)}</td><td>${money(f.expected)}</td><td>${money(f.projected)}</td></tr>`;
      })
      .join("")}</tbody></table></div>${rows("commitment")
      .filter((r) => !E.paid(s, r.id))
      .map(
        (r) =>
          `<div class="os-insight"><span>${link("os", r)} · ${e(r.due)} · ${money(r.amount)}</span>${button("settle", "Enregistrer le règlement", r.id)}</div>`,
      )
      .join(
        "",
      )}<details><summary>Créer un échéancier mensuel</summary><p>Le montant signé total est réparti au centime, avec ajustement de la dernière mensualité. Chaque échéance est modifiable avant règlement.</p><form id="evo-installments" class="form"><label>Titre<input name="title" required></label><label>Compte<select name="account" required>${options(rows("account"))}</select></label><label>Total signé (€)<input name="total" type="number" step="0.01" required></label><label>Mensualités<input name="count" type="number" min="1" max="60" value="3" required></label><label>Première échéance<input name="first" type="date" required value="${Q.day()}"></label><button class="primary">Créer l’échéancier</button></form></details><h3>Scénarios indépendants</h3><p class="meta">Chaque variation est appliquée à sa propre prévision de référence ; aucun mouvement réel n’est créé.</p>${
      rows("scenario")
        .map((r) => {
          const f = E.forecast(s, r.accountId, r.due);
          return `<p>${link("os", r)} · ${e(r.due)} : ${money(f.projected)} + ${money(r.delta)} = <strong>${money(f.projected + Number(r.delta))}</strong> · ${e(r.assumption || "")}</p>`;
        })
        .join("") || empty
    }</section>
    <section class="card"><h2>Décisions multicritères</h2><p>Notes favorables de 0 à 10, pondérées par tes critères. Une option incomplète n’est pas classée.</p><div class="os-actions">${create("criterion", "Critère")}${create("optionScore", "Évaluation")}</div>${rows(
      "decision",
    )
      .map(
        (d) =>
          `<h3>${link("os", d)}</h3>${E.decisionScores(s, d.id)
            .map(
              (x) =>
                `<p>${link("os", x.option)} : ${x.complete ? x.score.toFixed(2) + " / 10" : "Évaluation incomplète"}</p>`,
            )
            .join("")}`,
      )
      .join("")}</section>
    <section class="card"><h2>Menus → courses → stock</h2><p>Renseigne les ingrédients par portion. Les quantités restent séparées par unité : g, ml ou pièce. Les courses ouvertes sont déduites des besoins pour éviter les doublons.</p><div class="os-actions">${create("ingredient", "Ingrédient")}${create("menu", "Menu")}${create("stock", "Stock")}</div><form id="evo-shopping" class="form"><label>Du<input name="from" type="date" required value="${from}"></label><label>Au<input name="until" type="date" required value="${until}"></label><button class="primary">Créer les courses manquantes</button></form>${rows(
      "shopping",
    )
      .filter((r) => !r.receivedAt && !O.done(r))
      .map(
        (r) =>
          `<div class="os-insight"><span>${link("os", r)} · ${e(r.quantity)} ${e(r.unit)}</span>${button("receive", "Réceptionner", r.id)}</div>`,
      )
      .join("")}${rows("menu")
      .filter((r) => !r.consumedAt)
      .map(
        (r) =>
          `<div class="os-insight"><span>${link("os", r)} · ${e(r.date)} · ${e(r.portions)} portion(s)</span>${button("consume", "Consommer le stock", r.id)}</div>`,
      )
      .join("")}</section>
    <section class="card"><h2>Documents, maison et récupération</h2><p>Choisis une facture du coffre dans la fiche équipement. La garantie et les entretiens utilisent ensuite le même équipement. Le lien vers le coffre conserve le fichier et ses versions.</p><div class="os-actions">${create("equipment", "Équipement")}${create("maintenance", "Entretien")}${create("recovery", "Procédure de récupération")}</div>${rows(
      "equipment",
    )
      .map(
        (r) =>
          `<p>${link("os", r)} · garantie : ${e(r.warranty || "non renseignée")}${
            r.vaultDocumentId
              ? ` · ${link(
                  "documents",
                  s.documents.find((d) => d.id === r.vaultDocumentId),
                )}`
              : ""
          }</p>`,
      )
      .join("")}${s.documents
      .filter(P.visible)
      .map((r) => `<p>${link("documents", r)}</p>`)
      .join("")}</section>
    <section class="card"><h2>Apprentissage, carrière et relations</h2><p>Les cours peuvent viser une compétence de carrière ; les candidatures peuvent être liées à un contact. Les cartes de révision et interactions conservent leurs échéances.</p>${rows(
      "careerSkill",
    )
      .map(
        (skill) =>
          `<h3>${link("os", skill)}</h3><p>${
            rows("course")
              .filter(
                (c) => c.careerSkillId === skill.id || c.id === skill.courseId,
              )
              .map((c) => link("os", c))
              .join(" · ") || "Aucun cours lié"
          }</p>`,
      )
      .join(
        "",
      )}<div class="os-actions">${create("course", "Cours")}${create("flashcard", "Carte de révision")}${create("interaction", "Suivi de contact")}</div></section>
    <section class="card"><h2>Voyages : préparation et dépenses</h2><p>Les réservations donnent une estimation ; seuls les mouvements financiers liés au voyage composent le réalisé. Ils ne sont jamais additionnés ensemble.</p>${
      rows("trip")
        .map((t) => {
          const bookings = rows("booking").filter((b) => b.tripId === t.id),
            packing = rows("packing").filter((b) => b.tripId === t.id);
          return `<p>${link("os", t)} · Réservations : ${money(O.sum(bookings, "cost"))} · Réalisé : ${money(-s.finances.filter((f) => !f.deleted && f.tripId === t.id).reduce((a, f) => a + Number(f.amount), 0))} · Préparatifs : ${packing.filter(O.done).length}/${packing.length}</p>`;
        })
        .join("") || empty
    }</section>
    <section class="card"><h2>Programmes sportifs</h2><div class="os-actions">${create("trainingProgram", "Programme")}${create("trainingSession", "Séance")}</div>${rows(
      "trainingProgram",
    )
      .map((p) => {
        const sessions = rows("trainingSession")
          .filter((x) => x.programId === p.id)
          .sort((a, b) => String(b.date).localeCompare(String(a.date)));
        return `<h3>${link("os", p)} · ${e(p.sport)}</h3><p>${sessions.length} séance(s), ${O.sum(sessions, "minutes")} minutes cumulées.</p>${sessions
          .slice(0, 5)
          .map(
            (x) =>
              `<p>${link("os", x)} · ${e(x.date)} · ${e(x.result || "")}</p>`,
          )
          .join("")}`;
      })
      .join("")}</section>
    ${exerciseDetails()}<section class="card"><h2>Convertir les anciens registres</h2><p>La conversion conserve l’identifiant, archive la fiche source et crée sa fiche spécialisée. Le retour au registre réactive la source et archive la fiche spécialisée ; les relations restent disponibles.</p>${[
      "assets",
      "goals",
    ]
      .map(
        (key) =>
          `<form id="evo-convert-${key}" class="form"><label>${key === "assets" ? "Équipement → Maison" : "Objectif → Projet"}<select name="id" required><option value="">Choisir</option>${options(s[key].filter((r) => !r.deleted && !r.convertedTo))}</select></label><button class="mini">Convertir</button></form>${s[
            key
          ]
            .filter((r) => r.convertedTo)
            .map(
              (r) =>
                `<p>${e(P.title(r))} ${button("reverse-" + key, "Revenir au registre", r.id)}</p>`,
            )
            .join("")}`,
      )
      .join("")}</section>`;
  }
  function compositeScores() {
    return `<section class="card"><h2>Dix scores composites</h2><p>Indicateurs de pilotage personnels, sans diagnostic ni classement. Chaque score est la moyenne à poids égaux de ses composantes renseignées, arrondie sur 100. Une composante absente reste inconnue ; elle ne vaut pas zéro. Les scores partiels ne sont pas directement comparables.</p>${Q.Progression.scores(
      ctx.state(),
    )
      .map(
        (score) =>
          `<article class="score-row"><h3>${e(score.name)} · ${score.score === null ? "Données insuffisantes" : score.score + " / 100"}</h3>${score.score === null ? "" : `<progress max="100" value="${score.score}" aria-label="${e(score.name)}"></progress>`}<p class="meta">${e(score.coverage)}</p><details><summary>Calcul et sources</summary>${score.components
            .map(
              (c) =>
                `<p><strong>${e(c.label)} : ${c.score === null ? "inconnu" : c.score + " / 100"}</strong><br>${e(c.explanation)}</p>${c.refs
                  .slice(0, 10)
                  .map((ref) => {
                    const r = P.resolve(ctx.state(), ref);
                    return r ? link(ref.key, r) : "";
                  })
                  .join(
                    " · ",
                  )}${c.refs.length > 10 ? `<p class="meta">${c.refs.length} sources au total ; 10 affichées.</p>` : ""}`,
            )
            .join("")}</details></article>`,
      )
      .join("")}</section>`;
  }
  function exerciseDetails() {
    const s = ctx.state();
    return `<section class="card"><h2>Exercices et séries réalisées</h2><p>Ajoute les exercices au programme, puis consigne chaque série dans une séance du même programme. Les objectifs sont tes propres saisies.</p><div class="os-actions">${create("trainingExercise", "Exercice")}${create("exerciseSet", "Série réalisée")}</div>${rows(
      "trainingExercise",
    )
      .map((ex) => {
        const history = Q.Progression.performance(s, ex.id);
        return `<h3>${link("os", ex)}</h3><p>Objectif : ${e(ex.targetSets)} × ${e(ex.targetReps)} répétitions · ${e(ex.targetLoad)} kg · repos ${e(ex.restSeconds)} s</p>${
          history.length
            ? `<div class="table-scroll"><table><thead><tr><th>Date</th><th>Série</th><th>Répétitions</th><th>Charge</th><th>Durée</th></tr></thead><tbody>${history
                .slice(0, 12)
                .map(
                  (r) =>
                    `<tr><td>${e(r.date)}</td><td>${link("os", r)} (${e(r.setIndex)})</td><td>${e(r.repetitions)}</td><td>${e(r.load)} kg</td><td>${e(r.seconds)} s</td></tr>`,
                )
                .join(
                  "",
                )}</tbody></table></div><p class="meta">${history.length} série(s) enregistrée(s) ; les 12 dernières sont affichées.</p>`
            : empty
        }`;
      })
      .join("")}</section>`;
  }
  function review() {
    const s = ctx.state(),
      config = s.settings.analysis || { horizon: 7, stagnation: 30 },
      scores = E.lifeScores(s),
      since = O.addDays(Q.day(), -29);
    const timeline = P.all(s)
      .filter(
        (h) =>
          P.visible(h.record) &&
          P.date(h.record) >= since &&
          P.date(h.record) <= Q.day(),
      )
      .sort((a, b) => P.date(b.record).localeCompare(P.date(a.record)));
    const journal = rows("journal")
      .filter((r) => r.date >= since && r.date <= Q.day())
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return `<section class="card"><h2>Seuils d’analyse</h2><form id="evo-settings" class="form"><label>Horizon des alertes (jours)<input type="number" min="1" max="90" name="horizon" required value="${config.horizon}"></label><label>Stagnation d’un projet (jours)<input type="number" min="1" max="365" name="stagnation" required value="${config.stagnation}"></label><label><input type="checkbox" name="game" ${s.settings.game ? "checked" : ""}>Afficher la progression ludique</label><button class="primary">Enregistrer</button></form>${button("monthly", "Installer la revue mensuelle")}</section>${compositeScores()}<section class="card"><h2>Auto-évaluations · 30 jours</h2><p class="meta">Scores d’auto-évaluation, sans diagnostic ni valeur calculée pour les données manquantes.</p>${create("lifeRating", "Auto-évaluation")}${scores.map((x) => `<div class="score-row"><strong>${e(x.area)} : ${x.score === null ? "insuffisant" : x.score + " / 100"}</strong>${x.score !== null ? `<progress max="100" value="${x.score}" aria-label="${e(x.area)}"></progress>` : ""}<p class="meta">${e(x.explanation)}</p></div>`).join("")}</section><section class="card"><h2>Humeur dans le journal</h2>${journal.length ? `<svg viewBox="0 0 500 120" role="img" aria-label="Évolution de l’humeur du journal, de zéro à dix"><polyline fill="none" stroke="currentColor" stroke-width="3" points="${journal.map((r, i) => `${10 + (i * 480) / Math.max(1, journal.length - 1)},${110 - Number(r.mood) * 10}`).join(" ")}" /></svg><p class="meta">${journal.map((r) => `${e(r.date)} : ${e(r.mood)}/10`).join(" · ")}</p>` : empty}</section>${s.settings.game ? `<section class="card"><h2>Progression ludique</h2><p>${s.tasks.filter((t) => !t.deleted && t.done).length * 10} points · 10 points par tâche actuellement terminée. Désactivable, sans pénalité.</p></section>` : ""}<section class="card"><h2>Périodes de vie</h2>${create("lifePeriod", "Période")}${rows(
      "lifePeriod",
    )
      .map(
        (p) =>
          `<p>${link("os", p)} · ${e(p.date)} → ${e(p.end)} · ${e(p.meaning || "")}</p>`,
      )
      .join("")}<h3>Chronologie multidomaine · 30 jours</h3>${
      timeline
        .slice(0, 60)
        .map(
          (h) =>
            `<p>${e(P.date(h.record))} · ${link(h.key, h.record)} · ${e(P.describe(h))}</p>`,
        )
        .join("") || empty
    }</section><section class="card"><h2>Résultats des recommandations</h2>${
      Q.Intelligence.decisions(s)
        .map((d) => {
          const task = s.tasks.find((t) => t.id === d.taskId);
          return `<p>${e(d.title)} · ${e(d.status)} · ${task ? (task.deleted ? "Action retirée" : task.done ? "Action terminée" : "Action en cours") : "Sans action créée"}</p>`;
        })
        .join("") || empty
    }</section>`;
  }
  function agents() {
    const s = ctx.state(),
      enabled = s.settings.agents || [];
    return `<section class="card"><h2>Agents spécialisés locaux</h2><p>Chaque agent lit uniquement les domaines cochés pour lui et propose des tâches à partir des analyseurs existants. Il agit seulement lorsque tu valides une proposition, avec une trace annulable.</p><form id="evo-agents" class="form">${O.domains.map((d) => `<label><input name="domains" value="${d.id}" type="checkbox" ${enabled.includes(d.id) ? "checked" : ""}>${e(d.name)}</label>`).join("")}<button class="primary">Enregistrer les permissions</button></form></section>${enabled
      .map((domain) => {
        const proposals = C.proposals(s, domain);
        return `<section class="card"><h2>Agent ${e(O.domains.find((d) => d.id === domain).name)}</h2>${proposals.map((f) => `<article class="card"><h3>${e(f.title)}</h3><p>${e(f.explanation)}</p><p>Action proposée : ${e(f.action)}</p><button class="primary" data-evo="agent-accept" data-domain="${e(domain)}" data-id="${e(f.id)}">Valider la création de tâche</button></article>`).join("") || "<p>Aucune proposition pour les données autorisées.</p>"}</section>`;
      })
      .join("")}${history()}`;
  }
  function sync() {
    return `<section class="card"><h2>Synchronisation manuelle avec serveur privé</h2><p>Un serveur QUOTIDIEN doit être configuré pour ce compte. L’application fonctionne localement sans serveur. Le jeton reste en mémoire jusqu’à la déconnexion ou au rechargement.</p><form id="evo-connect" class="form"><label>Adresse HTTPS du serveur<input name="endpoint" type="url" required value="${e(endpoint)}" placeholder="https://quotidien.example.com"></label><label>Jeton d’accès<input name="token" type="password" autocomplete="off" required></label><button class="primary">Se connecter et comparer</button></form>${identity ? `<p>Identité : ${e(identity.user)} · droit : ${e(identity.role)} · révision distante ${remote.revision}</p><p>Local : ${e(Q.summary(ctx.state()))}</p><p>Distant : ${remote.archive ? e(Q.summary(JSON.parse(remote.archive).state)) : "Aucune sauvegarde"}</p><p>Choisis explicitement la version à conserver. Les pièces jointes sont incluses. Une modification distante concurrente bloque l’envoi ; une restauration conserve un point de récupération local.</p><div class="os-actions">${identity.role !== "reader" ? button("sync-push", "Envoyer cette version locale") : ""}${remote.archive ? button("sync-pull", "Restaurer cette version distante") : ""}${button("disconnect", "Déconnecter")}</div>` : ""}</section>`;
  }
  async function api(path, method = "GET", body) {
    const response = await fetch(endpoint + path, {
      method,
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "Conflit : le serveur a changé. Reconnecte-toi pour comparer les deux versions."
          : response.status === 401 || response.status === 403
            ? "Accès refusé ou expiré."
            : "Serveur indisponible (" + response.status + ").",
      );
    return response.json();
  }
  async function persist(text) {
    if (await ctx.save()) {
      message = text;
      ctx.render();
    }
  }
  async function click(t) {
    const action = t.dataset.evo;
    if (!action) return false;
    try {
      const s = ctx.state(),
        id = t.dataset.id;
      if (action === "tab") {
        tab = id;
        message = "";
        ctx.render();
      } else if (action === "new") ctx.edit(id);
      else if (action === "cancel-command") {
        preview = null;
        ctx.render();
      } else if (action === "apply-command") {
        if (!preview) throw new Error("Prévisualise une commande.");
        C.apply(s, preview, ctx.id);
        preview = null;
        await persist("Commande appliquée.");
      } else if (action === "undo") {
        C.undo(s, id);
        await persist("Commande annulée.");
      } else if (action === "settle") {
        E.settle(s, id, ctx.id);
        await persist("Règlement enregistré une seule fois.");
      } else if (action === "receive") {
        E.receive(s, id, ctx.id);
        await persist("Stock mis à jour.");
      } else if (action === "consume") {
        E.consume(s, id);
        await persist("Menu consommé, stock déduit.");
      } else if (action.startsWith("reverse-")) {
        E.reverse(s, action.slice(8), id);
        await persist("Registre réactivé ; fiche spécialisée archivée.");
      } else if (action === "monthly") {
        E.monthlyReview(s, ctx.id);
        await persist("La revue mensuelle est disponible dans les routines.");
      } else if (action === "agent-accept") {
        C.accept(s, t.dataset.domain, id, ctx.id);
        await persist("Proposition validée et inscrite dans l’historique.");
      } else if (action === "disconnect") {
        token = "";
        identity = null;
        remote = null;
        ctx.render();
      } else if (action === "sync-push" || action === "sync-pull") {
        if (!identity || !remote)
          throw new Error("Connecte-toi pour comparer les versions.");
        if (JSON.stringify(s) !== syncPreview)
          throw new Error(
            "Les données locales ont changé. Reconnecte-toi pour comparer à nouveau.",
          );
        if (action === "sync-push") {
          const archive = await Q.FullBackup.create(s, ctx.repository());
          const result = await api("/snapshot", "PUT", {
            revision: remote.revision,
            archive,
          });
          remote = { revision: result.revision, archive };
          message = "Version locale et pièces jointes envoyées.";
        } else {
          const latest = await api("/snapshot");
          if (latest.revision !== remote.revision)
            throw new Error(
              "Le serveur a changé. Reconnecte-toi pour comparer à nouveau.",
            );
          const prepared = await Q.FullBackup.prepare(remote.archive);
          prepared.state.screen = "workbench";
          if (!(await ctx.restore(prepared))) return true;
          message =
            "Version distante restaurée ; copie locale précédente conservée.";
        }
        syncPreview = JSON.stringify(ctx.state());
        ctx.render();
      }
    } catch (error) {
      ctx.error(error.message);
    }
    return true;
  }
  async function submit(form) {
    if (!form.id.startsWith("evo-")) return false;
    try {
      const data = new FormData(form),
        s = ctx.state(),
        get = (k) => String(data.get(k) || "");
      if (form.id === "evo-command") {
        preview = C.parse(s, get("command"));
        search = [];
        if (preview.type === "search") {
          search = P.search(s, { query: preview.text });
          message = search.length + " résultat(s).";
          preview = null;
        }
        ctx.render();
      } else if (form.id === "evo-horizon") {
        horizon = get("horizon");
        ctx.render();
      } else if (form.id === "evo-installments") {
        E.installments(
          s,
          get("account"),
          get("title"),
          Number(get("total")),
          Number(get("count")),
          get("first"),
          ctx.id,
        );
        await persist(
          "Échéancier créé. Les mensualités figurent dans le prévisionnel.",
        );
      } else if (form.id === "evo-shopping") {
        from = get("from");
        until = get("until");
        const count = E.makeShopping(s, from, until, ctx.id);
        await persist(count + " course(s) créée(s).");
      } else if (form.id.startsWith("evo-convert-")) {
        E.convert(s, form.id.slice(12), get("id"));
        await persist(
          "Conversion effectuée ; identifiant et source conservés.",
        );
      } else if (form.id === "evo-settings") {
        s.settings.analysis = {
          horizon: Number(get("horizon")),
          stagnation: Number(get("stagnation")),
        };
        s.settings.game = data.has("game");
        await persist("Préférences enregistrées.");
      } else if (form.id === "evo-agents") {
        s.settings.agents = data.getAll("domains");
        await persist("Permissions enregistrées.");
      } else if (form.id === "evo-connect") {
        const url = new URL(get("endpoint"));
        if (
          (url.protocol !== "https:" &&
            !(
              url.protocol === "http:" &&
              ["localhost", "127.0.0.1"].includes(url.hostname)
            )) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          url.pathname !== "/"
        )
          throw new Error(
            "Utilise une origine HTTPS, sans chemin ni paramètres (localhost accepté pour les tests).",
          );
        identity = null;
        remote = null;
        endpoint = url.origin;
        token = get("token");
        const me = await api("/me"),
          snapshot = await api("/snapshot");
        if (snapshot.archive) await Q.FullBackup.prepare(snapshot.archive);
        identity = me;
        remote = snapshot;
        syncPreview = JSON.stringify(s);
        message = "Versions comparées. Aucun transfert appliqué.";
        ctx.render();
      }
    } catch (error) {
      ctx.error(error.message);
    }
    return true;
  }
  return { view, click, submit };
}
