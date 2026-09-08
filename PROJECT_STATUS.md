# Quotidien — état du projet au 8 septembre 2026

## Livraison actuelle

**2.1.0 : vagues 0 et 1, avec les fondations nécessaires de la vague 2.**
Base réelle : reconstruction 2.0 de `gh-pages` au commit `8cbfd84`.
Le code et les corrections sont préparés sur `fix/stabilisation-quotidien-2`.
La fusion et le déploiement de cette branche ne sont pas effectués par cette mission.
Les vingt modules spécialisés de la vision produit ne sont pas déclarés terminés.

## Architecture

- Application statique sans framework, issue de la reconstruction existante : `app.js` pour les vues et interactions, `app.css` pour le style.
- `src/core.ts` : schéma de sauvegarde, validation, dates locales, recherche, calcul Focus et repository de persistance. TypeScript strict, compilé en script classique sans import dynamique.
- État local conservé sous `quotidien-rebuild-2`, schéma 2 compatible avec les exports 2.0. Pas d’API, de compte utilisateur ou de synchronisation active.
- Repository : validation avant écriture, copie précédente, checkpoint avant restauration/réinitialisation, détection d’état modifié par un autre onglet, erreur visible en cas de quota/accès refusé. Une erreur de chargement ouvre la récupération sans remplacer l’état par des listes vides.
- Suppression logique, liste des éléments retirés et restauration individuelle. Export JSON complet incluant les éléments retirés ; import de l’enveloppe actuelle et du format brut 2.0 après aperçu.
- Navigation par hash et délégation de clics. Recherche sur 13 collections, raccourci Ctrl/Cmd+K, ajout rapide de six types d’éléments.
- Build de fichiers statiques à empreinte SHA-256, sans dépendance chargée depuis un CDN. `dist/` exclut les archives, sources, outils et tests.
- Manifest et icônes de l’ancien projet réutilisés. Aucun nouveau service worker enregistré. L’endpoint `sw.js` retire les anciens workers et uniquement leurs caches `quotidien-v6.*` / `quotidien-v7.*`. Le nettoyage ne bloque pas le démarrage.
- `legacy/v7/` conserve à l’identique les 48 fichiers de l’ancien `main` (`42d7b14`), dont V6.1, migration, hub, vague A et ébauche Cloudflare Worker/D1. Ces fichiers ne sont ni compilés ni publiés dans la 2.1.

## Branches et backups inspectés

| Branche | Commit observé | Rôle |
|---|---|---|
| main | 42d7b14 | Ancien code V7.1.4, identique au backup avant redémarrage |
| backup-before-clean-restart-2026-07-17 | 42d7b14 | Sauvegarde préservée |
| gh-pages | 8cbfd84 | Reconstruction 2.0, cinq fichiers statiques, retenue comme base |
| clean-reset-source | 92b1188 | Ancien socle + fichiers préparatoires `clean-*`, pas la reconstruction finale |
| v6-app | 3bf30e1 | V6, TypeScript/Vite à l’origine, IndexedDB et modèles structurés |
| v6-ultra | da9ab7c | Socle enrichi V6.1 et anciens outils |
| v7-life-os | f9e85e3 | Catalogue et capture générique des vingt domaines |
| v7-wave-a | 0a77a6f | Première spécialisation : projets, transactions, documents, équipements, règles |
| fix-pages-v71 | f41e136 | Correctifs d’exposition de la version |
| fix-ios-boot | b7568ca | Correctifs de démarrage |
| fix-interactions-v713 | 946fd40 | Correctifs d’interactions |
| fix-v714-no-cache | 852fa4f | Correctifs de cache et préparation du redémarrage |

Aucun AGENTS.md ou manifeste Sites présent dans ces arbres. Aucun changement de plateforme d’hébergement.
Une archive V5 `mon-quotidien-v5.zip` est également retrouvée parmi les fichiers disponibles ; elle n’a pas été extraite, les références V6/V7 étant déjà présentes dans Git.

## Fonctionnalités

Les statuts concernent le périmètre indiqué, pas la totalité de la vision cible.

