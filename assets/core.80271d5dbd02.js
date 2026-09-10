"use strict";
/** Pure domain rules and synchronous, fail-closed local persistence. */
var Q;
(function (Q) {
    Q.KEY = "quotidien-rebuild-2";
    Q.BACKUP_KEY = Q.KEY + "-previous";
    Q.CHECKPOINT_KEY = Q.KEY + "-before-restore";
    Q.RELEASE = "2.7.0";
    Q.collections = [
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
    ];
    Q.screens = [
        "today",
        "plan",
        "notes",
        "tracking",
        "life",
        "wave",
        "explore",
        "intelligence",
    ];
    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
    Q.clone = clone;
    function empty() {
        return Object.assign({ version: 2, screen: "today", settings: { theme: "dark", focus: 25 } }, Object.fromEntries(Q.collections.map((key) => [key, []])));
    }
    Q.empty = empty;
    function day(date = new Date()) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    Q.day = day;
    function object(x) {
        return x !== null && typeof x === "object" && !Array.isArray(x);
    }
    function guard(value) {
        if (!value || typeof value !== "object")
            return;
        for (const key of Object.keys(value)) {
            if (["__proto__", "prototype", "constructor"].includes(key))
                throw new Error("Champ de sauvegarde interdit.");
            guard(value[key]);
        }
    }
    function validDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
            return false;
        const date = new Date(value + "T12:00:00");
        return Number.isFinite(date.getTime()) && day(date) === value;
    }
    Q.validDate = validDate;
    function normalize(input) {
        guard(input);
        if (!object(input) ||
            input.version !== 2 ||
            !Q.collections.some((key) => Array.isArray(input[key])))
            throw new Error("Sauvegarde Quotidien 2.x attendue. Les formats V5/V6/V7 nécessitent une migration dédiée.");
        const next = Object.assign(empty(), clone(input));
        for (const key of Q.collections) {
            const value = input[key];
            if (value === undefined) {
                next[key] = [];
                continue;
            }
            if (!Array.isArray(value))
                throw new Error(`La collection ${key} est invalide.`);
            const ids = new Set();
            next[key] = value.map((item) => {
                if (!object(item) ||
                    typeof item.id !== "string" ||
                    !item.id.trim() ||
                    ids.has(item.id))
                    throw new Error(`Identifiant manquant ou dupliqué dans ${key}.`);
                ids.add(item.id);
                const record = clone(item);
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
                    if (record[field] == null)
                        continue;
                    if (typeof record[field] !== "string")
                        throw new Error(`Champ ${key}.${field} invalide.`);
                }
                for (const field of ["date", "due"]) {
                    if (record[field] == null || record[field] === "")
                        continue;
                    if (typeof record[field] !== "string" || !validDate(record[field]))
                        throw new Error(`Date invalide dans ${key}.`);
                }
                if (record.time &&
                    (typeof record.time !== "string" ||
                        !/^([01]\d|2[0-3]):[0-5]\d$/.test(record.time)))
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
                    if (record[field] == null || record[field] === "")
                        continue;
                    if (!["string", "number"].includes(typeof record[field]) ||
                        !Number.isFinite(Number(record[field])))
                        throw new Error(`Nombre invalide dans ${key}.${field}.`);
                    record[field] = Number(record[field]);
                }
                for (const field of ["done", "deleted", "important", "urgent"]) {
                    if (record[field] !== undefined && typeof record[field] !== "boolean")
                        throw new Error(`Champ ${key}.${field} invalide.`);
                }
                if (record.progress !== undefined &&
                    (Number(record.progress) < 0 || Number(record.progress) > 100))
                    throw new Error("Progression attendue entre 0 et 100.");
                if (record.estimate !== undefined && Number(record.estimate) <= 0)
                    throw new Error("Durée estimée positive attendue.");
                if (record.minutes !== undefined && Number(record.minutes) < 0)
                    throw new Error("Durée négative.");
                if (record.target !== undefined && Number(record.target) <= 0)
                    throw new Error("Objectif strictement positif attendu.");
                if (record.effort !== undefined &&
                    (Number(record.effort) < 1 || Number(record.effort) > 10))
                    throw new Error("Effort attendu entre 1 et 10.");
                if (key === "habits" && record.days !== undefined) {
                    if (!object(record.days) ||
                        Object.entries(record.days).some(([date, value]) => !validDate(date) || typeof value !== "boolean"))
                        throw new Error("Historique d’habitude invalide.");
                }
                Q.Personal.validateMeta(record);
                if (key === "os")
                    Q.OS.validate(record);
                return record;
            });
        }
        if (input.settings !== undefined && !object(input.settings))
            throw new Error("Réglages invalides.");
        next.settings = Object.assign(empty().settings, input.settings || {});
        if (!["light", "dark"].includes(next.settings.theme))
            next.settings.theme = "dark";
        next.screen = Q.screens.includes(next.screen) ? next.screen : "today";
        Q.OS.validateLinks(next);
        Q.Personal.validate(next);
        Q.Intelligence.validate(next);
        Q.Connected.validate(next);
        Q.Focus.validate(next);
        return next;
    }
    Q.normalize = normalize;
    function parseBackup(raw) {
        const data = JSON.parse(raw);
        if (object(data) && data.app === "quotidien" && data.format === 1)
            return normalize(data.state);
        return normalize(data);
    }
    Q.parseBackup = parseBackup;
    function backup(state) {
        return JSON.stringify({
            app: "quotidien",
            format: 1,
            exportedAt: new Date().toISOString(),
            release: Q.RELEASE,
            state: normalize(state),
        }, null, 2);
    }
    Q.backup = backup;
    function summary(state) {
        return Q.collections.map((key) => `${key}: ${state[key].length}`).join(" · ");
    }
    Q.summary = summary;
    class Repository {
        constructor(storage) {
            this.storage = storage;
        }
        load() {
            const raw = this.storage.getItem(Q.KEY);
            const next = raw === null ? empty() : normalize(JSON.parse(raw));
            this.expected = raw;
            return next;
        }
        commit(state, checkpoint = false) {
            const next = normalize(state);
            const raw = this.storage.getItem(Q.KEY);
            if (this.expected === undefined)
                throw new Error("Les données existantes doivent être récupérées avant toute modification.");
            if (raw !== this.expected)
                throw new Error("Les données ont changé dans un autre onglet. Exporte ton brouillon puis recharge avant de réessayer.");
            // Both writes are synchronous. A failed backup aborts before changing the primary key.
            // setItem is atomic: quota errors leave the previous primary value intact.
            if (checkpoint)
                this.storage.setItem(Q.CHECKPOINT_KEY, JSON.stringify(this.load()));
            if (raw !== null)
                this.storage.setItem(Q.BACKUP_KEY, raw);
            if (!checkpoint)
                Q.Personal.stamp(raw === null ? empty() : normalize(JSON.parse(raw)), next);
            const serialized = JSON.stringify(next);
            this.storage.setItem(Q.KEY, serialized);
            this.expected = serialized;
            return next;
        }
    }
    Q.Repository = Repository;
    function matches(state, query) {
        return Q.Personal.search(state, { query }).map((hit) => ({
            key: hit.key,
            record: hit.record,
        }));
    }
    Q.matches = matches;
    function focusMinutes(state) {
        return state.health
            .filter((x) => !x.deleted && String(x.kind).toLowerCase() === "focus")
            .reduce((sum, x) => sum + Number(x.value || 0), 0);
    }
    Q.focusMinutes = focusMinutes;
})(Q || (Q = {}));

