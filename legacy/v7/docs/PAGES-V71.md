# GitHub Pages — Quotidien V7.1

La source de production est le workflow `.github/workflows/pages.yml`.

- branche déclenchante : `main` ;
- artefact publié : `dist/` ;
- compilation : `npm run verify` ;
- publication : `actions/deploy-pages@v4`.

Le libellé V6.1 visible après la fusion V7.1 provenait de deux éléments distincts :

1. le composant historique `app-v61.ts` affichait encore `V6.1` dans l’en-tête ;
2. une ancienne version du service worker pouvait conserver la page et les ressources en cache.

Le correctif V7.1.1 :

- remplace visuellement le libellé par V7.1 ;
- ajoute des paramètres de version aux ressources critiques ;
- change la clé de cache du service worker ;
- recharge les navigations avec `cache: no-store` avant repli hors connexion.