| Domaine | État de la 2.1 | Référence / restant |
|---|---|---|
| Dashboard | ✅ Synthèse tâches, agenda du jour, habitudes, objectifs, sport et Focus | 🟡 Personnalisation, finances du jour et analytics avancés |
| Tâches | ✅ Création, édition, échéance, liste/projet texte, important/urgent, complétion, retrait/récupération | 🟡 Sous-tâches, récurrence, estimations, kanban et liens d’objectifs présents dans V6.1 à réintégrer |
| Calendrier | ✅ Agenda chronologique, création/édition d’événements, navigation correcte des onglets | 🟡 Vues jour/semaine/mois, ICS, récurrence et time blocking à récupérer |
| Habitudes/routines | ✅ Saisie, édition et coche journalière des habitudes ; conservation des routines | 🟡 Compteurs vers cible >1, fréquence, streaks et exécution des étapes |
| Objectifs | ✅ Saisie/édition de progression, domaine et échéance | 🟡 Hiérarchie, KPI, milestones et relations |
| Projets | 🟡 Catégorie texte des tâches et captures Life OS | Projets structurés et relations transverses à construire |
| Finances | ✅ Registre de mouvements signés, solde, édition et récupération | 🟡 Comptes, budgets, CSV, récurrences, prévisionnel et catégories hiérarchiques |
| Patrimoine | ⚪ Aucun modèle financier spécialisé | À développer |
| Abonnements | ⚪ Aucun modèle spécialisé | À développer |
| Sport | ✅ Historique de séances avec date, sport, durée et effort | 🟡 Programmes et exercices V6.1 à réintégrer |
| Musculation | ⚪ Aucun outil spécialisé dans la 2.1 | Ancien modèle exercices/séries/répétitions/charge disponible dans l’archive |
| Tennis | 🟡 Séances saisissables comme sport libre | Matchs, scores, surfaces, adversaires à développer |
| Nutrition | 🟡 Captures génériques, mesures libres | Ancien suivi repas/eau/poids à récupérer ; macros et aliments à développer |
| Apprentissage | 🟡 Captures génériques Life OS | Compétences, cours, temps et ressources à structurer |
| Notes / connaissances | ✅ Création, édition, tags texte, recherche, contenu conservé | 🟡 Markdown rendu, backlinks, favoris, pièces jointes et export Obsidian à récupérer |
| Journal | 🟡 Notes libres et domaine Life OS | Modèle quotidien, humeur et gratitude à réintégrer |
| Voyages | 🟡 Captures de domaine consultables et modifiables | Itinéraire, réservations et budget à développer |
| Inventaire/documents | ✅ Fiches texte, catégorie, échéance et détails | 🟡 Fichiers joints, garanties, valorisation et relations |
| Relations | 🟡 Captures génériques | Contacts, anniversaires, historique et rappels à structurer |
| Analytics | 🟡 Compteurs élémentaires | Tendances et graphiques à récupérer / développer |
| Automatisations | 🟡 Notes décrivant des idées de règles | Aucune règle exécutée ; interface explicite sur cette limite |
| Recherche / ajout rapide | ✅ Résultats ouvrables sur 13 collections, accents ignorés ; six formulaires rapides | Index spécialisé et recherche de pièces jointes futurs |
| Sauvegarde / restauration | ✅ Format 2.x vérifié, aperçu, checkpoints et erreurs visibles | Migration V5/V6/V7 volontairement refusée sans convertisseur dédié |

## P0/P1 et corrections

| Priorité | Constat reproductible | Correction |
|---|---|---|
| P0 | Import brut non validé : état incompatible, attributs HTML non échappés | Schéma contrôlé et échappement des identifiants / dates / textes ; import refusé avant mutation |
| P0 | Erreur JSON interprétée comme état vide, écrasement possible au prochain enregistrement | Écran de récupération avec exports bruts, aucune écriture automatique |
| P0 | Risque de republier l’ancien main au-dessus de la reconstruction | PR réconcilie la source avec la 2.0 ; workflow prépare uniquement le build 2.1 et conserve l’historique gh-pages |
| P1 | Clic dans un champ modal ferme la fenêtre via `closest('[data-close]')` | Fond cliquable seulement lorsqu’il est la cible directe, fermeture explicite et Échap |
| P1 | Bouton + Note inerte et édition absente | Création et édition reliées aux données, identifiants de formulaires uniques |
| P1 | Échec localStorage non géré | Message visible, formulaire et brouillon conservés, pas de toast de réussite |
| P1 | Import remplace immédiatement les données | Aperçu + action de restauration, copie indépendante avant remplacement |
| P1 | Agenda/Objectifs/Routines ouvrent des créations au lieu de changer la vue | Onglets affichant réellement chaque section |
| P1 | Recherche renvoie seulement un nombre | Liste de résultats filtrés et accès à l’édition |
| P1 | Jour dérivé d’UTC, erreur autour de minuit français | Date calendaire locale testée en hiver/été Europe/Paris |
| P1 | Focus saisi en `Focus` mais calcul filtré sur `focus` | Calcul insensible à la casse et excluant les éléments retirés |

