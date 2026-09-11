# Quotidien 3.0

Application personnelle locale : organisation quotidienne et **20 Life OS spécialisés, 48 types de fiches**.

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

Les notes de Focus nécessitent un enregistrement explicite. Les brouillons couvrent les formulaires de fiches, pas tous les contrôles de l’application. Il n’y a ni synchronisation, ni OCR, ni service d’exécution en arrière-plan, ni notification système. Les fichiers du coffre restent sur cet appareil et ne sont pas inclus dans l’export JSON. Le lien public ci-dessous ne change de version qu’après fusion et publication.

[Ouvrir l’application](https://pivot-consulting.github.io/Quotidien/)

Dans **Life OS**, choisis un domaine puis une section : comptes, budgets, jalons, sessions d’apprentissage, repas, contacts, réservations, etc. Les synthèses se recalculent à partir des données saisies. Les fiches peuvent être recherchées, liées, dupliquées, exportées et retirées sans suppression définitive.

## Socle Personal OS

La recherche (loupe ou Ctrl/Cmd+K) ouvre **Explorer** : filtres transversaux, favoris, archives, liste, Kanban de consultation et chronologie. Tu peux nommer tes recherches et retrouver les recherches récemment soumises.

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

Les automatisations actives sont évaluées de façon idempotente à l’ouverture de l’application, lors de leur enregistrement ou sur lancement manuel. L’assistant calcule un plan local et des bilans ; il n’est pas connecté à une IA. Aucune synchronisation distante, opération bancaire ou notification en arrière-plan.

## Sources et déploiement

- `app.js`, `app.css` : interface principale.
- `modules/os-ui.js` : espaces Life OS.
- `src/core.ts`, `src/os.ts` : persistance, modèles et règles métier.
- `src/personal.ts`, `modules/personal-ui.js` : socle commun, relations, historique, recherche et Today.
- `src/planning.ts`, `src/intelligence.ts`, `modules/cockpit-ui.js` : projections calendrier et analyseurs locaux.
- `src/routines.ts`, `modules/routines-ui.js` : planification, exécutions et historique des routines.
- `src/vault.ts`, `modules/vault-ui.js` : coffre documentaire, métadonnées et fichiers locaux séparés.
- `src/automation.ts`, `modules/automation-ui.js` : règles, notifications et journal d’exécution.
- `scripts/sources.cjs` : manifeste de chargement partagé entre build et tests.
- `legacy/v7/` : archive historique hors build.

Après fusion dans `main`, le workflow teste, compile et avance `gh-pages` sans réécriture d’historique. GitHub Pages publie depuis cette branche, racine `/`. Les anciens fichiers à empreinte restent disponibles pour les clients encore sur une page précédente.

Voir [PROJECT_STATUS.md](PROJECT_STATUS.md) pour les fonctionnalités et limites exactes.
