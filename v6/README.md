# Quotidien V6 — alpha

Cette branche démarre la transformation de Quotidien en application **local-first**, installable et synchronisable.

## État de l’alpha

Cette première étape apporte :

- Vite + TypeScript strict ;
- interface mobile autonome ;
- IndexedDB comme stockage principal ;
- migration automatique des tâches et notes depuis la V5 ;
- métadonnées de synchronisation sur chaque objet ;
- mode clair/sombre ;
- service worker et manifeste PWA ;
- premiers tests automatisés ;
- squelette Cloudflare Worker + D1 pour la future synchronisation ;
- migration SQL initiale pour comptes, appareils, entités et rappels.

La V5 à la racine du dépôt reste inchangée. La V6 vit dans ce dossier jusqu’à atteindre la parité fonctionnelle.

## Lancer localement

```bash
cd v6
npm install
npm run dev
```

## Vérifier

```bash
npm run check
npm run build
```

## Migration V5

Au premier lancement, la V6 lit la clé historique `mon-quotidien-v1`. Elle copie les tâches et les notes dans IndexedDB sans supprimer la sauvegarde V5.

## Backend gratuit

Le dossier `worker/` contient le point de départ Cloudflare :

```bash
cd worker
npm install
npx wrangler d1 create quotidien-db
```

Reporter ensuite l’identifiant retourné dans `worker/wrangler.jsonc`, puis appliquer la migration D1.

## Prochain lot

1. parité agenda, habitudes, routines, sport et suivi ;
2. export/import JSON V6 ;
3. authentification facultative ;
4. synchronisation différentielle ;
5. Web Push fiable ;
6. calendrier privé `.ics` ;
7. preview Cloudflare automatisée.
