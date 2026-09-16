# Reprise QUOTIDIEN — référence 3.1

## Base et périmètre

Audit du 14 septembre 2026 : `main` 6d97b34 (3.0), publié sur `gh-pages` 206ea9d. Les PR #10–#14 sont fusionnées. Les 20 OS, 48 modèles, calendrier, analyseurs, relations, Focus, routines, coffre et Automation Builder sont conservés.

Les branches feat/life-os-specialises, feat/personal-os-foundations, feat/reliability-connected-life et feat/routines-vault-automation sont déjà intégrées. Les anciennes branches V6/V7 et clean-reset-source divergent : récupération ciblée seulement, jamais une fusion globale de remise à zéro. `gh-pages` contient les fichiers compilés ; le travail part de `main`.

## Lots de cette version

| Lot | Résultat | Preuve / validation |
|---|---|---|
| A — Référence | Documentation courante séparée de l’historique, catalogue des routes complété, version de publication issue du package | package/core/build cohérents ; compilation et workflow |
| B — Automatisations | Reçus persistants indépendants des 500 logs, reprise des jetons disponibles, exclusion des tâches générées et archives | 1 001 événements, relances, export/import, boucles et migration testés |
| C — Sauvegarde | Format 2 autonome avec données et blobs référencés par les fiches et leurs révisions ; vérification SHA-256 | Restauration sur base vierge, corruption/manque/doublon refusés, panne transactionnelle et onglet obsolète sans mutation |
| D — Navigation | Liens de fiche, fermeture vers Explorer, statuts Kanban éditables, filtres/vues persistants | Parcours DOM : identifiants encodés, référence inconnue, dépendances, changement de statut et rechargement |

Un blocage Kanban est calculé à partir des relations, jamais modifié comme un statut indépendant. Les modèles sans champ de statut restent consultables et modifiables via leur formulaire. Les liens directs n’effectuent aucun partage de données.

## Sauvegarde et compatibilité

- Format 1 : données seules, compatible avec les anciens exports. Format 2 : données et fichiers, contrôle d’intégrité avant aperçu puis confirmation utilisateur.
- Fichiers de 25 Mo maximum ; total de pièces 100 Mo ; archive importée/exportée 160 Mo maximum. La construction est en mémoire : un appareil limité peut nécessiter des téléchargements séparés.
- La restauration utilise de nouveaux identifiants de blobs : les fichiers antérieurs et les checkpoints restent lisibles. Données, checkpoint et fichiers importés sont écrits dans une transaction unique.
- Une pièce remplacée reste conservée. Aucun ramasse-miettes automatique : un futur nettoyage devra tenir compte des révisions ET des snapshots de récupération.
- Les pièces déjà supprimées en 3.0 ne sont pas récupérables par cette mise à jour. Un export complet incomplet est refusé avec la référence du fichier ; l’export des données seules reste possible.
- L’export représente l’état courant chargé et son historique de fiches, pas tous les snapshots locaux antérieurs. Les brouillons de formulaires disposent de leur export distinct.
- Le SHA-256 détecte la corruption ; il ne chiffre pas les données et n’authentifie pas l’auteur d’une archive.
- Les jetons déjà éliminés du journal 3.0 et absents des tâches ne sont pas recréés. Les reçus durables prennent de l’espace ; leur future compaction devra préserver le dédoublonnage.

## Suite priorisée, sans doublons

| Ordre | Lot | Dépendances | Critère de sortie |
|---|---|---|---|
| 1 | E — sous-tâches, champs typés, responsables liés, conversions des anciens registres | C + D | Aperçu et retour arrière ; identifiants/relations conservés ; aucun doublon |
| 2 | F — prévisionnel Finance/Projet/Décision et critères configurables | E | Réel/prévisionnel séparés, aucun double comptage, scénarios isolés |
| 3 | G1 — Admin/Maison/Sécurité/Digital | E + C | Parcours achat → document → garantie → entretien cohérent |
| 4 | G2 — Nutrition/Santé/Foyer/Impact | E | Menus → courses → stocks ; programmes sportifs ; unités et répartition fiables |
| 5 | G3 — Learning/Career/Relations/Travel | E ; F pour budgets | Compétences/révisions et préparatifs/relances reliés |
| 6 | G4 — Journal/Game/Balance | E | Périodes de vie et chronologie, graphiques explicables, gamification optionnelle |
| 7 | H — intelligence/routines avancées | B + E + F | Scores sourcés, données insuffisantes visibles, récurrence mensuelle correcte |
| 8 | I — Command Center | E + services métier | Aperçu des écritures ambiguës, validations partagées et annulation |
| 9 | J — synchronisation/intégrations | C + E ; choix d’architecture | Deux appareils convergent, conflits/suppressions traités, permissions révocables |
| 10 | K — agents spécialisés | H + I ; J pour distant | Droits par domaine, propositions traçables, actions contrôlées |

Les phases 1–4 sont partiellement réalisées ; la version produit 3.1 ne signifie pas que la phase 3 est achevée. Command Center, agents, OCR, authentification, sync et exécution distante ne sont pas annoncés comme disponibles.

## Publication et retour arrière

Le workflow de PR exécute `npm run verify`. La fusion sur main déclenche vérification, compilation et publication sur gh-pages ; les ressources anciennes à empreinte sont conservées. La version publiée est contrôlée via `dist/version.json` et le statut Pages.

Cette évolution est additive sur le schéma 2 / IndexedDB v2. Un retour à l’ancienne application doit être précédé d’une sauvegarde complète ; la 3.0 peut ignorer les reçus durables et supprimer des fichiers remplacés. Préférer un correctif en avant à un retour aveugle du code, sans effacer le stockage du navigateur.

## Validation du 16 septembre 2026

`npm run verify` : 122 tests réussis. Parcours Chromium réel validés : création d’une tâche au premier clic, Kanban, lien direct et rechargement, deux versions de pièce, export/import sur navigateur vierge et téléchargement de la pièce restaurée. Les 4 écrans Today/Explorer/Vault/Automation ont été mesurés à 320, 390 et 844 px, sans débordement. Aucune erreur JavaScript relevée. Vérification visuelle Explorer à 390 px. Ces cadres ne remplacent pas une recette sur iPhone/Android physique, clavier natif ou PWA hors réseau.
