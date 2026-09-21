# Atelier — QUOTIDIEN 3.4

Direction approuvée : ivoire, sauge, titres éditoriaux, espaces plus généreux.

- Design partagé entre les 20 OS, le pilotage, la recherche, les formulaires et les dialogues.
- Accueil en deux colonnes sur ordinateur : prochaines actions et concentration à gauche ; agenda, habitudes et routines à droite. Sur mobile, les colonnes suivent cet ordre en une seule pile.
- Navigation horizontale sur ordinateur ; barre inférieure et cibles tactiles sur mobile. Capture rapide conservée dans l’en-tête et ajoutée au premier plan de l’accueil.
- Analyses, indicateurs, objectifs et rappel de sauvegarde restent disponibles sous le quotidien. Les réglages des widgets sont conservés.
- Premier passage à Atelier : activation du thème clair, sans modification des collections. Un choix ultérieur du mode sombre dans Réglages est mémorisé via `settings.design = atelier`, y compris après export/import.
- Polices système et Georgia, sans téléchargement de police. Palette sombre sauge disponible. Respect des mouvements réduits et du focus clavier.

Validation : `npm run verify` couvre les parcours existants et la migration d’apparence. `node scripts/browser-smoke.cjs` utilise Chrome (variable `CHROME_BIN` facultative) pour vérifier les routes à 320, 390, 768 et 1280 pixels, puis la capture rapide. La CI conserve les captures comme artefact `atelier-browser`.
