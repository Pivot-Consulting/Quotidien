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
