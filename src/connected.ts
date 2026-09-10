/** Explicit accounting sources: no implicit allocation or double counting. */
namespace Q.Connected {
  export function projectSpent(s: State, project: RecordData): number {
    return project.spendMode === "Transactions"
      ? -s.finances
          .filter((t) => !t.deleted && t.projectId === project.id)
          .reduce((n, t) => n + Number(t.amount || 0), 0)
      : Number(project.spent || 0);
  }
  export function balance(s: State, accountId: string): number {
    const account = s.os.find(
      (r) => r.id === accountId && r.kind === "account",
    );
    return (
      Number(account?.opening || 0) +
      s.finances
        .filter((t) => !t.deleted && t.accountId === accountId)
        .reduce((n, t) => n + Number(t.amount || 0), 0)
    );
  }
  export function savings(s: State, goal: RecordData) {
    if (!goal.savingsAccountId || !Number(goal.savingsTarget)) return null;
    const current = balance(s, String(goal.savingsAccountId)),
      target = Number(goal.savingsTarget),
      remaining = Math.max(0, target - current);
    const monthly = Number(goal.monthlyContribution || 0);
    return {
      current,
      target,
      remaining,
      progress: Math.max(0, Math.min(100, (current / target) * 100)),
      months:
        remaining === 0
          ? 0
          : monthly > 0
            ? Math.ceil(remaining / monthly)
            : null,
    };
  }
  export function progress(s: State, goal: RecordData): number {
    return savings(s, goal)?.progress ?? Number(goal.progress || 0);
  }
  export function validate(s: State): void {
    const allocated = new Set<string>();
    for (const r of [...s.finances, ...s.goals]) {
      if (
        r.projectId &&
        (typeof r.projectId !== "string" ||
          !s.os.some((p) => p.kind === "project" && p.id === r.projectId))
      )
        throw new Error("Projet lié introuvable.");
    }
    for (const g of s.goals) {
      for (const field of ["savingsTarget", "monthlyContribution"]) {
        if (g[field] === undefined || g[field] === "") continue;
        if (
          !["number", "string"].includes(typeof g[field]) ||
          !Number.isFinite(Number(g[field])) ||
          Number(g[field]) < 0
        )
          throw new Error("Montant d’épargne invalide.");
        g[field] = Number(g[field]);
      }
      if (!g.savingsAccountId) continue;
      if (
        typeof g.savingsAccountId !== "string" ||
        !s.os.some((a) => a.id === g.savingsAccountId && a.kind === "account")
      )
        throw new Error("Compte d’épargne introuvable.");
      if (!Number(g.savingsTarget))
        throw new Error("Renseigne une cible d’épargne supérieure à zéro.");
      if (!Personal.visible(g)) continue;
      if (allocated.has(g.savingsAccountId))
        throw new Error(
          "Ce compte finance déjà un objectif actif. Utilise un compte distinct pour éviter une double affectation.",
        );
      allocated.add(g.savingsAccountId);
    }
  }
}
