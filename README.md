# Quotidien V6.1

Application personnelle **local-first** pour organiser les tâches, l’agenda, les notes, les objectifs, les habitudes, les routines, le sport et le suivi quotidien.

Quotidien fonctionne hors connexion et conserve les données sur l’appareil. Les anciennes données V5 et V6 sont normalisées automatiquement lorsqu’elles sont ouvertes sur la même adresse web et dans le même navigateur.

## Outils principaux

### Aujourd’hui

- chronologie réunissant événements et blocs de temps ;
- trois priorités quotidiennes ;
- charge estimée et temps disponible ;
- humeur, énergie et stress ;
- habitudes du jour ;
- objectifs actifs ;
- capture rapide vers la boîte de réception.

### Tâches

- listes et projets ;
- description, tags, contexte et niveau d’énergie ;
- statuts `Inbox`, prochaine action, en attente et un jour ;
- échéance, heure, date de démarrage et rappels ;
- temps estimé et temps réellement consacré ;
- sous-tâches, récurrence, priorités et matrice urgent/important ;
- liaison à un objectif ;
- duplication, report et mode Focus.

### Agenda

- événements récurrents et rappels ;
- navigation quotidienne ;
- blocs de temps avec type, début, fin et tâches liées ;
- lieux, liens, notes, couleurs et compte à rebours ;
- import/export Apple Calendar `.ics`.

### Objectifs

- domaines personnel, professionnel, santé, finances et apprentissage ;
- statut, date cible, progression et notes ;
- tâches rattachées et calcul de progression ;
- mise en pause, clôture et abandon.

### Notes

- Markdown et liens `[[Note]]` ;
- dossiers, tags, favorites, épingles, archives et sources ;
- journal quotidien ;
- recherche universelle ;
- graphe des connaissances et export Obsidian.

### Habitudes et routines

- jours programmés, cible quotidienne et objectif hebdomadaire ;
- icône, couleur, rappel et unité personnalisée ;
- séries, historique hebdomadaire et jours neutralisés ;
- routines multi-étapes avec durée et horaire.

### Sport et santé

- programmes sportifs personnalisés ;
- séances, durée, effort perçu, calories et exercices ;
- poids, sommeil, hydratation, repas et mensurations ;
- humeur, énergie et stress ;
- analyses sur 28 jours et recommandations automatiques.

### Productivité avancée

- capture universelle ;
- recherche globale avec `Ctrl/Cmd + K` ;
- nouvelle capture avec `Ctrl/Cmd + N` ;
- mode Focus lié aux tâches ;
- sauvegarde et restauration JSON ;
- PWA installable et utilisable hors connexion.

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

La migration couvre les tâches, projets, événements, notes, habitudes, routines, programmes, séances, sessions de concentration, poids, sommeil, repas, eau, mensurations, préférences et corbeille.

La normalisation V6.1 ajoute les nouveaux champs et tableaux sans supprimer les données déjà enregistrées. Avant une évolution importante, conserver malgré tout un export JSON.

## Données et confidentialité

Par défaut, aucune donnée personnelle n’est envoyée à un serveur. IndexedDB est le stockage principal et `localStorage` sert de secours. Le PIN est un verrou visuel et non un chiffrement de la base.

## Backend optionnel

Le dossier `worker/` contient le point de départ Cloudflare Worker/D1 pour :

- compte facultatif ;
- synchronisation entre appareils ;
- Web Push fiable quand l’application est fermée ;
- calendrier Apple privé abonné.

Il n’est pas requis pour utiliser Quotidien en mode local.
