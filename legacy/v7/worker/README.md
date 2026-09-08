# Backend Cloudflare optionnel

Ce Worker n’est pas nécessaire au mode local. Il prépare la synchronisation D1 et la planification des rappels.

## Initialisation

1. Créer une base D1 nommée `quotidien`.
2. Remplacer `REMPLACER_PAR_L_ID_D1` dans `wrangler.jsonc`.
3. Définir un secret : `npx wrangler secret put API_TOKEN`.
4. Exécuter `npm run db:remote`, puis `npm run deploy`.

L’authentification définitive par passkey/lien magique et l’envoi Web Push VAPID restent à connecter avant une ouverture publique.
