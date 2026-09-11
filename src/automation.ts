/** Deterministic automations evaluated when the application is open. */
namespace Q.Automation {
  export const triggers = [
    "Tâche en retard",
    "Document à renouveler",
    "Dépense importante",
    "Projet stagnant",
    "Voyage créé",
    "Revue du dimanche",
  ];
  export const actions = [
    "Notification",
    "Créer une tâche",
    "Créer une checklist",
  ];
  export type Notice = {
    id: string;
    type: string;
    title: string;
    message: string;
    priority: number;
    createdAt: string;
    read: boolean;
    snoozedUntil?: string;
    sourceKey?: Collection;
    sourceId?: string;
    ruleId?: string;
  };
  export type Log = {
    id: string;
    ruleId: string;
    token: string;
    at: string;
    status: "success";
    actions: string[];
  };
  type Event = {
    token: string;
    title: string;
    message: string;
    sourceKey?: Collection;
    sourceId?: string;
    due?: string;
  };
  const logs = (s: State): Log[] => (s.automationLogs as Log[]) || [];
  const notices = (s: State): Notice[] => (s.notifications as Notice[]) || [];
  const lastActivity = (s: State, p: RecordData): string =>
    [
      p.updatedAt,
      p.createdAt,
      ...s.tasks
        .filter((t) => t.osSourceId === p.id && !t.deleted)
        .flatMap((t) => [t.updatedAt, t.completedAt, t.createdAt]),
      ...OS.rows(s, "milestone")
        .filter((m) => m.projectId === p.id)
        .flatMap((m) => [m.updatedAt, m.completedAt, m.createdAt]),
    ]
      .map(String)
      .filter((x) => /^\d{4}-\d{2}-\d{2}/.test(x))
      .sort()
      .pop()
      ?.slice(0, 10) || "";
  function events(s: State, rule: RecordData, today: string): Event[] {
    const horizon = Math.max(0, Number(rule.horizon || 7)),
      threshold = Math.max(0, Number(rule.threshold || 0));
    if (rule.trigger === "Tâche en retard")
      return s.tasks
        .filter(
          (t) =>
            Personal.visible(t) && !t.done && t.due && String(t.due) < today,
        )
        .map((t) => ({
          token: `task:${t.id}:${t.due}`,
          title: `Tâche en retard · ${Personal.title(t)}`,
          message: `Échéance dépassée le ${t.due}.`,
          sourceKey: "tasks",
          sourceId: t.id,
          due: String(t.due),
        }));
    if (rule.trigger === "Document à renouveler")
      return s.documents
        .filter(
          (d) =>
            Personal.visible(d) &&
            (!rule.category ||
              String(d.category).toLocaleLowerCase("fr") ===
                String(rule.category).toLocaleLowerCase("fr")) &&
            d.expiry &&
            String(d.expiry) >= today &&
            String(d.expiry) <= OS.addDays(today, horizon),
        )
        .map((d) => ({
          token: `document:${d.id}:${d.expiry}`,
          title: `Document à renouveler · ${Personal.title(d)}`,
          message: `Échéance le ${d.expiry}.`,
          sourceKey: "documents",
          sourceId: d.id,
          due: String(d.expiry),
        }));
    if (rule.trigger === "Dépense importante")
      return s.finances
        .filter(
          (t) =>
            !t.deleted &&
            (!rule.category ||
              String(t.category).toLocaleLowerCase("fr") ===
                String(rule.category).toLocaleLowerCase("fr")) &&
            Number(t.amount) < -threshold,
        )
        .map((t) => ({
          token: `expense:${t.id}:${t.amount}`,
          title: `Dépense à vérifier · ${Personal.title(t)}`,
          message: `Montant enregistré : ${Math.abs(Number(t.amount)).toFixed(2)} €.`,
          sourceKey: "finances",
          sourceId: t.id,
          due: String(t.date || today),
        }));
    if (rule.trigger === "Projet stagnant")
      return OS.rows(s, "project")
        .filter((p) => Personal.visible(p) && !OS.done(p))
        .flatMap((p) => {
          const last = lastActivity(s, p);
          return last && OS.daysBetween(last, today) > Math.max(1, horizon)
            ? [
                {
                  token: `project:${p.id}:${last}`,
                  title: `Projet stagnant · ${Personal.title(p)}`,
                  message: `Aucune activité métier enregistrée depuis le ${last}.`,
                  sourceKey: "os" as Collection,
                  sourceId: p.id,
                },
              ]
            : [];
        });
    if (rule.trigger === "Voyage créé")
      return OS.rows(s, "trip")
        .filter(Personal.visible)
        .map((t) => ({
          token: `trip:${t.id}`,
          title: `Préparer le voyage · ${Personal.title(t)}`,
          message: `Une checklist peut être préparée pour ce voyage.`,
          sourceKey: "os",
          sourceId: t.id,
          due: String(t.date || ""),
        }));
    if (
      rule.trigger === "Revue du dimanche" &&
      new Date(today + "T12:00:00").getDay() === 0
    )
      return [
        {
          token: `weekly:${today}`,
          title: "Préparer la semaine",
          message: "La revue hebdomadaire est disponible dans Today.",
        },
      ];
    return [];
  }
  export function run(
    s: State,
    today = day(),
    makeId = () => Math.random().toString(36).slice(2),
  ): number {
    if (!Array.isArray(s.notifications)) s.notifications = [];
    if (!Array.isArray(s.automationLogs)) s.automationLogs = [];
    const used = new Set(logs(s).map((x) => x.token));
    let count = 0;
    for (const rule of s.automations.filter(
      (r) => !r.deleted && r.engineVersion === 1 && r.active === true,
    ))
      for (const event of events(s, rule, today)) {
        const token = `${rule.id}:${event.token}`;
        if (used.has(token)) continue;
        used.add(token);
        const performed: string[] = [];
        for (const action of rule.actions as string[]) {
          if (action === "Notification") {
            notices(s).unshift({
              id: makeId(),
              type: "Automatisation",
              title: event.title,
              message: event.message,
              priority: Number(rule.priority || 2),
              createdAt: new Date().toISOString(),
              read: false,
              sourceKey: event.sourceKey,
              sourceId: event.sourceId,
              ruleId: rule.id,
            });
            performed.push(action);
          }
          if (
            action === "Créer une tâche" ||
            action === "Créer une checklist"
          ) {
            const taskToken = token + ":" + action;
            if (!s.tasks.some((t) => t.automationToken === taskToken))
              s.tasks.unshift({
                id: makeId(),
                title: event.title,
                due: event.due && validDate(event.due) ? event.due : today,
                done: false,
                automationToken: taskToken,
                automationRuleId: rule.id,
                createdAt: new Date().toISOString(),
                personal:
                  action === "Créer une checklist"
                    ? {
                        checklist: (event.sourceKey === "os" &&
                        s.os.find((x) => x.id === event.sourceId)?.kind ===
                          "trip"
                          ? [
                              "Transport",
                              "Hébergement",
                              "Documents",
                              "Budget",
                              "Bagages",
                            ]
                          : [
                              "Vérifier les informations",
                              "Rassembler les pièces",
                              "Finaliser",
                            ]
                        ).map((text) => ({ text, done: false })),
                      }
                    : {},
              });
            performed.push(action);
          }
        }
        logs(s).unshift({
          id: makeId(),
          ruleId: rule.id,
          token,
          at: new Date().toISOString(),
          status: "success",
          actions: performed,
        });
        count++;
      }
    if (logs(s).length > 500) s.automationLogs = logs(s).slice(0, 500);
    return count;
  }
  export function visible(s: State, today = day()): Notice[] {
    return notices(s)
      .filter((n) => !n.snoozedUntil || n.snoozedUntil <= today)
      .sort(
        (a, b) =>
          Number(b.priority) - Number(a.priority) ||
          b.createdAt.localeCompare(a.createdAt),
      );
  }
  export function snooze(
    s: State,
    id: string,
    days: number,
    today = day(),
  ): void {
    const n = notices(s).find((x) => x.id === id);
    if (!n) throw new Error("Notification introuvable.");
    n.snoozedUntil = OS.addDays(today, days);
    n.read = true;
  }
  export function read(s: State, id: string): void {
    const n = notices(s).find((x) => x.id === id);
    if (n) n.read = true;
  }
  export function validate(s: State): void {
    for (const r of s.automations.filter(
      (x) => x.engineVersion !== undefined,
    )) {
      if (
        r.engineVersion !== 1 ||
        typeof r.active !== "boolean" ||
        !triggers.includes(String(r.trigger)) ||
        !Array.isArray(r.actions) ||
        !r.actions.length ||
        r.actions.some((x) => !actions.includes(String(x)))
      )
        throw new Error("Règle d’automatisation invalide.");
      for (const f of ["horizon", "threshold", "priority"])
        if (
          r[f] !== undefined &&
          (!Number.isFinite(Number(r[f])) || Number(r[f]) < 0)
        )
          throw new Error("Paramètre d’automatisation invalide.");
    }
    if (
      s.notifications !== undefined &&
      (!Array.isArray(s.notifications) ||
        s.notifications.some(
          (n: any) =>
            !n ||
            typeof n.id !== "string" ||
            typeof n.title !== "string" ||
            typeof n.message !== "string" ||
            typeof n.read !== "boolean" ||
            !Number.isFinite(Number(n.priority)) ||
            (n.snoozedUntil !== undefined && !validDate(n.snoozedUntil)),
        ))
    )
      throw new Error("Notifications invalides.");
    if (
      s.automationLogs !== undefined &&
      (!Array.isArray(s.automationLogs) ||
        s.automationLogs.some(
          (l: any) =>
            !l ||
            typeof l.id !== "string" ||
            typeof l.ruleId !== "string" ||
            typeof l.token !== "string" ||
            l.status !== "success" ||
            !Array.isArray(l.actions),
        ))
    )
      throw new Error("Journal d’automatisation invalide.");
    for (const field of ["notificationQuietStart", "notificationQuietEnd"])
      if (
        s.settings[field] !== undefined &&
        (typeof s.settings[field] !== "string" ||
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.settings[field])))
      )
        throw new Error("Horaire silencieux invalide.");
  }
}
