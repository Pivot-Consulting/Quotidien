/** Explicit local intent registry. Preview first, common validation, guarded undo. */
namespace Q.Commands {
  export type Intent = {
    type: "task" | "note" | "search" | "plan";
    text: string;
    date?: string;
    target?: Personal.Ref;
    expected?: string;
    source?: string;
    agent?: string;
  };
  export type Entry = {
    id: string;
    at: string;
    label: string;
    ref: Personal.Ref;
    before: RecordData | null;
    after: RecordData;
    undone?: boolean;
    source?: string;
    agent?: string;
  };
  export const history = (s: State): Entry[] =>
    (s.commandHistory || []) as Entry[];
  export const examples = [
    "tâche Appeler Paul",
    "tâche Payer le loyer le 2026-10-01",
    "note Idée de formation",
    "chercher tennis",
    "planifier Préparer la réunion le 2026-10-02",
  ];
  type Handler = {
    pattern: RegExp;
    parse: (s: State, match: RegExpMatchArray) => Intent;
  };
  export const registry: Handler[] = [
    {
      pattern: /^(?:chercher|rechercher)\s+(.+)$/i,
      parse: (_s, m) => ({ type: "search", text: m[1]!.trim() }),
    },
    {
      pattern: /^note\s+(.+)$/i,
      parse: (_s, m) => ({ type: "note", text: m[1]!.trim() }),
    },
    {
      pattern: /^(?:tâche|tache)\s+(.+?)(?:\s+le\s+(\d{4}-\d{2}-\d{2}))?$/i,
      parse: (_s, m) => ({
        type: "task",
        text: m[1]!.trim(),
        ...(m[2] ? { date: m[2] } : {}),
      }),
    },
    {
      pattern: /^planifier\s+(.+)\s+le\s+(\d{4}-\d{2}-\d{2})$/i,
      parse: (s, m) => {
        const matches = s.tasks.filter(
          (r) =>
            Personal.visible(r) &&
            !r.done &&
            Personal.fold(Personal.title(r)) === Personal.fold(m[1]!.trim()),
        );
        if (matches.length !== 1)
          throw new Error(
            matches.length
              ? "Plusieurs tâches portent ce titre. Renomme la tâche voulue avant de la planifier."
              : "Aucune tâche ouverte ne porte exactement ce titre.",
          );
        const r = matches[0]!;
        return {
          type: "plan",
          text: Personal.title(r),
          date: m[2],
          target: { key: "tasks", id: r.id },
          expected: JSON.stringify(r),
        };
      },
    },
  ];
  export function parse(s: State, text: string): Intent {
    for (const handler of registry) {
      const match = text.trim().match(handler.pattern);
      if (match) {
        const intent = handler.parse(s, match);
        check(intent);
        return intent;
      }
    }
    throw new Error(
      "Commande non reconnue. Utilise tâche, note, chercher ou planifier, avec une date au format AAAA-MM-JJ.",
    );
  }
  function check(i: Intent) {
    if (
      !["task", "note", "search", "plan"].includes(i.type) ||
      !i.text.trim() ||
      i.text.length > 2000 ||
      (i.date && !validDate(i.date))
    )
      throw new Error("Commande ou date invalide.");
  }
  export function apply(s: State, i: Intent, makeId: () => string): Entry {
    check(i);
    if (i.type === "search")
      throw new Error("La recherche ne modifie pas les données.");
    if (
      i.source &&
      (history(s).some((h) => h.source === i.source && !h.undone) ||
        s.tasks.some(
          (t) =>
            t.commandSource === i.source && (!t.commandUndone || !t.deleted),
        ))
    )
      throw new Error("Cette proposition a déjà été appliquée.");
    let before: RecordData | null = null,
      after: RecordData,
      ref: Personal.Ref;
    if (i.type === "plan") {
      const r = i.target && Personal.resolve(s, i.target);
      if (!r || i.target!.key !== "tasks" || JSON.stringify(r) !== i.expected)
        throw new Error(
          "La tâche a changé. Prévisualise à nouveau la commande.",
        );
      before = clone(r);
      after = { ...r, due: i.date };
      ref = i.target!;
    } else {
      ref = { key: i.type === "task" ? "tasks" : "notes", id: makeId() };
      after =
        i.type === "task"
          ? {
              id: ref.id,
              title: i.text,
              done: false,
              estimate: 25,
              ...(i.date ? { due: i.date } : {}),
              createdAt: new Date().toISOString(),
            }
          : {
              id: ref.id,
              title: i.text,
              body: i.text,
              createdAt: new Date().toISOString(),
            };
    }
    if (i.source) after.commandSource = i.source;
    const entry: Entry = {
      id: makeId(),
      at: new Date().toISOString(),
      label: i.type + " · " + i.text,
      ref,
      before,
      after: clone(after),
      ...(i.source ? { source: i.source } : {}),
      ...(i.agent ? { agent: i.agent } : {}),
    };
    const candidate = clone(s);
    candidate[ref.key] = [
      ...candidate[ref.key].filter((r) => r.id !== ref.id),
      after,
    ];
    candidate.commandHistory = [entry, ...history(candidate)].slice(0, 200);
    Object.assign(s, normalize(candidate));
    return entry;
  }
  function content(r: RecordData | undefined): string {
    if (!r) return "";
    const copy = clone(r);
    delete copy.updatedAt;
    delete copy.createdAt;
    return JSON.stringify(copy);
  }
  export function undo(s: State, id: string): void {
    const candidate = clone(s),
      h = history(candidate).find((x) => x.id === id);
    if (!h || h.undone) throw new Error("Commande déjà annulée ou absente.");
    const r = Personal.resolve(candidate, h.ref);
    if (content(r) !== content(h.after))
      throw new Error(
        "Objet modifié depuis la commande : annulation refusée pour préserver tes changements.",
      );
    candidate[h.ref.key] = candidate[h.ref.key].map((x) =>
      x.id === h.ref.id
        ? h.before || {
            ...x,
            deleted: true,
            ...(h.source ? { commandUndone: true } : {}),
          }
        : x,
    );
    h.undone = true;
    Object.assign(s, normalize(candidate));
  }
  export function validate(s: State) {
    if (
      s.commandHistory !== undefined &&
      (!Array.isArray(s.commandHistory) ||
        s.commandHistory.length > 200 ||
        history(s).some(
          (h) =>
            !h ||
            typeof h.id !== "string" ||
            typeof h.at !== "string" ||
            typeof h.label !== "string" ||
            !h.ref ||
            !collections.includes(h.ref.key) ||
            !h.after ||
            h.ref.id !== h.after.id ||
            !Personal.resolve(s, h.ref),
        ))
    )
      throw new Error("Journal des commandes invalide.");
    const agents = s.settings.agents;
    if (
      agents !== undefined &&
      (!Array.isArray(agents) ||
        agents.some(
          (a) => typeof a !== "string" || !OS.domains.some((d) => d.id === a),
        ))
    )
      throw new Error("Permission d’agent invalide.");
  }
  export function proposals(s: State, domain: string, today = day()) {
    if (!((s.settings.agents || []) as string[]).includes(domain)) return [];
    // An agent only sees records from its explicitly granted domain.
    const scoped = clone(s);
    for (const key of collections)
      scoped[key] = scoped[key].filter(
        (record) => Personal.domain({ key, id: record.id, record }) === domain,
      );
    scoped.connections = Personal.connections(s).filter(
      (c) => Personal.resolve(scoped, c.from) && Personal.resolve(scoped, c.to),
    );
    scoped.activity = Personal.revisions(s).filter((h) =>
      Personal.resolve(scoped, h.ref),
    );
    return Intelligence.analyze(scoped, today)
      .filter(
        (f) =>
          f.refs.length &&
          f.refs.every((ref) => {
            const record = Personal.resolve(s, ref);
            return record && Personal.domain({ ...ref, record }) === domain;
          }),
      )
      .filter(
        (f) =>
          !history(s).some((h) => h.source === f.id && !h.undone) &&
          !s.tasks.some(
            (t) => t.commandSource === f.id && (!t.commandUndone || !t.deleted),
          ),
      );
  }
  export function accept(
    s: State,
    domain: string,
    findingId: string,
    makeId: () => string,
  ): Entry {
    const f = proposals(s, domain).find((x) => x.id === findingId);
    if (!f) throw new Error("Proposition périmée ou permission retirée.");
    return apply(
      s,
      {
        type: "task",
        text: f.action,
        date: day(),
        source: f.id,
        agent: domain,
      },
      makeId,
    );
  }
}
