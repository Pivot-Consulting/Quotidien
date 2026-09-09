/** Life OS: declarative typed models and pure domain calculations. */
namespace Q.OS {
  export type Field = {
    key: string;
    label: string;
    type: string;
    options?: string[];
    min?: number;
    max?: number;
    required?: boolean;
    ref?: string;
    default?: string | number;
  };
  export type Model = {
    id: string;
    label: string;
    fields: Field[];
    scheduled?: boolean;
  };
  export type Domain = {
    id: string;
    name: string;
    icon: string;
    description: string;
    models: Model[];
  };
  const text = (key: string, label: string, required = false): Field => ({
    key,
    label,
    type: "text",
    required,
  });
  const num = (key: string, label: string, min = 0, max?: number): Field => ({
    key,
    label,
    type: "number",
    min,
    max,
    required: true,
  });
  const date = (key: string, label: string): Field => ({
    key,
    label,
    type: "date",
    required: key === "date",
  });
  const choice = (key: string, label: string, options: string[]): Field => ({
    key,
    label,
    type: "select",
    options,
  });
  const ref = (
    key: string,
    label: string,
    model: string,
    required = true,
  ): Field => ({ key, label, type: "ref", ref: model, required });
  const notes = (key: string, label: string): Field => ({
    key,
    label,
    type: "textarea",
  });
  const url = (key: string, label: string): Field => ({
    key,
    label,
    type: "url",
  });
  const rating = (key: string, label: string): Field =>
    num(key, label + " (0–10)", 0, 10);
  const model = (
    id: string,
    label: string,
    fields: Field[],
    scheduled = false,
  ): Model => ({ id, label, fields, scheduled });
  export const domains: Domain[] = [
    {
      id: "finance",
      name: "Finances",
      icon: "€",
      description: "Comptes, budgets mensuels, abonnements et patrimoine net.",
      models: [
        model("account", "Comptes", [
          num("opening", "Solde initial (€)", -1e12),
          choice("accountType", "Type", ["Courant", "Épargne", "Espèces"]),
          text("bank", "Établissement"),
        ]),
        model("budget", "Budgets", [
          text("category", "Catégorie exacte des mouvements", true),
          { key: "month", label: "Mois", type: "month", required: true },
          num("limit", "Enveloppe (€)"),
        ]),
        model(
          "subscription",
          "Abonnements",
          [
            num("cost", "Montant par période (€)"),
            choice("period", "Périodicité", [
              "Mensuelle",
              "Annuelle",
              "Hebdomadaire",
            ]),
            ref("accountId", "Compte", "account", false),
            date("due", "Prochain paiement"),
            date("cancelBy", "Résilier avant"),
            url("url", "Gérer le service"),
          ],
          true,
        ),
        model("holding", "Patrimoine", [
          choice("assetType", "Nature", ["Actif", "Dette"]),
          num("valuation", "Valeur actuelle / capital restant (€)"),
          date("date", "Date de valorisation"),
          text("category", "Catégorie"),
        ]),
      ],
    },
    {
      id: "projects",
      name: "Projets de vie",
      icon: "◇",
      description: "Projets, jalons pondérés, budget et actions reliées.",
      models: [
        model("project", "Projets", [
          choice("priority", "Priorité", ["Normale", "Haute", "Basse"]),
          num("budget", "Budget prévu (€)"),
          num("spent", "Dépenses cumulées (€)"),
          date("due", "Échéance"),
          notes("outcome", "Résultat attendu"),
        ]),
        model(
          "milestone",
          "Jalons",
          [
            ref("projectId", "Projet", "project"),
            num("weight", "Poids dans la progression", 1),
            date("due", "Échéance"),
            notes("acceptance", "Critère de réussite"),
          ],
          true,
        ),
      ],
    },
    {
      id: "learning",
      name: "Apprentissage",
      icon: "↗",
      description: "Parcours, temps étudié et cartes de révision espacée.",
      models: [
        model("course", "Parcours", [
          text("skill", "Compétence"),
          num("targetHours", "Objectif (heures)", 0.1),
          num("progress", "Avancement (%)", 0, 100),
          date("due", "Échéance"),
          url("url", "Ressource"),
        ]),
        model("study", "Sessions", [
          ref("courseId", "Parcours", "course"),
          date("date", "Date"),
          num("minutes", "Durée (minutes)", 1),
          notes("takeaway", "Ce que je retiens"),
        ]),
        model(
          "flashcard",
          "Révisions",
          [
            ref("courseId", "Parcours", "course"),
            notes("answer", "Réponse"),
            date("due", "Prochaine révision"),
          ],
          true,
        ),
      ],
    },
    {
      id: "documents",
      name: "Documents",
      icon: "▤",
      description: "Références, versions, échéances et dossiers reliés.",
      models: [
        model(
          "document",
          "Documents",
          [
            text("category", "Catégorie"),
            text("location", "Emplacement du fichier"),
            url("url", "Lien vers le document"),
            text("revision", "Version"),
            date("due", "Expiration / renouvellement"),
            ref("projectId", "Projet associé", "project", false),
          ],
          true,
        ),
        model(
          "procedure",
          "Démarches",
          [
            ref("documentId", "Document", "document"),
            text("organization", "Organisme"),
            date("due", "Date limite"),
            notes("checklist", "Pièces et étapes à réunir"),
          ],
          true,
        ),
      ],
    },
    {
      id: "home",
      name: "Maison",
      icon: "⌂",
      description: "Inventaire valorisé, garanties et entretien récurrent.",
      models: [
        model("equipment", "Équipements", [
          text("room", "Pièce"),
          num("purchase", "Prix d’achat (€)"),
          num("valuation", "Valeur estimée (€)"),
          date("date", "Date d’achat"),
          date("warranty", "Fin de garantie"),
          text("serial", "Référence / série"),
          ref("documentId", "Facture", "document", false),
        ]),
        model(
          "maintenance",
          "Entretiens",
          [
            ref("equipmentId", "Équipement", "equipment"),
            date("due", "Prochaine intervention"),
            num("cost", "Coût (€)"),
            num("repeatDays", "Répéter tous les jours (0 = unique)"),
            text("provider", "Prestataire"),
          ],
          true,
        ),
      ],
    },
    {
      id: "nutrition",
      name: "Nutrition",
      icon: "◒",
      description: "Journal alimentaire, macros, eau et objectifs personnels.",
      models: [
        model("meal", "Repas", [
          date("date", "Date"),
          choice("mealType", "Repas", [
            "Petit-déjeuner",
            "Déjeuner",
            "Dîner",
            "Collation",
          ]),
          num("calories", "Énergie (kcal)"),
          num("protein", "Protéines (g)"),
          num("carbs", "Glucides (g)"),
          num("fat", "Lipides (g)"),
          num("water", "Eau (ml)"),
        ]),
        model("nutritionTarget", "Objectifs nutrition", [
          num("calories", "Énergie / jour (kcal)"),
          num("protein", "Protéines / jour (g)"),
          num("water", "Eau / jour (ml)"),
          date("date", "Applicable à partir du"),
        ]),
        model("recipe", "Recettes", [
          num("servings", "Portions", 1),
          num("minutes", "Préparation (minutes)"),
          notes("ingredients", "Ingrédients et quantités"),
          notes("instructions", "Préparation"),
          num("calories", "kcal par portion"),
        ]),
      ],
    },
    {
      id: "health",
      name: "Santé avancée",
      icon: "♡",
      description: "Observations, sommeil et rendez-vous, sans diagnostic.",
      models: [
        model("symptom", "Observations", [
          date("date", "Date"),
          rating("severity", "Intensité"),
          text("context", "Contexte / déclencheur"),
          notes("followup", "Points à discuter avec un professionnel"),
        ]),
        model("sleep", "Sommeil", [
          date("date", "Date du réveil"),
          num("hours", "Durée (heures)", 0, 24),
          rating("quality", "Qualité"),
          num("awakenings", "Réveils nocturnes"),
        ]),
        model(
          "appointment",
          "Rendez-vous",
          [
            date("due", "Date"),
            text("practitioner", "Praticien"),
            text("location", "Lieu"),
            notes("questions", "Questions à préparer"),
            ref("documentId", "Document associé", "document", false),
          ],
          true,
        ),
      ],
    },
    {
      id: "relations",
      name: "Relations",
      icon: "◎",
      description: "Contacts, échanges, anniversaires et relances.",
      models: [
        model("contact", "Contacts", [
          text("group", "Cercle / groupe"),
          text("email", "E-mail"),
          text("phone", "Téléphone"),
          date("birthday", "Date de naissance"),
          num("cadence", "Reprendre contact tous les jours", 1),
          date("date", "Dernier contact initial"),
        ]),
        model(
          "interaction",
          "Échanges",
          [
            ref("contactId", "Contact", "contact"),
            date("date", "Date"),
            choice("channel", "Canal", [
              "Rencontre",
              "Appel",
              "Message",
              "E-mail",
            ]),
            date("due", "Prochaine relance"),
            notes("takeaway", "À retenir"),
          ],
          true,
        ),
      ],
    },
    {
      id: "travel",
      name: "Voyages",
      icon: "↗",
      description: "Séjours, itinéraires datés, réservations et budget.",
      models: [
        model("trip", "Voyages", [
          text("destination", "Destination"),
          date("date", "Départ"),
          date("end", "Retour"),
          num("budget", "Budget (€)"),
          text("travelers", "Voyageurs"),
        ]),
        model("booking", "Réservations", [
          ref("tripId", "Voyage", "trip"),
          choice("category", "Type", [
            "Transport",
            "Hébergement",
            "Activité",
            "Restaurant",
            "Autre",
          ]),
          date("date", "Date"),
          { key: "time", label: "Heure", type: "time" },
          text("location", "Adresse"),
          text("reference", "Référence"),
          num("cost", "Coût (€)"),
          date("cancelBy", "Annulation avant"),
          url("url", "Lien de réservation"),
        ]),
        model(
          "packing",
          "Préparatifs",
          [
            ref("tripId", "Voyage", "trip"),
            text("category", "Catégorie"),
            date("due", "À préparer avant"),
          ],
          true,
        ),
      ],
    },
    {
      id: "career",
      name: "Carrière",
      icon: "▣",
      description: "Candidatures, relances, réalisations et compétences.",
      models: [
        model(
          "application",
          "Candidatures",
          [
            text("company", "Entreprise"),
            choice("stage", "Étape", [
              "À explorer",
              "Envoyée",
              "Entretien",
              "Offre",
              "Refus",
              "Acceptée",
            ]),
            num("salary", "Salaire annuel proposé (€)"),
            date("date", "Date de candidature"),
            date("due", "Prochaine relance"),
            url("url", "Offre"),
            text("contact", "Contact"),
          ],
          true,
        ),
        model("achievement", "Réalisations", [
          date("date", "Date"),
          notes("result", "Résultat mesurable"),
          text("skill", "Compétence"),
          url("url", "Preuve / portfolio"),
        ]),
        model("careerSkill", "Compétences", [
          rating("current", "Niveau actuel"),
          rating("desired", "Niveau souhaité"),
          ref("courseId", "Parcours de formation", "course", false),
          notes("evidence", "Preuve de maîtrise"),
        ]),
      ],
    },
    {
      id: "decisions",
      name: "Décisions",
      icon: "⇄",
      description: "Comparer les options selon tes critères pondérés.",
      models: [
        model("decision", "Décisions", [
          date("due", "Décider avant"),
          num("benefitWeight", "Poids bénéfice", 0),
          num("costWeight", "Poids coût faible", 0),
          num("riskWeight", "Poids risque faible", 0),
          notes("context", "Contexte et contraintes"),
        ]),
        model("option", "Options", [
          ref("decisionId", "Décision", "decision"),
          rating("benefit", "Bénéfice"),
          rating("affordability", "Coût faible : 10 = peu coûteux"),
          rating("safety", "Risque faible : 10 = peu risqué"),
          notes("evidence", "Arguments et hypothèses"),
        ]),
        model("decisionReview", "Bilans", [
          ref("decisionId", "Décision", "decision"),
          ref("optionId", "Option retenue", "option"),
          date("date", "Date de bilan"),
          notes("lesson", "Résultats et enseignements"),
        ]),
      ],
    },
    {
      id: "journal",
      name: "Journal",
      icon: "✎",
      description: "Écriture quotidienne, humeur et bilan hebdomadaire.",
      models: [
        model("journal", "Entrées", [
          date("date", "Date"),
          rating("mood", "Humeur"),
          rating("energy", "Énergie"),
          notes("gratitude", "Gratitude"),
          notes("wins", "Victoires"),
          notes("lesson", "Enseignement"),
          notes("tomorrow", "Intention pour demain"),
          text("tags", "Tags"),
        ]),
      ],
    },
    {
      id: "automation",
      name: "Automatisations",
      icon: "↻",
      description: "Prévisualiser des règles et créer les actions manquantes.",
      models: [
        model("rule", "Règles", [
          choice("source", "Source", [
            "Échéances OS",
            "Documents existants",
            "Tâches en retard",
          ]),
          num("horizon", "Échéances dans les prochains jours"),
          text("prefix", "Préfixe de la tâche"),
          choice("enabled", "Activation", ["Active", "Inactive"]),
        ]),
      ],
    },
    {
      id: "assistant",
      name: "Assistant",
      icon: "✦",
      description: "Plan du jour calculé, charge disponible et revue locale.",
      models: [
        model("planning", "Préférences du jour", [
          date("date", "Date"),
          num("capacity", "Temps disponible (minutes)", 1),
          choice("priority", "Prioriser", ["Échéances", "Importance"]),
          notes("intention", "Intention du jour"),
        ]),
        model(
          "brief",
          "Briefs",
          [
            text("topic", "Sujet"),
            notes("context", "Contexte"),
            notes("next", "Prochaine action"),
            date("due", "Échéance"),
          ],
          true,
        ),
      ],
    },
    {
      id: "digital",
      name: "Vie numérique",
      icon: "⌘",
      description: "Services, temps d’écran et revues de comptes.",
      models: [
        model(
          "service",
          "Services",
          [
            text("category", "Usage"),
            text("email", "Identifiant / e-mail (sans mot de passe)"),
            choice("mfa", "Double authentification", [
              "À vérifier",
              "Activée",
              "Non disponible",
              "Désactivée",
            ]),
            date("due", "Revoir les accès le"),
            ref("subscriptionId", "Abonnement associé", "subscription", false),
            url("url", "Gestion du compte"),
          ],
          true,
        ),
        model("screenTime", "Temps d’écran", [
          date("date", "Date"),
          text("category", "Application / catégorie"),
          num("minutes", "Durée (minutes)"),
          num("limit", "Limite personnelle (minutes)"),
        ]),
      ],
    },
    {
      id: "security",
      name: "Sécurité",
      icon: "◇",
      description: "Risques, protections et vérification des sauvegardes.",
      models: [
        model(
          "risk",
          "Risques",
          [
            num("likelihood", "Probabilité (1–5)", 1, 5),
            num("impact", "Impact (1–5)", 1, 5),
            text("owner", "Responsable"),
            notes("mitigation", "Mesure de réduction"),
            date("due", "Date de revue"),
          ],
          true,
        ),
        model(
          "backupCheck",
          "Sauvegardes",
          [
            text("location", "Emplacement (sans secret)"),
            date("date", "Dernière sauvegarde"),
            date("tested", "Dernier test de restauration"),
            date("due", "Prochaine vérification"),
            num("repeatDays", "Fréquence (jours)"),
          ],
          true,
        ),
      ],
    },
    {
      id: "impact",
      name: "Impact",
      icon: "❋",
      description: "Objectifs d’engagement et contributions mesurées.",
      models: [
        model("impactGoal", "Engagements", [
          num("targetValue", "Cible", 0.01),
          text("unit", "Unité (heures, €, kg…)", true),
          date("due", "Échéance"),
          text("organization", "Organisation"),
        ]),
        model("contribution", "Contributions", [
          ref("impactGoalId", "Engagement", "impactGoal"),
          date("date", "Date"),
          num("quantity", "Quantité (unité de l’engagement)"),
          notes("evidence", "Action réalisée / justificatif"),
        ]),
      ],
    },
    {
      id: "household",
      name: "Foyer",
      icon: "⌂",
      description: "Membres, tâches partagées et répartition des dépenses.",
      models: [
        model("member", "Membres", [text("role", "Rôle")]),
        model(
          "chore",
          "Tâches du foyer",
          [
            ref("memberId", "Responsable", "member"),
            date("due", "Échéance"),
            num("minutes", "Durée estimée (minutes)"),
            num("repeatDays", "Répéter tous les jours (0 = unique)"),
          ],
          true,
        ),
        model("sharedExpense", "Dépenses partagées", [
          ref("payerId", "Payé par", "member"),
          {
            key: "participants",
            label: "Répartir à parts égales entre",
            type: "refs",
            ref: "member",
            required: true,
          },
          num("cost", "Montant (€)"),
          date("date", "Date"),
        ]),
        model("settlement", "Remboursements", [
          ref("fromId", "Payé par", "member"),
          ref("toId", "Reçu par", "member"),
          num("cost", "Montant remboursé (€)", 0.01),
          date("date", "Date"),
        ]),
      ],
    },
    {
      id: "progress",
      name: "Progression",
      icon: "▥",
      description:
        "Indicateurs, mesures historiques et objectifs croissants ou décroissants.",
      models: [
        model("indicator", "Indicateurs", [
          text("unit", "Unité"),
          num("baseline", "Valeur initiale", -1e12),
          num("targetValue", "Cible", -1e12),
          date("due", "Échéance"),
        ]),
        model("measurement", "Mesures", [
          ref("indicatorId", "Indicateur", "indicator"),
          date("date", "Date"),
          num("reading", "Valeur", -1e12),
        ]),
      ],
    },
    {
      id: "balance",
      name: "Équilibre",
      icon: "☯",
      description: "Bilan des domaines de vie, charge et récupération.",
      models: [
        model("lifeRating", "Satisfaction", [
          choice("area", "Domaine", [
            "Travail",
            "Relations",
            "Santé",
            "Finances",
            "Loisirs",
            "Apprentissage",
            "Foyer",
            "Sens",
          ]),
          rating("score", "Satisfaction"),
          date("date", "Date"),
          notes("next", "Petit changement à essayer"),
        ]),
        model("energyDay", "Charge quotidienne", [
          date("date", "Date"),
          num("capacity", "Disponibilité (minutes)"),
          num("obligations", "Engagements (minutes)"),
          num("recovery", "Récupération prévue (minutes)"),
          rating("energy", "Énergie ressentie"),
        ]),
      ],
    },
  ];
  export const models = domains.flatMap((d) => d.models);
  export const getModel = (kind: unknown): Model | undefined =>
    models.find((m) => m.id === kind);
  export const domainFor = (kind: unknown): Domain | undefined =>
    domains.find((d) => d.models.some((m) => m.id === kind));
  export const rows = (state: State, kind: string): RecordData[] =>
    state.os.filter((r) => !r.deleted && r.kind === kind);
  export const n = (r: RecordData, key: string): number => Number(r[key] || 0);
  export const sum = (rs: RecordData[], key: string): number =>
    rs.reduce((v, r) => v + n(r, key), 0);
  export const done = (r: RecordData): boolean => r.status === "Terminé";
  export const clamp = (v: number): number => Math.max(0, Math.min(100, v));
  export function addDays(value: string, count: number): string {
    const d = new Date(value + "T12:00:00");
    d.setDate(d.getDate() + count);
    return day(d);
  }
  export function daysBetween(a: string, b: string): number {
    return Math.round(
      (Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000,
    );
  }
  export function validate(record: RecordData): void {
    const m = getModel(record.kind);
    if (!m)
      throw new Error("Type Life OS inconnu. Utilise une version compatible.");
    if (typeof record.title !== "string" || !record.title.trim())
      throw new Error("Un titre est requis.");
    if (
      !["Idée", "En cours", "En attente", "Terminé"].includes(
        String(record.status),
      )
    )
      throw new Error("Statut OS invalide.");
    for (const f of m.fields) {
      const v = record[f.key];
      if (v === undefined || v === "") {
        if (f.required) throw new Error(f.label + " : champ requis.");
        continue;
      }
      if (f.type === "refs") {
        if (
          !Array.isArray(v) ||
          !v.length ||
          v.some((x) => typeof x !== "string") ||
          new Set(v).size !== v.length
        )
          throw new Error(f.label + " : sélection invalide.");
        continue;
      }
      if (f.type === "number") {
        if (
          !["number", "string"].includes(typeof v) ||
          !Number.isFinite(Number(v)) ||
          (f.min !== undefined && Number(v) < f.min) ||
          (f.max !== undefined && Number(v) > f.max)
        )
          throw new Error(f.label + " : nombre hors limites.");
        record[f.key] = Number(v);
      } else {
        if (typeof v !== "string")
          throw new Error(f.label + " : texte attendu.");
        if (f.type === "date" && !validDate(v))
          throw new Error(f.label + " : date invalide.");
        if (f.type === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v))
          throw new Error("Mois invalide.");
        if (f.options && !f.options.includes(v))
          throw new Error(f.label + " : choix invalide.");
        if (f.type === "url" && !safeURL(v))
          throw new Error("Lien HTTP ou HTTPS attendu.");
      }
    }
    if (
      record.kind === "trip" &&
      record.date &&
      record.end &&
      String(record.end) < String(record.date)
    )
      throw new Error("Le retour doit suivre le départ.");
    if (
      record.kind === "decision" &&
      n(record, "benefitWeight") +
        n(record, "costWeight") +
        n(record, "riskWeight") <=
        0
    )
      throw new Error("Renseigne au moins un poids supérieur à zéro.");
    if (record.kind === "settlement" && record.fromId === record.toId)
      throw new Error("Choisis deux membres différents pour un remboursement.");
    for (const key of ["repeatDays", "cadence", "horizon"])
      if (
        record[key] !== undefined &&
        record[key] !== "" &&
        !Number.isInteger(Number(record[key]))
      )
        throw new Error("Un nombre entier de jours est requis.");
  }
  export function validateLinks(state: State): void {
    const byId = new Map(state.os.map((r) => [r.id, r]));
    for (const record of state.os) {
      const model = getModel(record.kind);
      for (const f of model?.fields || []) {
        if (f.type !== "ref" && f.type !== "refs") continue;
        const ids =
          f.type === "refs" ? (record[f.key] as string[]) : [record[f.key]];
        for (const id of ids || [])
          if (id && byId.get(String(id))?.kind !== f.ref)
            throw new Error(
              f.label + " : référence manquante ou incompatible.",
            );
      }
      if (
        record.kind === "decisionReview" &&
        byId.get(String(record.optionId))?.decisionId !== record.decisionId
      )
        throw new Error("L’option retenue ne correspond pas à cette décision.");
    }
  }
  export function completeRecord(r: RecordData, today = day()): RecordData {
    if (r.kind === "subscription") {
      const base = validDate(String(r.due)) ? String(r.due) : today;
      let due: string;
      if (r.period === "Hebdomadaire") due = addDays(base, 7);
      else {
        const d = new Date(base + "T12:00:00");
        const wanted = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + (r.period === "Annuelle" ? 12 : 1));
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(wanted, last));
        due = day(d);
      }
      return { ...r, due, lastCompleted: today };
    }
    if (done(r)) return { ...r, status: "En cours" };
    if (n(r, "repeatDays") > 0)
      return {
        ...r,
        status: "En cours",
        lastCompleted: today,
        completedCount: n(r, "completedCount") + 1,
        due: addDays(
          r.due && String(r.due) > today ? String(r.due) : today,
          n(r, "repeatDays"),
        ),
      };
    return { ...r, status: "Terminé", lastCompleted: today };
  }
  export function safeURL(value: unknown): string {
    try {
      const u = new URL(String(value));
      return ["https:", "http:"].includes(u.protocol) ? u.href : "";
    } catch {
      return "";
    }
  }
  export function annual(r: RecordData): number {
    return (
      n(r, "cost") *
      (r.period === "Annuelle" ? 1 : r.period === "Hebdomadaire" ? 52 : 12)
    );
  }
  export function projectProgress(state: State, id: string): number {
    const rs = rows(state, "milestone").filter((r) => r.projectId === id);
    const total = sum(rs, "weight");
    return total ? (sum(rs.filter(done), "weight") / total) * 100 : 0;
  }
  export function decisionScores(
    state: State,
    id: string,
  ): { record: RecordData; score: number }[] {
    const d = rows(state, "decision").find((r) => r.id === id);
    if (!d) return [];
    const total =
      n(d, "benefitWeight") + n(d, "costWeight") + n(d, "riskWeight");
    return rows(state, "option")
      .filter((r) => r.decisionId === id)
      .map((record) => ({
        record,
        score: total
          ? (n(record, "benefit") * n(d, "benefitWeight") +
              n(record, "affordability") * n(d, "costWeight") +
              n(record, "safety") * n(d, "riskWeight")) /
            total
          : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }
  export function indicatorProgress(
    state: State,
    r: RecordData,
  ): { value: number; progress: number; history: RecordData[] } {
    const history = rows(state, "measurement")
      .filter((x) => x.indicatorId === r.id)
      .sort(
        (a, b) =>
          String(a.date).localeCompare(String(b.date)) ||
          String(a.createdAt).localeCompare(String(b.createdAt)),
      );
    const latest = history[history.length - 1];
    const value = latest ? n(latest, "reading") : n(r, "baseline");
    const delta = n(r, "targetValue") - n(r, "baseline");
    return {
      value,
      progress: delta
        ? clamp(((value - n(r, "baseline")) / delta) * 100)
        : value === n(r, "targetValue")
          ? 100
          : 0,
      history,
    };
  }
  export function balances(
    state: State,
  ): { id: string; title: string; cents: number }[] {
    const map = new Map<string, number>();
    for (const r of rows(state, "member")) map.set(r.id, 0);
    for (const r of rows(state, "sharedExpense")) {
      const people = Array.isArray(r.participants)
        ? (r.participants as string[])
        : [];
      if (!people.length) continue;
      const cents = Math.round(n(r, "cost") * 100),
        share = Math.floor(cents / people.length),
        rest = cents - share * people.length;
      map.set(String(r.payerId), (map.get(String(r.payerId)) || 0) + cents);
      people.forEach((id, i) =>
        map.set(id, (map.get(id) || 0) - share - (i < rest ? 1 : 0)),
      );
    }
    for (const r of rows(state, "settlement")) {
      const cents = Math.round(n(r, "cost") * 100);
      map.set(String(r.fromId), (map.get(String(r.fromId)) || 0) + cents);
      map.set(String(r.toId), (map.get(String(r.toId)) || 0) - cents);
    }
    return Array.from(map, ([id, cents]) => ({
      id,
      title: String(
        state.os.find((r) => r.id === id)?.title || "Membre retiré",
      ),
      cents,
    }));
  }
  export function settlements(
    state: State,
  ): { from: string; to: string; cents: number }[] {
    const b = balances(state),
      debt = b.filter((r) => r.cents < 0).map((r) => ({ ...r })),
      credit = b.filter((r) => r.cents > 0).map((r) => ({ ...r })),
      transfers = [];
    for (const d of debt)
      for (const c of credit) {
        const cents = Math.min(-d.cents, c.cents);
        if (cents > 0) {
          transfers.push({ from: d.title, to: c.title, cents });
          d.cents += cents;
          c.cents -= cents;
        }
      }
    return transfers;
  }
  export function reviewCard(
    r: RecordData,
    quality: string,
    today = day(),
  ): RecordData {
    const streak = quality === "again" ? 0 : n(r, "reviewStreak") + 1;
    const interval =
      quality === "again"
        ? 1
        : quality === "hard"
          ? Math.max(1, Math.round(n(r, "interval") * 1.2))
          : Math.min(
              365,
              streak === 1 ? 3 : Math.max(3, Math.round(n(r, "interval") * 2)),
            );
    return {
      ...r,
      reviewStreak: streak,
      interval,
      due: addDays(today, interval),
      lastReviewed: today,
    };
  }
  export type Proposal = {
    token: string;
    title: string;
    due: string;
    sourceId: string;
    sourceKey: string;
    ruleId: string;
  };
  export function proposals(state: State, today = day()): Proposal[] {
    const result: Proposal[] = [];
    const used = new Set(
      state.tasks.map((t) => String(t.automationToken || "")),
    );
    for (const rule of rows(state, "rule").filter(
      (r) => Personal.visible(r) && r.enabled === "Active" && !done(r),
    )) {
      const key =
        rule.source === "Documents existants"
          ? "documents"
          : rule.source === "Tâches en retard"
            ? "tasks"
            : "os";
      const records = state[key].filter(
        (r) =>
          Personal.visible(r) &&
          !r.done &&
          !done(r) &&
          r.id !== rule.id &&
          (key !== "os" || getModel(r.kind)?.scheduled),
      );
      for (const r of records) {
        const due = String(r.due || (key === "documents" ? r.date : "") || "");
        if (
          !validDate(due) ||
          due > addDays(today, n(rule, "horizon")) ||
          (key === "tasks" && due >= today)
        )
          continue;
        const token = rule.id + ":" + key + ":" + r.id + ":" + due;
        if (used.has(token)) continue;
        used.add(token);
        result.push({
          token,
          title:
            String(rule.prefix || "À traiter") +
            " · " +
            String(r.title || r.name || "Échéance"),
          due,
          sourceId: r.id,
          sourceKey: key,
          ruleId: rule.id,
        });
      }
    }
    return result;
  }
  export function dayPlan(
    state: State,
    today = day(),
  ): {
    tasks: RecordData[];
    used: number;
    capacity: number;
    remaining: number;
  } {
    const pref = rows(state, "planning").find((r) => r.date === today);
    const capacity = pref ? n(pref, "capacity") : 120;
    const pool = state.tasks.filter(
      (r) =>
        Personal.visible(r) &&
        !r.done &&
        !Personal.blockers(state, { key: "tasks", id: r.id }).length &&
        (!r.due || String(r.due) <= today),
    );
    pool.sort((a, b) =>
      pref?.priority === "Importance"
        ? Number(!!b.important) - Number(!!a.important) ||
          String(a.due || "9999").localeCompare(String(b.due || "9999"))
        : String(a.due || "9999").localeCompare(String(b.due || "9999")) ||
          Number(!!b.important) - Number(!!a.important),
    );
    let used = 0;
    const tasks = [];
    for (const r of pool) {
      const duration = n(r, "estimate") || 25;
      if (used + duration <= capacity) {
        tasks.push(r);
        used += duration;
      }
    }
    return { tasks, used, capacity, remaining: pool.length - tasks.length };
  }
  export function csv(headers: string[], rs: unknown[][]): string {
    const cell = (v: unknown) =>
      '"' +
      String(v ?? "")
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replace(/"/g, '""') +
      '"';
    return (
      "\ufeff" + [headers, ...rs].map((r) => r.map(cell).join(";")).join("\r\n")
    );
  }
  export function parseCSV(
    raw: string,
  ): { label: string; amount: number; category: string; date: string }[] {
    const text = raw.replace(/^\ufeff/, "");
    const separator = text.split(/\r?\n/)[0]?.includes(";") ? ";" : ",";
    const rows: string[][] = [];
    let row: string[] = [],
      cell = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = !quoted;
      } else if (c === separator && !quoted) {
        row.push(cell);
        cell = "";
      } else if ((c === "\n" || c === "\r") && !quoted) {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
        cell = "";
      } else cell += c;
    }
    if (quoted) throw new Error("CSV : guillemet non fermé.");
    row.push(cell);
    if (row.some((x) => x.trim())) rows.push(row);
    const headers = rows.shift()?.map((x) => x.trim().toLowerCase()) || [];
    const names = ["date", "libelle", "montant", "categorie"];
    if (!names.every((x) => headers.includes(x)))
      throw new Error("Colonnes attendues : date;libelle;montant;categorie");
    return rows.map((r, i) => {
      const get = (key: string) => r[headers.indexOf(key)]?.trim() || "";
      const date = get("date"),
        label = get("libelle"),
        s = get("montant").replace(",", ".");
      const amount = Number(s);
      if (!validDate(date) || !label || !s || !Number.isFinite(amount))
        throw new Error(
          "Ligne " + (i + 2) + " : date ISO, libellé et montant requis.",
        );
      return { date, label, amount, category: get("categorie") };
    });
  }
}
