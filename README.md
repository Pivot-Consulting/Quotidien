# Quotidien 3.2

Application personnelle locale : organisation quotidienne et **20 Life OS spécialisés, 60 types de fiches**.

## Nouveautés 3.2 — parcours E–K

Accès : **Pilotage → Centre de pilotage** (`#workbench`).

- Propriétés communes : sous-tâches, contact responsable, champs typés et brouillons restaurables ; conversions explicites équipement→Maison et objectif→Projet, réversibles avec source conservée.
- Parcours métier : échéanciers au centime et règlements sans double comptage, scénarios distincts du réel, décisions multicritères, liens vers le coffre, menus→courses→stock, programmes tennis/musculation, compétences→cours, contacts→candidatures et dépenses de voyage.
- Bilan : seuils d’analyse, scores expliqués sur les huit domaines d’auto-évaluation existants, historique des résultats, revue mensuelle et intervalles, périodes de vie et chronologie, courbe d’humeur, points optionnels.
- Command Center local : `tâche`, `note`, `chercher`, `planifier`, aperçu avant écriture et annulation protégée. Syntaxe explicite ; aucune IA externe.
- Agents locaux par domaine : autorisation de lecture, propositions issues des analyseurs, validation avant création de tâche, journal et annulation.
- Client de synchronisation et [service privé Node](server/README.md) : identités par jetons expirants, droits par espace, pièces jointes et révisions atomiques. **Le service serveur n’est pas déployé.** Sans serveur, l’application reste locale. Exécution distante, push, OCR et agents autonomes restent à réaliser.

Périmètre précis, dépendances et limites : [docs/REPRISE_3_2.md](docs/REPRISE_3_2.md). Les lots A–D ne sont pas reconstruits.

## Nouveautés 3.1 — reprise A–D

- **Sauvegarde complète** dans Réglages : données et pièces jointes, y compris les anciennes pièces encore référencées par l’historique. Intégrité SHA-256 contrôlée avant restauration ; fichiers et données restaurés dans une même transaction IndexedDB, avec checkpoint de l’état précédent. Les anciens fichiers sont conservés lors d’un remplacement.
- **Automatisations fiabilisées** : reçus de dédoublonnage indépendants du journal de 500 entrées ; tâches générées exclues du déclencheur « tâche en retard » ; règles et dépenses archivées ignorées.
- **Navigation** : liens directs `#record/<collection>/<identifiant encodé>` dans les fiches, réouverture après rechargement et erreur explicite si absentes sur cet appareil.
- **Explorer** : vue et filtres persistants ; changement de statut des tâches et modèles OS compatibles depuis le Kanban, utilisable au clavier et au tactile. Les dépendances bloquent le passage à « Terminé ».

La sauvegarde complète est un fichier JSON autonome limité à **100 Mo de pièces** (25 Mo par fichier), avec une limite d’import de 160 Mo. Elle nécessite HTTPS/localhost pour l’intégrité. L’export historique « données seules » reste compatible mais n’inclut aucun fichier. Une pièce déjà perdue avant 3.1 ne peut pas être recréée : l’export complet indique alors la référence manquante. Les liens directs n’envoient aucune donnée et nécessitent la présence de la fiche dans le navigateur de destination.

## Nouveautés 2.8–3.0

- **Today personnalisable** : widgets activables, échéances, recommandations, routines et alertes sur un même cockpit. Les modèles Morning Routine, Evening Review et Sunday Reset créent des checklists quotidiennes historisées.
- **Document Vault** : métadonnées, recherche, catégories, statut, échéance, société, montant, tags, relation projet et aperçu local des PDF/images. Les fichiers sont stockés séparément dans IndexedDB, avec une limite de 25 Mo par fichier.
- **Automation Builder** : déclencheurs sur tâches en retard, documents à renouveler, dépenses importantes, projets stagnants, voyages et revue du dimanche ; conditions de délai, montant et catégorie ; notifications, tâches et checklists comme actions cumulables.
- **Notification Center** : priorité, lecture, filtres, report à demain ou sept jours, ouverture de la source et préférences d’horaires silencieux pour les futures notifications système.

## Socle 2.5–2.7 conservé

- Stockage IndexedDB transactionnel, migration conservant le localStorage original et les snapshots ; refus d’écraser une version modifiée dans un autre onglet. Compatibilité localStorage seulement si aucune migration n’a eu lieu.
- Reprise de la dernière saisie dans Réglages, export du brouillon et rappel d’export après 30 jours. La reprise est bloquée si les données ont changé entre-temps : récupérer alors le contenu via l’export du brouillon. Ne pas revenir à une ancienne version du site après migration sans exporter les deux copies.
- Projets : choix explicite entre dépenses manuelles et transactions liées. Objectifs : solde de compte réservé, cible monétaire, durée simulée à versements constants. Les remboursements de projet sont déduits ; les écritures archivées restent comptées. Un seul objectif actif par compte.
- Today : contexte, temps et énergie ajustent les recommandations ; Focus avec pause/reprise, notes et checklist ; bilans du soir et des sept derniers jours préparés comme notes à valider. Le minuteur utilise le temps écoulé, plafonné à la durée prévue ; il ne prouve pas une attention réelle et ne termine pas la tâche automatiquement.

