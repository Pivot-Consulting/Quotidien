# QUOTIDIEN — audit et exécution progressive

Audit du 9 septembre 2026, base `main` au commit `1e65395` (2.2, PR #11 fusionnée). Travail sur `feat/personal-os-foundations`. Ce document distingue la première livraison du programme demandé à terme.

## Audit de la base

Le dépôt contient une application 2.2 active et une archive V7. Seuls les fichiers actifs, `public/` et `scripts/build.cjs` contribuent à `dist/`. Le catalogue, les validateurs et les calculs des 20 OS ont été inspectés, ainsi que le routage, les événements UI, les formulaires, le dépôt de données, les imports/exports, les styles responsive, les tests et les workflows. Les manifestes et points d’entrée de l’archive ont été comparés au périmètre actif ; ses sources ne sont pas réintégrées sans migration dédiée.

- `app.js` orchestre six écrans historiques et les formulaires des 13 registres antérieurs. C’est encore un gros fichier ; le réduire par extraction progressive est préférable à une nouvelle réécriture.
- `src/os.ts` définit 48 modèles et des calculs purs : finances, jalons, révisions, décisions, remboursements, règles et plan du jour.
- `modules/os-ui.js` génère dashboards, listes, filtres, formulaires et actions spécialisés. Ses formulaires pilotés par modèle constituent une base réutilisable.
- `src/core.ts` normalise les données, préserve les champs inconnus, garde la même clé locale et refuse les écritures depuis un onglet obsolète. Copies précédentes et checkpoints d’import sont déjà présents.
- Les routes utilisent le fragment URL, compatible avec GitHub Pages et les liens profonds de sections. Le build produit deux scripts classiques et une feuille CSS avec empreintes : cette stratégie de démarrage mobile est conservée.
- Les styles disposent déjà de thèmes, 44 px tactiles, navigation inférieure/latérale, safe areas et modales scrollables. Pas de nouveau framework ni de CDN.
- La référence avant modification est `npm run verify` : **44 tests passants**.

## Lacunes et risques identifiés

| Sujet | Constat | Traitement |
|---|---|---|
| Relations | Références typées limitées à certains OS, impossibilité de lier librement deux collections | Adresses `{key,id}`, relations globales et adaptateur des liens métier en 2.3 |
| Recherche | JSON brut, résultats sur des identifiants, pas de filtres globaux ni vues réutilisables | Recherche sur les champs utilisateur, mots/accent, filtres et trois vues en 2.3 |
| Objets | Tags et capacités hétérogènes selon les formulaires | Extension additive `personal`, intégrée aux formulaires existants |
| Traçabilité | Dates de modification partielles, aucune révision par fiche | Historique des commits de données, comparaison et restauration explicite |
| Navigation | Ancien filtre conservé lors d’un changement de domaine par l’URL | Validation domaine/type et remise à zéro des filtres hors contexte |
| Today | Priorités fondées sur deux booléens, sans explication ni dépendance | Classement expliqué ; blocages reliés au plan de l’Assistant |
| Mobile | Risque de quatre colonnes sur les transactions et d’accès clavier aux champs repliés | Montant sous le libellé en étroit, exclusion des champs masqués du piège de focus |
| Archives | Les données V6/V7 ne sont pas compatibles avec l’import 2.x | Archive préservée, import refusé explicitement ; migration dédiée future |
| PWA | Worker historique retiré pour éviter les anciens blocages de cache | Stratégie préservée ; démarrage sans réseau non garanti |
| Données | LocalStorage synchrone, quota, historique pouvant grossir | Historique borné, échec visible ; stockage transactionnel à traiter avant les pièces jointes |
| Intelligence | Pas d’IA connectée ni de données externes | Aucun score ni agent factice ; règles locales explicitement expliquées |

Les fonctions détaillées, calculs et limites de chaque OS sont conservés dans `PROJECT_STATUS.md`. Les routes et types réels figurent dans `docs/ROUTES.md`.

## Première livraison — 2.3, fondations transversales

- Aucun changement d’identifiant, de clé de stockage ou de sens des anciens champs. Aucun enrichissement ni écriture lors d’une simple lecture d’une sauvegarde 2.2.
- `personal` rassemble tags, description, priorité 1–5, énergie, contexte, durée prévue, responsable textuel, lieu, favori, archivage et checklist. Les tags historiques restent recherchables. Les tâches conservent un seul champ visible de durée estimée.
- `connections` relie n’importe quels objets par « lié à », « dépend de », « contribue à ». Validation des références, doublons, auto-liens et cycles de dépendance. Les liens d’anciens modèles apparaissent dans les deux sens sans modification des données.
- Les liens métier existants se modifient dans leurs champs d’origine. Les relations globales sont retirées logiquement, sans effacer leurs extrémités. L’archivage ne rend pas une dépendance terminée.
- `activity` capture avant/après pour les mutations de fiches (création, modification, checklist, statut, retrait, archivage). Jusqu’à 10 révisions par objet et 300 au total. Restaurer une version crée une révision de l’état remplacé. Les relations ne font pas encore l’objet de révisions restaurables.
- Explorer (`#explore`) : filtres type/OS/état/échéance/période/tag/favoris/archives ; liste, Kanban de consultation, chronologie ; recherches nommées ; historique des 10 dernières recherches soumises, effaçable.
- Today : top 3 expliqué, score déterministe, exclusion des actions bloquées, accès direct checklist/relations, terminer/retirer, échéances globales, favoris. Le score utilise échéance, urgence, importance, priorité, durée courte et relation projet/objectif. Énergie, difficulté, risques et contexte ne modifient pas encore le score.
- Capture étendue : tâche, événement, transaction, note, séance, habitude, objectif, routine, document, idée, projet, contact, journal et voyage.

L’archivage est un classement : les listes opérationnelles et Explorer le masquent par défaut, les bilans métier continuent d’utiliser les montants historiques non retirés. Les règles archivées et les sources archivées ne génèrent pas de nouvelles actions. Les exports incluent les métadonnées, liens et révisions. L’application reste locale, sans compte ni synchronisation : un test de reconnexion à un serveur ne serait pas pertinent pour cette version.

## Deuxième livraison — 2.4, cohérence et projections communes

Reprise des sources actives, des 20 dashboards et des parcours des 48 modèles ; référence initiale : 61 tests passants. Corrections : duplication différente entre Explorer et OS, archives proposées comme actions actives, durée commune ignorée par le plan, fermeture/navigation pouvant perdre les modifications d’une fiche et route non restaurée après retour bfcache. Les bilans historiques continuent d’inclure les écritures archivées.

Le calendrier partagé et le centre d’analyse sont des projections des mêmes objets. Sept analyseurs purs exposent leurs sources et hypothèses. Le suivi des constats est une extension additive `insightDecisions`, validée à l’import et à la sauvegarde. L’acceptation relie une seule tâche ; l’identifiant de génération assure son dédoublonnage après réexamen. Les filtres sont consultatifs ; les choix de suivi sont persistés.

Ce lot ne réactive pas V7, ne modifie pas la clé de stockage et ne migre pas la plateforme. 74 tests couvrent les parcours antérieurs et ces règles. Les limites exactes figurent dans `PROJECT_STATUS.md`. Pour les prochains lots ci-dessous, le calendrier et le registre d’analyseurs sont désormais des bases existantes à enrichir, pas à recréer.

## Programme des prochaines livraisons

Chaque lot : analyse ciblée → règles pures → UI réutilisable → migration additive ou explicite → tests du risque réel → build → commit/PR. Ne pas annoncer les étapes suivantes comme déjà implémentées.

1. **Terminer les fondations** : liens profonds de fiches, calendrier partagé, actions Kanban, champs personnalisés typés, commentaires, sous-tâches, responsables liés aux contacts, vues et paramètres par OS. Extraire les composants de `app.js` et `os-ui.js` au fil des changements. Migrer vers un dépôt transactionnel avec sauvegarde et reprise avant d’ajouter les fichiers.
2. **Approfondir les 20 Core OS**, par groupes dépendants :
   - Finance/Projects/Decision : écritures comptées une seule fois, dépenses liées aux projets, objectifs monétaires, dette et cash-flow, budgets prévisionnels, critères de décision configurables, scénarios comparables.
   - Admin/Home/Safety/Digital : coffre de fichiers avec stockage adapté, aperçu, expiration, garanties, procédures de sauvegarde, registres de services et revues. OCR via adaptateur explicite ultérieur, aucune extraction prétendument disponible sans moteur.
   - Nutrition/Health/Household/Eco : menus et courses, stock, programmes sportifs et historiques, répartitions par membre, unités cohérentes. Séparer observations et recommandations non médicales.
   - Learning/Career/Relationships/Travel : objectifs de compétences, plan de révision, pipeline, relances, événements, itinéraires et budgets liés.
   - Journal/Game/Balance : périodes de vie, souvenirs, timeline multidomaine, progression et gamification optionnelle, roue des domaines avec données explicables.
3. **Intelligence** : registre d’analyseurs purs produisant constats sourcés, seuils réglables et identifiants stables ; accepter/ignorer/reporter ; Next Best Action complet et Life Scores fondés sur les données disponibles ; aucune valeur inventée pour un domaine vide. Scénarios isolés du réel, hypothèses explicites et comparaison côte à côte.
4. **Automatisation** : événements métier, déclencheur/conditions/actions, journal d’exécution, dédoublonnage, routines et centre de notifications. Programmation effective seulement avec un exécutant disponible ; distinguer exécution en application ouverte et arrière-plan.
5. **Command Center** : parseur d’intentions extensible, aperçu des écritures ambiguës, création/recherche/navigation sur le même service métier. Moteur local d’abord ; fournisseur de langage optionnel et consentement explicite avant envoi de données personnelles.
6. **Agents spécialisés** : registre de capacités partageant les analyseurs, accès limité aux domaines concernés, explications et propositions d’action utilisant les mêmes workflows. Pas de faux chat ni de promesse de surveillance hors ligne.
7. **Écosystème** : authentification et synchronisation robustes avant partage ; API versionnée, contrats d’adaptateurs, webhooks signés, permissions par intégration et widgets tiers. Les connecteurs de ChatGPT ne constituent pas les connexions des utilisateurs de QUOTIDIEN.

## Sécurité et compatibilité

- Le repository constitue la seule frontière d’écriture. Validation avant sauvegarde, rollback UI et conservation des formulaires en cas de quota. Échec d’import sans mutation du jeu de données courant.
- Aucun serveur ou secret ajouté ; pas de chiffrement prétendu ni de section « sécurisée » visuelle sans protection réelle.
- Archives V7 et branches historiques intactes. Aucun force-push ni changement de plateforme. La fusion dans `main` déclencherait le workflow de publication existant ; cette PR ne fusionne pas automatiquement.
- Une restauration globale garde le checkpoint dédié et restaure l’historique contenu dans la sauvegarde. Elle ne fabrique pas des centaines de révisions de migration.
- Limites conservées : concurrence localStorage non transactionnelle, quota navigateur, usage mono-appareil, pas d’authentification, pas de pièces jointes/OCR, pas de routine en arrière-plan, pas de LLM.
