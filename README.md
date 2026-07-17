# Mon Quotidien — version 5

Application personnelle installable sur téléphone : tâches, agenda, notes, routines, sport, habitudes et suivi. Elle fonctionne hors connexion et conserve les données sur l'appareil.

## Ce qui change dans cette version

- écran **Aujourd'hui** transformé en tableau de bord avec prochain événement, trois priorités et charge estimée ;
- bouton flottant de **capture universelle** : tâche, événement, note, séance, mesure ou routine ;
- navigation mobile simplifiée à cinq entrées ;
- modification complète des tâches, événements, notes et habitudes ;
- corbeille de 30 jours et bouton **Annuler** après suppression ;
- planification quotidienne avec choix des trois priorités et détection de surcharge ;
- mode concentration relié aux tâches ;
- routines composées de plusieurs étapes et programmables par jour de semaine ;
- habitudes programmables selon les jours et avec objectif hebdomadaire ;
- export d'un événement individuel au format `.ics`, avec rappel, pour Calendrier Apple ;
- rappels des événements, tâches, résumé du matin et bilan du soir ;
- rattrapage des rappels lors de la réouverture de l'application ;
- double stockage local : `localStorage` + `IndexedDB` ;
- recalcul automatique du jour lorsque l'application reste ouverte après minuit ;
- installation PWA, raccourcis de création et écran de mise à jour ;
- service worker v5 avec cache séparé des fichiers statiques et des requêtes dynamiques ;
- code découpé en plusieurs fichiers pour faciliter la maintenance.

## Fichiers

```text
index.html          Structure de l'interface
app.css             Styles historiques
app-core.js         Stockage, tâches, agenda et fonctions centrales
app-modules.js      Notes, sport, suivi et démarrage

enhancements.css    Interface mobile v5
enhancements.js     Planification, routines, focus, édition, corbeille, IndexedDB

manifest.json       Installation sur téléphone et raccourcis
sw.js               Fonctionnement hors connexion, mises à jour et notifications
```

## Mise en ligne sur GitHub Pages

1. Fais d'abord un export JSON depuis l'ancienne application.
2. Copie **tout le contenu de ce dossier** à la racine du dépôt GitHub.
3. Fais un commit puis un push.
4. Dans GitHub : **Settings → Pages**.
5. Sélectionne la branche principale et le dossier racine.
6. Ouvre l'adresse GitHub Pages dans Safari sur l'iPhone.
7. Dans Safari : **Partager → Sur l'écran d'accueil**.

La version 5 conserve la clé de données historique. Sur le même navigateur et la même adresse GitHub Pages, les données existantes sont reprises automatiquement, puis copiées dans IndexedDB.

> Un changement de nom du dépôt ou de l'adresse GitHub Pages crée une nouvelle origine web. Dans ce cas, importe le fichier JSON exporté depuis l'ancienne adresse.

## Tester localement

Les service workers ne fonctionnent pas correctement en ouvrant directement `index.html` comme un fichier. Lance un petit serveur local :

```bash
python -m http.server 8000
```

Puis ouvre :

```text
http://localhost:8000
```

## Ajouter un événement à l'agenda iPhone

Dans la liste des événements, touche le bouton ****. L'application utilise la feuille de partage de l'iPhone quand elle est disponible, sinon elle télécharge un fichier `.ics`.

Le fichier contient notamment :

- le début et la fin ;
- le fuseau horaire du téléphone ;
- le lieu ;
- la récurrence ;
- l'alarme choisie.

Pour synchroniser automatiquement tous les événements dans Calendrier Apple, un calendrier privé abonné doit être généré par un serveur. L'architecture proposée est décrite dans `BACKEND-OPTIONNEL.md`.

## Rappels sur iPhone

La version actuelle sait :

- afficher des notifications depuis le service worker ;
- rappeler les événements et tâches ;
- envoyer un résumé du matin et un bilan du soir ;
- rattraper un rappel lorsque l'application est rouverte.

Une PWA seule ne peut toutefois pas garantir une alerte à l'heure exacte quand iOS a complètement suspendu l'application. Pour cette garantie, il faut ajouter un service Web Push distant. Le service worker contient déjà le récepteur `push` et le gestionnaire de clic ; il reste à connecter l'abonnement et le planificateur serveur.

## Sauvegarde et confidentialité

Les données restent locales par défaut. Le code PIN protège l'écran contre les regards indiscrets, mais ne chiffre pas la base de données.

Recommandations :

- export JSON au moins toutes les deux semaines ;
- export avant tout changement important du dépôt ;
- ne pas stocker de données médicales ou confidentielles sans ajouter un véritable chiffrement ;
- conserver les sauvegardes dans un espace privé.

## Mettre à jour l'application

À chaque nouvelle version, modifie la constante suivante dans `sw.js` :

```js
const VERSION = "v5.0.0";
```

Exemple : `v5.0.1`, puis commit et push. L'application affichera un bandeau **Nouvelle version disponible**.
