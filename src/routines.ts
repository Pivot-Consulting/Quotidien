/** Repeatable routines with one run per routine and local calendar day. */
namespace Q.Routines {
  export type Step = { text: string; done: boolean };
  export type Run = {
    id: string;
    routineId: string;
    date: string;
    steps: Step[];
    startedAt: string;
    completedAt?: string;
  };
  const runs = (s: State): Run[] => (s.routineRuns as Run[]) || [];
  export function steps(routine: RecordData): string[] {
    return String(routine.steps || "")
      .split(/[,;\n]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  export function due(routine: RecordData, date = day()): boolean {
    if (!Personal.visible(routine)) return false;
    const mode = String(routine.schedule || "Tous les jours");
    const weekday = new Date(date + "T12:00:00").getDay();
    if (mode === "Jours ouvrés") return weekday >= 1 && weekday <= 5;
    if (mode === "Week-end") return weekday === 0 || weekday === 6;
    if (mode === "Jours choisis")
      return String(routine.weekdays || "")
        .split(",")
        .map(Number)
        .includes(weekday);
    return true;
  }
  export function run(s: State, routineId: string, date = day()): Run | null {
    return (
      runs(s).find((x) => x.routineId === routineId && x.date === date) || null
    );
  }
  export function start(
    s: State,
    routineId: string,
    id: string,
    date = day(),
  ): Run {
    const routine = s.routines.find(
      (x) => x.id === routineId && Personal.visible(x),
    );
    if (!routine) throw new Error("Routine introuvable.");
    const existing = run(s, routineId, date);
    if (existing) return existing;
    const created: Run = {
      id,
      routineId,
      date,
      steps: steps(routine).map((text) => ({ text, done: false })),
      startedAt: new Date().toISOString(),
    };
    if (!Array.isArray(s.routineRuns)) s.routineRuns = [];
    (s.routineRuns as Run[]).push(created);
    return created;
  }
  export function toggle(
    s: State,
    routineId: string,
    index: number,
    date = day(),
  ): Run {
    const current = run(s, routineId, date);
    if (!current || !current.steps[index])
      throw new Error("Étape de routine introuvable.");
    if (current.completedAt)
      throw new Error("Cette exécution est déjà terminée.");
    current.steps[index].done = !current.steps[index].done;
    return current;
  }
  export function complete(s: State, routineId: string, date = day()): Run {
    const current = run(s, routineId, date);
    if (!current) throw new Error("Démarre la routine avant de la terminer.");
    if (current.steps.length && current.steps.some((x) => !x.done))
      throw new Error(
        "Termine toutes les étapes ou laisse la routine ouverte.",
      );
    current.completedAt ||= new Date().toISOString();
    return current;
  }
  export function today(
    s: State,
    date = day(),
  ): { routine: RecordData; run: Run | null }[] {
    return s.routines
      .filter((r) => due(r, date))
      .map((routine) => ({ routine, run: run(s, routine.id, date) }))
      .sort((a, b) =>
        String(a.routine.time || "99:99").localeCompare(
          String(b.routine.time || "99:99"),
        ),
      );
  }
  export function history(s: State, routineId: string, limit = 30): Run[] {
    return runs(s)
      .filter((x) => x.routineId === routineId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }
  export function installDefaults(s: State, makeId: () => string): number {
    const templates: Omit<RecordData, "id">[] = [
      {
        templateKey: "morning",
        name: "Morning Routine",
        time: "07:30",
        schedule: "Tous les jours",
        steps:
          "Météo et calendrier\nPriorité du jour\nÉchéances et rappels\nSport et énergie\nBudget du jour",
      },
      {
        templateKey: "evening",
        name: "Evening Review",
        time: "20:30",
        schedule: "Tous les jours",
        steps:
          "Tâches terminées\nDépenses du jour\nProgression et apprentissage\nBilan dans le journal\nPréparer demain",
      },
      {
        templateKey: "sunday",
        name: "Sunday Reset",
        time: "18:00",
        schedule: "Jours choisis",
        weekdays: "0",
        steps:
          "Revue des projets\nPlanifier la semaine\nFinances et administration\nCourses et maison\nObjectifs et apprentissage",
      },
    ];
    let count = 0;
    for (const template of templates)
      if (
        !s.routines.some(
          (r) => r.templateKey === template.templateKey && !r.deleted,
        )
      ) {
        s.routines.push({
          ...template,
          id: makeId(),
          createdAt: new Date().toISOString(),
        });
        count++;
      }
    return count;
  }
  export function validate(s: State): void {
    for (const routine of s.routines) {
      const schedule = String(routine.schedule || "Tous les jours");
      if (
        ![
          "Tous les jours",
          "Jours ouvrés",
          "Week-end",
          "Jours choisis",
        ].includes(schedule)
      )
        throw new Error("Planification de routine invalide.");
      if (schedule === "Jours choisis") {
        const selected = String(routine.weekdays || "")
          .split(",")
          .filter(Boolean)
          .map(Number);
        if (
          !selected.length ||
          selected.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
        )
          throw new Error("Jours de routine invalides.");
      }
    }
    if (s.routineRuns === undefined) return;
    if (!Array.isArray(s.routineRuns))
      throw new Error("Historique de routines invalide.");
    const tokens = new Set<string>();
    for (const run of s.routineRuns as Run[]) {
      if (
        !run ||
        typeof run !== "object" ||
        typeof run.id !== "string" ||
        !run.id ||
        typeof run.routineId !== "string" ||
        !s.routines.some((r) => r.id === run.routineId) ||
        !validDate(run.date) ||
        !Array.isArray(run.steps) ||
        run.steps.some(
          (x) =>
            !x ||
            typeof x.text !== "string" ||
            !x.text.trim() ||
            typeof x.done !== "boolean",
        ) ||
        typeof run.startedAt !== "string" ||
        (run.completedAt !== undefined && typeof run.completedAt !== "string")
      )
        throw new Error("Exécution de routine invalide.");
      const token = run.routineId + ":" + run.date;
      if (tokens.has(token))
        throw new Error("Routine exécutée deux fois pour la même journée.");
      tokens.add(token);
    }
  }
}
