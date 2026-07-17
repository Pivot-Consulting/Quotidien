# Quotidien V6

Application personnelle **local-first** pour gérer les tâches, l’agenda, les notes, les habitudes, les routines, le sport et le suivi quotidien.

La V6 remplace entièrement l’ancienne application. Elle reprend automatiquement les données enregistrées sous la clé historique `mon-quotidien-v1` lorsqu’elle est ouverte sur la même adresse web et dans le même navigateur.

## Fonctions principales

- tableau de bord Aujourd’hui, trois priorités et charge estimée ;
- tâches, sous-tâches, listes, récurrences, matrice urgent/important et mode Focus ;
- agenda mois/semaine, rappels, récurrences et import/export Apple Calendar `.ics` ;
- notes Markdown, liens `[[Note]]`, rétroliens, journal, graphe et export Obsidian ;
- habitudes hebdomadaires et routines multi-étapes ;
- programmes sportifs, minuteur d’intervalles, séances et progression par exercice ;
- poids, sommeil, hydratation, repas et mensurations ;
- corbeille 30 jours, verrou PIN, thème sombre et sauvegarde JSON ;
- PWA installable et utilisable hors connexion ;
- IndexedDB avec secours `localStorage` ;
- socle Cloudflare Worker/D1 pour la synchronisation et les notifications distantes.

## Développement

Pré-requis : Node.js 22 ou version LTS récente.

```bash
npm ci
npm run verify
```

Pour lancer un serveur local après compilation :

```bash
npm run build
python -m http.server 8000 --directory dist
```

Puis ouvrir `http://localhost:8000`.

## Déploiement

Le workflow `.github/workflows/pages.yml` compile puis publie automatiquement `dist/` sur GitHub Pages à chaque push sur `main`.

Dans GitHub, sélectionner une fois : **Settings → Pages → Source → GitHub Actions**.

## Migration de la V5

La migration couvre :

- tâches, projets et sous-tâches ;
- événements et rappels ;
- notes, tags, épingles et archives ;
- habitudes et routines ;
- programmes, séances et sessions de concentration ;
- poids, sommeil, repas, eau et mensurations ;
- préférences, PIN, priorités journalières et corbeille.

Avant la première mise en production, conserver malgré tout un export JSON de l’ancienne application. L’historique Git permet également de retrouver le code V5.

## Données et confidentialité

Par défaut, aucune donnée personnelle n’est envoyée à un serveur. Le PIN est un verrou visuel et non un chiffrement de la base. Pour des informations sensibles, activer ultérieurement le chiffrement côté client avant la synchronisation.

## Backend optionnel

Le dossier `worker/` contient le schéma D1 et le point de départ Cloudflare Worker pour :

- compte facultatif ;
- synchronisation entre appareils ;
- Web Push fiable quand l’application est fermée ;
- calendrier Apple privé abonné.

Il n’est pas requis pour utiliser Quotidien en mode local.
