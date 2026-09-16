/** Shared extensions. Existing records remain valid; all derived views are pure. */
namespace Q.Evolution {
  export type Custom = {
    name: string;
    type: "text" | "number" | "date" | "boolean";
    value: string | number | boolean;
  };
  const live = (s: State, kind: string) =>
    OS.rows(s, kind).filter(Personal.visible);
  const n = OS.n;
  const field = (
    key: string,
    label: string,
    type = "text",
    extra: Partial<OS.Field> = {},
  ): OS.Field => ({ key, label, type, ...extra });
  const number = (key: string, label: string, min = 0) =>
    field(key, label, "number", { min, required: true });
  const date = (key: string, label: string) =>
    field(key, label, "date", { required: true });
  const ref = (key: string, label: string, kind: string) =>
    field(key, label, "ref", { ref: kind, required: true });
  const choice = (key: string, label: string, options: string[]) =>
    field(key, label, "select", { options });
  function add(
    domain: string,
    id: string,
    label: string,
    fields: OS.Field[],
    scheduled = false,
  ) {
    const model = { id, label, fields, scheduled };
    OS.domains.find((d) => d.id === domain)!.models.push(model);
    OS.models.push(model);
  }
  add(
    "finance",
    "commitment",
    "Échéances financières",
    [
      ref("accountId", "Compte", "account"),
      number("amount", "Montant signé (€ ; dépense négative)", -1e12),
      date("due", "Échéance"),
      field("projectId", "Projet", "ref", { ref: "project" }),
    ],
    true,
  );
  add("finance", "scenario", "Scénarios de trésorerie", [
    ref("accountId", "Compte", "account"),
    date("due", "Horizon"),
    number("delta", "Variation hypothétique totale (€)", -1e12),
    field("assumption", "Hypothèses", "textarea"),
  ]);
  add("decisions", "criterion", "Critères personnalisés", [
    ref("decisionId", "Décision", "decision"),
    number("weight", "Poids", 0.01),
  ]);
  add("decisions", "optionScore", "Évaluations des options", [
    ref("optionId", "Option", "option"),
    ref("criterionId", "Critère", "criterion"),
    field("score", "Note (0–10)", "number", {
      min: 0,
      max: 10,
      required: true,
    }),
    field("evidence", "Justification", "textarea"),
  ]);
  add(
    "security",
    "recovery",
    "Procédures de récupération",
    [
      ref("serviceId", "Service numérique", "service"),
      field("steps", "Étapes (sans mot de passe ni code secret)", "textarea", {
        required: true,
      }),
      field("location", "Emplacement sécurisé des moyens de récupération"),
      date("due", "Prochain essai"),
    ],
    true,
  );
  const unit = () => choice("unit", "Unité", ["g", "ml", "pièce"]);
  add("nutrition", "ingredient", "Ingrédients structurés", [
    ref("recipeId", "Recette", "recipe"),
    field("item", "Aliment", "text", { required: true }),
    number("quantity", "Quantité par portion", 0.001),
    unit(),
  ]);
  add("nutrition", "menu", "Menus planifiés", [
    ref("recipeId", "Recette", "recipe"),
    date("date", "Date"),
    number("portions", "Portions", 0.01),
  ]);
  add("nutrition", "stock", "Stock alimentaire", [
    field("item", "Aliment", "text", { required: true }),
    number("quantity", "Quantité"),
    unit(),
  ]);
  add(
    "nutrition",
    "shopping",
    "Courses",
    [
      field("item", "Aliment", "text", { required: true }),
      number("quantity", "Quantité", 0.001),
      unit(),
      date("due", "À acheter avant"),
    ],
    true,
  );
  add("health", "trainingProgram", "Programmes sportifs", [
    choice("sport", "Sport", ["Tennis", "Musculation", "Autre"]),
    field("exercises", "Exercices et progression", "textarea", {
      required: true,
    }),
    number("weeklySessions", "Séances par semaine", 1),
  ]);
  add("health", "trainingSession", "Historique des programmes", [
    ref("programId", "Programme", "trainingProgram"),
    date("date", "Date"),
    number("minutes", "Durée (min)", 1),
    field("effort", "Effort ressenti (1–10)", "number", {
      min: 1,
      max: 10,
      required: true,
    }),
    field("result", "Exercices, séries, charges ou résultat", "textarea"),
  ]);
  add("journal", "lifePeriod", "Périodes de vie", [
    date("date", "Début"),
    date("end", "Fin"),
    field("meaning", "Bilan et sens", "textarea"),
  ]);
  // Optional relations augment existing forms, without copying existing objects.
  for (const kind of ["document", "equipment", "procedure"])
    OS.getModel(kind)!.fields.push(
      field("vaultDocumentId", "Document du coffre", "vaultref"),
    );
  OS.getModel("application")!.fields.push(
    field("contactId", "Contact", "ref", { ref: "contact" }),
  );
  OS.getModel("course")!.fields.push(
    field("careerSkillId", "Compétence visée", "ref", { ref: "careerSkill" }),
  );

