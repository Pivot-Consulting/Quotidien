# Quotidien — version 2.4.0

## Lot calendrier et analyse — 10 septembre 2026

Les 20 OS et 48 modèles sont conservés. Ce lot complète le socle 2.3, sans prétendre terminer la vision globale.

- Calendrier commun dans Planifier : mois, agenda quotidien, voyages multi-jours, filtres OS/terminés, résiliations et garanties, ouverture des sources et création d’événement à la date sélectionnée. Les mesures et transactions ne deviennent pas des rendez-vous.
- Centre d’analyse (`#intelligence`) depuis Today et Pilotage : sept analyseurs locaux pour échéances, budgets, contacts, projets stagnants, charge, conflits horaires et doublons possibles. Sources consultables et calculs expliqués, sans IA distante.
- Suivi persistant : accepter, ignorer, reporter sept jours, réexaminer et historique. Une acceptation crée une tâche reliée, ou suit la tâche existante. Le dédoublonnage reste effectif après rechargement et retrait d’une tâche générée ; un retrait ne la recrée pas silencieusement.
- Corrections : fermeture accidentelle des fiches modifiées, recherche au clavier et changement de route pendant une saisie ; duplication OS mutualisée ; archivage respecté dans les actions actives concernées ; durée commune dans le plan ; restauration de la route au retour du cache navigateur.
- Architecture : `src/planning.ts` et `src/intelligence.ts` contiennent les règles pures, `modules/cockpit-ui.js` les parcours ; `scripts/sources.cjs` partage le manifeste entre build et tests. Aucun nouveau framework ni service externe.

Validation : 74 tests passent, incluant tous les parcours précédents et les nouveaux cas de calendrier, données manquantes, charge, conflits, report, acceptation idempotente, quota, import/export et protection des saisies. Les exemples QA ne sont pas inclus dans les données du site.

Contrôles Chrome en cadres responsive : calendrier et centre d’analyse sans débordement horizontal à 320 × 844 et 844 × 390 ; calendrier et formulaire à 390 × 844 ; événement conservé après rechargement ; protection de fermeture testée à 320 px. Une tâche en retard apparaît dans l’analyse après rechargement à 390 px. Ces contrôles ne remplacent pas un essai sur iPhone physique, clavier natif, installation PWA ou démarrage hors réseau.

Limites : pas de qualification de stagnation sans date fiable ; l’historique est borné et l’absence de progression enregistrée ne signifie pas absence d’activité réelle. Les conflits sont comparés sur une même journée ; sans durées, seuls les débuts identiques sont signalés. La surcharge compare les tâches à échéance aux disponibilités déclarées, pas toute la journée. Les constats se recalculent à l’ouverture ; pas de surveillance en arrière-plan. Leurs décisions restent dans l’historique quand leur cause n’est plus détectée.

Les données restent locales par navigateur. Pas de compte/synchronisation, fichiers joints/OCR ou agent distant. Les exports sauvegardent aussi le suivi des recommandations. La protection des formulaires n’est pas un brouillon persistant et ne garantit pas leur récupération si le système ferme le navigateur.

## Lot transversal du 9 septembre 2026

La version 2.3 ajoute une première couche Personal OS à la base 2.2 existante. Ce lot n’implémente pas encore toute la vision en sept phases.

- Explorer : recherche globale par mots et accents sur les champs utilisateur, filtres communs, liste/Kanban de consultation/chronologie, recherches nommées et historique de recherche effaçable.
- Propriétés communes repliées dans les formulaires : tags, description, priorité, énergie, contexte, durée, responsable, lieu, favori, archivage et checklist.
- Relations entre toutes les collections ; liens métier existants reconnus ; validation des références, doublons et cycles ; visualisation textuelle dans les deux sens.
- Historique avant/après des fiches, restauration explicite d’une version, duplication sans reprendre l’exécution passée. Conservation bornée : 10 révisions par objet, 300 au total.
- Today : prochaines actions expliquées, accès direct aux relations et checklists, actions terminer/retirer, échéances globales et favoris ; dépendances respectées aussi par le plan de l’Assistant.
- Capture rapide étendue, routage OS fiabilisé, clavier des sections repliées et transactions adaptées aux écrans étroits.
- Même clé et schéma 2. Les champs existants restent intacts à la lecture ; l’historique commence aux modifications effectuées en 2.3. Les bilans financiers conservent les montants archivés. Les règles et sources archivées ne génèrent plus de tâches.

Sources nouvelles : `src/personal.ts` (modèles et règles pures), `modules/personal-ui.js` (parcours communs), `tests/personal.test.cjs`. La structure existante et les archives ne sont pas remplacées.

**Validation du lot :** `npm run verify` réussit avec **61 tests**, dont les parcours de création et édition des 48 modèles existants. Les nouveaux tests couvrent relations inter-collections, collisions d’identifiants, cycles, quota, snapshots, archivage, restauration, recherche, filtres, historique et routes.

