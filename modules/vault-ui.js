function createVaultUI(ctx) {
  const V = Q.Vault,
    e = ctx.esc;
  let query = "",
    status = "",
    previewUrl = null;
  const bytes = (n) =>
    n < 1024
      ? `${n} o`
      : n < 1048576
        ? `${(n / 1024).toFixed(1)} Ko`
        : `${(n / 1048576).toFixed(1)} Mo`;
  function cleanup() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }
  function card(r) {
    const expiry = V.expiry(r),
      label =
        expiry === "expired"
          ? "Expiré"
          : expiry === "soon"
            ? "À renouveler"
            : r.status || "À traiter";
    return `<article class="shared-action"><div class="section-head"><div><p class="meta">${e(r.category || "Sans catégorie")} · ${e(r.company || "Sans société")}</p><h3>${e(r.title)}</h3></div><span class="tag">${e(label)}</span></div><p class="meta">${r.expiry ? "Échéance " + e(r.expiry) + " · " : ""}${r.fileName ? e(r.fileName) + " · " + bytes(Number(r.fileSize || 0)) : "Aucun fichier joint"}</p><div class="os-actions">${r.fileId ? '<button class="mini" data-vault="preview" data-id="' + e(r.id) + '">Aperçu</button><button class="mini" data-vault="download" data-id="' + e(r.id) + '">Télécharger</button>' : ""}<button class="mini" data-vault="edit" data-id="${e(r.id)}">Modifier</button><button class="danger" data-del="documents" data-id="${e(r.id)}">×</button></div></article>`;
  }
  function view() {
    const s = ctx.state(),
      stats = V.stats(s),
      rows = V.search(s, query, status);
    return `<div class="page-title"><div><span class="eyebrow">COFFRE DOCUMENTAIRE</span><h1>Documents</h1></div><button class="primary" data-vault="new">＋ Document</button></div><section class="grid stat-grid"><article class="card stat"><strong>${stats.total}</strong><span>documents</span></article><article class="card stat"><strong>${stats.attached}</strong><span>fichiers locaux · ${bytes(stats.bytes)}</span></article><article class="card stat"><strong>${stats.soon}</strong><span>échéance sous 30 jours</span></article><article class="card stat"><strong>${stats.expired}</strong><span>expirés</span></article></section><section class="card"><form id="vault-search" class="form"><label class="full">Rechercher<input name="query" value="${e(query)}" placeholder="Titre, société, catégorie, fichier ou tag"></label><label>Statut<select name="status"><option value="">Tous</option>${V.statuses.map((x) => `<option ${status === x ? "selected" : ""}>${e(x)}</option>`).join("")}</select></label><button class="mini" type="submit">Filtrer</button></form></section><section class="card"><div class="section-head"><h2>${rows.length} résultat(s)</h2><p class="meta">Les fichiers restent sur cet appareil et ne sont pas inclus dans l’export JSON.</p></div><div class="shared-actions">${rows.map(card).join("") || '<p class="empty">Aucun document pour ces filtres.</p>'}</div></section>`;
  }
  function projectOptions(record) {
    return ctx
      .state()
      .os.filter(
        (x) =>
          x.kind === "project" && (!x.deleted || x.id === record?.projectId),
      )
      .map(
        (x) =>
          `<option value="${e(x.id)}" ${x.id === record?.projectId ? "selected" : ""}>${e(x.title)}</option>`,
      )
      .join("");
  }
  function open(record) {
    const r = record || {};
    ctx.modal(
      record ? "Modifier le document" : "Nouveau document",
      `<form id="vault-form" class="form" data-draft-kind="vault" data-draft-id="${e(r.id || "")}"><label>Titre<input name="title" required value="${e(r.title || "")}"></label><label>Catégorie<input name="category" value="${e(r.category || "")}" placeholder="Contrat, facture, assurance…"></label><label>Société<input name="company" value="${e(r.company || "")}"></label><label>Statut<select name="status">${V.statuses.map((x) => `<option ${x === (r.status || "À traiter") ? "selected" : ""}>${e(x)}</option>`).join("")}</select></label><label>Expiration / renouvellement<input name="expiry" type="date" value="${e(r.expiry || "")}"></label><label>Montant (€)<input name="amount" type="number" step="0.01" value="${e(r.amount ?? "")}"></label><label>Projet lié<select name="projectId"><option value="">Aucun</option>${projectOptions(r)}</select></label><label class="full">Tags<input name="tags" value="${e(Array.isArray(r.personal?.tags) ? r.personal.tags.join(", ") : r.tags || "")}"></label><label class="full">Notes<textarea name="details">${e(r.details || "")}</textarea></label><label class="full">${r.fileName ? "Remplacer le fichier · " + e(r.fileName) : "Joindre un fichier (25 Mo maximum)"}<input name="file" type="file"></label><button class="primary" type="submit">Enregistrer</button></form>${record ? ctx.footer({ key: "documents", id: r.id }) : ""}`,
    );
    ctx.markClean();
  }
  async function fileAction(record, download = false) {
    const blob = await ctx.repository.getFile(record.fileId);
    if (!blob)
      throw new Error("Le fichier n’est plus disponible sur cet appareil.");
    if (download) {
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = record.fileName || "document";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    cleanup();
    previewUrl = URL.createObjectURL(blob);
    const image = /^image\/(png|jpeg|webp|gif)$/.test(record.fileType),
      pdf = record.fileType === "application/pdf";
    if (!image && !pdf) {
      ctx.modal(
        record.title,
        `<p>Ce format est conservé mais n’est pas prévisualisé dans l’application.</p><button class="primary" data-vault="download" data-id="${e(record.id)}">Télécharger ${e(record.fileName)}</button>`,
      );
      return;
    }
    ctx.modal(
      record.title,
      image
        ? `<img class="vault-preview" alt="Aperçu de ${e(record.title)}" src="${e(previewUrl)}">`
        : `<iframe class="vault-preview" title="Aperçu de ${e(record.title)}" src="${e(previewUrl)}"></iframe>`,
    );
  }
  async function submit(form) {
    if (form.id === "vault-search") {
      const d = new FormData(form);
      query = String(d.get("query") || "").trim();
      status = String(d.get("status") || "");
      ctx.render();
      return true;
    }
    if (form.id !== "vault-form") return false;
    const data = new FormData(form),
      id = form.dataset.draftId || ctx.id(),
      old = ctx.state().documents.find((x) => x.id === id),
      file = data.get("file"),
      newFile = file instanceof File && file.size > 0 ? file : null,
      newFileId = newFile ? id + ":" + Date.now() : old?.fileId;
    if (newFile && newFile.size > 25 * 1024 * 1024) {
      ctx.error("Le fichier dépasse 25 Mo.");
      return true;
    }
    if (newFile) await ctx.repository.putFile(newFileId, newFile);
    const record = Object.assign(
      { id, createdAt: new Date().toISOString() },
      old || {},
      {
        title: String(data.get("title") || "").trim(),
        category: String(data.get("category") || "").trim(),
        company: String(data.get("company") || "").trim(),
        status: String(data.get("status")),
        expiry: String(data.get("expiry") || ""),
        amount:
          data.get("amount") === "" ? undefined : Number(data.get("amount")),
        projectId: String(data.get("projectId") || ""),
        details: String(data.get("details") || "").trim(),
        updatedAt: new Date().toISOString(),
      },
    );
    record.personal = {
      ...(record.personal || {}),
      tags: String(data.get("tags") || "")
        .split(/[,;#]/)
        .map((x) => x.trim())
        .filter(Boolean),
    };
    if (newFile)
      Object.assign(record, {
        fileId: newFileId,
        fileName: newFile.name,
        fileType: newFile.type || "application/octet-stream",
        fileSize: newFile.size,
      });
    const index = ctx.state().documents.findIndex((x) => x.id === id);
    if (index < 0) ctx.state().documents.unshift(record);
    else ctx.state().documents[index] = record;
    if (await ctx.save()) {
      if (newFile && old?.fileId && old.fileId !== newFileId)
        await ctx.repository.deleteFile(old.fileId).catch(() => {});
      ctx.close();
      ctx.render();
      ctx.toast("Document enregistré");
    } else if (newFile) await ctx.repository.deleteFile(newFileId);
    return true;
  }
  async function click(t) {
    const action = t.dataset.vault;
    if (!action) return false;
    const record = ctx.state().documents.find((x) => x.id === t.dataset.id);
    try {
      if (action === "new") open();
      else if (action === "edit" && record) open(record);
      else if (action === "preview" && record) await fileAction(record);
      else if (action === "download" && record) await fileAction(record, true);
    } catch (error) {
      ctx.error(error.message);
    }
    return true;
  }
  return { view, open, submit, click, cleanup };
}
