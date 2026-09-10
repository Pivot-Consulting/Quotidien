/** Local, explainable findings; analyzers are read-only and share the same objects. */
namespace Q.Intelligence {
  export type Finding = {
    id: string;
    category: string;
    title: string;
    explanation: string;
    refs: Personal.Ref[];
    action: string;
  };
  export type Decision = {
    id: string;
    title: string;
    status: "accepted" | "ignored" | "snoozed";
    at: string;
    until?: string;
    taskId?: string;
  };
  type Analyzer = (s: State, today: string) => Finding[];
  const P = Personal;
  export const categories = [
    "Important",
    "Risque",
    "À surveiller",
    "Opportunité",
    "Suggestion",
  ];
  export const decisions = (s: State): Decision[] =>
    (s.insightDecisions || []) as Decision[];
  const ref = (h: Personal.Ref): Personal.Ref => ({ key: h.key, id: h.id });
  const finding = (
    type: string,
    category: string,
    title: string,
    explanation: string,
    refs: Personal.Ref[],
    action: string,
    period = "",
  ): Finding => ({
    id: JSON.stringify([type, ...refs.map(P.token).sort(), period]),
    category,
    title,
    explanation,
    refs: refs.map(ref),
    action,
  });
  const live = (s: State, kind: string) =>
    OS.rows(s, kind).filter((r) => P.visible(r) && !P.completed(r));
  const euro = (n: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(n);
  const deadlines: Analyzer = (s, today) =>
    Planning.entries(s)
      .filter((x) => x.deadline && x.start <= OS.addDays(today, 7))
      .map((x) =>
        finding(
          "deadline:" + x.id,
          x.start < today ? "Important" : "À surveiller",
          `${x.label} ${x.start < today ? "dépassée" : "à venir"} · ${P.title(x.hit.record)}`,
          `${x.label} le ${x.start}. ${x.start < today ? OS.daysBetween(x.start, today) + " jour(s) de retard." : "Dans les sept prochains jours."}`,
          [x.hit],
          `Traiter ${x.label.toLowerCase()} · ${P.title(x.hit.record)}`,
          x.start,
        ),
      );
  const budgets: Analyzer = (s, today) =>
    live(s, "budget")
      .filter((r) => r.month === today.slice(0, 7))
      .flatMap((r) => {
        const spent = -OS.sum(
          s.finances.filter(
            (t) =>
              !t.deleted &&
              Number(t.amount) < 0 &&
              String(t.date).startsWith(String(r.month)) &&
              String(t.category || "")
                .trim()
                .toLocaleLowerCase("fr") ===
                String(r.category).trim().toLocaleLowerCase("fr"),
          ),
          "amount",
        );
        return spent > Number(r.limit)
          ? [
              finding(
                "budget",
                "Risque",
                `Budget dépassé · ${P.title(r)}`,
                `${euro(spent)} dépensés pour une enveloppe de ${euro(Number(r.limit))} en ${r.month}, soit ${euro(spent - Number(r.limit))} de dépassement. Les transactions archivées restent comptabilisées.`,
                [{ key: "os", id: r.id }],
                `Revoir le budget · ${P.title(r)}`,
                String(r.month),
              ),
            ]
          : [];
      });
  const contacts: Analyzer = (s, today) =>
    live(s, "contact").flatMap((r) => {
      const dates = [
        r.date,
        ...OS.rows(s, "interaction")
          .filter((x) => x.contactId === r.id)
          .map((x) => x.date),
      ]
        .map(String)
        .filter((d) => validDate(d) && d <= today)
        .sort();
      const last = dates[dates.length - 1];
      if (!last || OS.daysBetween(last, today) < Number(r.cadence)) return [];
      return [
        finding(
          "contact",
          "Suggestion",
          `Reprendre contact · ${P.title(r)}`,
          `Dernier échange enregistré le ${last}, il y a ${OS.daysBetween(last, today)} jours. Ta cadence est de ${r.cadence} jours.`,
          [{ key: "os", id: r.id }],
          `Contacter ${P.title(r)}`,
          last,
        ),
      ];
    });
  /** Metadata edits don't count as progress; linked task/milestone completion does. */
  const projects: Analyzer = (s, today) =>
    live(s, "project")
      .filter((r) => r.status === "En cours")
      .flatMap((r) => {
        const projectRef: Personal.Ref = { key: "os", id: r.id };
        const linked = P.related(s, projectRef).map((c) =>
          P.same(c.from, projectRef) ? c.to : c.from,
        );
        const dates = [
          String(r.createdAt || "").slice(0, 10),
          String(r.lastCompleted || "").slice(0, 10),
        ];
        for (const h of P.revisions(s)) {
          if (!h.before || h.after.deleted) continue;
          const own = P.same(h.ref, projectRef);
          const child = linked.some((x) => P.same(x, h.ref));
          if (
            (own || child) &&
            (h.before.status !== h.after.status ||
              h.before.progress !== h.after.progress ||
              h.before.done !== h.after.done ||
              JSON.stringify(P.meta(h.before).checklist) !==
                JSON.stringify(P.meta(h.after).checklist))
          )
            dates.push(h.at.slice(0, 10));
        }
        for (const x of linked) {
          const child = P.resolve(s, x);
          if (child && !child.deleted && P.completed(child))
            dates.push(
              String(child.completedAt || child.lastCompleted || "").slice(
                0,
                10,
              ),
            );
        }
        const known = dates.filter((d) => validDate(d) && d <= today).sort();
        const last = known[known.length - 1];
        if (!last || OS.daysBetween(last, today) < 30) return [];
        return [
          finding(
            "stagnation",
            "À surveiller",
            `Projet à revoir · ${P.title(r)}`,
            `Aucune progression enregistrée depuis le ${last} (${OS.daysBetween(last, today)} jours). Calcul sur la création, les statuts, la progression, les checklists et les actions liées ; les simples changements de tags ne comptent pas. L’historique conservé est limité.`,
            [projectRef],
            `Définir la prochaine étape · ${P.title(r)}`,
            last,
          ),
        ];
      });
  const workload: Analyzer = (s, today) =>
    live(s, "planning")
      .filter(
        (r) =>
          String(r.date) >= today && String(r.date) <= OS.addDays(today, 7),
      )
      .flatMap((r) => {
        const tasks = s.tasks.filter(
          (t) => P.visible(t) && !P.completed(t) && t.due === r.date,
        );
        const used = tasks.reduce(
          (n, t) => n + (P.meta(t).duration || Number(t.estimate) || 25),
          0,
        );
        return used > Number(r.capacity)
          ? [
              finding(
                "load",
                "Risque",
                `Charge élevée le ${r.date}`,
                `${used} min de tâches à échéance pour ${r.capacity} min disponibles selon tes préférences du jour. Les rendez-vous et tâches sans échéance ne sont pas inclus.`,
                [
                  { key: "os", id: r.id },
                  ...tasks.map((t) => ({
                    key: "tasks" as Collection,
                    id: t.id,
                  })),
                ],
                `Replanifier la journée du ${r.date}`,
                String(r.date),
              ),
            ]
          : [];
      });
  const conflicts: Analyzer = (s, today) => {
    const items = Planning.entries(s).filter(
      (x) =>
        x.start >= today &&
        x.start <= OS.addDays(today, 7) &&
        x.time &&
        (x.hit.key === "events" ||
          x.hit.record.kind === "appointment" ||
          x.hit.record.kind === "booking"),
    );
    const result: Finding[] = [];
    const minute = (time: string) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i]!,
          b = items[j]!;
        if (a.start !== b.start || P.same(a.hit, b.hit)) continue;
        const ad = P.meta(a.hit.record).duration,
          bd = P.meta(b.hit.record).duration;
        const sameTime = a.time === b.time;
        const overlap =
          ad &&
          bd &&
          minute(a.time) < minute(b.time) + bd &&
          minute(b.time) < minute(a.time) + ad;
        if (sameTime || overlap)
          result.push(
            finding(
              "conflict",
              "Important",
              `Horaires à vérifier le ${a.start}`,
              `${P.title(a.hit.record)} à ${a.time} et ${P.title(b.hit.record)} à ${b.time}. ${ad && bd ? "Les durées déclarées se chevauchent." : "Même heure de début ; renseigne les durées pour préciser le conflit."}`,
              [a.hit, b.hit],
              "Vérifier les rendez-vous du " + a.start,
              a.start + ":" + a.time + ":" + b.time,
            ),
          );
      }
    return result;
  };
  const duplicates: Analyzer = (s) => {
    const groups = new Map<string, Personal.Hit[]>();
    for (const h of P.all(s).filter((h) => P.visible(h.record))) {
      const title = P.fold(P.title(h.record)).trim();
      if (title.length < 3) continue;
      const key = JSON.stringify([
        h.key,
        h.record.kind || "",
        title,
        P.date(h.record),
        h.record.amount ?? "",
        h.record.time || "",
      ]);
      groups.set(key, [...(groups.get(key) || []), h]);
    }
    return [...groups.values()]
      .filter((g) => g.length > 1)
      .map((g) =>
        finding(
          "duplicate",
          "Suggestion",
          `Doublon possible · ${P.title(g[0]!.record)}`,
          `${g.length} fiches de même type portent le même titre et la même date${g[0]!.key === "finances" ? " et le même montant" : ""}. Vérifie leur contenu avant tout retrait.`,
          g,
          `Vérifier les doublons · ${P.title(g[0]!.record)}`,
        ),
      );
  };
  export const analyzers: { id: string; run: Analyzer }[] = [
    {
      id: "connected-finances",
      run: (s, today) => [
        ...live(s, "project")
          .filter((r) => Connected.projectSpent(s, r) > Number(r.budget || 0))
          .map((r) =>
            finding(
              "project-budget",
              "Risque",
              `Budget du projet dépassé · ${P.title(r)}`,
              `${euro(Connected.projectSpent(s, r))} utilisés pour ${euro(Number(r.budget || 0))} prévus. Source : ${r.spendMode === "Transactions" ? "transactions liées, remboursements déduits" : "saisie manuelle"}.`,
              [{ key: "os", id: r.id }],
              `Revoir le budget · ${P.title(r)}`,
            ),
          ),
        ...s.goals
          .filter((g) => P.visible(g) && g.date && validDate(String(g.date)))
          .flatMap((g) => {
            const value = Connected.savings(s, g);
            if (!value || !value.remaining) return [];
            const days = OS.daysBetween(today, String(g.date));
            if (
              days >= 0 &&
              (value.months === null || value.months * 30.44 <= days)
            )
              return [];
            return [
              finding(
                "savings-gap",
                "À surveiller",
                `Épargne à ajuster · ${P.title(g)}`,
                `${euro(value.remaining)} restent à constituer avant le ${g.date}. ${days < 0 ? "L’échéance est passée." : `À versement mensuel constant, environ ${value.months} mois seraient nécessaires (mois moyen de 30,44 jours, sans intérêts ni retraits).`}`,
                [{ key: "goals", id: g.id }],
                `Revoir le plan d’épargne · ${P.title(g)}`,
                String(g.date),
              ),
            ];
          }),
      ],
    },
    { id: "deadlines", run: deadlines },
    { id: "budgets", run: budgets },
    { id: "contacts", run: contacts },
    { id: "projects", run: projects },
    { id: "workload", run: workload },
    { id: "conflicts", run: conflicts },
    { id: "duplicates", run: duplicates },
  ];
  export function analyze(s: State, today = day()): Finding[] {
    return analyzers
      .flatMap((x) => x.run(s, today))
      .sort(
        (a, b) =>
          categories.indexOf(a.category) - categories.indexOf(b.category) ||
          a.title.localeCompare(b.title, "fr"),
      );
  }
  export function disposition(s: State, f: Finding, today = day()): string {
    const d = decisions(s).find((x) => x.id === f.id);
    return !d || (d.status === "snoozed" && String(d.until) <= today)
      ? "active"
      : d.status;
  }
  export function decide(
    s: State,
    f: Finding,
    status: Decision["status"],
    id: string,
    today = day(),
  ): void {
    let taskId: string | undefined;
    if (status === "accepted") {
      const old = decisions(s).find((x) => x.id === f.id);
      const existing = s.tasks.find(
        (t) => t.id === old?.taskId || t.insightSource === f.id,
      );
      const source =
        f.refs.length === 1 && f.refs[0]!.key === "tasks"
          ? P.resolve(s, f.refs[0]!)
          : undefined;
      if (existing || source) taskId = (existing || source)!.id;
      else {
        taskId = id;
        s.tasks.unshift({
          id,
          title: f.action,
          due: today,
          estimate: 25,
          done: false,
          important: true,
          insightSource: f.id,
        });
        s.connections = [
          ...P.connections(s),
          ...f.refs.map((r, i) => ({
            id: `${id}:insight:${i}`,
            from: { key: "tasks", id },
            to: ref(r),
            type: "related",
          })),
        ];
      }
    }
    s.insightDecisions = [
      {
        id: f.id,
        title: f.title,
        status,
        at: today,
        ...(status === "snoozed" ? { until: OS.addDays(today, 7) } : {}),
        ...(taskId ? { taskId } : {}),
      },
      ...decisions(s).filter((x) => x.id !== f.id),
    ];
  }
  export function validate(s: State): void {
    if (s.insightDecisions === undefined) return;
    if (!Array.isArray(s.insightDecisions))
      throw new Error("Suivi des recommandations invalide.");
    const ids = new Set();
    for (const d of decisions(s)) {
      if (
        !d ||
        typeof d !== "object" ||
        typeof d.id !== "string" ||
        !d.id ||
        ids.has(d.id) ||
        typeof d.title !== "string" ||
        !["accepted", "ignored", "snoozed"].includes(d.status) ||
        typeof d.at !== "string" ||
        !validDate(d.at) ||
        (d.status === "snoozed" &&
          (typeof d.until !== "string" || !validDate(d.until))) ||
        (d.until !== undefined &&
          (typeof d.until !== "string" || !validDate(d.until))) ||
        (d.taskId !== undefined &&
          (typeof d.taskId !== "string" ||
            !s.tasks.some((t) => t.id === d.taskId)))
      )
        throw new Error("Décision de recommandation invalide.");
      ids.add(d.id);
    }
  }
}