**Contrôles Chrome :** Today et fiches communes inspectés à 320 × 844 ; création de projet, checklist persistante après rechargement et liaison tâche/projet vérifiées ; Explorer et changement de vue contrôlés. Today a aussi été contrôlé à 390 × 844 et 844 × 390, sans débordement horizontal constaté. Ces tests utilisent des cadres responsive, pas un iPhone physique : clavier natif, installation PWA et démarrage hors réseau restent à vérifier. Les exemples QA ne sont pas dans le dépôt.

Le détail de l’audit et l’ordre des prochaines implémentations figurent dans [docs/PERSONAL_OS_ROADMAP.md](docs/PERSONAL_OS_ROADMAP.md). Le catalogue des routes figure dans [docs/ROUTES.md](docs/ROUTES.md).

## Périmètre conservé de la livraison 2.2

Les vingt Life OS disposent maintenant de **48 types de fiches structurées**, de synthèses calculées et d’actions utilisables. Cette version étend le socle 2.1 déployé via la PR #10 ; elle conserve les données 2.x et les archives V6/V7. Les statuts ci-dessous décrivent le périmètre réellement implémenté, pas l’intégralité de la vision à long terme.

## Fonctionnalités des vingt espaces

| Life OS | Fonctions opérationnelles en 2.2 | Limites / suite possible |
|---|---|---|
| Finances | ✅ Comptes et mouvements affectés ; budgets mensuels par catégorie ; import CSV avec aperçu et détection des doublons ; flux sur six mois ; abonnements annualisés et avancement des échéances ; actifs, dettes et patrimoine net déclaré | 🟡 Pas de connexion bancaire, virements ou cours de marché ; patrimoine saisi séparément des comptes ; pas de prévisionnel de trésorerie |
| Projets de vie | ✅ Projets, priorité, budget et dépenses saisis ; jalons pondérés ; tâches liées et taux de réalisation | 🟡 Pas de Gantt ni de dépendances entre jalons |
| Apprentissage | ✅ Parcours, compétences, ressources, sessions minutées ; cartes avec réponse masquée et révision espacée selon difficulté | 🟡 Algorithme local simple, sans synchronisation de plateforme |
| Documents | ✅ Liens HTTP(S), emplacement, catégorie, version déclarée, expiration et démarches ; association aux projets | 🟡 Références de fichiers uniquement, sans stockage de pièces jointes ni OCR |
| Maison | ✅ Inventaire, pièces, achat et valorisation, garanties, factures référencées ; entretien récurrent, coût et prestataire | 🟡 Pas de commande de prestataire |
| Nutrition | ✅ Repas, calories, protéines, glucides, lipides, eau ; totaux quotidiens et objectifs datés ; recettes, portions et préparation | 🟡 Apports saisis manuellement, sans base d’aliments, scanner ou prescription |
| Santé avancée | ✅ Observations, intensité, contexte ; sommeil et moyenne sur sept jours ; rendez-vous et questions à préparer ; accès aux mesures et séances existantes | 🟡 Carnet descriptif sans diagnostic, traitement ou connexion à une montre |
| Relations | ✅ Contacts, coordonnées, anniversaires du mois ; échanges, fréquence de contact et relances | 🟡 Aucun message envoyé ni carnet d’adresses distant |
| Voyages | ✅ Voyages, dates, destinations ; réservations, adresses, horaires, annulations ; itinéraire chronologique ; budget restant ; préparatifs | 🟡 Aucun achat, carte ou connexion à une agence |
| Carrière | ✅ Candidatures par étape, salaire et relances ; réalisations et preuves ; écarts de compétences reliés aux formations | 🟡 Pas de candidature ou CV envoyé |
| Décisions | ✅ Décisions et options ; comparaison pondérée bénéfice/coût faible/risque faible ; classement ; choix et bilan lié | 🟡 Trois critères fixes, scores définis par l’utilisateur |
| Journal | ✅ Entrées datées, humeur, énergie, gratitude, victoires, enseignements, intention ; série et moyenne mensuelle | 🟡 Pas de photos ni d’analyse psychologique |
| Automatisations | ✅ Règles sur échéances OS, documents existants et tâches en retard ; aperçu puis création de tâches ; dédoublonnage par règle/source/échéance | 🟡 Exécution manuelle uniquement, sans moteur en arrière-plan ni notification push |
| Assistant | ✅ Plan du jour selon capacité, échéances, importance et durées estimées ; briefs ; note de bilan sur sept jours | 🟡 Calcul déterministe local, aucune IA conversationnelle connectée |
| Vie numérique | ✅ Registre des services, état MFA, revues d’accès, abonnements liés ; temps d’écran et limites saisies | 🟡 Aucune surveillance de l’appareil ni collecte automatique |
| Sécurité | ✅ Registre de risques, probabilité × impact, mesures de réduction ; sauvegardes et dates de test/restauration | 🟡 Registre uniquement, sans scan, coffre-fort ni stockage chiffré |
| Impact | ✅ Engagements et contributions reliées ; suivi quantitatif dans l’unité de chaque engagement | 🟡 Aucun facteur carbone estimé ni comparaison entre unités différentes |
| Foyer | ✅ Membres, tâches assignées et récurrentes ; charges en minutes ; dépenses à parts égales ; soldes au centime ; remboursements proposés et enregistrés | 🟡 Usage local sur un navigateur, pas de partage multi-utilisateur ; aucun virement exécuté |
| Progression | ✅ Indicateurs avec valeur initiale/cible ; historique daté ; progression croissante ou décroissante et atteinte des cibles | 🟡 Historique textuel, sans éditeur de graphiques |
| Équilibre | ✅ Satisfaction par domaine, dernières évaluations ; capacité, engagements, récupération et marge quotidienne | 🟡 Bilan déclaratif, sans évaluation médicale |

