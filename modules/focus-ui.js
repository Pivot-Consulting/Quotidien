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
