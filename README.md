# Quotidien 2.2

Application personnelle locale : organisation quotidienne et **20 Life OS spécialisés, 48 types de fiches**.

[Ouvrir l’application](https://pivot-consulting.github.io/Quotidien/)

Dans **Life OS**, choisis un domaine puis une section : comptes, budgets, jalons, sessions d’apprentissage, repas, contacts, réservations, etc. Les synthèses se recalculent à partir des données saisies. Les fiches peuvent être recherchées, liées, dupliquées, exportées et retirées sans suppression définitive.

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

Les données restent dans le navigateur, sous `quotidien-rebuild-2`. Les exports 2.0/2.1 sont compatibles ; les captures et registres existants sont conservés. Réglages propose sauvegarde JSON, restauration avec aperçu, copies de récupération et éléments retirés. Exporte régulièrement une copie hors de ton appareil.

Les automatisations créent des tâches **après aperçu et lancement manuel**. L’assistant calcule un plan local et des bilans ; il n’est pas connecté à une IA. Les documents sont des références et liens, sans pièce jointe stockée. Aucune synchronisation distante, opération bancaire ou notification en arrière-plan.

## Sources et déploiement

- `app.js`, `app.css` : interface principale.
- `modules/os-ui.js` : espaces Life OS.
- `src/core.ts`, `src/os.ts` : persistance, modèles et règles métier.
- `legacy/v7/` : archive historique hors build.

Après fusion dans `main`, le workflow teste, compile et avance `gh-pages` sans réécriture d’historique. GitHub Pages publie depuis cette branche, racine `/`. Les anciens fichiers à empreinte restent disponibles pour les clients encore sur une page précédente.

Voir [PROJECT_STATUS.md](PROJECT_STATUS.md) pour les fonctionnalités et limites exactes.
