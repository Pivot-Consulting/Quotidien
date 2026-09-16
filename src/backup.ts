/** Portable, integrity-checked local backup. No network or external service. */
namespace Q.FullBackup {
  export const MAX_BYTES = 100 * 1024 * 1024;
  export const MAX_ARCHIVE_BYTES = 160 * 1024 * 1024;
  type Entry = {
    id: string;
    type: string;
    size: number;
    sha256: string;
    base64: string;
  };
  export type Prepared = { state: State; files: { id: string; blob: Blob }[] };
  export function fileIds(state: State): string[] {
    const ids = new Set<string>();
    const add = (r: RecordData | null | undefined) => {
      if (r && typeof r.fileId === "string" && r.fileId) ids.add(r.fileId);
    };
    state.documents.forEach(add);
    Personal.revisions(state)
      .filter((r) => r.ref.key === "documents")
      .forEach((r) => {
        add(r.before);
        add(r.after);
      });
    return [...ids].sort();
  }
  async function hash(bytes: Uint8Array): Promise<string> {
    if (!globalThis.crypto?.subtle)
      throw new Error(
        "La vérification d’intégrité nécessite HTTPS ou localhost.",
      );
    const value = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(value))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  function encode(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 32768)
      binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  }
  export async function create(
    state: State,
    repository: Durable.Repository,
  ): Promise<string> {
    const next = normalize(state),
      files: Entry[] = [];
    let total = 0;
    for (const id of fileIds(next)) {
      const blob = await repository.getFile(id);
      if (!blob)
        throw new Error(
          "Fichier manquant : " +
            id +
            ". La sauvegarde complète est interrompue ; l’export des données seules reste disponible.",
        );
      total += blob.size;
      if (total > MAX_BYTES)
        throw new Error(
          "La sauvegarde complète est limitée à 100 Mo de fichiers. Télécharge séparément les pièces supplémentaires.",
        );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      files.push({
        id,
        type: blob.type,
        size: blob.size,
        sha256: await hash(bytes),
        base64: encode(bytes),
      });
    }
    const raw = JSON.stringify({
      app: "quotidien",
      format: 2,
      release: RELEASE,
      exportedAt: new Date().toISOString(),
      state: next,
      stateSha256: await hash(new TextEncoder().encode(JSON.stringify(next))),
      files,
    });
    if (new Blob([raw]).size > MAX_ARCHIVE_BYTES)
      throw new Error("La sauvegarde complète dépasse 160 Mo.");
    return raw;
  }
  export async function prepare(raw: string): Promise<Prepared> {
    if (new Blob([raw]).size > MAX_ARCHIVE_BYTES)
      throw new Error("Sauvegarde trop volumineuse (160 Mo maximum).");
    const data = JSON.parse(raw);
    if (
      !data ||
      data.app !== "quotidien" ||
      data.format !== 2 ||
      !Array.isArray(data.files)
    )
      throw new Error("Format de sauvegarde complète invalide.");
    const state = normalize(data.state);
    if (
      data.stateSha256 !==
      (await hash(new TextEncoder().encode(JSON.stringify(data.state))))
    )
      throw new Error("Les données de la sauvegarde sont corrompues.");
    const expected = new Set(fileIds(state)),
      seen = new Set<string>();
    const files: Prepared["files"] = [];
    const mapping = new Map<string, string>();
    let total = 0;
    for (const entry of data.files) {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        !expected.has(entry.id) ||
        seen.has(entry.id) ||
        typeof entry.type !== "string" ||
        typeof entry.base64 !== "string" ||
        !Number.isInteger(entry.size) ||
        entry.size < 0 ||
        entry.size > 25 * 1024 * 1024 ||
        entry.base64.length !== 4 * Math.ceil(entry.size / 3) ||
        /[^A-Za-z0-9+/=]/.test(entry.base64)
      )
        throw new Error("Manifeste des fichiers invalide.");
      total += entry.size;
      if (total > MAX_BYTES)
        throw new Error("La sauvegarde dépasse 100 Mo de fichiers.");
      seen.add(entry.id);
      const bytes = Uint8Array.from(atob(entry.base64), (c) => c.charCodeAt(0));
      if (
        bytes.length !== entry.size ||
        encode(bytes) !== entry.base64 ||
        (await hash(bytes)) !== entry.sha256
      )
        throw new Error("Pièce jointe corrompue : " + entry.id);
      // New keys preserve all previous files and recovery snapshots, even on ID collision.
      const id = "restore:" + crypto.randomUUID();
      mapping.set(entry.id, id);
      files.push({ id, blob: new Blob([bytes], { type: entry.type }) });
    }
    if (seen.size !== expected.size)
      throw new Error("Sauvegarde incomplète : pièce jointe manquante.");
    const remap = (r: RecordData | null | undefined) => {
      if (r && typeof r.fileId === "string" && mapping.has(r.fileId))
        r.fileId = mapping.get(r.fileId)!;
    };
    state.documents.forEach(remap);
    Personal.revisions(state)
      .filter((r) => r.ref.key === "documents")
      .forEach((r) => {
        remap(r.before);
        remap(r.after);
      });
    return { state: normalize(state), files };
  }
}
