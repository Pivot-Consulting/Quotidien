"use strict";
/** Pure domain rules and synchronous, fail-closed local persistence. */
var Q;
(function (Q) {
    Q.KEY = "quotidien-rebuild-2";
    Q.BACKUP_KEY = Q.KEY + "-previous";
    Q.CHECKPOINT_KEY = Q.KEY + "-before-restore";
    Q.RELEASE = "2.2.0";
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
    Q.screens = ["today", "plan", "notes", "tracking", "life", "wave"];
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
            const serialized = JSON.stringify(next);
            this.storage.setItem(Q.KEY, serialized);
            this.expected = serialized;
            return next;
        }
    }
    Q.Repository = Repository;
    function matches(state, query) {
        const fold = (value) => value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
        const q = fold(query.trim());
        return Q.collections.flatMap((key) => state[key]
            .filter((record) => !record.deleted && fold(JSON.stringify(record)).includes(q))
            .map((record) => ({ key, record })));
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
            for (const rule of OS.rows(state, "rule").filter((r) => r.enabled === "Active" && !OS.done(r))) {
                const key = rule.source === "Documents existants"
                    ? "documents"
                    : rule.source === "Tâches en retard"
                        ? "tasks"
                        : "os";
                const records = state[key].filter((r) => !r.deleted &&
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
            const pref = OS.rows(state, "planning").find((r) => r.date === today);
            const capacity = pref ? OS.n(pref, "capacity") : 120;
            const pool = state.tasks.filter((r) => !r.deleted && !r.done && (!r.due || String(r.due) <= today));
            pool.sort((a, b) => pref?.priority === "Importance"
                ? Number(!!b.important) - Number(!!a.important) ||
                    String(a.due || "9999").localeCompare(String(b.due || "9999"))
                : String(a.due || "9999").localeCompare(String(b.due || "9999")) ||
                    Number(!!b.important) - Number(!!a.important));
            let used = 0;
            const tasks = [];
            for (const r of pool) {
                const duration = OS.n(r, "estimate") || 25;
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