## Fonctions communes

- Ajout, édition, duplication, statut, notes et liens entre fiches via sélecteurs.
- Filtres par statut, recherche locale, tri chronologique, export CSV des résultats ; formules de tableur neutralisées.
- Recherche globale ouvrant les fiches OS ; création d’une tâche liée depuis une fiche, détection d’une action ouverte déjà liée.
- Retrait logique et récupération individuelle ; liens vers les éléments retirés conservés.
- Navigation directe `#life/<domaine>/<type>`, rechargement et retour navigateur.
- Date de référence pour les calculs journaliers et mensuels qui la nécessitent. Les vues d’inventaire et soldes cumulés restent sur l’ensemble des données actives.
- Captures libres, documents, équipements, séances et objectifs antérieurs accessibles dans leurs espaces. Aucun contenu ancien n’est transformé ou supprimé silencieusement.

## Architecture et données — base 2.2 préservée

- `src/core.ts` : schéma, imports/exports, recherche et repository local ; `src/os.ts` : catalogue typé des modèles, validation et calculs métier purs.
- `modules/os-ui.js` : vues, formulaires et interactions spécialisés ; `app.js` : application existante et points d’intégration. L’interface est du JavaScript vérifié par syntaxe et tests DOM ; le TypeScript strict couvre les règles et la persistance.
- Le build assemble `core.ts` + `os.ts` puis le module UI + l’application en deux scripts classiques à empreinte de contenu. Aucune dépendance supplémentaire ni CDN.
- Même clé `quotidien-rebuild-2`, schéma 2 enrichi de la collection `os`. Une sauvegarde 2.0/2.1 sans `os` reçoit une liste vide à la lecture, sans écriture automatique. Les champs inconnus existants restent préservés.
- Validation avant sauvegarde/import : champs, bornes, dates, URL HTTP(S), identifiants uniques, références typées et cohérence décision/option.
- Copie précédente, checkpoint avant restauration, erreur de quota visible, brouillon conservé et refus d’écrasement depuis un onglet devenu obsolète.
- Stockage local au navigateur, non chiffré et limité en capacité. Un export externe reste nécessaire pour sauvegarder hors de l’appareil. Pas de synchronisation serveur.
- Les archives `legacy/v7/` et les branches historiques restent intactes, hors compilation et publication. Les formats V5/V6/V7 nécessitent toujours une migration dédiée.

## Vérifications de référence — 2.2

- `npm run verify` : formatage, syntaxe des deux fichiers UI, TypeScript strict, build et **44 tests réussis**.
- Parcours DOM pour les 48 modèles des 20 domaines : création, sauvegarde, réouverture et modification ; rechargement d’un état complet ; recherche, retrait, récupération, quota et reprise de saisie.
- Règles testées : jalons pondérés, classement des décisions, progression décroissante, répartition et remboursement au centime, révision espacée, dates récurrentes dont fin de mois, plan sous contrainte de durée, parsing CSV et rejet des imports incohérents, dédoublonnage des automatisations.
- Chrome réel : création de projet, budget restant calculé, données conservées après rechargement, jalon lié terminé et progression à 100 %.
- Aperçu Chrome 390 × 844 : navigation et rendu des Life OS inspectés. Ce viewport n’est pas un appareil physique ; installation PWA, clavier Android/iOS, synchronisation et démarrage hors ligne ne sont pas validés.
- Seuls des exemples synthétiques ont été saisis dans l’aperçu ; ils ne font pas partie de la distribution.

## Publication

Le workflow existant vérifie le code sur `main`, construit uniquement `dist/` et pousse un commit normal vers `gh-pages`, sans force-push. GitHub Pages reste configuré depuis cette branche. Les ressources précédentes à empreinte sont conservées. Aucun nouveau service worker ni changement de plateforme.

## Dette et prochaines évolutions

- Harmoniser progressivement les anciens registres et fiches spécialisées avec des conversions explicites et réversibles ; ne pas migrer les contenus libres en devinant leur sens.
- Ajouter pièces jointes, recherche de contenu de fichiers et stockage transactionnel plus volumineux.
- Approfondir les vues de calendrier et kanban, les programmes sportifs et le suivi tennis/musculation de l’archive.
- Introduire une synchronisation et un partage authentifiés avant tout usage réellement collaboratif.
- Ajouter des critères de décision personnalisables, une base d’aliments et des graphiques historiques, sans présenter ces fonctions comme déjà livrées.
- Les listes ne sont pas virtualisées. La concurrence exacte entre onglets reste une limite du repository localStorage.