  export function children(s: State, id: string): RecordData[] {
    return s.tasks.filter((r) => Personal.visible(r) && r.parentTaskId === id);
  }
  export function validate(s: State): void {
    for (const key of collections)
      for (const r of s[key]) {
        if (
          r.assigneeId &&
          !s.os.some((x) => x.id === r.assigneeId && x.kind === "contact")
        )
          throw new Error("Contact responsable introuvable.");
        if (r.customFields !== undefined) {
          if (!Array.isArray(r.customFields) || r.customFields.length > 30)
            throw new Error("30 champs personnalisés maximum.");
          const names = new Set<string>();
          for (const c of r.customFields as Custom[]) {
            if (
              !c ||
              typeof c.name !== "string" ||
              !c.name.trim() ||
              names.has(c.name.trim().toLowerCase())
            )
              throw new Error("Nom de champ personnalisé vide ou en double.");
            names.add(c.name.trim().toLowerCase());
            if (
              !(
                (c.type === "text" && typeof c.value === "string") ||
                (c.type === "number" &&
                  typeof c.value === "number" &&
                  Number.isFinite(c.value)) ||
                (c.type === "boolean" && typeof c.value === "boolean") ||
                (c.type === "date" &&
                  typeof c.value === "string" &&
                  validDate(c.value))
              )
            )
              throw new Error(
                "Valeur de champ personnalisé incompatible avec son type.",
              );
          }
        }
      }
    const tasks = new Map(s.tasks.map((t) => [t.id, t]));
    for (const t of s.tasks) {
      const seen = new Set([t.id]);
      let parent = t.parentTaskId;
      while (parent) {
        if (
          typeof parent !== "string" ||
          !tasks.has(parent) ||
          seen.has(parent)
        )
          throw new Error("Hiérarchie des sous-tâches invalide ou cyclique.");
        seen.add(parent);
        parent = tasks.get(parent)!.parentTaskId;
      }
    }
    const pairs = new Set<string>();
    const dependencies = new Map<string, string[]>();
    const edge = (from: string, to: string) =>
      dependencies.set(from, [...(dependencies.get(from) || []), to]);
    for (const t of s.tasks)
      if (t.parentTaskId)
        edge(
          Personal.token({ key: "tasks", id: String(t.parentTaskId) }),
          Personal.token({ key: "tasks", id: t.id }),
        );
    for (const c of Personal.connections(s))
      if (!c.deleted && c.type === "depends")
        edge(Personal.token(c.from), Personal.token(c.to));
    const visiting = new Set<string>(),
      visited = new Set<string>();
    const visit = (id: string) => {
      if (visiting.has(id))
        throw new Error("Cycle entre sous-tâches et dépendances.");
      if (visited.has(id)) return;
      visiting.add(id);
      for (const next of dependencies.get(id) || []) visit(next);
      visiting.delete(id);
      visited.add(id);
    };
    for (const id of dependencies.keys()) visit(id);
    for (const r of s.os) {
      if (
        r.vaultDocumentId &&
        !s.documents.some((d) => d.id === r.vaultDocumentId)
      )
        throw new Error("Document du coffre introuvable.");
      if (r.kind === "lifePeriod" && String(r.end) < String(r.date))
        throw new Error("La fin de période précède son début.");
      if (r.kind === "optionScore") {
        const option = s.os.find((x) => x.id === r.optionId),
          criterion = s.os.find((x) => x.id === r.criterionId);
        if (option?.decisionId !== criterion?.decisionId)
          throw new Error("Critère et option de décisions différentes.");
        const pair = JSON.stringify([r.optionId, r.criterionId]);
        if (!r.deleted && pairs.has(pair))
          throw new Error("Une seule note par option et critère.");
        if (!r.deleted) pairs.add(pair);
      }
    }
    const paid = new Set<string>();
    for (const t of s.finances.filter((x) => !x.deleted && x.commitmentId)) {
      const c = s.os.find(
        (x) => x.id === t.commitmentId && x.kind === "commitment",
      );
      if (
        !c ||
        paid.has(c.id) ||
        t.accountId !== c.accountId ||
        Number(t.amount) !== Number(c.amount)
      )
        throw new Error("Règlement d’échéance incohérent ou en double.");
      paid.add(c.id);
    }
    for (const t of s.finances)
      if (t.tripId && !s.os.some((x) => x.id === t.tripId && x.kind === "trip"))
        throw new Error("Voyage lié introuvable.");
    const config = s.settings.analysis as Record<string, unknown> | undefined;
    if (config)
      for (const [k, max] of [
        ["horizon", 90],
        ["stagnation", 365],
      ] as const)
        if (
          !Number.isInteger(config[k]) ||
          Number(config[k]) < 1 ||
          Number(config[k]) > max
        )
          throw new Error("Seuil d’analyse invalide.");
  }
  export function paid(s: State, id: string): boolean {
    return s.finances.some((t) => !t.deleted && t.commitmentId === id);
  }
  export function installments(
    s: State,
    accountId: string,
    title: string,
    total: number,
    count: number,
    first: string,
    makeId: () => string,
  ): number {
    if (
      !title.trim() ||
      !Number.isFinite(total) ||
      !total ||
      Math.abs(total) > 1e12 ||
      !Number.isInteger(count) ||
      count < 1 ||
      count > 60 ||
      !validDate(first) ||
      !live(s, "account").some((a) => a.id === accountId)
    )
      throw new Error(
        "Échéancier invalide : compte, titre, montant signé, date et 1 à 60 mensualités requis.",
      );
    const cents = Math.round(total * 100),
      part = Math.trunc(cents / count),
      group = makeId(),
      original = new Date(first + "T12:00:00");
    for (let i = 0; i < count; i++) {
      const date = new Date(original);
      date.setDate(1);
      date.setMonth(date.getMonth() + i);
      date.setDate(
        Math.min(
          original.getDate(),
          new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate(),
        ),
      );
      s.os.push({
        id: makeId(),
        kind: "commitment",
        title: title.trim() + ` · ${i + 1}/${count}`,
        accountId,
        amount: (i === count - 1 ? cents - part * (count - 1) : part) / 100,
        due: day(date),
        status: "En cours",
        installmentGroup: group,
      });
    }
    return count;
  }
  export function settle(
    s: State,
    id: string,
    makeId: () => string,
    today = day(),
  ): void {
    const c = live(s, "commitment").find((x) => x.id === id);
    if (!c || paid(s, id)) throw new Error("Échéance absente ou déjà réglée.");
    s.finances.push({
      id: makeId(),
      label: c.title,
      type: "Autre",
      amount: n(c, "amount"),
      date: today,
      accountId: c.accountId,
      projectId: c.projectId || "",
      commitmentId: id,
      category: "Échéance",
    });
  }
  export function forecast(s: State, accountId: string, until: string) {
    if (!validDate(until)) throw new Error("Horizon invalide.");
    const actual = Connected.balance(s, accountId);
    const commitments = live(s, "commitment").filter(
      (c) =>
        c.accountId === accountId && String(c.due) <= until && !paid(s, c.id),
    );
    const expected = commitments.reduce((sum, c) => sum + n(c, "amount"), 0);
    return { actual, expected, projected: actual + expected, commitments };
  }
  export function decisionScores(s: State, decisionId: string) {
    const criteria = live(s, "criterion").filter(
      (c) => c.decisionId === decisionId,
    );
    return live(s, "option")
      .filter((o) => o.decisionId === decisionId)
      .map((option) => {
        const scores = criteria.map((c) => ({
          criterion: c,
          rating: live(s, "optionScore").find(
            (x) => x.optionId === option.id && x.criterionId === c.id,
          ),
        }));
        const complete = criteria.length > 0 && scores.every((x) => x.rating);
        return {
          option,
          complete,
          score: complete
            ? scores.reduce(
                (a, x) => a + n(x.criterion, "weight") * n(x.rating!, "score"),
                0,
              ) / criteria.reduce((a, c) => a + n(c, "weight"), 0)
            : null,
        };
      });
  }
  const itemKey = (r: RecordData) =>
    JSON.stringify([Personal.fold(String(r.item)).trim(), r.unit]);
  export function shoppingNeeds(s: State, from: string, until: string) {
    if (!validDate(from) || !validDate(until) || until < from)
      throw new Error("Période de menus invalide.");
    const needs = new Map<
      string,
      { item: string; unit: string; quantity: number }
    >();
    for (const menu of live(s, "menu").filter(
      (m) => !m.consumedAt && String(m.date) >= from && String(m.date) <= until,
    )) {
      const ingredients = live(s, "ingredient").filter(
        (i) => i.recipeId === menu.recipeId,
      );
      if (!ingredients.length)
        throw new Error(
          "Ajoute les ingrédients structurés des recettes du menu.",
        );
      for (const i of ingredients) {
        const key = itemKey(i),
          current = needs.get(key) || {
            item: String(i.item),
            unit: String(i.unit),
            quantity: 0,
          };
        current.quantity += n(i, "quantity") * n(menu, "portions");
        needs.set(key, current);
      }
    }
    for (const [key, value] of needs)
      value.quantity = Math.max(
        0,
        value.quantity -
          live(s, "stock")
            .filter((r) => itemKey(r) === key)
            .reduce((a, r) => a + n(r, "quantity"), 0) -
          live(s, "shopping")
            .filter((r) => itemKey(r) === key && !r.receivedAt && !OS.done(r))
            .reduce((a, r) => a + n(r, "quantity"), 0),
      );
    return [...needs.values()].filter((r) => r.quantity > 0.000001);
  }
  export function makeShopping(
    s: State,
    from: string,
    until: string,
    makeId: () => string,
  ): number {
    const needs = shoppingNeeds(s, from, until);
    for (const r of needs)
      s.os.push({
        ...r,
        id: makeId(),
        kind: "shopping",
        title: r.item,
        status: "En cours",
        due: from,
      });
    return needs.length;
  }
  export function receive(s: State, id: string, makeId: () => string): void {
    const r = live(s, "shopping").find((x) => x.id === id);
    if (!r || r.receivedAt)
      throw new Error("Course absente ou déjà réceptionnée.");
    const stock = live(s, "stock").find((x) => itemKey(x) === itemKey(r));
    if (stock) stock.quantity = n(stock, "quantity") + n(r, "quantity");
    else
      s.os.push({
        id: makeId(),
        kind: "stock",
        title: r.item,
        item: r.item,
        unit: r.unit,
        quantity: r.quantity,
        status: "En cours",
      });
    r.receivedAt = new Date().toISOString();
    r.status = "Terminé";
  }
  export function consume(s: State, id: string): void {
    const m = live(s, "menu").find((x) => x.id === id);
    if (!m || m.consumedAt) throw new Error("Menu absent ou déjà consommé.");
    const ingredients = live(s, "ingredient").filter(
      (i) => i.recipeId === m.recipeId,
    );
    if (!ingredients.length)
      throw new Error("Recette sans ingrédients structurés.");
    const needs = new Map<string, number>();
    for (const i of ingredients)
      needs.set(
        itemKey(i),
        (needs.get(itemKey(i)) || 0) + n(i, "quantity") * n(m, "portions"),
      );
    for (const [key, quantity] of needs)
      if (
        live(s, "stock")
          .filter((x) => itemKey(x) === key)
          .reduce((a, x) => a + n(x, "quantity"), 0) +
          1e-9 <
        quantity
      )
        throw new Error(
          "Stock insuffisant. Réceptionne les courses avant de consommer ce menu.",
        );
    for (const [key, quantity] of needs) {
      let remaining = quantity;
      for (const stock of live(s, "stock").filter((x) => itemKey(x) === key)) {
        const take = Math.min(remaining, n(stock, "quantity"));
        stock.quantity = n(stock, "quantity") - take;
        remaining -= take;
      }
    }
    m.consumedAt = new Date().toISOString();
    m.status = "Terminé";
  }
  export function convert(
    s: State,
    key: "assets" | "goals",
    id: string,
  ): Personal.Ref {
    const source = s[key].find((r) => r.id === id && !r.deleted);
    if (!source) throw new Error("Source introuvable.");
    const existing = s.os.find((r) => r.id === id);
    if (existing && existing.convertedFrom !== key)
      throw new Error("Identifiant déjà utilisé dans Life OS.");
    if (source.convertedTo)
      throw new Error("Cette fiche a déjà été convertie.");
    if (existing) {
      existing.personal = { ...Personal.meta(existing), archived: false };
    } else
      s.os.push({
        id,
        title: Personal.title(source),
        status: "En cours",
        convertedFrom: key,
        personal: { ...Personal.meta(source), archived: false },
        ...(source.assigneeId ? { assigneeId: source.assigneeId } : {}),
        ...(source.customFields
          ? { customFields: clone(source.customFields) }
          : {}),
        ...(key === "assets"
          ? {
              kind: "equipment",
              purchase: Number(source.value || 0),
              valuation: Number(source.value || 0),
              date: source.date || day(),
            }
          : {
              kind: "project",
              priority: "Normale",
              budget: 0,
              spent: 0,
              spendMode: "Manuel",
            }),
      });
    source.conversionArchivedBefore = !!Personal.meta(source).archived;
    source.personal = { ...Personal.meta(source), archived: true };
    source.convertedTo = id;
    return { key: "os", id };
  }
  export function reverse(s: State, key: "assets" | "goals", id: string): void {
    const source = s[key].find((r) => r.id === id),
      target = s.os.find((r) => r.id === id && r.convertedFrom === key);
    if (!source?.convertedTo || !target)
      throw new Error("Conversion introuvable.");
    source.personal = {
      ...Personal.meta(source),
      archived: !!source.conversionArchivedBefore,
    };
    delete source.convertedTo;
    target.personal = { ...Personal.meta(target), archived: true };
  }
  export function lifeScores(s: State, today = day()) {
    const since = OS.addDays(today, -29);
    return [
      "Travail",
      "Relations",
      "Santé",
      "Finances",
      "Loisirs",
      "Apprentissage",
      "Foyer",
      "Sens",
    ].map((area) => {
      const rows = live(s, "lifeRating").filter(
        (r) =>
          r.area === area && String(r.date) >= since && String(r.date) <= today,
      );
      return {
        area,
        count: rows.length,
        score: rows.length
          ? Math.round(
              (rows.reduce((a, r) => a + n(r, "score"), 0) / rows.length) * 10,
            )
          : null,
        explanation: rows.length
          ? `Moyenne de ${rows.length} auto-évaluation(s) sur 30 jours, multipliée par 10.`
          : "Données insuffisantes : aucune auto-évaluation sur 30 jours.",
      };
    });
  }
  export function monthlyReview(s: State, makeId: () => string): void {
    if (s.routines.some((r) => !r.deleted && r.templateKey === "monthly"))
      return;
    s.routines.push({
      id: makeId(),
      name: "Revue mensuelle",
      templateKey: "monthly",
      schedule: "Mensuel",
      monthDay: 1,
      time: "18:00",
      steps:
        "Comparer réel et prévisionnel\nRevoir les projets et décisions\nÉvaluer les huit domaines de vie\nRelire le journal\nChoisir les priorités du mois",
    });
  }
}
