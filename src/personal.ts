/** Shared, additive layer: stable collection+id addresses; no reinterpretation of legacy data. */
namespace Q.Personal {
  export type Ref = { key: Collection; id: string };
  export type Hit = Ref & { record: RecordData };
  export type Meta = {
    tags?: string[];
    priority?: number;
    energy?: string;
    context?: string;
    duration?: number;
    description?: string;
    location?: string;
    owner?: string;
    favorite?: boolean;
    archived?: boolean;
    checklist?: { text: string; done: boolean }[];
  };
  export type Connection = {
    id: string;
    from: Ref;
    to: Ref;
    type: string;
    label?: string;
    deleted?: boolean;
    inferred?: boolean;
  };
  export type Revision = {
    id: string;
    ref: Ref;
    at: string;
    action: string;
    before?: RecordData;
    after: RecordData;
  };
  export type Filter = {
    query?: string;
    key?: string;
    domain?: string;
    status?: string;
    tag?: string;
    archive?: string;
    favorite?: boolean;
    scope?: string;
    from?: string;
    to?: string;
  };
  export const labels: Record<Collection, string> = {
    os: "Life OS",
    tasks: "Tâches",
    events: "Événements",
    notes: "Notes",
    habits: "Habitudes",
    routines: "Routines",
    goals: "Objectifs",
    workouts: "Séances",
    health: "Mesures",
    life: "Captures",
    finances: "Transactions",
    documents: "Documents",
    assets: "Équipements",
    automations: "Idées de règles",
  };
  export const relationTypes: Record<string, string> = {
    related: "Est lié à",
    depends: "Dépend de",
    contributes: "Contribue à",
  };
  const obj = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  export const meta = (r: RecordData): Meta => (r.personal || {}) as Meta;
  export const visible = (r: RecordData): boolean =>
    !r.deleted && !meta(r).archived;
  export const token = (r: Ref): string => JSON.stringify([r.key, r.id]);
  export const same = (a: Ref, b: Ref): boolean =>
    a.key === b.key && a.id === b.id;
  export const title = (r: RecordData): string =>
    String(r.title || r.name || r.label || r.type || r.kind || "Élément");
  export const fold = (v: unknown): string =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  export const resolve = (s: State, r: Ref): RecordData | undefined =>
    s[r.key]?.find((x) => x.id === r.id);
  export const all = (s: State): Hit[] =>
    collections.flatMap((key) =>
      s[key].map((record) => ({ key, id: record.id, record })),
    );
  export const completed = (r: RecordData): boolean =>
    r.done === true ||
    r.status === "Terminé" ||
    (r.progress !== undefined && Number(r.progress) >= 100);
  export const date = (r: RecordData): string => String(r.due || r.date || "");
  export const tags = (r: RecordData): string[] => [
    ...new Set(
      [...(meta(r).tags || []), ...String(r.tags || "").split(/[,;#]/)]
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
  export function domain(hit: Hit): string {
    if (hit.key === "os") return OS.domainFor(hit.record.kind)?.id || "";
    if (hit.key === "life")
      return OS.domains.find((d) => d.name === hit.record.domain)?.id || "";
    return (
      (
        {
          finances: "finance",
          documents: "documents",
          assets: "home",
          workouts: "health",
          health: "health",
          goals: "projects",
          automations: "automation",
        } as Record<string, string>
      )[hit.key] || ""
    );
  }
  export function describe(hit: Hit): string {
    return hit.key === "os"
      ? `${OS.domainFor(hit.record.kind)?.name} · ${OS.getModel(hit.record.kind)?.label}`
      : labels[hit.key];
  }
  export function validateMeta(r: RecordData): void {
    if (r.personal === undefined) return;
    if (!obj(r.personal)) throw new Error("Propriétés communes invalides.");
    const m = r.personal;
    for (const f of ["description", "location", "owner", "context"])
      if (m[f] !== undefined && typeof m[f] !== "string")
        throw new Error(`Propriété ${f} invalide.`);
    for (const f of ["favorite", "archived"])
      if (m[f] !== undefined && typeof m[f] !== "boolean")
        throw new Error(`Propriété ${f} invalide.`);
    if (
      m.tags !== undefined &&
      (!Array.isArray(m.tags) ||
        m.tags.some((t) => typeof t !== "string" || !t.trim()))
    )
      throw new Error("Tags invalides.");
    if (
      m.priority !== undefined &&
      (!Number.isInteger(m.priority) ||
        Number(m.priority) < 1 ||
        Number(m.priority) > 5)
    )
      throw new Error("Priorité attendue entre 1 et 5.");
    if (
      m.duration !== undefined &&
      (typeof m.duration !== "number" ||
        !Number.isFinite(m.duration) ||
        m.duration <= 0)
    )
      throw new Error("Durée positive attendue.");
    if (
      m.energy !== undefined &&
      !["", "low", "medium", "high"].includes(String(m.energy))
    )
      throw new Error("Énergie invalide.");
    if (
      m.checklist !== undefined &&
      (!Array.isArray(m.checklist) ||
        m.checklist.some(
          (x) =>
            !obj(x) ||
            typeof x.text !== "string" ||
            !x.text.trim() ||
            typeof x.done !== "boolean",
        ))
    )
      throw new Error("Checklist invalide.");
  }
  export function connections(s: State): Connection[] {
    return (s.connections || []) as Connection[];
  }
  export function revisions(s: State): Revision[] {
    return (s.activity || []) as Revision[];
  }
  export function validate(s: State): void {
    const validRef = (r: unknown): r is Ref =>
      obj(r) &&
      collections.includes(r.key as Collection) &&
      typeof r.id === "string" &&
      !!resolve(s, r as Ref);
    if (s.connections !== undefined && !Array.isArray(s.connections))
      throw new Error("Relations invalides.");
    const ids = new Set(),
      pairs = new Set();
    const edges = new Map<string, string[]>();
    for (const c of connections(s)) {
      if (
        !obj(c) ||
        typeof c.id !== "string" ||
        !c.id ||
        ids.has(c.id) ||
        !validRef(c.from) ||
        !validRef(c.to) ||
        same(c.from, c.to) ||
        !Object.prototype.hasOwnProperty.call(relationTypes, c.type)
      )
        throw new Error("Relation invalide ou référence manquante.");
      if (c.deleted !== undefined && typeof c.deleted !== "boolean")
        throw new Error("État de relation invalide.");
      if (c.label !== undefined && typeof c.label !== "string")
        throw new Error("Libellé de relation invalide.");
      ids.add(c.id);
      if (c.deleted) continue;
      let a = token(c.from),
        b = token(c.to);
      if (c.type === "related" && a > b) [a, b] = [b, a];
      const pair = JSON.stringify([a, b, c.type]);
      if (pairs.has(pair)) throw new Error("Cette relation existe déjà.");
      pairs.add(pair);
      if (c.type === "depends") edges.set(a, [...(edges.get(a) || []), b]);
    }
    const visiting = new Set(),
      visited = new Set();
    const visit = (id: string): void => {
      if (visiting.has(id))
        throw new Error(
          "Dépendance circulaire : ce lien bloquerait les actions.",
        );
      if (visited.has(id)) return;
      visiting.add(id);
      for (const next of edges.get(id) || []) visit(next);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of edges.keys()) visit(id);
    if (s.activity !== undefined && !Array.isArray(s.activity))
      throw new Error("Historique invalide.");
    const historyIds = new Set();
    for (const h of revisions(s)) {
      if (
        !obj(h) ||
        typeof h.id !== "string" ||
        !h.id ||
        historyIds.has(h.id) ||
        !validRef(h.ref) ||
        typeof h.at !== "string" ||
        !Number.isFinite(Date.parse(h.at)) ||
        typeof h.action !== "string" ||
        !obj(h.after) ||
        h.after.id !== h.ref.id ||
        (h.before !== undefined && (!obj(h.before) || h.before.id !== h.ref.id))
      )
        throw new Error("Révision invalide.");
      historyIds.add(h.id);
    }
    const searches = s.settings.searches;
    if (
      searches !== undefined &&
      (!Array.isArray(searches) ||
        searches.some(
          (x) =>
            !obj(x) ||
            typeof x.name !== "string" ||
            !obj(x.filter) ||
            Object.entries(x.filter).some(([key, value]) =>
              key === "favorite"
                ? typeof value !== "boolean"
                : typeof value !== "string",
            ),
        ))
    )
      throw new Error("Recherches enregistrées invalides.");
    const history = s.settings.searchHistory;
    if (
      history !== undefined &&
      (!Array.isArray(history) || history.some((x) => typeof x !== "string"))
    )
      throw new Error("Historique de recherche invalide.");
  }
  /** Native model references are exposed without rewriting any existing record. */
  export function graph(s: State): Connection[] {
    const result = connections(s)
      .filter((c) => !c.deleted)
      .map((c) => ({ ...c, inferred: false }));
    const add = (from: Ref, key: Collection, id: unknown, label: string) => {
      const to = { key, id: String(id || "") };
      if (id && resolve(s, to) && !same(from, to))
        result.push({
          id: `native:${token(from)}:${label}:${token(to)}`,
          from,
          to,
          type: "related",
          label,
          inferred: true,
        });
    };
    for (const h of all(s)) {
      if (h.record.deleted) continue;
      if (h.key === "os")
        for (const f of OS.getModel(h.record.kind)?.fields || []) {
          if (f.type === "ref") add(h, "os", h.record[f.key], f.label);
          if (f.type === "refs")
            for (const id of (h.record[f.key] as string[]) || [])
              add(h, "os", id, f.label);
        }
      if (h.key === "tasks") add(h, "os", h.record.osSourceId, "Action liée");
      if (h.key === "finances") add(h, "os", h.record.accountId, "Compte");
    }
    return result;
  }
  export function related(s: State, ref: Ref): Connection[] {
    return graph(s).filter((c) => same(c.from, ref) || same(c.to, ref));
  }
  export function blockers(s: State, ref: Ref): Hit[] {
    return connections(s)
      .filter((c) => !c.deleted && c.type === "depends" && same(c.from, ref))
      .map((c) => ({ ...c.to, record: resolve(s, c.to)! }))
      .filter((h) => !completed(h.record));
  }
  /** Audit only changed user records. Navigation/search preferences create no record revisions. */
  export function stamp(
    previous: State,
    next: State,
    at = new Date().toISOString(),
  ): void {
    const history = [...revisions(next)];
    for (const h of all(next)) {
      const old = resolve(previous, h);
      if (JSON.stringify(old) === JSON.stringify(h.record)) continue;
      h.record.updatedAt = at;
      if (!old && !h.record.createdAt) h.record.createdAt = at;
      const action = !old
        ? "Création"
        : h.record.deleted && !old.deleted
          ? "Retrait"
          : !h.record.deleted && old.deleted
            ? "Récupération"
            : meta(h.record).archived && !meta(old).archived
              ? "Archivage"
              : !meta(h.record).archived && meta(old).archived
                ? "Désarchivage"
                : "Modification";
      const prefix = token(h) + ":" + at + ":";
      let sequence = history.length;
      while (history.some((x) => x.id === prefix + sequence)) sequence++;
      history.unshift({
        id: prefix + sequence,
        ref: { key: h.key, id: h.id },
        at,
        action,
        ...(old ? { before: clone(old) } : {}),
        after: clone(h.record),
      });
    }
    if (history.length) {
      const counts = new Map<string, number>();
      next.activity = history
        .filter((h) => {
          const t = token(h.ref),
            n = (counts.get(t) || 0) + 1;
          counts.set(t, n);
          return n <= 10;
        })
        .slice(0, 300);
    }
  }
  function text(h: Hit): string {
    const r = h.record,
      fields = [
        "title",
        "name",
        "label",
        "body",
        "details",
        "category",
        "project",
        "area",
        "domain",
        "status",
        "type",
        "kind",
        "source",
        "amount",
        "value",
        "unit",
        "date",
        "due",
        "time",
        ...((h.key === "os" ? OS.getModel(r.kind)?.fields : []) || [])
          .filter((f) => !["ref", "refs"].includes(f.type))
          .map((f) => f.key),
      ];
    return fold(
      [
        ...fields.map((k) => r[k] || ""),
        describe(h),
        ...tags(r),
        meta(r).description || "",
        meta(r).context || "",
        meta(r).owner || "",
        meta(r).location || "",
        ...(meta(r).checklist || []).map((x) => x.text),
      ].join(" "),
    );
  }
  export function search(s: State, f: Filter = {}, today = day()): Hit[] {
    const terms = fold(f.query || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return all(s)
      .filter((h) => {
        const r = h.record,
          m = meta(r),
          d = date(r);
        return (
          !r.deleted &&
          (f.scope !== "deadlines" || !!r.due) &&
          (f.archive === "all" ||
            (f.archive === "archived" ? m.archived : !m.archived)) &&
          (!f.key || h.key === f.key) &&
          (!f.domain || domain(h) === f.domain) &&
          (!f.favorite || m.favorite) &&
          (!f.tag || tags(r).some((t) => fold(t) === fold(f.tag))) &&
          (!f.from || (!!d && d >= f.from)) &&
          (!f.to || (!!d && d <= f.to)) &&
          (!f.status ||
            (f.status === "done"
              ? completed(r)
              : f.status === "overdue"
                ? !!r.due && String(r.due) < today && !completed(r)
                : !completed(r))) &&
          terms.every((t) => text(h).includes(t))
        );
      })
      .sort(
        (a, b) =>
          Number(!!meta(b.record).favorite) -
            Number(!!meta(a.record).favorite) ||
          String(b.record.updatedAt || b.record.createdAt || "").localeCompare(
            String(a.record.updatedAt || a.record.createdAt || ""),
          ) ||
          title(a.record).localeCompare(title(b.record), "fr"),
      );
  }
  export function duplicate(s: State, ref: Ref, id: string): RecordData {
    const original = resolve(s, ref);
    if (!original) throw new Error("Élément introuvable.");
    const copy = clone(original);
    copy.id = id;
    delete copy.createdAt;
    delete copy.updatedAt;
    delete copy.completedAt;
    const field =
      copy.title !== undefined
        ? "title"
        : copy.name !== undefined
          ? "name"
          : copy.label !== undefined
            ? "label"
            : "title";
    copy[field] = title(original) + " (copie)";
    copy.deleted = false;
    copy.personal = {
      ...meta(copy),
      archived: false,
      favorite: false,
      checklist: (meta(copy).checklist || []).map((x) => ({
        ...x,
        done: false,
      })),
    };
    // Copies are new work, without execution or generator identity.
    for (const key of [
      "lastCompleted",
      "completedCount",
      "lastReviewed",
      "reviewStreak",
      "interval",
      "insightSource",
      "automationToken",
    ])
      delete copy[key];
    if (ref.key === "os") {
      copy.status = "Idée";
      if (copy.progress !== undefined) copy.progress = 0;
      if (copy.done !== undefined) copy.done = false;
    }
    if (ref.key === "tasks") copy.done = false;
    if (ref.key === "habits") copy.days = {};
    return copy;
  }
  export type Action = {
    hit: Hit;
    score: number;
    reasons: string[];
    blocked: Hit[];
  };
  export function nextActions(s: State, today = day()): Action[] {
    const edges = graph(s);
    return s.tasks
      .filter((r) => visible(r) && !completed(r))
      .map((r) => {
        const hit: Hit = { key: "tasks", id: r.id, record: r },
          m = meta(r),
          reasons: string[] = [];
        let score = 0;
        const delta = r.due ? OS.daysBetween(today, String(r.due)) : 999;
        if (delta < 0) {
          score += 60 + Math.min(20, -delta);
          reasons.push(`${-delta} jour(s) de retard`);
        } else if (delta === 0) {
          score += 50;
          reasons.push("Échéance aujourd’hui");
        } else if (delta <= 7) {
          score += 30 - delta;
          reasons.push(`Échéance dans ${delta} jour(s)`);
        }
        if (r.urgent) {
          score += 15;
          reasons.push("Marquée urgente");
        }
        if (r.important) {
          score += 20;
          reasons.push("Marquée importante");
        }
        if (m.priority) {
          score += m.priority * 5;
          reasons.push(`Priorité ${m.priority}/5`);
        }
        const duration = m.duration || Number(r.estimate || 25);
        if (duration <= 15) {
          score += 5;
          reasons.push("Action courte, 15 min ou moins");
        }
        const linked = edges
          .filter((c) => same(c.from, hit) || same(c.to, hit))
          .some((c) => {
            const other = resolve(s, same(c.from, hit) ? c.to : c.from);
            return (
              other &&
              !other.deleted &&
              (other.kind === "project" || s.goals.includes(other))
            );
          });
        if (linked) {
          score += 10;
          reasons.push("Reliée à un projet ou objectif");
        }
        const blocked = blockers(s, hit);
        if (!reasons.length)
          reasons.push(
            "Action ouverte ; ajoute une échéance ou une priorité pour affiner le classement",
          );
        return { hit, score, reasons, blocked };
      })
      .sort(
        (a, b) =>
          Number(!!a.blocked.length) - Number(!!b.blocked.length) ||
          b.score - a.score ||
          title(a.hit.record).localeCompare(title(b.hit.record), "fr"),
      );
  }
}
