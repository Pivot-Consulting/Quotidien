namespace Q.Vault {
  export const statuses = [
    "À traiter",
    "Valide",
    "À renouveler",
    "Expiré",
    "Archivé",
  ];
  const fold = (v: unknown) =>
    String(v || "")
      .toLocaleLowerCase("fr")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  export function expiry(
    r: RecordData,
    today = day(),
  ): "expired" | "soon" | "later" | "none" {
    const date = String(r.expiry || r.date || "");
    if (!validDate(date)) return "none";
    if (date < today) return "expired";
    return date <= OS.addDays(today, 30) ? "soon" : "later";
  }
  export function search(s: State, query = "", status = ""): RecordData[] {
    const term = fold(query.trim());
    return s.documents
      .filter(
        (r) =>
          Personal.visible(r) &&
          (!status || r.status === status) &&
          (!term ||
            fold(
              [
                r.title,
                r.category,
                r.company,
                r.details,
                r.fileName,
                Personal.tags(r).join(" "),
              ].join(" "),
            ).includes(term)),
      )
      .sort(
        (a, b) =>
          String(a.expiry || "9999").localeCompare(
            String(b.expiry || "9999"),
          ) || Personal.title(a).localeCompare(Personal.title(b), "fr"),
      );
  }
  export function stats(s: State, today = day()) {
    const live = s.documents.filter(Personal.visible),
      attached = live.filter((x) => x.fileId);
    return {
      total: live.length,
      attached: attached.length,
      bytes: attached.reduce((n, x) => n + Number(x.fileSize || 0), 0),
      expired: live.filter((x) => expiry(x, today) === "expired").length,
      soon: live.filter((x) => expiry(x, today) === "soon").length,
    };
  }
  export function validate(s: State): void {
    for (const r of s.documents) {
      if (
        r.expiry !== undefined &&
        r.expiry !== "" &&
        (typeof r.expiry !== "string" || !validDate(r.expiry))
      )
        throw new Error("Date d’expiration documentaire invalide.");
      if (r.status !== undefined && !statuses.includes(String(r.status)))
        throw new Error("Statut documentaire invalide.");
      for (const field of ["company", "fileId", "fileName", "fileType"])
        if (r[field] !== undefined && typeof r[field] !== "string")
          throw new Error("Métadonnée documentaire invalide.");
      if (
        r.fileSize !== undefined &&
        (!Number.isFinite(Number(r.fileSize)) ||
          Number(r.fileSize) < 0 ||
          Number(r.fileSize) > 25 * 1024 * 1024)
      )
        throw new Error("Taille documentaire invalide.");
      if (
        r.projectId &&
        (typeof r.projectId !== "string" ||
          !s.os.some((p) => p.kind === "project" && p.id === r.projectId))
      )
        throw new Error("Projet du document introuvable.");
    }
  }
}
