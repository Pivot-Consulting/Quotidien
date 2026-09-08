# Quotidien V7 Life OS

Application personnelle **local-first** pour organiser le quotidien et piloter les grands domaines de vie.

La branche V7 conserve tout le socle V6.1 — tâches, agenda, objectifs, notes, habitudes, routines, sport, santé et analyses — et ajoute un hub modulaire regroupant 20 espaces supplémentaires. Les données restent sur l’appareil par défaut et l’application fonctionne hors connexion.

## Socle quotidien hérité de V6.1

- écran Aujourd’hui avec chronologie, trois priorités, charge, humeur, habitudes et objectifs ;
- tâches GTD, sous-tâches, projets, tags, énergie, récurrence, rappels et mode Focus ;
- agenda, événements, time blocking et import/export `.ics` ;
- objectifs et progression ;
- notes Markdown, journal, dossiers, liens, graphe et export Obsidian ;
- habitudes, routines, sport, sommeil, poids, hydratation, repas et mensurations ;
- analyses sur 28 jours ;
- capture et recherche universelles ;
- sauvegarde JSON et PWA hors connexion.

## Les 20 espaces Life OS

### Organiser

- projets de vie ;
- documents et administratif ;
- automatisations personnelles ;
- assistant personnel ;
- foyer partagé.

### Se développer

- apprentissage ;
- carrière ;
- décisions ;
- journal avancé ;
- progression et gamification.

### Prendre soin de soi

- nutrition ;
- santé avancée ;
- relations ;
- sécurité et urgence.

### Piloter sa vie

- finances ;
- maison ;
- voyages ;
- vie numérique ;
- impact environnemental ;
- équilibre de vie.

## Alpha 1 : socle commun immédiatement utilisable

Chaque espace propose :

- une présentation et des résultats attendus ;
- des points de départ ;
- une capture d’éléments ;
- notes, tags, date et statut ;
- recherche globale ;
- activation ou masquage ;
- import et export JSON ;
- stockage local hors connexion.

Le bouton flottant **20 espaces** ouvre le hub. Le raccourci clavier est `Ctrl/Cmd + Maj + K`. La PWA expose aussi un raccourci « Ouvrir les 20 espaces ».

Le document [`docs/V7-LIFE-OS.md`](docs/V7-LIFE-OS.md) décrit l’architecture et les quatre vagues de spécialisation.

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

## Migration et sécurité des données

La V7 ne remplace pas la base V6.1. Les nouveaux espaces utilisent actuellement une clé locale séparée, `quotidien-v7-life-os`, afin de protéger les données quotidiennes existantes et de permettre une évolution progressive du schéma.

Les anciennes données V5 et V6 restent normalisées par le socle principal. Avant une évolution importante, conserver un export JSON.

## Données et confidentialité

Par défaut, aucune donnée personnelle n’est envoyée à un serveur. IndexedDB et `localStorage` assurent le fonctionnement local. Le PIN actuel est un verrou visuel et non un chiffrement de la base.

Les futurs modules Documents, Santé, Finances, Relations et Sécurité devront être chiffrés côté client avant toute synchronisation distante.

## Backend optionnel

Le dossier `worker/` contient le point de départ Cloudflare Worker/D1 pour la synchronisation entre appareils, les notifications Web Push et le calendrier Apple privé abonné. Il n’est pas requis pour utiliser Quotidien localement.
