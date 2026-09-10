namespace Q.Focus {
  export type Session = {
    id: string;
    taskId: string;
    targetSeconds: number;
    elapsedSeconds: number;
    runningSince: number | null;
    status: "active" | "finished";
    notes: string;
  };
  export function session(s: State): Session | null {
    return (s.focusSession as Session) || null;
  }
  export function elapsed(f: Session, now = Date.now()): number {
    return Math.min(
      f.targetSeconds,
      f.elapsedSeconds +
        (f.runningSince === null
          ? 0
          : Math.max(0, (now - f.runningSince) / 1000)),
    );
  }
  export function start(
    s: State,
    taskId: string,
    id: string,
    minutes = 25,
    now = Date.now(),
  ): void {
    if (session(s)?.status === "active")
      throw new Error("Termine d’abord la session en cours.");
    const task = s.tasks.find(
      (t) => t.id === taskId && Personal.visible(t) && !t.done,
    );
    if (!task) throw new Error("Choisis une tâche ouverte.");
    if (Personal.blockers(s, { key: "tasks", id: taskId }).length)
      throw new Error("Cette tâche est bloquée par une dépendance.");
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240)
      throw new Error("Durée attendue entre 1 et 240 minutes.");
    s.focusSession = {
      id,
      taskId,
      targetSeconds: minutes * 60,
      elapsedSeconds: 0,
      runningSince: now,
      status: "active",
      notes: "",
    };
  }
  export function toggle(s: State, now = Date.now()): void {
    const f = session(s);
    if (!f || f.status !== "active") throw new Error("Aucune session active.");
    if (f.runningSince === null) f.runningSince = now;
    else {
      f.elapsedSeconds = elapsed(f, now);
      f.runningSince = null;
    }
  }
  export function finish(s: State, id: string, now = Date.now()): void {
    const f = session(s);
    if (!f || f.status === "finished") return;
    f.elapsedSeconds = elapsed(f, now);
    f.runningSince = null;
    f.status = "finished";
    if (!s.health.some((r) => r.focusSessionId === f.id))
      s.health.push({
        id,
        kind: "Focus",
        value: Math.round((f.elapsedSeconds / 60) * 10) / 10,
        unit: "min",
        date: day(new Date(now)),
        focusSessionId: f.id,
        taskId: f.taskId,
        details: f.notes,
      });
  }
  export function validate(s: State): void {
    if (s.focusSession === undefined || s.focusSession === null) return;
    const f = session(s);
    if (f === null) throw new Error("Session Focus invalide.");
    if (
      typeof f !== "object" ||
      typeof f.id !== "string" ||
      !f.id ||
      typeof f.taskId !== "string" ||
      !s.tasks.some((t) => t.id === f.taskId) ||
      !["active", "finished"].includes(f.status) ||
      typeof f.notes !== "string" ||
      !Number.isFinite(f.targetSeconds) ||
      f.targetSeconds < 60 ||
      f.targetSeconds > 14400 ||
      !Number.isFinite(f.elapsedSeconds) ||
      f.elapsedSeconds < 0 ||
      f.elapsedSeconds > f.targetSeconds ||
      (f.runningSince !== null &&
        (!Number.isFinite(f.runningSince) || f.runningSince < 0))
    )
      throw new Error("Session Focus invalide.");
  }
  export function review(s: State, weekly = false, today = day()): string {
    const start = weekly ? OS.addDays(today, -6) : today,
      end = OS.addDays(today, weekly ? 7 : 1);
    const completed = s.tasks.filter(
      (t) =>
        !t.deleted &&
        t.done &&
        String(t.completedAt || "").slice(0, 10) >= start &&
        String(t.completedAt || "").slice(0, 10) <= today,
    );
    const expenses = -s.finances
      .filter(
        (t) =>
          !t.deleted &&
          Number(t.amount) < 0 &&
          String(t.date) >= start &&
          String(t.date) <= today,
      )
      .reduce((n, t) => n + Number(t.amount), 0);
    const upcoming = s.tasks.filter(
      (t) =>
        Personal.visible(t) &&
        !t.done &&
        t.due &&
        String(t.due) > today &&
        String(t.due) <= end,
    );
    return `${weekly ? "Revue des 7 derniers jours" : "Bilan du soir"} · ${start} → ${today}\n\n${completed.length} tâche(s) terminée(s) avec date enregistrée\n${completed.map((t) => "• " + Personal.title(t)).join("\n")}\n\nDépenses saisies : ${expenses.toFixed(2)} € (hors remboursements)\n\nÀ préparer\n${upcoming.map((t) => "• " + Personal.title(t) + " · " + String(t.due)).join("\n") || "Aucune échéance de tâche renseignée."}\n\nCe qui a bien fonctionné :\nÀ ajuster :\nPriorité suivante :`;
  }
}
