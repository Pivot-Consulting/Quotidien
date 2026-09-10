/** Pure domain rules and synchronous, fail-closed local persistence. */
namespace Q {
  export const KEY = "quotidien-rebuild-2";
  export const BACKUP_KEY = KEY + "-previous";
  export const CHECKPOINT_KEY = KEY + "-before-restore";
  export const RELEASE = "2.4.0";
  export const collections = [
    "os",
    "tasks",
    "events",
    "notes",
    "habits",
    "routines",
    "goals",
    "workouts",
    "health",
    "life",
    "finances",
    "documents",
    "assets",
    "automations",
  ] as const;
  export type Collection = (typeof collections)[number];
  export type RecordData = { id: string; [key: string]: unknown };
  export type State = {
    version: 2;
    screen: string;
    settings: { theme: string; focus: number; [key: string]: unknown };
    [key: string]: unknown;
  } & Record<Collection, RecordData[]>;
  export const screens = [
    "today",
    "plan",
    "notes",
    "tracking",
    "life",
    "wave",
    "explore",
    "intelligence",
  ];
  export function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
  export function empty(): State {
    return Object.assign(
      { version: 2, screen: "today", settings: { theme: "dark", focus: 25 } },
      Object.fromEntries(collections.map((key) => [key, []])),
    ) as State;
  }
  export function day(date = new Date()): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  function object(x: unknown): x is Record<string, unknown> {
    return x !== null && typeof x === "object" && !Array.isArray(x);
  }
  function guard(value: unknown): void {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      if (["__proto__", "prototype", "constructor"].includes(key))
        throw new Error("Champ de sauvegarde interdit.");
      guard((value as Record<string, unknown>)[key]);
    }
  }
  export function validDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + "T12:00:00");
    return Number.isFinite(date.getTime()) && day(date) === value;
  }
  export function normalize(input: unknown): State {
    guard(input);
    if (
      !object(input) ||
      input.version !== 2 ||
      !collections.some((key) => Array.isArray(input[key]))
    )
      throw new Error(
        "Sauvegarde Quotidien 2.x attendue. Les formats V5/V6/V7 nécessitent une migration dédiée.",
      );
    const next = Object.assign(empty(), clone(input)) as State;
    for (const key of collections) {
      const value = input[key];
      if (value === undefined) {
        next[key] = [];
        continue;
      }
      if (!Array.isArray(value))
        throw new Error(`La collection ${key} est invalide.`);
      const ids = new Set<string>();
      next[key] = value.map((item: unknown) => {
        if (
          !object(item) ||
          typeof item.id !== "string" ||
          !item.id.trim() ||
          ids.has(item.id)
        )
          throw new Error(`Identifiant manquant ou dupliqué dans ${key}.`);
        ids.add(item.id);
        const record = clone(item) as RecordData;
        for (const field of [
          "title",
          "name",
          "label",
          "body",
          "tags",
          "details",
          "project",
          "category",
          "area",
          "type",
          "kind",
          "unit",
          "status",
          "steps",
        ]) {
          if (record[field] == null) continue;
          if (typeof record[field] !== "string")
            throw new Error(`Champ ${key}.${field} invalide.`);
        }
        for (const field of ["date", "due"]) {
          if (record[field] == null || record[field] === "") continue;
          if (typeof record[field] !== "string" || !validDate(record[field]))
            throw new Error(`Date invalide dans ${key}.`);
        }
        if (
          record.time &&
          (typeof record.time !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time))
        )
          throw new Error("Horaire invalide.");
        for (const field of [
          "estimate",
          "amount",
          "progress",
          "minutes",
          "effort",
          "target",
          "value",
        ]) {
          if (record[field] == null || record[field] === "") continue;
          if (
            !["string", "number"].includes(typeof record[field]) ||
            !Number.isFinite(Number(record[field]))
          )
            throw new Error(`Nombre invalide dans ${key}.${field}.`);
          record[field] = Number(record[field]);
        }
        for (const field of ["done", "deleted", "important", "urgent"]) {
          if (record[field] !== undefined && typeof record[field] !== "boolean")
            throw new Error(`Champ ${key}.${field} invalide.`);
        }
        if (
          record.progress !== undefined &&
          (Number(record.progress) < 0 || Number(record.progress) > 100)
        )
          throw new Error("Progression attendue entre 0 et 100.");
        if (record.estimate !== undefined && Number(record.estimate) <= 0)
          throw new Error("Durée estimée positive attendue.");
        if (record.minutes !== undefined && Number(record.minutes) < 0)
          throw new Error("Durée négative.");
        if (record.target !== undefined && Number(record.target) <= 0)
          throw new Error("Objectif strictement positif attendu.");
        if (
          record.effort !== undefined &&
          (Number(record.effort) < 1 || Number(record.effort) > 10)
        )
          throw new Error("Effort attendu entre 1 et 10.");
        if (key === "habits" && record.days !== undefined) {
          if (
            !object(record.days) ||
            Object.entries(record.days).some(
              ([date, value]) => !validDate(date) || typeof value !== "boolean",
            )
          )
            throw new Error("Historique d’habitude invalide.");
        }
        Personal.validateMeta(record);
        if (key === "os") OS.validate(record);
        return record;
      });
    }
    if (input.settings !== undefined && !object(input.settings))
      throw new Error("Réglages invalides.");
    next.settings = Object.assign(empty().settings, input.settings || {});
    if (!["light", "dark"].includes(next.settings.theme))
      next.settings.theme = "dark";
    next.screen = screens.includes(next.screen) ? next.screen : "today";
    OS.validateLinks(next);
    Personal.validate(next);
    Intelligence.validate(next);
    return next;
  }
  export function parseBackup(raw: string): State {
    const data: unknown = JSON.parse(raw);
    if (object(data) && data.app === "quotidien" && data.format === 1)
      return normalize(data.state);
    return normalize(data);
  }
  export function backup(state: State): string {
    return JSON.stringify(
      {
        app: "quotidien",
        format: 1,
        exportedAt: new Date().toISOString(),
        release: RELEASE,
        state: normalize(state),
      },
      null,
      2,
    );
  }
  export function summary(state: State): string {
    return collections.map((key) => `${key}: ${state[key].length}`).join(" · ");
  }
  export class Repository {
    private expected: string | null | undefined;
    constructor(private readonly storage: Storage) {}
    load(): State {
      const raw = this.storage.getItem(KEY);
      const next = raw === null ? empty() : normalize(JSON.parse(raw));
      this.expected = raw;
      return next;
    }
    commit(state: State, checkpoint = false): State {
      const next = normalize(state);
      const raw = this.storage.getItem(KEY);
      if (this.expected === undefined)
        throw new Error(
          "Les données existantes doivent être récupérées avant toute modification.",
        );
      if (raw !== this.expected)
        throw new Error(
          "Les données ont changé dans un autre onglet. Exporte ton brouillon puis recharge avant de réessayer.",
        );
      // Both writes are synchronous. A failed backup aborts before changing the primary key.
      // setItem is atomic: quota errors leave the previous primary value intact.
      if (checkpoint)
        this.storage.setItem(CHECKPOINT_KEY, JSON.stringify(this.load()));
      if (raw !== null) this.storage.setItem(BACKUP_KEY, raw);
      if (!checkpoint)
        Personal.stamp(
          raw === null ? empty() : normalize(JSON.parse(raw)),
          next,
        );
      const serialized = JSON.stringify(next);
      this.storage.setItem(KEY, serialized);
      this.expected = serialized;
      return next;
    }
  }
  export function matches(
    state: State,
    query: string,
  ): { key: Collection; record: RecordData }[] {
    return Personal.search(state, { query }).map((hit) => ({
      key: hit.key,
      record: hit.record,
    }));
  }

  export function focusMinutes(state: State): number {
    return state.health
      .filter((x) => !x.deleted && String(x.kind).toLowerCase() === "focus")
      .reduce((sum, x) => sum + Number(x.value || 0), 0);
  }
}
