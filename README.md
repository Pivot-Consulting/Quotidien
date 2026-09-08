# Quotidien 2.1

Application personnelle locale, construite à partir de la reconstruction 2.0.
Tâches, événements, notes, habitudes, objectifs, séances, mesures et captures Life OS.

## Développement

Node.js 22 ou 24.

```sh
npm ci --ignore-scripts
npm run verify
npm run dev
```

Le serveur de développement utilise le port 4173. Le build est dans `dist/`.
`npm run verify` vérifie la syntaxe/forme du JavaScript, les types du noyau TypeScript, les tests DOM/métier et les ressources du build.

## Données

La clé `quotidien-rebuild-2` est conservée. Les exports bruts 2.0 restent compatibles.
Réglages propose export, import avec aperçu, copies de récupération et éléments retirés.
Les données restent dans le navigateur ; aucune synchronisation serveur active.
Conserver régulièrement un export externe. Les formats V5/V6/V7 ne sont pas importés sans conversion.

## Sources et déploiement

`app.js` / `app.css` : interface actuelle. `src/core.ts` : règles et persistance.
`legacy/v7/` : copie exacte de l’ancien main avant redémarrage, hors build.
Les branches historiques et backups restent inchangés.

La PR de stabilisation vise `main`. Après fusion, le workflow compile la 2.1 et ajoute un commit normal à `gh-pages`, sans force-push. Il conserve les fichiers à empreinte pour les clients encore sur une page précédente et un éventuel CNAME existant.
La configuration prévue reste GitHub Pages « Deploy from a branch », branche `gh-pages`, racine `/`. Elle doit correspondre aux réglages effectifs ; aucun réglage externe n’est changé par le code.

Ne pas publier le dépôt source entier. Publier uniquement `dist/`.

Voir [PROJECT_STATUS.md](PROJECT_STATUS.md) pour l’inventaire, les limites des tests et les prochaines vagues.
