/** Optional detailed journeys over the existing Personal OS records. */
namespace Q.Progression {
  const rows = (s: State, kind: string) =>
    OS.rows(s, kind).filter(Personal.visible);
  const num = (key: string, label: string, min = 0, max = 1e6): OS.Field => ({
    key,
    label,
    type: "number",
    min,
    max,
    required: true,
  });
  const ref = (key: string, label: string, kind: string): OS.Field => ({
    key,
    label,
    type: "ref",
    ref: kind,
    required: true,
  });
  function add(id: string, label: string, fields: OS.Field[]) {
    const model = { id, label, fields };
    OS.domains.find((d) => d.id === "health")!.models.push(model);
    OS.models.push(model);
  }
  add("trainingExercise", "Exercices du programme", [
    ref("programId", "Programme", "trainingProgram"),
    num("targetSets", "Séries prévues", 1, 50),
    num("targetReps", "Répétitions par série", 1, 10000),
    num("targetLoad", "Charge indicative (kg)", 0, 1000),
    num("restSeconds", "Repos entre séries (secondes)", 0, 3600),
    { key: "instructions", label: "Consignes personnelles", type: "textarea" },
  ]);
  add("exerciseSet", "Séries réalisées", [
    ref("sessionId", "Séance", "trainingSession"),
    ref("exerciseId", "Exercice", "trainingExercise"),
    num("setIndex", "Numéro de série", 1, 1000),
    num("repetitions", "Répétitions réalisées", 0, 10000),
    num("load", "Charge réalisée (kg)", 0, 1000),
    num("seconds", "Durée réalisée (secondes)", 0, 86400),
  ]);
  OS.getModel("sharedExpense")!.fields.push({
    key: "shareWeights",
    label: "Poids de répartition (facultatifs)",
    type: "weights",
  });
  OS.getModel("sharedExpense")!.fields.find(
    (f) => f.key === "participants",
  )!.label = "Participants";
  export type Weight = { memberId: string; weight: number };
  export function validateWeights(r: RecordData): void {
    if (r.shareWeights === undefined) return;
    const weights = r.shareWeights as Weight[],
      people = r.participants as string[];
    if (
      !Array.isArray(weights) ||
      !Array.isArray(people) ||
      weights.length !== people.length ||
      new Set(weights.map((w) => w?.memberId)).size !== weights.length ||
      weights.some(
        (w) =>
          !w ||
          !people.includes(w.memberId) ||
          typeof w.weight !== "number" ||
          !Number.isFinite(w.weight) ||
          w.weight <= 0 ||
          w.weight > 1e6,
      )
    )
      throw new Error(
        "Renseigne un poids positif pour chaque participant coché, et uniquement ces participants, ou laisse tous les poids vides pour des parts égales.",
      );
  }
  export function shares(r: RecordData): { id: string; cents: number }[] {
    validateWeights(r);
    const people = (r.participants || []) as string[];
    if (!people.length) return [];
    const cents = Math.round(OS.n(r, "cost") * 100);
    if (!Number.isSafeInteger(cents) || cents < 0)
      throw new Error("Montant partagé trop grand ou invalide.");
    const weights = people.map(
        (id) =>
          (r.shareWeights as Weight[] | undefined)?.find(
            (w) => w.memberId === id,
          )?.weight ?? 1,
      ),
      total = weights.reduce((a, b) => a + b, 0);
    const parts = people.map((id, i) => {
      const exact = (cents * weights[i]!) / total;
      return {
        id,
        index: i,
        cents: Math.floor(exact),
        remainder: exact - Math.floor(exact),
      };
    });
    let remaining = cents - parts.reduce((a, p) => a + p.cents, 0);
    if (remaining < 0 || remaining > parts.length)
      throw new Error(
        "Précision monétaire insuffisante pour cette répartition.",
      );
    for (const part of [...parts].sort(
      (a, b) => b.remainder - a.remainder || a.index - b.index,
    )) {
      if (!remaining) break;
      part.cents++;
      remaining--;
    }
    return parts.map(({ id, cents }) => ({ id, cents }));
  }
  export function validate(s: State): void {
    const seen = new Set<string>();
    for (const r of s.os) {
      if (r.kind === "sharedExpense") shares(r);
      if (r.kind === "trainingExercise")
        for (const key of ["targetSets", "targetReps", "restSeconds"])
          if (!Number.isInteger(Number(r[key])))
            throw new Error(
              "Les séries, répétitions et secondes attendent des entiers.",
            );
      if (r.kind !== "exerciseSet") continue;
      for (const key of ["setIndex", "repetitions", "seconds"])
        if (!Number.isInteger(Number(r[key])))
          throw new Error(
            "Numéro de série, répétitions et durée : entiers requis.",
          );
      const session = s.os.find((x) => x.id === r.sessionId),
        exercise = s.os.find((x) => x.id === r.exerciseId);
      if (session?.programId !== exercise?.programId)
        throw new Error(
          "La séance et l’exercice doivent appartenir au même programme.",
        );
      if (r.deleted) continue;
      const token = JSON.stringify([r.sessionId, r.exerciseId, r.setIndex]);
      if (seen.has(token))
        throw new Error(
          "Ce numéro de série existe déjà pour cet exercice dans cette séance.",
        );
      seen.add(token);
    }
  }
  export function performance(s: State, exerciseId: string) {
    return rows(s, "exerciseSet")
      .filter((r) => r.exerciseId === exerciseId)
      .map(
        (r) =>
          ({
            ...r,
            date: String(s.os.find((x) => x.id === r.sessionId)?.date || ""),
          }) as RecordData & { date: string },
      )
      .sort(
        (a, b) =>
          String(b.date).localeCompare(String(a.date)) ||
          Number(b.setIndex) - Number(a.setIndex),
      );
  }
  export type Component = {
    label: string;
    score: number | null;
    explanation: string;
    refs: Personal.Ref[];
  };
  export type Score = {
    id: string;
    name: string;
    score: number | null;
    coverage: string;
    components: Component[];
  };
  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  export function scores(s: State, today = day()): Score[] {
    if (!validDate(today)) throw new Error("Date de bilan invalide.");
    const since = OS.addDays(today, -29),
      week = OS.addDays(today, -6);
    const recent = (r: RecordData) =>
      String(r.date) >= since && String(r.date) <= today;
    const component = (
      label: string,
      value: number | null,
      explanation: string,
      records: RecordData[],
      key: Collection = "os",
    ): Component => ({
      label,
      score: value === null ? null : Math.round(OS.clamp(value)),
      explanation,
      refs: records.map((r) => ({ key, id: r.id })),
    });
    const rate = (
      label: string,
      records: RecordData[],
      predicate: (r: RecordData) => boolean,
      explanation: string,
      key: Collection = "os",
    ) =>
      component(
        label,
        records.length
          ? (100 * records.filter(predicate).length) / records.length
          : null,
        explanation,
        records,
        key,
      );
    const self = (area: string) => {
      const records = rows(s, "lifeRating").filter(
        (r) => r.area === area && recent(r),
      );
      return component(
        "Ressenti · " + area,
        mean(records.map((r) => OS.n(r, "score") * 10)),
        "Moyenne des auto-évaluations de ce domaine sur les 30 derniers jours.",
        records,
      );
    };
    const combine = (
      id: string,
      name: string,
      components: Component[],
    ): Score => {
      const available = components.filter((c) => c.score !== null);
      return {
        id,
        name,
        score: available.length
          ? Math.round(
              available.reduce((a, c) => a + c.score!, 0) / available.length,
            )
          : null,
        coverage: `${available.length}/${components.length} composante(s) renseignée(s)`,
        components,
      };
    };
    const budgets = rows(s, "budget").filter(
      (r) => r.month === today.slice(0, 7),
    );
    const transactions = s.finances.filter(
      (t) =>
        !t.deleted &&
        String(t.date).startsWith(today.slice(0, 7)) &&
        String(t.date) <= today,
    );
    const budgetValues = budgets.flatMap((b) => {
      const tx = transactions.filter(
        (t) =>
          Personal.fold(t.category).trim() === Personal.fold(b.category).trim(),
      );
      if (!tx.length) return [];
      const spent = -tx
          .filter((t) => Number(t.amount) < 0)
          .reduce((a, t) => a + Number(t.amount), 0),
        limit = OS.n(b, "limit");
      return [spent <= limit ? 100 : limit > 0 ? (100 * limit) / spent : 0];
    });
    const milestones = rows(s, "milestone");
    const courses = rows(s, "course");
    const programs = rows(s, "trainingProgram"),
      sessions = rows(s, "trainingSession").filter(
        (r) =>
          String(r.date) >= week &&
          String(r.date) <= today &&
          programs.some((p) => p.id === r.programId),
      );
    const contacts = rows(s, "contact")
      .map((r) => {
        const dates = [
          String(r.date || ""),
          ...rows(s, "interaction")
            .filter((i) => i.contactId === r.id)
            .map((i) => String(i.date)),
        ]
          .filter((d) => validDate(d) && d <= today)
          .sort();
        return { ...r, lastContact: dates[dates.length - 1] };
      })
      .filter((r) => r.lastContact);
    const docs = s.documents.filter(
      (r) => Personal.visible(r) && validDate(String(r.expiry)),
    );
    const chores = rows(s, "chore").filter(
      (r) => String(r.due) >= since && String(r.due) <= today,
    );
    const services = rows(s, "service").filter((r) =>
      ["Activée", "Désactivée"].includes(String(r.mfa)),
    );
    const impactGoals = rows(s, "impactGoal");
    const impact = impactGoals.flatMap((g) => {
      const contributions = rows(s, "contribution").filter(
        (c) => c.impactGoalId === g.id && String(c.date) <= today,
      );
      return contributions.length
        ? [
            OS.clamp(
              (100 * OS.sum(contributions, "quantity")) /
                OS.n(g, "targetValue"),
            ),
          ]
        : [];
    });
    const energy = rows(s, "energyDay").filter(recent);
    return [
      combine("finance", "Finances", [
        component(
          "Budgets",
          mean(budgetValues),
          `${budgetValues.length}/${budgets.length} budgets du mois avec des mouvements datés jusqu’au bilan. 100 si respecté ; sinon plafond/dépenses × 100. Les catégories sans mouvement restent inconnues.`,
          budgets,
        ),
        self("Finances"),
      ]),
      combine("projects", "Projets", [
        component(
          "Jalons",
          milestones.length
            ? (100 *
                milestones
                  .filter(OS.done)
                  .reduce((a, r) => a + OS.n(r, "weight"), 0)) /
                milestones.reduce((a, r) => a + OS.n(r, "weight"), 0)
            : null,
          "Part des jalons terminés, pondérée par leur poids ; état actuel des projets.",
          milestones,
        ),
        self("Travail"),
      ]),
      combine("learning", "Apprentissage", [
        component(
          "Parcours",
          mean(courses.map((c) => OS.n(c, "progress"))),
          "Moyenne des avancements saisis des parcours actifs ; état actuel.",
          courses,
        ),
        self("Apprentissage"),
      ]),
      combine("health", "Activité physique", [
        component(
          "Régularité",
          programs.length && sessions.length
            ? (100 *
                sessions.filter((r) =>
                  programs.some((p) => p.id === r.programId),
                ).length) /
                programs.reduce((a, p) => a + OS.n(p, "weeklySessions"), 0)
            : null,
          "Séances des sept derniers jours / séances hebdomadaires prévues, plafonné à 100. Sans séance enregistrée, données insuffisantes. Ce n’est pas une mesure de santé.",
          sessions,
        ),
        self("Santé"),
      ]),
      combine("relations", "Relations", [
        rate(
          "Cadence de contact",
          contacts,
          (r) =>
            OS.daysBetween(String(r.lastContact), today) <= OS.n(r, "cadence"),
          "Part des contacts connus encore dans la cadence choisie ; dates futures ignorées. Les contacts sans date sont exclus.",
        ),
        self("Relations"),
      ]),
      combine("documents", "Administration", [
        rate(
          "Validité des documents",
          docs,
          (r) => String(r.expiry) >= today,
          "Part des documents du coffre dont l’expiration renseignée n’est pas dépassée ; autres documents exclus.",
          "documents",
        ),
      ]),
      combine("household", "Foyer", [
        rate(
          "Tâches du foyer",
          chores,
          OS.done,
          "Part des tâches du foyer à échéance dans les 30 derniers jours marquées terminées. Les tâches récurrentes représentent leur occurrence courante.",
        ),
        self("Foyer"),
      ]),
      combine("digital", "Vie numérique", [
        rate(
          "Double authentification",
          services,
          (r) => r.mfa === "Activée",
          "Part des services vérifiés avec double authentification activée ; À vérifier et Non disponible sont exclus.",
        ),
      ]),
      combine("impact", "Impact", [
        component(
          "Engagements",
          mean(impact),
          "Moyenne des contributions/cibles par engagement avec contributions datées jusqu’au bilan, plafonnée à 100. Chaque engagement conserve sa propre unité.",
          impactGoals,
        ),
        self("Sens"),
      ]),
      combine("balance", "Équilibre", [
        component(
          "Énergie déclarée",
          mean(energy.map((r) => OS.n(r, "energy") * 10)),
          "Moyenne de l’énergie déclarée sur les 30 derniers jours, multipliée par 10.",
          energy,
        ),
        self("Loisirs"),
      ]),
    ];
  }
}
