# Synchronisation privée — lot J

Ce service Node 22 accompagne le site statique, mais **n’est pas activé par GitHub Pages**. Il requiert un hébergement Node persistant, un disque privé et un reverse proxy HTTPS. Aucun compte distant n’est créé lors de l’ouverture de l’application.

## Mise en service

1. Exécuter `node server/provision.cjs raphael personnel owner` dans un terminal privé. Conserver le jeton pour la connexion depuis l’application ; placer uniquement l’objet `identity` dans un tableau JSON dans un fichier privé hors dépôt. Pour partager un espace, générer des identités distinctes avec le même `space`, en rôle `writer` ou `reader`. Expiration : 90 jours. Rotation/révocation : remplacer/supprimer l’entrée puis redémarrer.
2. Définir `QUOTIDIEN_AUTH_FILE` vers ce tableau, `QUOTIDIEN_DATA_DIR` vers un disque persistant privé, `QUOTIDIEN_ORIGIN=https://pivot-consulting.github.io`, puis lancer `node server/sync.cjs`. Écoute par défaut : `127.0.0.1:8787`.
3. Configurer le reverse proxy HTTPS, une limite de corps de 170 Mio, une limite de débit et de connexions par IP, et les sauvegardes chiffrées du disque. Ne pas exposer directement le port HTTP sur Internet. Les données serveur ne sont pas chiffrées par l’application ; la protection au repos relève de l’hébergement.
4. Dans Pilotage → Centre de pilotage → Synchronisation, saisir l’origine HTTPS et le jeton. Comparer les versions puis choisir explicitement l’envoi local ou la restauration distante. Le jeton reste en mémoire et n’est jamais exporté.

## Garanties et limites

- Identité issue du jeton aléatoire et de sa configuration serveur ; aucun identifiant utilisateur fourni par le client ne choisit le stockage. Jetons hachés SHA-256, comparaison constante, expiration obligatoire. Pas d’inscription publique ni de mot de passe.
- `reader` lit ; `writer` et `owner` lisent et écrivent. La gestion des accès est réservée à l’administrateur du serveur, hors API. Permissions par espace, pas par fiche.
- Révision entière, comparaison atomique et écriture sérialisée ; un conflit retourne HTTP 409. L’utilisateur compare et choisit une version complète. Aucune fusion automatique ni écrasement silencieux.
- Pièces jointes incluses avec contrôle SHA-256, 25 Mio par fichier, 100 Mio cumulés. Copie précédente conservée côté serveur ; point de récupération avant restauration locale.
- Un seul processus par répertoire : verrou exclusif. Après arrêt brutal, vérifier l’absence du processus avant de retirer manuellement `service.lock`. Le serveur refuse de démarrer tant que le verrou existe.
- Synchronisation à la demande. Les notifications poussées, l’exécution planifiée distante et les agents distants ne sont pas activés. Les agents du site restent locaux et soumis à validation.
- Ce service doit être testé avec deux appareils et des comptes distincts sur l’hébergement cible avant activation pour des données personnelles réelles.

Les tests couvrent isolation des espaces, lecture seule, expiration, intégrité des pièces jointes, concurrence et conservation de la version précédente.
