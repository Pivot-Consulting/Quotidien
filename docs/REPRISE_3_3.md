# Reprise 3.3 — approfondissements G2/H

Base : 3.2 publiée, commit 443779e. Les fonctionnalités E–K déjà livrées sont conservées. Aucun serveur distant n’est activé par cette version.

## Foyer : répartition pondérée

Dans une dépense partagée, cocher les participants. Laisser les poids vides conserve le partage égal. Pour pondérer, saisir un poids positif pour chacun des participants cochés : 2 et 1 attribuent respectivement deux tiers et un tiers.

Les montants sont calculés en centimes, arrondis par la méthode des plus grands restes. Les égalités suivent l’ordre des participants, comme le partage égal antérieur. La somme des parts égale le montant initial. Les soldes et propositions de remboursement réutilisent ces parts. Les poids incomplets, négatifs, dupliqués ou attribués à une personne non participante bloquent l’enregistrement. Les poids ne sont pas des pourcentages et n’ont pas à totaliser 100.

## Sport : exercices et séries

Créer un exercice lié à un programme : séries et répétitions prévues, charge indicative et repos. Créer une séance de ce programme puis une série réalisée : exercice, numéro de série, répétitions, charge et durée.

La séance et l’exercice doivent appartenir au même programme. Un numéro de série ne peut apparaître deux fois pour le même exercice dans la même séance. Retirer une série permet de corriger ce numéro. Le centre de pilotage affiche les douze dernières séries de chaque exercice ; toutes les séries restent dans Life OS et dans les sauvegardes. Les objectifs sont saisis par l’utilisateur ; aucune prescription sportive n’est générée. Une modification ultérieure de l’objectif ne réécrit pas les séries réalisées.

## Dix scores composites

Chaque composante renseignée est ramenée sur 100, plafonnée entre 0 et 100, puis arrondie. Le score est la moyenne arrondie de ces composantes, à poids égaux. Une composante inconnue est exclue du calcul ; si toutes sont absentes, le score reste « données insuffisantes ». La couverture affichée et les sources permettent de distinguer un score partiel d’un score complet. Ces indices décrivent les données saisies ; ils ne mesurent ni la valeur d’une personne, ni sa santé, ni toute sa situation réelle.

| Score | Composante factuelle | Ressenti éventuel |
|---|---|---|
| Finances | Budgets du mois avec mouvements enregistrés : 100 si dépenses ≤ plafond, sinon plafond/dépenses × 100 | Finances |
| Projets | Poids des jalons terminés / poids de tous les jalons actifs | Travail |
| Apprentissage | Avancement moyen saisi des cours actifs | Apprentissage |
| Activité physique | Séances des 7 derniers jours / séances hebdomadaires prévues ; absence de séances = inconnu | Santé |
| Relations | Contacts datés encore dans leur cadence choisie / contacts datés | Relations |
| Administration | Documents du coffre non expirés / documents avec expiration renseignée | — |
| Foyer | Tâches du foyer terminées / tâches à échéance dans les 30 derniers jours | Foyer |
| Vie numérique | MFA activée / services où MFA est déclarée activée ou désactivée | — |
| Impact | Moyenne des contributions/cibles des engagements renseignés, chacun dans sa propre unité | Sens |
| Équilibre | Énergie moyenne déclarée sur 30 jours | Loisirs |

Le ressenti correspond aux auto-évaluations des 30 derniers jours, multipliées par dix. Les données futures sont exclues des composantes datées. Projets, cours, MFA et engagements décrivent l’état enregistré actuel : ces scores ne reconstituent pas un état historique. Un zéro explicitement saisi demeure zéro ; une absence ne devient pas zéro. Pour les tâches récurrentes du foyer, seule l’occurrence courante existe dans ce calcul. Les scores partiels ne sont pas directement comparables.

## Validation et limites de livraison

143 tests passants : conservation des parts égales, répartitions au centime sur 500 montants, soldes et remboursements pondérés, refus des poids incohérents, séries uniques et appartenant au bon programme, dix scores sans données inventées, exclusion des dates futures, unités d’impact séparées, aperçu et réouverture du formulaire. Le parcours DOM existant couvre désormais la création et la réouverture des 62 types de fiches. TypeScript strict, lint et build inclus dans `npm run verify`.

La 3.3 est nécessaire sur tous les appareils pour ouvrir les deux nouveaux modèles sportifs et interpréter correctement les dépenses pondérées. Une ancienne application ignore les poids et afficherait un partage égal. Les sauvegardes antérieures restent compatibles à l’import ; un retour à une ancienne application nécessite de préserver une sauvegarde complète.

Restent ouverts : hébergement et activation de la synchronisation, ordonnanceur et notifications distantes, agents distants, OCR, conversions supplémentaires et fusion fine des conflits. Ces éléments ne sont pas annoncés comme terminés. Aucun service Cloudflare n’a été utilisé.
