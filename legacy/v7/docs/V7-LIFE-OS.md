# Quotidien V7 — Life OS

## Vision

Quotidien devient un système d’exploitation personnel local-first. L’écran quotidien reste simple ; les grands domaines de vie sont regroupés dans un hub secondaire activable.

## Les 20 espaces

1. Finances personnelles
2. Projets de vie
3. Formation et apprentissage
4. Documents et administratif
5. Maison et vie domestique
6. Nutrition
7. Santé avancée
8. Relations et réseau personnel
9. Voyage et mobilité
10. Carrière et activité professionnelle
11. Décisions et réflexion
12. Journal avancé
13. Automatisations personnelles
14. Assistant personnel
15. Vie numérique
16. Sécurité et urgence
17. Impact environnemental
18. Foyer partagé
19. Progression et gamification
20. Équilibre de vie

## Socle livré dans l’alpha 1

Chaque espace possède dès maintenant :

- une fiche de présentation et ses résultats attendus ;
- plusieurs points de départ ;
- un espace de capture fonctionnel ;
- des notes détaillées ;
- des tags ;
- une date ;
- les statuts Idée, En cours, En attente et Terminé ;
- une recherche globale ;
- activation ou masquage ;
- import et export JSON ;
- conservation locale hors connexion.

Ce socle permet d’utiliser les 20 domaines immédiatement sans attendre que chacun reçoive son modèle spécialisé.

## Principe d’architecture

- `src/life-os/catalog.ts` : registre des domaines et métadonnées ;
- `src/life-os/store.ts` : état local versionné et normalisé ;
- `src/life-os/hub.ts` : interface transversale ;
- `src/life-os.css` : styles isolés ;
- futurs dossiers `src/domains/<id>/` : outils spécialisés par domaine.

Les modules spécialisés devront s’appuyer sur le même identifiant de domaine et rester compatibles avec les entrées génériques déjà saisies.

## Ordre de spécialisation

### Vague A — Fondations de vie

- projets de vie ;
- finances ;
- documents ;
- maison ;
- automatisations.

### Vague B — Santé et quotidien

- nutrition ;
- santé avancée ;
- relations ;
- sécurité ;
- foyer.

### Vague C — Développement

- apprentissage ;
- carrière ;
- décisions ;
- journal ;
- gamification.

### Vague D — Pilotage global

- voyages ;
- vie numérique ;
- impact environnemental ;
- assistant personnel ;
- équilibre de vie.

## Exigences permanentes

- aucune suppression silencieuse de données ;
- fonctionnement hors connexion ;
- export complet ;
- modules activables pour éviter une interface surchargée ;
- aucune décision automatique irréversible ;
- données sensibles chiffrées avant toute synchronisation distante ;
- TypeScript, tests et build obligatoirement verts avant fusion.
