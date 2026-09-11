function createAutomationUI(ctx) {
  const A = Q.Automation,
    e = ctx.esc;
  let noticeFilter = "unread";
  function badge() {
    const unread = A.visible(ctx.state()).filter((x) => !x.read).length;
    return `<button class="icon" aria-label="Notifications${unread ? " · " + unread + " non lues" : ""}" data-automation="notices">♢${unread ? '<span class="count">' + unread + "</span>" : ""}</button>`;
  }
  function today() {
    const notices = A.visible(ctx.state())
      .filter((x) => !x.read)
      .slice(0, 3);
    return notices.length
      ? `<section class="card"><div class="section-head"><div><span class="eyebrow">À EXAMINER</span><h2>Notifications</h2></div><button class="mini" data-automation="notices">Tout voir</button></div>${notices.map(notice).join("")}</section>`
      : "";
  }
  function notice(n) {
    return `<article class="shared-action"><div class="section-head"><h3>${e(n.title)}</h3><span class="tag">P${e(n.priority)}</span></div><p>${e(n.message)}</p><div class="os-actions">${n.sourceKey ? '<button class="mini" data-automation="source" data-id="' + e(n.id) + '">Voir la source</button>' : ""}<button class="mini" data-automation="read" data-id="${e(n.id)}">Lu</button><button class="mini" data-automation="snooze" data-days="1" data-id="${e(n.id)}">Demain</button><button class="mini" data-automation="snooze" data-days="7" data-id="${e(n.id)}">7 jours</button></div></article>`;
  }
  function notices() {
    const rows = A.visible(ctx.state()).filter(
      (x) => noticeFilter === "all" || !x.read,
    );
    ctx.modal(
      "Notifications",
      `<div class="tabs"><button class="${noticeFilter === "unread" ? "active" : ""}" data-automation="filter" data-filter="unread">Non lues</button><button class="${noticeFilter === "all" ? "active" : ""}" data-automation="filter" data-filter="all">Toutes</button></div><div class="shared-actions">${rows.map(notice).join("") || '<p class="empty">Aucune notification dans ce filtre.</p>'}</div><p class="meta">Les règles sont évaluées lorsque QUOTIDIEN est ouvert. Aucune surveillance en arrière-plan n’est annoncée.</p>`,
    );
  }
  function view() {
    const s = ctx.state(),
      rules = s.automations.filter((x) => !x.deleted && x.engineVersion === 1),
      logs = (s.automationLogs || []).slice(0, 20);
    return `<div class="page-title"><div><span class="eyebrow">AUTOMATION OS</span><h1>Automatisations</h1></div><button class="primary" data-automation="new">＋ Règle</button></div><section class="card"><h2>Modèles</h2><div class="os-actions">${[
      ["Document à renouveler", "Renouveler mes documents"],
      ["Dépense importante", "Contrôler les dépenses importantes"],
      ["Projet stagnant", "Relancer les projets stagnants"],
      ["Voyage créé", "Préparer chaque voyage"],
      ["Revue du dimanche", "Préparer la semaine"],
    ]
      .map(
        ([trigger, title]) =>
          `<button class="mini" data-automation="template" data-trigger="${e(trigger)}" data-title="${e(title)}">${e(title)}</button>`,
      )
      .join(
        "",
      )}</div></section><section class="card"><div class="section-head"><div><h2>${rules.length} règle(s)</h2><p class="meta">Déclencheur → conditions → actions multiples. Exécution à l’ouverture ou manuelle.</p></div><button class="mini" data-automation="run">Exécuter maintenant</button></div><div class="shared-actions">${rules.map(rule).join("") || '<p class="empty">Crée une règle à partir d’un déclencheur réel.</p>'}</div></section><section class="card"><h2>Préférences de notification</h2><form id="notification-prefs" class="form"><label>Début des horaires silencieux<input type="time" name="quietStart" value="${e(s.settings.notificationQuietStart || "22:00")}"></label><label>Fin des horaires silencieux<input type="time" name="quietEnd" value="${e(s.settings.notificationQuietEnd || "07:00")}"></label><button class="primary" type="submit">Enregistrer</button></form><p class="meta">Ces horaires prépareront les notifications système futures. Les alertes internes restent consultables à tout moment.</p></section><section class="card"><h2>Journal d’exécution</h2>${logs.map((l) => `<p class="meta">${e(l.at.slice(0, 16).replace("T", " "))} · ${e(rules.find((r) => r.id === l.ruleId)?.title || "Règle retirée")} · ${e(l.actions.join(", ") || "Aucune action")}</p>`).join("") || '<p class="empty">Aucune exécution.</p>'}</section>`;
  }
  function rule(r) {
    return `<article class="shared-action"><div class="section-head"><div><p class="meta">${e(r.trigger)}</p><h3>${e(r.title)}</h3></div><span class="tag">${r.active ? "Active" : "Inactive"}</span></div><p class="meta">${e((r.actions || []).join(" + "))}</p><div class="os-actions"><button class="mini" data-automation="toggle" data-id="${e(r.id)}">${r.active ? "Désactiver" : "Activer"}</button><button class="mini" data-automation="edit" data-id="${e(r.id)}">Modifier</button><button class="mini" data-automation="duplicate" data-id="${e(r.id)}">Dupliquer</button><button class="danger" data-del="automations" data-id="${e(r.id)}">×</button></div></article>`;
  }
  function open(record) {
    const r = record || {};
    ctx.modal(
      record ? "Modifier l’automatisation" : "Nouvelle automatisation",
      `<form id="automation-builder" class="form" data-draft-kind="automation-builder" data-draft-id="${e(r.id || "")}"><label>Nom<input name="title" required value="${e(r.title || "")}"></label><label>Déclencheur<select name="trigger">${A.triggers.map((x) => `<option ${r.trigger === x ? "selected" : ""}>${e(x)}</option>`).join("")}</select></label><label>Horizon / inactivité (jours)<input name="horizon" type="number" min="0" value="${e(r.horizon ?? 7)}"></label><label>Seuil financier (€)<input name="threshold" type="number" min="0" step="0.01" value="${e(r.threshold ?? 500)}"></label><label>Catégorie exacte (facultatif)<input name="category" value="${e(r.category || "")}"></label><label>Priorité de notification<input name="priority" type="number" min="1" max="5" value="${e(r.priority ?? 2)}"></label><fieldset class="full"><legend>Actions</legend>${A.actions.map((x) => `<label><input type="checkbox" name="actions" value="${e(x)}" ${(r.actions || ["Notification"]).includes(x) ? "checked" : ""}> ${e(x)}</label>`).join("")}</fieldset><label><input type="checkbox" name="active" ${r.active !== false ? "checked" : ""}> Règle active</label><button class="primary" type="submit">Enregistrer et évaluer</button></form>`,
    );
    ctx.markClean();
  }
  async function submit(form) {
    if (form.id === "notification-prefs") {
      const prefs = new FormData(form);
      ctx.state().settings.notificationQuietStart = String(
        prefs.get("quietStart") || "22:00",
      );
      ctx.state().settings.notificationQuietEnd = String(
        prefs.get("quietEnd") || "07:00",
      );
      if (await ctx.save()) ctx.toast("Préférences enregistrées");
      return true;
    }
    if (form.id !== "automation-builder") return false;
    const d = new FormData(form),
      id = form.dataset.draftId || ctx.id(),
      old = ctx.state().automations.find((x) => x.id === id),
      record = Object.assign(
        { id, createdAt: new Date().toISOString() },
        old || {},
        {
          engineVersion: 1,
          title: String(d.get("title") || "").trim(),
          trigger: String(d.get("trigger")),
          horizon: Number(d.get("horizon")),
          threshold: Number(d.get("threshold")),
          category: String(d.get("category") || "").trim(),
          priority: Number(d.get("priority")),
          actions: d.getAll("actions").map(String),
          active: d.has("active"),
          updatedAt: new Date().toISOString(),
        },
      );
    const index = ctx.state().automations.findIndex((x) => x.id === id);
    if (index < 0) ctx.state().automations.unshift(record);
    else ctx.state().automations[index] = record;
    A.run(ctx.state(), Q.day(), ctx.id);
    if (await ctx.save()) {
      ctx.close();
      ctx.render();
      ctx.toast("Règle enregistrée et évaluée");
    }
    return true;
  }
  async function click(t) {
    const action = t.dataset.automation;
    if (!action) return false;
    const s = ctx.state(),
      record = s.automations.find((x) => x.id === t.dataset.id),
      noticeRecord = (s.notifications || []).find((x) => x.id === t.dataset.id);
    try {
      if (action === "notices") notices();
      else if (action === "filter") {
        noticeFilter = t.dataset.filter === "all" ? "all" : "unread";
        notices();
      } else if (action === "new") open();
      else if (action === "template")
        open({
          title: t.dataset.title,
          trigger: t.dataset.trigger,
          horizon: t.dataset.trigger === "Projet stagnant" ? 30 : 7,
          threshold: 500,
          priority: 2,
          actions:
            t.dataset.trigger === "Voyage créé"
              ? ["Notification", "Créer une checklist"]
              : ["Notification"],
          active: true,
        });
      else if (action === "edit" && record) open(record);
      else if (action === "toggle" && record) {
        record.active = !record.active;
        if (await ctx.save()) ctx.render();
      } else if (action === "duplicate" && record) {
        const copy = Q.clone(record);
        copy.id = ctx.id();
        copy.title = record.title + " (copie)";
        copy.active = false;
        delete copy.createdAt;
        delete copy.updatedAt;
        s.automations.unshift(copy);
        if (await ctx.save()) ctx.render();
      } else if (action === "run") {
        const count = A.run(s, Q.day(), ctx.id);
        if (await ctx.save()) {
          ctx.render();
          ctx.toast(
            count
              ? `${count} événement(s) traité(s)`
              : "Aucun nouvel événement",
          );
        }
      } else if (action === "read" && noticeRecord) {
        A.read(s, noticeRecord.id);
        if (await ctx.save()) notices();
      } else if (action === "snooze" && noticeRecord) {
        A.snooze(s, noticeRecord.id, Number(t.dataset.days));
        if (await ctx.save()) notices();
      } else if (action === "source" && noticeRecord?.sourceKey) {
        A.read(s, noticeRecord.id);
        await ctx.save();
        ctx.close();
        ctx.edit({ key: noticeRecord.sourceKey, id: noticeRecord.sourceId });
      }
    } catch (error) {
      ctx.error(error.message);
    }
    return true;
  }
  return { badge, today, view, open, submit, click };
}