## Vérifications

- Ancien `main` exécuté dans une copie séparée : TypeScript, 10 tests et build passent. Ces tests sont essentiellement structurels et ne prouvent pas le bon fonctionnement de l’interface.
- Reproduction sur code 2.0 original, sans modification : clic sur un champ ferme le formulaire ; bouton + Note ne crée aucune modale.
- Version corrigée : `npm run verify` passe : syntaxe JavaScript + formatage, TypeScript strict du noyau, build, **26 tests** de règles métier, persistance, interactions DOM et packaging.
- Tests : sauvegardes compatibles/incompatibles, corruption, quota, identifiants dupliqués, dates, HTML injecté, conflit entre onglets, checkpoint, récupération individuelle, recherche, saisie/édition, conservation après rechargement et six ajouts rapides.
- Chrome réel : démarrage, création d’événement, saisie dans les champs et conservation après rechargement vérifiés.
- Format 390 × 844 dans une iframe Chrome : rendu, navigation, capture et enregistrement d’une note vérifiés visuellement. Il s’agit d’un viewport réduit, pas d’un véritable téléphone ni d’une émulation de clavier Android/iOS.
- Installabilité sur appareil, mode autonome mobile et ouverture offline non validés. Le shell ne garantit pas un démarrage sans réseau ; aucune promesse d’offline n’est affichée.
- Le code UI JavaScript hérité n’est pas couvert par le typecheck TypeScript ; il est couvert par syntaxe et tests DOM. L’archive historique est exclue des nouvelles vérifications.

## Dette technique et limites connues

- `app.js` reste un grand renderer hérité ; extraction progressive par module à effectuer pendant les prochaines vagues. Le repository et les règles critiques sont déjà séparés.
- localStorage reste limité en capacité, propre au navigateur, non chiffré et effaçable par l’utilisateur. Les copies sur le même appareil ne remplacent pas un export externe. Aucun stockage distant actif.
- Détection de conflit entre onglets par comparaison de la valeur persistée, sans verrou distribué : une simultanéité exacte entre processus reste une limite. Travailler dans un seul onglet pour les écritures critiques jusqu’à l’introduction d’une transaction IndexedDB ou Web Locks.
- Les anciens espaces V5/V6/V7 sont préservés mais non migrés automatiquement. Leurs bases IndexedDB et clés localStorage restent intactes. Préparer un convertisseur avec rapport de correspondance avant restauration.
- Pas de moteur de notifications, synchronisation, traitement financier automatique ou d’automatisation. Le worker archivé est un prototype, pas un service actif.
- Listes UI complètes non virtualisées, recherche limitée à 100 résultats visibles avec demande d’affiner. Mesures : huit dernières visibles, toutes recherchables.
- La publication conserve les anciennes ressources à empreinte pour les pages déjà en cache ; prévoir une politique de rétention ultérieure.
- La publication GitHub Pages et ses paramètres réels ne sont pas exécutés/vérifiés ici. La fusion de la PR dans `main` déclenchera le workflow prévu.

## Roadmap

1. Vague 2 : extraire le layout et les vues, navigation groupée, dashboard configurable, préférences et états vides uniformes.
2. Vague 3 : réintégrer tâches avancées, calendrier, projets reliés, objectifs et habitudes depuis `legacy/v7`, avec migration non destructive testée.
3. Vague 4 : comptes, catégories, budgets, CSV, abonnements et patrimoine.
4. Vague 5 : programmes sportifs, musculation, tennis, nutrition et routines.
5. Vague 6 : notes enrichies, journal, apprentissage et relations de connaissances.
6. Vague 7 : voyages, inventaire, contacts, pièces jointes et documents.
7. Vague 8 : indicateurs cohérents calculés sur les données reliées.
8. Vague 9 : téléphone réel, accessibilité complète, performance, modèle de stockage/synchronisation, audit sécurité et PWA.

## Dernières modifications et journal

### Vague 0 — analyse

Douze branches inventoriées. La source `main` n’était pas la reconstruction publiée sur la branche de distribution. Version 2.0 retenue, sources antérieures archivées sans modifier leurs branches.

### Vague 1 — modifications

Protection des données et des imports, correction des interactions et formulaires, édition, récupération, dates, recherche, navigation et styles tactiles. Build reproductible et publication sans force-push préparés.

### Résultat

Socle 2.1 utilisable et vérifié dans le périmètre décrit. Aucun ancien module spécialisé déclaré livré sans implémentation. Le travail suivant peut repartir de cette branche et du présent inventaire.
