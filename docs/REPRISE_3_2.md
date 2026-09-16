# Reprise 3.2 — lots E à K

Base : `main` 1e236f1, version 3.1, PR #15 fusionnée. Les lots A–D, les 20 OS, 48 modèles initiaux, le coffre, le calendrier, les automatismes et les sauvegardes complètes sont conservés. Cette version ajoute 12 modèles et des parcours utilisant les mêmes données.

## Livraison et dépendances

| Lot | Livraison vérifiable | Dépendances et validation |
|---|---|---|
| E — Modèle commun | Contact responsable, sous-tâches, champs texte/nombre/date/oui-non dans les fiches ; conservation des brouillons dynamiques ; conversions équipements/objectifs réversibles | IDs et sources conservés, relations navigables, cycles refusés, types contrôlés à l’import et à l’enregistrement. Aucun remplacement automatique des registres |
| F — Finance/projets/décisions | Échéanciers mensuels arrondis au centime, trésorerie avec échéances non réglées, règlement lié au mouvement réel, scénarios séparés, critères pondérés et notes justifiées | E ; total prévisionnel inchangé par un règlement, pas de double paiement, mois courts gérés, scores incomplets non classés. Les projets continuent à utiliser leur choix Manuel/Transactions |
| G1 — Administration/maison/sécurité | Liens sélectionnables vers le coffre depuis documents, démarches et équipements ; garanties et entretiens existants ; procédures de récupération liées aux services | E ; liens contrôlés, fichiers conservés dans le coffre. OCR et extraction restent hors livraison |
| G2 — Nutrition/santé/foyer/impact | Ingrédients par portion, menus, besoins nets, réception des courses, consommation du stock, programmes et séances sportives | E ; unités séparées g/ml/pièce, agrégation des doublons, mutation du stock atomique en cas de manque. Répartition du foyer et unités d’impact existantes réutilisées |
| G3 — Apprentissage/carrière/relations/voyages | Cours liés à des compétences, candidatures à des contacts, accès aux révisions et suivis existants, dépenses réelles de voyage séparées des réservations | E/F ; références contrôlées et absence d’addition du réel aux estimations |
| G4 — Journal/progression/équilibre | Périodes de vie, chronologie multidomaine, courbe d’humeur, progression ludique facultative | E/G ; dates cohérentes, points calculés à partir des tâches terminées actuelles, désactivation sans effet sur les données |
| H — Intelligence/routines | Seuils d’horizon et d’inactivité, huit scores d’auto-évaluation expliqués, données absentes marquées insuffisantes, résultat des recommandations, revue mensuelle et intervalles | E/G ; aucune valeur inventée, mois courts gérés, une seule routine mensuelle installée, analyseurs antérieurs réutilisés |
| I — Command Center | Registre local de quatre intentions : tâche, note, chercher, planifier ; aperçu puis validation, historique et annulation | E/H ; dates validées, homonymes refusés, objet modifié depuis l’aperçu ou depuis l’action protégé. Langage à syntaxe explicite, pas de compréhension universelle |
| J — Synchronisation | Client fonctionnel et service Node testable : identités par jeton, ACL par espace, snapshots avec pièces jointes, CAS, conflit explicite et copie précédente | E + sauvegarde A–D ; tests d’isolation, expiration, lecture seule, concurrence et intégrité. **Activation serveur en attente d’hébergement** |
| K — Agents | Agents locaux autorisés domaine par domaine, propositions issues des analyseurs, création uniquement après validation, trace et annulation | H/I ; permissions revérifiées lors de l’acceptation, filtrage des données/relations/historique par domaine. **Pas d’agent distant autonome** |

## Limites assumées et travaux restant ouverts

Cette livraison n’achève pas toute la vision Personal OS. En particulier, J n’est pas opérationnel entre appareils tant que le service n’est pas hébergé et vérifié ; le site GitHub Pages ne peut pas exécuter ce serveur.

1. **J — mise en service** : hébergement Node avec stockage persistant, HTTPS, protection du disque, sauvegardes et limitation de débit. Provisionner les identités en privé puis tester sur deux appareils. Le jeton ne doit pas être commité. Voir [le guide serveur](../server/README.md).
2. **J — automatisation distante** : ordonnanceur, notifications push et supervision à construire après activation du serveur. Le fonctionnement local à l’ouverture reste celui de 3.1.
3. **K — exécution distante** : éventuelle extension des agents au serveur, avec portée par domaine, revue des propositions et suivi des résultats. Aucun appel à une IA externe ou service tiers dans cette version.
4. **Approfondissements métier** : OCR, dix scores composites de la vision complète, conversion de tous les anciens registres, fusion automatique fine des conflits, programmes sportifs détaillés par exercice et allocations pondérées du foyer restent des extensions. Les huit scores livrés sont des auto-évaluations explicites.

## Risques et protections

- **Évolution du format fonctionnel** : la version de schéma reste 2, avec extensions optionnelles, mais les nouvelles fiches ne doivent pas être ouvertes par une ancienne application ignorant leurs modèles. Exporter une sauvegarde complète avant retour à 3.1. Les fichiers de la base ne sont ni effacés ni migrés destructivement.
- **Conversions** : les anciennes données restent dans la source archivée. La fiche spécialisée possède le même ID dans une autre collection et un lien vers la source ; les deux types ne sont pas fusionnés silencieusement. Revenir au registre archive la fiche spécialisée sans supprimer ses relations.
- **Prévisions** : les scénarios reposent sur les montants saisis, sans intérêts ni import bancaire. Les abonnements ne sont pas extrapolés automatiquement en échéances, afin de ne pas les compter deux fois. Une échéance réglée ne peut pas changer de montant ou de compte tant que son mouvement reste lié.
- **Stock** : les unités ne sont pas converties automatiquement ; modifier manuellement le stock reste possible. La consommation vérifie toutes les disponibilités avant de déduire la moindre quantité.
- **Agents** : permissions locales applicatives, non séparation cryptographique des données. Le serveur applique séparément les droits d’espace. Une proposition ne vaut pas action distante.
- **Synchronisation** : choix d’un snapshot complet après comparaison, pas de fusion automatique. Le serveur rejette une révision obsolète. Une restauration distante crée un checkpoint local avec les fichiers correspondants.

## Validation de publication

`npm run verify` : **137 tests passants**, syntaxe frontend/serveur, formatage, TypeScript strict, tests métier/DOM/IndexedDB/sauvegardes/serveur et build statique. Parcours navigateur Chromium aux largeurs 390 et 1440 px : commande, aperçu, confirmation, annulation, cinq onglets, formulaire sportif avec vrai clic natif, absence d’erreur JavaScript et de débordement horizontal.

Test serveur + client dans deux profils Chromium isolés : transfert d’une pièce jointe, restauration avec checkpoint, téléchargement aux octets identiques et rejet du second envoi concurrent. Ce test local ne remplace pas la recette sur le futur hébergement.

La publication doit passer les contrôles de la PR, puis le workflow GitHub Pages ; vérifier ensuite `/version.json` et le hash du commit publié. Le déploiement Pages publie uniquement `dist/`, jamais le serveur, ses identités ou ses données.