"use strict";
/** Life OS: declarative typed models and pure domain calculations. */
var Q;
(function (Q) {
    var OS;
    (function (OS) {
        const text = (key, label, required = false) => ({
            key,
            label,
            type: "text",
            required,
        });
        const num = (key, label, min = 0, max) => ({
            key,
            label,
            type: "number",
            min,
            max,
            required: true,
        });
        const date = (key, label) => ({
            key,
            label,
            type: "date",
            required: key === "date",
        });
        const choice = (key, label, options) => ({
            key,
            label,
            type: "select",
            options,
        });
        const ref = (key, label, model, required = true) => ({ key, label, type: "ref", ref: model, required });
        const notes = (key, label) => ({
            key,
            label,
            type: "textarea",
        });
        const url = (key, label) => ({
            key,
            label,
            type: "url",
        });
        const rating = (key, label) => num(key, label + " (0–10)", 0, 10);
        const model = (id, label, fields, scheduled = false) => ({ id, label, fields, scheduled });
        OS.domains = [
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
                    model("subscription", "Abonnements", [
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
                    ], true),
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
                        choice("spendMode", "Source des dépenses", [
                            "Manuel",
                            "Transactions",
                        ]),
                        date("due", "Échéance"),
                        notes("outcome", "Résultat attendu"),
                    ]),
                    model("milestone", "Jalons", [
                        ref("projectId", "Projet", "project"),
                        num("weight", "Poids dans la progression", 1),
                        date("due", "Échéance"),
                        notes("acceptance", "Critère de réussite"),
                    ], true),
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
                    model("flashcard", "Révisions", [
                        ref("courseId", "Parcours", "course"),
                        notes("answer", "Réponse"),
                        date("due", "Prochaine révision"),
                    ], true),
                ],
            },
            {
                id: "documents",
                name: "Documents",
                icon: "▤",
                description: "Références, versions, échéances et dossiers reliés.",
                models: [
                    model("document", "Documents", [
                        text("category", "Catégorie"),
                        text("location", "Emplacement du fichier"),
                        url("url", "Lien vers le document"),
                        text("revision", "Version"),
                        date("due", "Expiration / renouvellement"),
                        ref("projectId", "Projet associé", "project", false),
                    ], true),
                    model("procedure", "Démarches", [
                        ref("documentId", "Document", "document"),
                        text("organization", "Organisme"),
                        date("due", "Date limite"),
                        notes("checklist", "Pièces et étapes à réunir"),
                    ], true),
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
                    model("maintenance", "Entretiens", [
                        ref("equipmentId", "Équipement", "equipment"),
                        date("due", "Prochaine intervention"),
                        num("cost", "Coût (€)"),
                        num("repeatDays", "Répéter tous les jours (0 = unique)"),
                        text("provider", "Prestataire"),
                    ], true),
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
                    model("appointment", "Rendez-vous", [
                        date("due", "Date"),
                        text("practitioner", "Praticien"),
                        text("location", "Lieu"),
                        notes("questions", "Questions à préparer"),
                        ref("documentId", "Document associé", "document", false),
                    ], true),
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
                    model("interaction", "Échanges", [
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
                    ], true),
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
                    model("packing", "Préparatifs", [
                        ref("tripId", "Voyage", "trip"),
                        text("category", "Catégorie"),
                        date("due", "À préparer avant"),
                    ], true),
                ],
            },
            {
                id: "career",
                name: "Carrière",
                icon: "▣",
                description: "Candidatures, relances, réalisations et compétences.",
                models: [
                    model("application", "Candidatures", [
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
                    ], true),
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
                    model("brief", "Briefs", [
                        text("topic", "Sujet"),
                        notes("context", "Contexte"),
                        notes("next", "Prochaine action"),
                        date("due", "Échéance"),
                    ], true),
                ],
            },
            {
                id: "digital",
                name: "Vie numérique",
                icon: "⌘",
                description: "Services, temps d’écran et revues de comptes.",
                models: [
                    model("service", "Services", [
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
                    ], true),
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
                    model("risk", "Risques", [
                        num("likelihood", "Probabilité (1–5)", 1, 5),
                        num("impact", "Impact (1–5)", 1, 5),
                        text("owner", "Responsable"),
                        notes("mitigation", "Mesure de réduction"),
                        date("due", "Date de revue"),
                    ], true),
                    model("backupCheck", "Sauvegardes", [
                        text("location", "Emplacement (sans secret)"),
                        date("date", "Dernière sauvegarde"),
                        date("tested", "Dernier test de restauration"),
                        date("due", "Prochaine vérification"),
                        num("repeatDays", "Fréquence (jours)"),
                    ], true),
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
                    model("chore", "Tâches du foyer", [
                        ref("memberId", "Responsable", "member"),
                        date("due", "Échéance"),
                        num("minutes", "Durée estimée (minutes)"),
                        num("repeatDays", "Répéter tous les jours (0 = unique)"),
                    ], true),
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
                description: "Indicateurs, mesures historiques et objectifs croissants ou décroissants.",
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
        OS.models = OS.domains.flatMap((d) => d.models);
        OS.getModel = (kind) => OS.models.find((m) => m.id === kind);
        OS.domainFor = (kind) => OS.domains.find((d) => d.models.some((m) => m.id === kind));
        OS.rows = (state, kind) => state.os.filter((r) => !r.deleted && r.kind === kind);
        OS.n = (r, key) => Number(r[key] || 0);
        OS.sum = (rs, key) => rs.reduce((v, r) => v + OS.n(r, key), 0);
        OS.done = (r) => r.status === "Terminé";
        OS.clamp = (v) => Math.max(0, Math.min(100, v));
        function addDays(value, count) {
            const d = new Date(value + "T12:00:00");
            d.setDate(d.getDate() + count);
            return Q.day(d);
        }
        OS.addDays = addDays;
        function daysBetween(a, b) {
            return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
        }
        OS.daysBetween = daysBetween;
        function validate(record) {
            const m = OS.getModel(record.kind);
            if (!m)
                throw new Error("Type Life OS inconnu. Utilise une version compatible.");
            if (typeof record.title !== "string" || !record.title.trim())
                throw new Error("Un titre est requis.");
            if (!["Idée", "En cours", "En attente", "Terminé"].includes(String(record.status)))
                throw new Error("Statut OS invalide.");
            for (const f of m.fields) {
                const v = record[f.key];
                if (v === undefined || v === "") {
                    if (f.required)
                        throw new Error(f.label + " : champ requis.");
                    continue;
                }
                if (f.type === "refs") {
                    if (!Array.isArray(v) ||
                        !v.length ||
                        v.some((x) => typeof x !== "string") ||
                        new Set(v).size !== v.length)
                        throw new Error(f.label + " : sélection invalide.");
                    continue;
                }
                if (f.type === "number") {
                    if (!["number", "string"].includes(typeof v) ||
                        !Number.isFinite(Number(v)) ||
                        (f.min !== undefined && Number(v) < f.min) ||
                        (f.max !== undefined && Number(v) > f.max))
                        throw new Error(f.label + " : nombre hors limites.");
                    record[f.key] = Number(v);
                }
                else {
                    if (typeof v !== "string")
                        throw new Error(f.label + " : texte attendu.");
                    if (f.type === "date" && !Q.validDate(v))
                        throw new Error(f.label + " : date invalide.");
                    if (f.type === "month" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(v))
                        throw new Error("Mois invalide.");
                    if (f.options && !f.options.includes(v))
                        throw new Error(f.label + " : choix invalide.");
                    if (f.type === "url" && !safeURL(v))
                        throw new Error("Lien HTTP ou HTTPS attendu.");
                }
            }
            if (record.kind === "trip" &&
                record.date &&
                record.end &&
                String(record.end) < String(record.date))
                throw new Error("Le retour doit suivre le départ.");
            if (record.kind === "decision" &&
                OS.n(record, "benefitWeight") +
                    OS.n(record, "costWeight") +
                    OS.n(record, "riskWeight") <=
                    0)
                throw new Error("Renseigne au moins un poids supérieur à zéro.");
            if (record.kind === "settlement" && record.fromId === record.toId)
                throw new Error("Choisis deux membres différents pour un remboursement.");
            for (const key of ["repeatDays", "cadence", "horizon"])
                if (record[key] !== undefined &&
                    record[key] !== "" &&
                    !Number.isInteger(Number(record[key])))
                    throw new Error("Un nombre entier de jours est requis.");
        }
        OS.validate = validate;
        function validateLinks(state) {
            const byId = new Map(state.os.map((r) => [r.id, r]));
            for (const record of state.os) {
                const model = OS.getModel(record.kind);
                for (const f of model?.fields || []) {
                    if (f.type !== "ref" && f.type !== "refs")
                        continue;
                    const ids = f.type === "refs" ? record[f.key] : [record[f.key]];
                    for (const id of ids || [])
                        if (id && byId.get(String(id))?.kind !== f.ref)
                            throw new Error(f.label + " : référence manquante ou incompatible.");
                }
                if (record.kind === "decisionReview" &&
                    byId.get(String(record.optionId))?.decisionId !== record.decisionId)
                    throw new Error("L’option retenue ne correspond pas à cette décision.");
            }
        }
        OS.validateLinks = validateLinks;
        function completeRecord(r, today = Q.day()) {
            if (r.kind === "subscription") {
                const base = Q.validDate(String(r.due)) ? String(r.due) : today;
                let due;
                if (r.period === "Hebdomadaire")
                    due = addDays(base, 7);
                else {
                    const d = new Date(base + "T12:00:00");
                    const wanted = d.getDate();
                    d.setDate(1);
                    d.setMonth(d.getMonth() + (r.period === "Annuelle" ? 12 : 1));
                    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
                    d.setDate(Math.min(wanted, last));
                    due = Q.day(d);
                }
                return { ...r, due, lastCompleted: today };
            }
            if (OS.done(r))
                return { ...r, status: "En cours" };
            if (OS.n(r, "repeatDays") > 0)
                return {
                    ...r,
                    status: "En cours",
                    lastCompleted: today,
                    completedCount: OS.n(r, "completedCount") + 1,
                    due: addDays(r.due && String(r.due) > today ? String(r.due) : today, OS.n(r, "repeatDays")),
                };
            return { ...r, status: "Terminé", lastCompleted: today };
        }
        OS.completeRecord = completeRecord;
        function safeURL(value) {
            try {
                const u = new URL(String(value));
                return ["https:", "http:"].includes(u.protocol) ? u.href : "";
            }
            catch {
                return "";
            }
        }
        OS.safeURL = safeURL;
        function annual(r) {
            return (OS.n(r, "cost") *
                (r.period === "Annuelle" ? 1 : r.period === "Hebdomadaire" ? 52 : 12));
        }
        OS.annual = annual;
        function projectProgress(state, id) {
            const rs = OS.rows(state, "milestone").filter((r) => r.projectId === id);
            const total = OS.sum(rs, "weight");
            return total ? (OS.sum(rs.filter(OS.done), "weight") / total) * 100 : 0;
        }
        OS.projectProgress = projectProgress;
        function decisionScores(state, id) {
            const d = OS.rows(state, "decision").find((r) => r.id === id);
            if (!d)
                return [];
            const total = OS.n(d, "benefitWeight") + OS.n(d, "costWeight") + OS.n(d, "riskWeight");
            return OS.rows(state, "option")
                .filter((r) => r.decisionId === id)
                .map((record) => ({
                record,
                score: total
                    ? (OS.n(record, "benefit") * OS.n(d, "benefitWeight") +
                        OS.n(record, "affordability") * OS.n(d, "costWeight") +
                        OS.n(record, "safety") * OS.n(d, "riskWeight")) /
                        total
                    : 0,
            }))
                .sort((a, b) => b.score - a.score);
        }
        OS.decisionScores = decisionScores;
        function indicatorProgress(state, r) {
            const history = OS.rows(state, "measurement")
                .filter((x) => x.indicatorId === r.id)
                .sort((a, b) => String(a.date).localeCompare(String(b.date)) ||
                String(a.createdAt).localeCompare(String(b.createdAt)));
            const latest = history[history.length - 1];
            const value = latest ? OS.n(latest, "reading") : OS.n(r, "baseline");
            const delta = OS.n(r, "targetValue") - OS.n(r, "baseline");
            return {
                value,
                progress: delta
                    ? OS.clamp(((value - OS.n(r, "baseline")) / delta) * 100)
                    : value === OS.n(r, "targetValue")
                        ? 100
                        : 0,
                history,
            };
        }
        OS.indicatorProgress = indicatorProgress;
        function balances(state) {
            const map = new Map();
            for (const r of OS.rows(state, "member"))
                map.set(r.id, 0);
            for (const r of OS.rows(state, "sharedExpense")) {
                const people = Array.isArray(r.participants)
                    ? r.participants
                    : [];
                if (!people.length)
                    continue;
                const cents = Math.round(OS.n(r, "cost") * 100), share = Math.floor(cents / people.length), rest = cents - share * people.length;
                map.set(String(r.payerId), (map.get(String(r.payerId)) || 0) + cents);
                people.forEach((id, i) => map.set(id, (map.get(id) || 0) - share - (i < rest ? 1 : 0)));
            }
            for (const r of OS.rows(state, "settlement")) {
                const cents = Math.round(OS.n(r, "cost") * 100);
                map.set(String(r.fromId), (map.get(String(r.fromId)) || 0) + cents);
                map.set(String(r.toId), (map.get(String(r.toId)) || 0) - cents);
            }
            return Array.from(map, ([id, cents]) => ({
                id,
                title: String(state.os.find((r) => r.id === id)?.title || "Membre retiré"),
                cents,
            }));
        }
        OS.balances = balances;
        function settlements(state) {
            const b = balances(state), debt = b.filter((r) => r.cents < 0).map((r) => ({ ...r })), credit = b.filter((r) => r.cents > 0).map((r) => ({ ...r })), transfers = [];
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
        OS.settlements = settlements;
        function reviewCard(r, quality, today = Q.day()) {
            const streak = quality === "again" ? 0 : OS.n(r, "reviewStreak") + 1;
            const interval = quality === "again"
                ? 1
                : quality === "hard"
                    ? Math.max(1, Math.round(OS.n(r, "interval") * 1.2))
                    : Math.min(365, streak === 1 ? 3 : Math.max(3, Math.round(OS.n(r, "interval") * 2)));
            return {
                ...r,
                reviewStreak: streak,
                interval,
                due: addDays(today, interval),
                lastReviewed: today,
            };
        }
        OS.reviewCard = reviewCard;
        function proposals(state, today = Q.day()) {
            const result = [];
            const used = new Set(state.tasks.map((t) => String(t.automationToken || "")));
            for (const rule of OS.rows(state, "rule").filter((r) => Q.Personal.visible(r) && r.enabled === "Active" && !OS.done(r))) {
                const key = rule.source === "Documents existants"
                    ? "documents"
                    : rule.source === "Tâches en retard"
                        ? "tasks"
                        : "os";
                const records = state[key].filter((r) => Q.Personal.visible(r) &&
                    !r.done &&
                    !OS.done(r) &&
                    r.id !== rule.id &&
                    (key !== "os" || OS.getModel(r.kind)?.scheduled));
                for (const r of records) {
                    const due = String(r.due || (key === "documents" ? r.date : "") || "");
                    if (!Q.validDate(due) ||
                        due > addDays(today, OS.n(rule, "horizon")) ||
                        (key === "tasks" && due >= today))
                        continue;
                    const token = rule.id + ":" + key + ":" + r.id + ":" + due;
                    if (used.has(token))
                        continue;
                    used.add(token);
                    result.push({
                        token,
                        title: String(rule.prefix || "À traiter") +
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
        OS.proposals = proposals;
        function dayPlan(state, today = Q.day()) {
            const pref = OS.rows(state, "planning").find((r) => Q.Personal.visible(r) && r.date === today);
            const capacity = pref ? OS.n(pref, "capacity") : 120;
            const pool = state.tasks.filter((r) => Q.Personal.visible(r) &&
                !r.done &&
                !Q.Personal.blockers(state, { key: "tasks", id: r.id }).length &&
                (!r.due || String(r.due) <= today));
            pool.sort((a, b) => pref?.priority === "Importance"
                ? Number(!!b.important) - Number(!!a.important) ||
                    String(a.due || "9999").localeCompare(String(b.due || "9999"))
                : String(a.due || "9999").localeCompare(String(b.due || "9999")) ||
                    Number(!!b.important) - Number(!!a.important));
            let used = 0;
            const tasks = [];
            for (const r of pool) {
                const duration = Q.Personal.meta(r).duration || OS.n(r, "estimate") || 25;
                if (used + duration <= capacity) {
                    tasks.push(r);
                    used += duration;
                }
            }
            return { tasks, used, capacity, remaining: pool.length - tasks.length };
        }
        OS.dayPlan = dayPlan;
        function csv(headers, rs) {
            const cell = (v) => '"' +
                String(v ?? "")
                    .replace(/^[=+@\-\t\r]/, "'$&")
                    .replace(/"/g, '""') +
                '"';
            return ("\ufeff" + [headers, ...rs].map((r) => r.map(cell).join(";")).join("\r\n"));
        }
        OS.csv = csv;
        function parseCSV(raw) {
            const text = raw.replace(/^\ufeff/, "");
            const separator = text.split(/\r?\n/)[0]?.includes(";") ? ";" : ",";
            const rows = [];
            let row = [], cell = "", quoted = false;
            for (let i = 0; i < text.length; i++) {
                const c = text[i];
                if (c === '"') {
                    if (quoted && text[i + 1] === '"') {
                        cell += '"';
                        i++;
                    }
                    else
                        quoted = !quoted;
                }
                else if (c === separator && !quoted) {
                    row.push(cell);
                    cell = "";
                }
                else if ((c === "\n" || c === "\r") && !quoted) {
                    if (c === "\r" && text[i + 1] === "\n")
                        i++;
                    row.push(cell);
                    if (row.some((x) => x.trim()))
                        rows.push(row);
                    row = [];
                    cell = "";
                }
                else
                    cell += c;
            }
            if (quoted)
                throw new Error("CSV : guillemet non fermé.");
            row.push(cell);
            if (row.some((x) => x.trim()))
                rows.push(row);
            const headers = rows.shift()?.map((x) => x.trim().toLowerCase()) || [];
            const names = ["date", "libelle", "montant", "categorie"];
            if (!names.every((x) => headers.includes(x)))
                throw new Error("Colonnes attendues : date;libelle;montant;categorie");
            return rows.map((r, i) => {
                const get = (key) => r[headers.indexOf(key)]?.trim() || "";
                const date = get("date"), label = get("libelle"), s = get("montant").replace(",", ".");
                const amount = Number(s);
                if (!Q.validDate(date) || !label || !s || !Number.isFinite(amount))
                    throw new Error("Ligne " + (i + 2) + " : date ISO, libellé et montant requis.");
                return { date, label, amount, category: get("categorie") };
            });
        }
        OS.parseCSV = parseCSV;
    })(OS = Q.OS || (Q.OS = {}));
})(Q || (Q = {}));

"use strict";
/** Shared, additive layer: stable collection+id addresses; no reinterpretation of legacy data. */
var Q;
(function (Q) {
    var Personal;
    (function (Personal) {
        Personal.labels = {
            os: "Life OS",
            tasks: "Tâches",
            events: "Événements",
            notes: "Notes",
            habits: "Habitudes",
            routines: "Routines",
            goals: "Objectifs",
            workouts: "Séances",
            health: "Mesures",
            life: "Captures",
            finances: "Transactions",
            documents: "Documents",
            assets: "Équipements",
            automations: "Idées de règles",
        };
        Personal.relationTypes = {
            related: "Est lié à",
            depends: "Dépend de",
            contributes: "Contribue à",
        };
        const obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
        Personal.meta = (r) => (r.personal || {});
        Personal.visible = (r) => !r.deleted && !Personal.meta(r).archived;
        Personal.token = (r) => JSON.stringify([r.key, r.id]);
        Personal.same = (a, b) => a.key === b.key && a.id === b.id;
        Personal.title = (r) => String(r.title || r.name || r.label || r.type || r.kind || "Élément");
        Personal.fold = (v) => String(v ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        Personal.resolve = (s, r) => s[r.key]?.find((x) => x.id === r.id);
        Personal.all = (s) => Q.collections.flatMap((key) => s[key].map((record) => ({ key, id: record.id, record })));
        Personal.completed = (r, s) => r.done === true ||
            r.status === "Terminé" ||
            (s && s.goals.includes(r) && Q.Connected.savings(s, r)
                ? Q.Connected.progress(s, r) >= 100
                : r.progress !== undefined && Number(r.progress) >= 100);
        Personal.date = (r) => String(r.due || r.date || "");
        Personal.tags = (r) => [
            ...new Set([...(Personal.meta(r).tags || []), ...String(r.tags || "").split(/[,;#]/)]
                .map((t) => t.trim())
                .filter(Boolean)),
        ];
        function domain(hit) {
            if (hit.key === "os")
                return Q.OS.domainFor(hit.record.kind)?.id || "";
            if (hit.key === "life")
                return Q.OS.domains.find((d) => d.name === hit.record.domain)?.id || "";
            return ({
                finances: "finance",
                documents: "documents",
                assets: "home",
                workouts: "health",
                health: "health",
                goals: "projects",
                automations: "automation",
            }[hit.key] || "");
        }
        Personal.domain = domain;
        function describe(hit) {
            return hit.key === "os"
                ? `${Q.OS.domainFor(hit.record.kind)?.name} · ${Q.OS.getModel(hit.record.kind)?.label}`
                : Personal.labels[hit.key];
        }
        Personal.describe = describe;
        function validateMeta(r) {
            if (r.personal === undefined)
                return;
            if (!obj(r.personal))
                throw new Error("Propriétés communes invalides.");
            const m = r.personal;
            for (const f of ["description", "location", "owner", "context"])
                if (m[f] !== undefined && typeof m[f] !== "string")
                    throw new Error(`Propriété ${f} invalide.`);
            for (const f of ["favorite", "archived"])
                if (m[f] !== undefined && typeof m[f] !== "boolean")
                    throw new Error(`Propriété ${f} invalide.`);
            if (m.tags !== undefined &&
                (!Array.isArray(m.tags) ||
                    m.tags.some((t) => typeof t !== "string" || !t.trim())))
                throw new Error("Tags invalides.");
            if (m.priority !== undefined &&
                (!Number.isInteger(m.priority) ||
                    Number(m.priority) < 1 ||
                    Number(m.priority) > 5))
                throw new Error("Priorité attendue entre 1 et 5.");
            if (m.duration !== undefined &&
                (typeof m.duration !== "number" ||
                    !Number.isFinite(m.duration) ||
                    m.duration <= 0))
                throw new Error("Durée positive attendue.");
            if (m.energy !== undefined &&
                !["", "low", "medium", "high"].includes(String(m.energy)))
                throw new Error("Énergie invalide.");
            if (m.checklist !== undefined &&
                (!Array.isArray(m.checklist) ||
                    m.checklist.some((x) => !obj(x) ||
                        typeof x.text !== "string" ||
                        !x.text.trim() ||
                        typeof x.done !== "boolean")))
                throw new Error("Checklist invalide.");
        }
        Personal.validateMeta = validateMeta;
        function connections(s) {
            return (s.connections || []);
        }
        Personal.connections = connections;
        function revisions(s) {
            return (s.activity || []);
        }
        Personal.revisions = revisions;
        function validate(s) {
            const validRef = (r) => obj(r) &&
                Q.collections.includes(r.key) &&
                typeof r.id === "string" &&
                !!Personal.resolve(s, r);
            if (s.connections !== undefined && !Array.isArray(s.connections))
                throw new Error("Relations invalides.");
            const ids = new Set(), pairs = new Set();
            const edges = new Map();
            for (const c of connections(s)) {
                if (!obj(c) ||
                    typeof c.id !== "string" ||
                    !c.id ||
                    ids.has(c.id) ||
                    !validRef(c.from) ||
                    !validRef(c.to) ||
                    Personal.same(c.from, c.to) ||
                    !Object.prototype.hasOwnProperty.call(Personal.relationTypes, c.type))
                    throw new Error("Relation invalide ou référence manquante.");
                if (c.deleted !== undefined && typeof c.deleted !== "boolean")
                    throw new Error("État de relation invalide.");
                if (c.label !== undefined && typeof c.label !== "string")
                    throw new Error("Libellé de relation invalide.");
                ids.add(c.id);
                if (c.deleted)
                    continue;
                let a = Personal.token(c.from), b = Personal.token(c.to);
                if (c.type === "related" && a > b)
                    [a, b] = [b, a];
                const pair = JSON.stringify([a, b, c.type]);
                if (pairs.has(pair))
                    throw new Error("Cette relation existe déjà.");
                pairs.add(pair);
                if (c.type === "depends")
                    edges.set(a, [...(edges.get(a) || []), b]);
            }
            const visiting = new Set(), visited = new Set();
            const visit = (id) => {
                if (visiting.has(id))
                    throw new Error("Dépendance circulaire : ce lien bloquerait les actions.");
                if (visited.has(id))
                    return;
                visiting.add(id);
                for (const next of edges.get(id) || [])
                    visit(next);
                visiting.delete(id);
                visited.add(id);
            };
            for (const id of edges.keys())
                visit(id);
            if (s.activity !== undefined && !Array.isArray(s.activity))
                throw new Error("Historique invalide.");
            const historyIds = new Set();
            for (const h of revisions(s)) {
                if (!obj(h) ||
                    typeof h.id !== "string" ||
                    !h.id ||
                    historyIds.has(h.id) ||
                    !validRef(h.ref) ||
                    typeof h.at !== "string" ||
                    !Number.isFinite(Date.parse(h.at)) ||
                    typeof h.action !== "string" ||
                    !obj(h.after) ||
                    h.after.id !== h.ref.id ||
                    (h.before !== undefined && (!obj(h.before) || h.before.id !== h.ref.id)))
                    throw new Error("Révision invalide.");
                historyIds.add(h.id);
            }
            const searches = s.settings.searches;
            if (searches !== undefined &&
                (!Array.isArray(searches) ||
                    searches.some((x) => !obj(x) ||
                        typeof x.name !== "string" ||
                        !obj(x.filter) ||
                        Object.entries(x.filter).some(([key, value]) => key === "favorite"
                            ? typeof value !== "boolean"
                            : typeof value !== "string"))))
                throw new Error("Recherches enregistrées invalides.");
            const history = s.settings.searchHistory;
            if (history !== undefined &&
                (!Array.isArray(history) || history.some((x) => typeof x !== "string")))
                throw new Error("Historique de recherche invalide.");
        }
        Personal.validate = validate;
        /** Native model references are exposed without rewriting any existing record. */
        function graph(s) {
            const result = connections(s)
                .filter((c) => !c.deleted)
                .map((c) => ({ ...c, inferred: false }));
            const add = (from, key, id, label) => {
                const to = { key, id: String(id || "") };
                if (id && Personal.resolve(s, to) && !Personal.same(from, to))
                    result.push({
                        id: `native:${Personal.token(from)}:${label}:${Personal.token(to)}`,
                        from,
                        to,
                        type: "related",
                        label,
                        inferred: true,
                    });
            };
            for (const h of Personal.all(s)) {
                if (h.record.deleted)
                    continue;
                if (h.key === "os")
                    for (const f of Q.OS.getModel(h.record.kind)?.fields || []) {
                        if (f.type === "ref")
                            add(h, "os", h.record[f.key], f.label);
                        if (f.type === "refs")
                            for (const id of h.record[f.key] || [])
                                add(h, "os", id, f.label);
                    }
                if (h.key === "tasks")
                    add(h, "os", h.record.osSourceId, "Action liée");
                if (h.key === "finances")
                    add(h, "os", h.record.accountId, "Compte");
                if (h.key === "finances" || h.key === "goals")
                    add(h, "os", h.record.projectId, "Projet financé");
                if (h.key === "goals")
                    add(h, "os", h.record.savingsAccountId, "Compte d’épargne");
            }
            return result;
        }
        Personal.graph = graph;
        function related(s, ref) {
            return graph(s).filter((c) => Personal.same(c.from, ref) || Personal.same(c.to, ref));
        }
        Personal.related = related;
        function blockers(s, ref) {
            return connections(s)
                .filter((c) => !c.deleted && c.type === "depends" && Personal.same(c.from, ref))
                .map((c) => ({ ...c.to, record: Personal.resolve(s, c.to) }))
                .filter((h) => !Personal.completed(h.record, s));
        }
        Personal.blockers = blockers;
        /** Audit only changed user records. Navigation/search preferences create no record revisions. */
        function stamp(previous, next, at = new Date().toISOString()) {
            const history = [...revisions(next)];
            for (const h of Personal.all(next)) {
                const old = Personal.resolve(previous, h);
                if (JSON.stringify(old) === JSON.stringify(h.record))
                    continue;
                h.record.updatedAt = at;
                if (!old && !h.record.createdAt)
                    h.record.createdAt = at;
                const action = !old
                    ? "Création"
                    : h.record.deleted && !old.deleted
                        ? "Retrait"
                        : !h.record.deleted && old.deleted
                            ? "Récupération"
                            : Personal.meta(h.record).archived && !Personal.meta(old).archived
                                ? "Archivage"
                                : !Personal.meta(h.record).archived && Personal.meta(old).archived
                                    ? "Désarchivage"
                                    : "Modification";
                const prefix = Personal.token(h) + ":" + at + ":";
                let sequence = history.length;
                while (history.some((x) => x.id === prefix + sequence))
                    sequence++;
                history.unshift({
                    id: prefix + sequence,
                    ref: { key: h.key, id: h.id },
                    at,
                    action,
                    ...(old ? { before: Q.clone(old) } : {}),
                    after: Q.clone(h.record),
                });
            }
            if (history.length) {
                const counts = new Map();
                next.activity = history
                    .filter((h) => {
                    const t = Personal.token(h.ref), n = (counts.get(t) || 0) + 1;
                    counts.set(t, n);
                    return n <= 10;
                })
                    .slice(0, 300);
            }
        }
        Personal.stamp = stamp;
        function text(h) {
            const r = h.record, fields = [
                "title",
                "name",
                "label",
                "body",
                "details",
                "category",
                "project",
                "area",
                "domain",
                "status",
                "type",
                "kind",
                "source",
                "amount",
                "value",
                "unit",
                "date",
                "due",
                "time",
                ...((h.key === "os" ? Q.OS.getModel(r.kind)?.fields : []) || [])
                    .filter((f) => !["ref", "refs"].includes(f.type))
                    .map((f) => f.key),
            ];
            return Personal.fold([
                ...fields.map((k) => r[k] || ""),
                describe(h),
                ...Personal.tags(r),
                Personal.meta(r).description || "",
                Personal.meta(r).context || "",
                Personal.meta(r).owner || "",
                Personal.meta(r).location || "",
                ...(Personal.meta(r).checklist || []).map((x) => x.text),
            ].join(" "));
        }
        function search(s, f = {}, today = Q.day()) {
            const terms = Personal.fold(f.query || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);
            return Personal.all(s)
                .filter((h) => {
                const r = h.record, m = Personal.meta(r), d = Personal.date(r);
                return (!r.deleted &&
                    (f.scope !== "deadlines" || !!r.due) &&
                    (f.archive === "all" ||
                        (f.archive === "archived" ? m.archived : !m.archived)) &&
                    (!f.key || h.key === f.key) &&
                    (!f.domain || domain(h) === f.domain) &&
                    (!f.favorite || m.favorite) &&
                    (!f.tag || Personal.tags(r).some((t) => Personal.fold(t) === Personal.fold(f.tag))) &&
                    (!f.from || (!!d && d >= f.from)) &&
                    (!f.to || (!!d && d <= f.to)) &&
                    (!f.status ||
                        (f.status === "done"
                            ? Personal.completed(r, s)
                            : f.status === "overdue"
                                ? !!r.due && String(r.due) < today && !Personal.completed(r, s)
                                : !Personal.completed(r, s))) &&
                    terms.every((t) => text(h).includes(t)));
            })
                .sort((a, b) => Number(!!Personal.meta(b.record).favorite) -
                Number(!!Personal.meta(a.record).favorite) ||
                String(b.record.updatedAt || b.record.createdAt || "").localeCompare(String(a.record.updatedAt || a.record.createdAt || "")) ||
                Personal.title(a.record).localeCompare(Personal.title(b.record), "fr"));
        }
        Personal.search = search;
        function duplicate(s, ref, id) {
            const original = Personal.resolve(s, ref);
            if (!original)
                throw new Error("Élément introuvable.");
            const copy = Q.clone(original);
            copy.id = id;
            delete copy.createdAt;
            delete copy.updatedAt;
            delete copy.completedAt;
            const field = copy.title !== undefined
                ? "title"
                : copy.name !== undefined
                    ? "name"
                    : copy.label !== undefined
                        ? "label"
                        : "title";
            copy[field] = Personal.title(original) + " (copie)";
            copy.deleted = false;
            copy.personal = {
                ...Personal.meta(copy),
                archived: false,
                favorite: false,
                checklist: (Personal.meta(copy).checklist || []).map((x) => ({
                    ...x,
                    done: false,
                })),
            };
            // Copies are new work, without execution or generator identity.
            for (const key of [
                "lastCompleted",
                "completedCount",
                "lastReviewed",
                "reviewStreak",
                "interval",
                "insightSource",
                "automationToken",
            ])
                delete copy[key];
            if (ref.key === "os") {
                copy.status = "Idée";
                if (copy.progress !== undefined)
                    copy.progress = 0;
                if (copy.done !== undefined)
                    copy.done = false;
            }
            if (ref.key === "tasks")
                copy.done = false;
            if (ref.key === "habits")
                copy.days = {};
            if (ref.key === "goals") {
                delete copy.savingsAccountId;
                copy.progress = 0;
            }
            return copy;
        }
        Personal.duplicate = duplicate;
        function nextActions(s, today = Q.day()) {
            const edges = graph(s);
            return s.tasks
                .filter((r) => Personal.visible(r) && !Personal.completed(r))
                .map((r) => {
                const hit = { key: "tasks", id: r.id, record: r }, m = Personal.meta(r), reasons = [];
                let score = 0;
                const delta = r.due ? Q.OS.daysBetween(today, String(r.due)) : 999;
                if (delta < 0) {
                    score += 60 + Math.min(20, -delta);
                    reasons.push(`${-delta} jour(s) de retard`);
                }
                else if (delta === 0) {
                    score += 50;
                    reasons.push("Échéance aujourd’hui");
                }
                else if (delta <= 7) {
                    score += 30 - delta;
                    reasons.push(`Échéance dans ${delta} jour(s)`);
                }
                if (r.urgent) {
                    score += 15;
                    reasons.push("Marquée urgente");
                }
                if (r.important) {
                    score += 20;
                    reasons.push("Marquée importante");
                }
                if (m.priority) {
                    score += m.priority * 5;
                    reasons.push(`Priorité ${m.priority}/5`);
                }
                const duration = m.duration || Number(r.estimate || 25);
                const context = s.settings.actionContext;
                if (context &&
                    m.context &&
                    textValue(m.context) === textValue(String(context))) {
                    score += 12;
                    reasons.push("Correspond au contexte choisi");
                }
                const available = Number(s.settings.availableMinutes || 0);
                if (available > 0) {
                    score += duration <= available ? 8 : -12;
                    reasons.push(duration <= available
                        ? "Tient dans le temps disponible"
                        : "Dépasse le temps disponible");
                }
                const energy = String(s.settings.availableEnergy || ""), levels = ["low", "medium", "high"];
                if (levels.includes(energy) && m.energy) {
                    const fits = levels.indexOf(m.energy) <= levels.indexOf(energy);
                    score += fits ? 5 : -15;
                    reasons.push(fits
                        ? "Énergie demandée compatible"
                        : "Demande plus d’énergie que disponible");
                }
                if (duration <= 15) {
                    score += 5;
                    reasons.push("Action courte, 15 min ou moins");
                }
                const linked = edges
                    .filter((c) => Personal.same(c.from, hit) || Personal.same(c.to, hit))
                    .some((c) => {
                    const other = Personal.resolve(s, Personal.same(c.from, hit) ? c.to : c.from);
                    return (other &&
                        !other.deleted &&
                        (other.kind === "project" || s.goals.includes(other)));
                });
                if (linked) {
                    score += 10;
                    reasons.push("Reliée à un projet ou objectif");
                }
                const blocked = blockers(s, hit);
                if (!reasons.length)
                    reasons.push("Action ouverte ; ajoute une échéance ou une priorité pour affiner le classement");
                return { hit, score, reasons, blocked };
            })
                .sort((a, b) => Number(!!a.blocked.length) - Number(!!b.blocked.length) ||
                b.score - a.score ||
                Personal.title(a.hit.record).localeCompare(Personal.title(b.hit.record), "fr"));
        }
        Personal.nextActions = nextActions;
        function textValue(value) {
            return value.trim().toLocaleLowerCase("fr");
        }
    })(Personal = Q.Personal || (Q.Personal = {}));
})(Q || (Q = {}));

"use strict";
/** Calendar projections never turn measurements or transactions into deadlines. */
var Q;
(function (Q) {
    var Planning;
    (function (Planning) {
        function entries(s, includeDone = false) {
            const result = [];
            for (const hit of Q.Personal.all(s)) {
                const r = hit.record;
                if (!Q.Personal.visible(r) || (!includeDone && Q.Personal.completed(r, s)))
                    continue;
                const add = (field, label, deadline, end) => {
                    const start = String(r[field] || "");
                    if (!Q.validDate(start))
                        return;
                    result.push({
                        id: Q.Personal.token(hit) + ":" + field,
                        hit,
                        start,
                        end: Q.validDate(String(end)) && String(end) >= start
                            ? String(end)
                            : start,
                        time: String(r.time || ""),
                        label,
                        deadline,
                    });
                };
                add("due", "Échéance", true);
                if (hit.key === "goals" && r.date !== r.due)
                    add("date", "Cible de l’objectif", true);
                if (["events", "workouts"].includes(hit.key) ||
                    (hit.key === "os" &&
                        ["trip", "booking", "interaction", "study"].includes(String(r.kind))))
                    if (r.date !== r.due)
                        add("date", r.kind === "trip" ? "Voyage" : "Agenda", false, r.kind === "trip" ? r.end : undefined);
                if (hit.key === "os" && r.kind === "subscription")
                    add("cancelBy", "Résiliation", true);
                if (hit.key === "os" && r.kind === "equipment")
                    add("warranty", "Fin de garantie", true);
            }
            return result.sort((a, b) => a.start.localeCompare(b.start) ||
                a.time.localeCompare(b.time) ||
                Q.Personal.title(a.hit.record).localeCompare(Q.Personal.title(b.hit.record), "fr"));
        }
        Planning.entries = entries;
        function monthDays(month) {
            if (!Q.validDate(month + "-01"))
                throw new Error("Mois invalide.");
            const first = month + "-01";
            const offset = (new Date(first + "T12:00:00").getDay() + 6) % 7;
            return Array.from({ length: 42 }, (_, i) => Q.OS.addDays(first, i - offset));
        }
        Planning.monthDays = monthDays;
        function shiftMonth(month, offset) {
            if (!Q.validDate(month + "-01"))
                throw new Error("Mois invalide.");
            const dt = new Date(month + "-01T12:00:00");
            dt.setMonth(dt.getMonth() + offset);
            return Q.day(dt).slice(0, 7);
        }
        Planning.shiftMonth = shiftMonth;
        Planning.onDay = (list, date) => list.filter((x) => x.start <= date && x.end >= date);
    })(Planning = Q.Planning || (Q.Planning = {}));
})(Q || (Q = {}));

"use strict";
/** Local, explainable findings; analyzers are read-only and share the same objects. */
var Q;
(function (Q) {
    var Intelligence;
    (function (Intelligence) {
        const P = Q.Personal;
        Intelligence.categories = [
            "Important",
            "Risque",
            "À surveiller",
            "Opportunité",
            "Suggestion",
        ];
        Intelligence.decisions = (s) => (s.insightDecisions || []);
        const ref = (h) => ({ key: h.key, id: h.id });
        const finding = (type, category, title, explanation, refs, action, period = "") => ({
            id: JSON.stringify([type, ...refs.map(P.token).sort(), period]),
            category,
            title,
            explanation,
            refs: refs.map(ref),
            action,
        });
        const live = (s, kind) => Q.OS.rows(s, kind).filter((r) => P.visible(r) && !P.completed(r));
        const euro = (n) => new Intl.NumberFormat("fr-FR", {
            style: "currency",
            currency: "EUR",
        }).format(n);
        const deadlines = (s, today) => Q.Planning.entries(s)
            .filter((x) => x.deadline && x.start <= Q.OS.addDays(today, 7))
            .map((x) => finding("deadline:" + x.id, x.start < today ? "Important" : "À surveiller", `${x.label} ${x.start < today ? "dépassée" : "à venir"} · ${P.title(x.hit.record)}`, `${x.label} le ${x.start}. ${x.start < today ? Q.OS.daysBetween(x.start, today) + " jour(s) de retard." : "Dans les sept prochains jours."}`, [x.hit], `Traiter ${x.label.toLowerCase()} · ${P.title(x.hit.record)}`, x.start));
        const budgets = (s, today) => live(s, "budget")
            .filter((r) => r.month === today.slice(0, 7))
            .flatMap((r) => {
            const spent = -Q.OS.sum(s.finances.filter((t) => !t.deleted &&
                Number(t.amount) < 0 &&
                String(t.date).startsWith(String(r.month)) &&
                String(t.category || "")
                    .trim()
                    .toLocaleLowerCase("fr") ===
                    String(r.category).trim().toLocaleLowerCase("fr")), "amount");
            return spent > Number(r.limit)
                ? [
                    finding("budget", "Risque", `Budget dépassé · ${P.title(r)}`, `${euro(spent)} dépensés pour une enveloppe de ${euro(Number(r.limit))} en ${r.month}, soit ${euro(spent - Number(r.limit))} de dépassement. Les transactions archivées restent comptabilisées.`, [{ key: "os", id: r.id }], `Revoir le budget · ${P.title(r)}`, String(r.month)),
                ]
                : [];
        });
        const contacts = (s, today) => live(s, "contact").flatMap((r) => {
            const dates = [
                r.date,
                ...Q.OS.rows(s, "interaction")
                    .filter((x) => x.contactId === r.id)
                    .map((x) => x.date),
            ]
                .map(String)
                .filter((d) => Q.validDate(d) && d <= today)
                .sort();
            const last = dates[dates.length - 1];
            if (!last || Q.OS.daysBetween(last, today) < Number(r.cadence))
                return [];
            return [
                finding("contact", "Suggestion", `Reprendre contact · ${P.title(r)}`, `Dernier échange enregistré le ${last}, il y a ${Q.OS.daysBetween(last, today)} jours. Ta cadence est de ${r.cadence} jours.`, [{ key: "os", id: r.id }], `Contacter ${P.title(r)}`, last),
            ];
        });
        /** Metadata edits don't count as progress; linked task/milestone completion does. */
        const projects = (s, today) => live(s, "project")
            .filter((r) => r.status === "En cours")
            .flatMap((r) => {
            const projectRef = { key: "os", id: r.id };
            const linked = P.related(s, projectRef).map((c) => P.same(c.from, projectRef) ? c.to : c.from);
            const dates = [
                String(r.createdAt || "").slice(0, 10),
                String(r.lastCompleted || "").slice(0, 10),
            ];
            for (const h of P.revisions(s)) {
                if (!h.before || h.after.deleted)
                    continue;
                const own = P.same(h.ref, projectRef);
                const child = linked.some((x) => P.same(x, h.ref));
                if ((own || child) &&
                    (h.before.status !== h.after.status ||
                        h.before.progress !== h.after.progress ||
                        h.before.done !== h.after.done ||
                        JSON.stringify(P.meta(h.before).checklist) !==
                            JSON.stringify(P.meta(h.after).checklist)))
                    dates.push(h.at.slice(0, 10));
            }
            for (const x of linked) {
                const child = P.resolve(s, x);
                if (child && !child.deleted && P.completed(child))
                    dates.push(String(child.completedAt || child.lastCompleted || "").slice(0, 10));
            }
            const known = dates.filter((d) => Q.validDate(d) && d <= today).sort();
            const last = known[known.length - 1];
            if (!last || Q.OS.daysBetween(last, today) < 30)
                return [];
            return [
                finding("stagnation", "À surveiller", `Projet à revoir · ${P.title(r)}`, `Aucune progression enregistrée depuis le ${last} (${Q.OS.daysBetween(last, today)} jours). Calcul sur la création, les statuts, la progression, les checklists et les actions liées ; les simples changements de tags ne comptent pas. L’historique conservé est limité.`, [projectRef], `Définir la prochaine étape · ${P.title(r)}`, last),
            ];
        });
        const workload = (s, today) => live(s, "planning")
            .filter((r) => String(r.date) >= today && String(r.date) <= Q.OS.addDays(today, 7))
            .flatMap((r) => {
            const tasks = s.tasks.filter((t) => P.visible(t) && !P.completed(t) && t.due === r.date);
            const used = tasks.reduce((n, t) => n + (P.meta(t).duration || Number(t.estimate) || 25), 0);
            return used > Number(r.capacity)
                ? [
                    finding("load", "Risque", `Charge élevée le ${r.date}`, `${used} min de tâches à échéance pour ${r.capacity} min disponibles selon tes préférences du jour. Les rendez-vous et tâches sans échéance ne sont pas inclus.`, [
                        { key: "os", id: r.id },
                        ...tasks.map((t) => ({
                            key: "tasks",
                            id: t.id,
                        })),
                    ], `Replanifier la journée du ${r.date}`, String(r.date)),
                ]
                : [];
        });
        const conflicts = (s, today) => {
            const items = Q.Planning.entries(s).filter((x) => x.start >= today &&
                x.start <= Q.OS.addDays(today, 7) &&
                x.time &&
                (x.hit.key === "events" ||
                    x.hit.record.kind === "appointment" ||
                    x.hit.record.kind === "booking"));
            const result = [];
            const minute = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
            for (let i = 0; i < items.length; i++)
                for (let j = i + 1; j < items.length; j++) {
                    const a = items[i], b = items[j];
                    if (a.start !== b.start || P.same(a.hit, b.hit))
                        continue;
                    const ad = P.meta(a.hit.record).duration, bd = P.meta(b.hit.record).duration;
                    const sameTime = a.time === b.time;
                    const overlap = ad &&
                        bd &&
                        minute(a.time) < minute(b.time) + bd &&
                        minute(b.time) < minute(a.time) + ad;
                    if (sameTime || overlap)
                        result.push(finding("conflict", "Important", `Horaires à vérifier le ${a.start}`, `${P.title(a.hit.record)} à ${a.time} et ${P.title(b.hit.record)} à ${b.time}. ${ad && bd ? "Les durées déclarées se chevauchent." : "Même heure de début ; renseigne les durées pour préciser le conflit."}`, [a.hit, b.hit], "Vérifier les rendez-vous du " + a.start, a.start + ":" + a.time + ":" + b.time));
                }
            return result;
        };
        const duplicates = (s) => {
            const groups = new Map();
            for (const h of P.all(s).filter((h) => P.visible(h.record))) {
                const title = P.fold(P.title(h.record)).trim();
                if (title.length < 3)
                    continue;
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
                .map((g) => finding("duplicate", "Suggestion", `Doublon possible · ${P.title(g[0].record)}`, `${g.length} fiches de même type portent le même titre et la même date${g[0].key === "finances" ? " et le même montant" : ""}. Vérifie leur contenu avant tout retrait.`, g, `Vérifier les doublons · ${P.title(g[0].record)}`));
        };
        Intelligence.analyzers = [
            {
                id: "connected-finances",
                run: (s, today) => [
                    ...live(s, "project")
                        .filter((r) => Q.Connected.projectSpent(s, r) > Number(r.budget || 0))
                        .map((r) => finding("project-budget", "Risque", `Budget du projet dépassé · ${P.title(r)}`, `${euro(Q.Connected.projectSpent(s, r))} utilisés pour ${euro(Number(r.budget || 0))} prévus. Source : ${r.spendMode === "Transactions" ? "transactions liées, remboursements déduits" : "saisie manuelle"}.`, [{ key: "os", id: r.id }], `Revoir le budget · ${P.title(r)}`)),
                    ...s.goals
                        .filter((g) => P.visible(g) && g.date && Q.validDate(String(g.date)))
                        .flatMap((g) => {
                        const value = Q.Connected.savings(s, g);
                        if (!value || !value.remaining)
                            return [];
                        const days = Q.OS.daysBetween(today, String(g.date));
                        if (days >= 0 &&
                            (value.months === null || value.months * 30.44 <= days))
                            return [];
                        return [
                            finding("savings-gap", "À surveiller", `Épargne à ajuster · ${P.title(g)}`, `${euro(value.remaining)} restent à constituer avant le ${g.date}. ${days < 0 ? "L’échéance est passée." : `À versement mensuel constant, environ ${value.months} mois seraient nécessaires (mois moyen de 30,44 jours, sans intérêts ni retraits).`}`, [{ key: "goals", id: g.id }], `Revoir le plan d’épargne · ${P.title(g)}`, String(g.date)),
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
        function analyze(s, today = Q.day()) {
            return Intelligence.analyzers
                .flatMap((x) => x.run(s, today))
                .sort((a, b) => Intelligence.categories.indexOf(a.category) - Intelligence.categories.indexOf(b.category) ||
                a.title.localeCompare(b.title, "fr"));
        }
        Intelligence.analyze = analyze;
        function disposition(s, f, today = Q.day()) {
            const d = Intelligence.decisions(s).find((x) => x.id === f.id);
            return !d || (d.status === "snoozed" && String(d.until) <= today)
                ? "active"
                : d.status;
        }
        Intelligence.disposition = disposition;
        function decide(s, f, status, id, today = Q.day()) {
            let taskId;
            if (status === "accepted") {
                const old = Intelligence.decisions(s).find((x) => x.id === f.id);
                const existing = s.tasks.find((t) => t.id === old?.taskId || t.insightSource === f.id);
                const source = f.refs.length === 1 && f.refs[0].key === "tasks"
                    ? P.resolve(s, f.refs[0])
                    : undefined;
                if (existing || source)
                    taskId = (existing || source).id;
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
                    ...(status === "snoozed" ? { until: Q.OS.addDays(today, 7) } : {}),
                    ...(taskId ? { taskId } : {}),
                },
                ...Intelligence.decisions(s).filter((x) => x.id !== f.id),
            ];
        }
        Intelligence.decide = decide;
        function validate(s) {
            if (s.insightDecisions === undefined)
                return;
            if (!Array.isArray(s.insightDecisions))
                throw new Error("Suivi des recommandations invalide.");
            const ids = new Set();
            for (const d of Intelligence.decisions(s)) {
                if (!d ||
                    typeof d !== "object" ||
                    typeof d.id !== "string" ||
                    !d.id ||
                    ids.has(d.id) ||
                    typeof d.title !== "string" ||
                    !["accepted", "ignored", "snoozed"].includes(d.status) ||
                    typeof d.at !== "string" ||
                    !Q.validDate(d.at) ||
                    (d.status === "snoozed" &&
                        (typeof d.until !== "string" || !Q.validDate(d.until))) ||
                    (d.until !== undefined &&
                        (typeof d.until !== "string" || !Q.validDate(d.until))) ||
                    (d.taskId !== undefined &&
                        (typeof d.taskId !== "string" ||
                            !s.tasks.some((t) => t.id === d.taskId))))
                    throw new Error("Décision de recommandation invalide.");
                ids.add(d.id);
            }
        }
        Intelligence.validate = validate;
    })(Intelligence = Q.Intelligence || (Q.Intelligence = {}));
})(Q || (Q = {}));

"use strict";
/** Transactional local repository. Legacy snapshots are kept intact during migration. */
var Q;
(function (Q) {
    var Durable;
    (function (Durable) {
        Durable.DB = "quotidien-local-v3";
        Durable.MARKER = "quotidien-idb-migrated";
        class Repository {
            constructor(storage, factory) {
                this.storage = storage;
                this.factory = factory;
                this.legacy = new Q.Repository(storage);
            }
            async open() {
                if (!this.factory) {
                    if (this.storage.getItem(Durable.MARKER))
                        throw new Error("Le stockage transactionnel est indisponible. Aucune ancienne copie n’a été chargée à sa place.");
                    return;
                }
                this.db = await new Promise((resolve, reject) => {
                    let blocked = false;
                    const r = this.factory.open(Durable.DB, 1);
                    r.onupgradeneeded = () => {
                        r.result.createObjectStore("data");
                        r.result.createObjectStore("drafts");
                    };
                    r.onsuccess = () => {
                        if (blocked)
                            r.result.close();
                        else
                            resolve(r.result);
                    };
                    r.onerror = () => reject(r.error);
                    r.onblocked = () => {
                        blocked = true;
                        reject(new Error("Ferme les autres onglets QUOTIDIEN pour ouvrir le stockage."));
                    };
                });
                this.db.onversionchange = () => this.db?.close();
                const existing = await this.read("current");
                if (existing !== null)
                    return;
                if (this.storage.getItem(Durable.MARKER))
                    throw new Error("La base locale est manquante. Conserve et restaure une sauvegarde ; la copie antérieure n’a pas été réimportée silencieusement.");
                const raw = this.storage.getItem(Q.KEY);
                const next = raw === null ? Q.empty() : Q.normalize(JSON.parse(raw));
                // Reserve a durable migration marker before writing. A failure leaves old data untouched.
                this.storage.setItem(Durable.MARKER, "1");
                try {
                    await this.writeInitial(JSON.stringify(next), raw);
                }
                catch (e) {
                    this.storage.removeItem(Durable.MARKER);
                    throw e;
                }
            }
            writeInitial(raw, legacy) {
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction("data", "readwrite"), st = tx.objectStore("data"), r = st.get("current");
                    r.onsuccess = () => {
                        if (r.result === undefined) {
                            st.put(raw, "current");
                            st.put(legacy, "legacy");
                            st.put(raw, "migration");
                            for (const key of [Q.BACKUP_KEY, Q.CHECKPOINT_KEY]) {
                                const old = this.storage.getItem(key);
                                if (old !== null)
                                    st.put(old, key);
                            }
                        }
                    };
                    tx.oncomplete = () => resolve();
                    tx.onabort = () => reject(tx.error || new Error("Migration interrompue."));
                });
            }
            async read(key, store = "data") {
                if (!this.db)
                    return this.storage.getItem(key === "current" ? Q.KEY : key);
                return new Promise((resolve, reject) => {
                    const r = this.db.transaction(store).objectStore(store).get(key);
                    r.onsuccess = () => resolve(r.result ?? null);
                    r.onerror = () => reject(r.error);
                });
            }
            async auxiliary(key, value) {
                if (!this.db) {
                    if (value === null)
                        this.storage.removeItem(key);
                    else
                        this.storage.setItem(key, value);
                    return;
                }
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction("drafts", "readwrite"), st = tx.objectStore("drafts");
                    if (value === null)
                        st.delete(key);
                    else
                        st.put(value, key);
                    tx.oncomplete = () => resolve();
                    tx.onabort = () => reject(tx.error);
                });
            }
            async load() {
                if (!this.db)
                    return this.legacy.load();
                const legacy = await this.read("legacy");
                if (legacy !== this.storage.getItem(Q.KEY))
                    throw new Error("Une ancienne version a modifié les données après migration. Exporte les deux copies avant de les rapprocher.");
                const raw = await this.read("current");
                if (raw === null)
                    throw new Error("Données locales manquantes.");
                const next = Q.normalize(JSON.parse(raw));
                this.expected = raw;
                return next;
            }
            async commit(state, checkpoint = false) {
                if (!this.db)
                    return this.legacy.commit(state, checkpoint);
                const next = Q.normalize(state);
                if (this.expected === undefined)
                    throw new Error("Charge les données avant de les modifier.");
                if (!checkpoint)
                    Q.Personal.stamp(Q.normalize(JSON.parse(this.expected)), next);
                const serialized = JSON.stringify(next);
                await new Promise((resolve, reject) => {
                    const tx = this.db.transaction("data", "readwrite"), st = tx.objectStore("data"), r = st.get("current");
                    let failure;
                    r.onsuccess = () => {
                        if (r.result !== this.expected) {
                            failure = new Error("Les données ont changé dans un autre onglet. Exporte ta saisie puis recharge.");
                            tx.abort();
                            return;
                        }
                        const old = st.get("legacy");
                        old.onsuccess = () => {
                            if (old.result !== this.storage.getItem(Q.KEY)) {
                                failure = new Error("Une ancienne version a modifié les données. Recharge avant de continuer.");
                                tx.abort();
                                return;
                            }
                            st.put(r.result, Q.BACKUP_KEY);
                            if (checkpoint)
                                st.put(r.result, Q.CHECKPOINT_KEY);
                            st.put(serialized, "current");
                        };
                    };
                    tx.oncomplete = () => resolve();
                    tx.onabort = () => reject(failure || tx.error || new Error("Transaction annulée."));
                });
                this.expected = serialized;
                return next;
            }
            close() {
                this.db?.close();
            }
            get mode() {
                return this.db
                    ? "IndexedDB · transactions atomiques"
                    : "LocalStorage · compatibilité";
            }
        }
        Durable.Repository = Repository;
    })(Durable = Q.Durable || (Q.Durable = {}));
})(Q || (Q = {}));

"use strict";
/** Explicit accounting sources: no implicit allocation or double counting. */
var Q;
(function (Q) {
    var Connected;
    (function (Connected) {
        function projectSpent(s, project) {
            return project.spendMode === "Transactions"
                ? -s.finances
                    .filter((t) => !t.deleted && t.projectId === project.id)
                    .reduce((n, t) => n + Number(t.amount || 0), 0)
                : Number(project.spent || 0);
        }
        Connected.projectSpent = projectSpent;
        function balance(s, accountId) {
            const account = s.os.find((r) => r.id === accountId && r.kind === "account");
            return (Number(account?.opening || 0) +
                s.finances
                    .filter((t) => !t.deleted && t.accountId === accountId)
                    .reduce((n, t) => n + Number(t.amount || 0), 0));
        }
        Connected.balance = balance;
        function savings(s, goal) {
            if (!goal.savingsAccountId || !Number(goal.savingsTarget))
                return null;
            const current = balance(s, String(goal.savingsAccountId)), target = Number(goal.savingsTarget), remaining = Math.max(0, target - current);
            const monthly = Number(goal.monthlyContribution || 0);
            return {
                current,
                target,
                remaining,
                progress: Math.max(0, Math.min(100, (current / target) * 100)),
                months: remaining === 0
                    ? 0
                    : monthly > 0
                        ? Math.ceil(remaining / monthly)
                        : null,
            };
        }
        Connected.savings = savings;
        function progress(s, goal) {
            return savings(s, goal)?.progress ?? Number(goal.progress || 0);
        }
        Connected.progress = progress;
        function validate(s) {
            const allocated = new Set();
            for (const r of [...s.finances, ...s.goals]) {
                if (r.projectId &&
                    (typeof r.projectId !== "string" ||
                        !s.os.some((p) => p.kind === "project" && p.id === r.projectId)))
                    throw new Error("Projet lié introuvable.");
            }
            for (const g of s.goals) {
                for (const field of ["savingsTarget", "monthlyContribution"]) {
                    if (g[field] === undefined || g[field] === "")
                        continue;
                    if (!["number", "string"].includes(typeof g[field]) ||
                        !Number.isFinite(Number(g[field])) ||
                        Number(g[field]) < 0)
                        throw new Error("Montant d’épargne invalide.");
                    g[field] = Number(g[field]);
                }
                if (!g.savingsAccountId)
                    continue;
                if (typeof g.savingsAccountId !== "string" ||
                    !s.os.some((a) => a.id === g.savingsAccountId && a.kind === "account"))
                    throw new Error("Compte d’épargne introuvable.");
                if (!Number(g.savingsTarget))
                    throw new Error("Renseigne une cible d’épargne supérieure à zéro.");
                if (!Q.Personal.visible(g))
                    continue;
                if (allocated.has(g.savingsAccountId))
                    throw new Error("Ce compte finance déjà un objectif actif. Utilise un compte distinct pour éviter une double affectation.");
                allocated.add(g.savingsAccountId);
            }
        }
        Connected.validate = validate;
    })(Connected = Q.Connected || (Q.Connected = {}));
})(Q || (Q = {}));

"use strict";
var Q;
(function (Q) {
    var Focus;
    (function (Focus) {
        function session(s) {
            return s.focusSession || null;
        }
        Focus.session = session;
        function elapsed(f, now = Date.now()) {
            return Math.min(f.targetSeconds, f.elapsedSeconds +
                (f.runningSince === null
                    ? 0
                    : Math.max(0, (now - f.runningSince) / 1000)));
        }
        Focus.elapsed = elapsed;
        function start(s, taskId, id, minutes = 25, now = Date.now()) {
            if (session(s)?.status === "active")
                throw new Error("Termine d’abord la session en cours.");
            const task = s.tasks.find((t) => t.id === taskId && Q.Personal.visible(t) && !t.done);
            if (!task)
                throw new Error("Choisis une tâche ouverte.");
            if (Q.Personal.blockers(s, { key: "tasks", id: taskId }).length)
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
        Focus.start = start;
        function toggle(s, now = Date.now()) {
            const f = session(s);
            if (!f || f.status !== "active")
                throw new Error("Aucune session active.");
            if (f.runningSince === null)
                f.runningSince = now;
            else {
                f.elapsedSeconds = elapsed(f, now);
                f.runningSince = null;
            }
        }
        Focus.toggle = toggle;
        function finish(s, id, now = Date.now()) {
            const f = session(s);
            if (!f || f.status === "finished")
                return;
            f.elapsedSeconds = elapsed(f, now);
            f.runningSince = null;
            f.status = "finished";
            if (!s.health.some((r) => r.focusSessionId === f.id))
                s.health.push({
                    id,
                    kind: "Focus",
                    value: Math.round((f.elapsedSeconds / 60) * 10) / 10,
                    unit: "min",
                    date: Q.day(new Date(now)),
                    focusSessionId: f.id,
                    taskId: f.taskId,
                    details: f.notes,
                });
        }
        Focus.finish = finish;
        function validate(s) {
            if (s.focusSession === undefined || s.focusSession === null)
                return;
            const f = session(s);
            if (f === null)
                throw new Error("Session Focus invalide.");
            if (typeof f !== "object" ||
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
                    (!Number.isFinite(f.runningSince) || f.runningSince < 0)))
                throw new Error("Session Focus invalide.");
        }
        Focus.validate = validate;
        function review(s, weekly = false, today = Q.day()) {
            const start = weekly ? Q.OS.addDays(today, -6) : today, end = Q.OS.addDays(today, weekly ? 7 : 1);
            const completed = s.tasks.filter((t) => !t.deleted &&
                t.done &&
                String(t.completedAt || "").slice(0, 10) >= start &&
                String(t.completedAt || "").slice(0, 10) <= today);
            const expenses = -s.finances
                .filter((t) => !t.deleted &&
                Number(t.amount) < 0 &&
                String(t.date) >= start &&
                String(t.date) <= today)
                .reduce((n, t) => n + Number(t.amount), 0);
            const upcoming = s.tasks.filter((t) => Q.Personal.visible(t) &&
                !t.done &&
                t.due &&
                String(t.due) > today &&
                String(t.due) <= end);
            return `${weekly ? "Revue des 7 derniers jours" : "Bilan du soir"} · ${start} → ${today}\n\n${completed.length} tâche(s) terminée(s) avec date enregistrée\n${completed.map((t) => "• " + Q.Personal.title(t)).join("\n")}\n\nDépenses saisies : ${expenses.toFixed(2)} € (hors remboursements)\n\nÀ préparer\n${upcoming.map((t) => "• " + Q.Personal.title(t) + " · " + String(t.due)).join("\n") || "Aucune échéance de tâche renseignée."}\n\nCe qui a bien fonctionné :\nÀ ajuster :\nPriorité suivante :`;
        }
        Focus.review = review;
    })(Focus = Q.Focus || (Q.Focus = {}));
})(Q || (Q = {}));