Les notes de Focus nécessitent un enregistrement explicite. Les brouillons couvrent les formulaires de fiches, pas tous les contrôles de l’application. La synchronisation manuelle nécessite le serveur privé de la version 3.2. Il n’y a pas d’OCR, d’exécution distante en arrière-plan ni de notification système. Les fichiers du coffre restent sur cet appareil et sont inclus uniquement dans la sauvegarde complète. Le lien public ci-dessous ne change de version qu’après fusion et publication.

[Ouvrir l’application](https://pivot-consulting.github.io/Quotidien/)

Dans **Life OS**, choisis un domaine puis une section : comptes, budgets, jalons, sessions d’apprentissage, repas, contacts, réservations, etc. Les synthèses se recalculent à partir des données saisies. Les fiches peuvent être recherchées, liées, dupliquées, exportées et retirées sans suppression définitive.

## Socle Personal OS

La recherche (loupe ou Ctrl/Cmd+K) ouvre **Explorer** : filtres transversaux, favoris, archives, liste, Kanban avec statuts modifiables et chronologie. Tu peux nommer tes recherches et retrouver les recherches récemment soumises.

Dans une fiche, ouvre **Propriétés avancées** pour les tags communs, la priorité, le contexte et la checklist. Enregistre puis ouvre **Relations, checklist et historique** pour relier d’autres objets, archiver, dupliquer ou restaurer une révision. Le lien « Dépend de » exclut une tâche bloquée des prochaines actions.

**Today** propose trois actions expliquées et des accès aux échéances des différents OS. Ce classement repose sur des règles locales. L’audit et le plan d’évolution se trouvent dans [docs/PERSONAL_OS_ROADMAP.md](docs/PERSONAL_OS_ROADMAP.md).

## Calendrier et centre d’analyse

Dans **Planifier → Calendrier**, retrouve les événements, voyages sur plusieurs jours, séances et échéances des OS, y compris résiliations et garanties. Sélectionne un jour pour ouvrir ses fiches ou ajouter un événement à cette date. Les filtres permettent de choisir un OS et d’inclure les éléments terminés. Les mesures et transactions ne deviennent pas des échéances.

Depuis Today ou Pilotage, le **Centre d’analyse** (`#intelligence`) expose retards, dépassements de budget, contacts à reprendre, projets sans progression enregistrée depuis 30 jours, surcharge, conflits horaires et doublons possibles. Chaque constat explique son calcul et donne accès aux fiches sources. Accepter crée une seule tâche de suivi reliée aux sources, ou suit la tâche existante ; ignorer, reporter 7 jours et réexaminer sont enregistrés dans les sauvegardes. Aucune notification en arrière-plan.

Les fiches modifiées sont protégées contre une fermeture accidentelle : continue la saisie ou abandonne-la explicitement. Cette protection ne remplace pas l’enregistrement, notamment si le système ferme le navigateur mobile.

## Développement

Node.js 22 ou 24.

```sh
npm ci --ignore-scripts
npm run verify
npm run dev
```

Serveur local : port 4173. Production : `dist/` uniquement.
`npm run verify` contrôle le formatage, la syntaxe UI, le TypeScript strict, les tests DOM/métier et le build.

## Données

Les données restent dans le navigateur, sous `quotidien-rebuild-2`. Les exports 2.0/2.1/2.2/2.3 sont compatibles ; les captures et registres existants sont conservés. Réglages propose sauvegarde JSON, restauration avec aperçu, copies de récupération et éléments retirés. Exporte régulièrement une copie hors de ton appareil.

Les automatisations actives sont évaluées de façon idempotente à l’ouverture de l’application, lors de leur enregistrement ou sur lancement manuel. L’assistant calcule un plan local et des bilans ; il n’est pas connecté à une IA. La synchronisation est facultative et manuelle, avec serveur privé. Aucune opération bancaire ni notification en arrière-plan.

## Sources et déploiement

- `app.js`, `app.css` : interface principale.
- `modules/os-ui.js` : espaces Life OS.
- `src/core.ts`, `src/os.ts` : persistance, modèles et règles métier.
- `src/personal.ts`, `modules/personal-ui.js` : socle commun, relations, historique, recherche et Today.
- `src/planning.ts`, `src/intelligence.ts`, `modules/cockpit-ui.js` : projections calendrier et analyseurs locaux.
- `src/routines.ts`, `modules/routines-ui.js` : planification, exécutions et historique des routines.
- `src/vault.ts`, `modules/vault-ui.js` : coffre documentaire, métadonnées et fichiers locaux séparés.
- `src/backup.ts` : sauvegarde complète, intégrité et préparation de restauration.
- `src/automation.ts`, `modules/automation-ui.js` : règles, notifications et journal d’exécution.
- `scripts/sources.cjs` : manifeste de chargement partagé entre build et tests.
- `legacy/v7/` : archive historique hors build.

Après fusion dans `main`, le workflow teste, compile et avance `gh-pages` sans réécriture d’historique. GitHub Pages publie depuis cette branche, racine `/`. Les anciens fichiers à empreinte restent disponibles pour les clients encore sur une page précédente.

Voir [PROJECT_STATUS.md](PROJECT_STATUS.md) pour les fonctionnalités et limites exactes.
