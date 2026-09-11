function createRoutinesUI(ctx) {
  const R = Q.Routines,
    e = ctx.esc;
  function card(item) {
    const run = item.run,
      done = !!run?.completedAt,
      progress = run?.steps.length
        ? run.steps.filter((x) => x.done).length + "/" + run.steps.length
        : done
          ? "Terminée"
          : "Prête";
    return `<article class="shared-action"><div class="section-head"><div><p class="meta">${e(item.routine.time || "Sans horaire")} · ${e(Q.Personal.meta(item.routine).context || "Tous contextes")}</p><h3>${e(item.routine.name)}</h3></div><span class="tag">${done ? "Terminée" : progress}</span></div><div class="os-actions"><button class="${done ? "mini" : "primary"}" data-routine="open" data-id="${e(item.routine.id)}">${done ? "Voir" : run ? "Continuer" : "Démarrer"}</button></div></article>`;
  }
  function today() {
    const items = R.today(ctx.state());
    return `<section class="card"><div class="section-head"><div><span class="eyebrow">RITUELS DU JOUR</span><h2>Routines</h2></div><div class="os-actions"><button class="mini" data-routine="templates">Installer les routines essentielles</button><button class="mini" data-action="add-routine">＋</button></div></div><div class="shared-actions">${items.map(card).join("") || '<p class="empty">Aucune routine prévue aujourd’hui.</p>'}</div></section>`;
  }
  function open(id) {
    const s = ctx.state(),
      routine = s.routines.find((x) => x.id === id);
    if (!routine) return;
    const run = R.start(s, id, ctx.id()),
      history = R.history(s, id, 8);
    ctx.modal(
      routine.name,
      `<p class="meta">${e(routine.time || "Sans horaire")} · ${e(routine.schedule || "Tous les jours")}</p><div class="list">${run.steps.map((step, index) => `<label class="item"><input type="checkbox" data-routine-step="${index}" ${step.done ? "checked" : ""} ${run.completedAt ? "disabled" : ""}><span>${e(step.text)}</span></label>`).join("") || '<p class="empty">Cette routine ne contient aucune étape.</p>'}</div><div class="os-actions">${run.completedAt ? '<span class="tag">Terminée aujourd’hui</span>' : '<button class="primary" data-routine="complete" data-id="' + e(id) + '">Terminer la routine</button>'}<button class="mini" data-edit="routines" data-id="${e(id)}">Modifier</button></div>${history.length ? "<details><summary>Historique récent</summary>" + history.map((x) => `<p class="meta">${e(x.date)} · ${x.completedAt ? "Terminée" : "Incomplète"} · ${x.steps.filter((y) => y.done).length}/${x.steps.length}</p>`).join("") + "</details>" : ""}`,
    );
  }
  async function click(t) {
    const action = t.dataset.routine;
    if (!action) return false;
    try {
      if (action === "open") {
        const existing = R.run(ctx.state(), t.dataset.id);
        if (!existing) {
          R.start(ctx.state(), t.dataset.id, ctx.id());
          if (!(await ctx.save())) return true;
        }
        open(t.dataset.id);
      } else if (action === "templates") {
        const count = R.installDefaults(ctx.state(), ctx.id);
        if (await ctx.save()) {
          ctx.render();
          ctx.toast(
            count
              ? `${count} routine(s) installée(s)`
              : "Les routines essentielles sont déjà disponibles",
          );
        }
      } else if (action === "complete") {
        R.complete(ctx.state(), t.dataset.id);
        if (await ctx.save()) {
          ctx.close();
          ctx.render();
          ctx.toast("Routine terminée");
        }
      }
    } catch (error) {
      ctx.error(error.message);
    }
    return true;
  }
  async function change(input) {
    if (input.dataset.routineStep === undefined) return false;
    const modal = input.closest(".modal"),
      id = modal.querySelector("[data-routine=complete]")?.dataset.id;
    if (!id) return true;
    try {
      R.toggle(ctx.state(), id, Number(input.dataset.routineStep));
      if (await ctx.save()) open(id);
    } catch (error) {
      ctx.error(error.message);
    }
    return true;
  }
  return { today, click, change };
}
