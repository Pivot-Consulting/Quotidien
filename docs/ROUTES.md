# Routes et modèles actifs — 3.3

Catalogue dérivé de src/os.ts, src/evolution.ts et src/progression.ts. Les noms français existants sont conservés : Documents correspond à Admin OS, Impact à Eco OS, Progression à Game OS.

Écrans racine : `#today`, `#plan`, `#notes`, `#tracking`, `#life`, `#wave`, `#explore`, `#intelligence`, `#vault`, `#automation`, `#workbench`.

Le calendrier commun est un onglet de `#plan`. Le centre d’analyse se rejoint aussi depuis Today et Pilotage. Les fiches continuent de s’ouvrir en modale.

Chaque section est accessible via `#life/<domaine>/<type>`. Un type absent ou appartenant à un autre domaine retombe sur la première section du domaine. Le retour navigateur réinitialise les filtres devenus hors contexte.

| OS | Route | Modèles conservés |
|---|---|---|
| Finances | `#life/finance` | Comptes (`account`), Budgets (`budget`), Abonnements (`subscription`), Patrimoine (`holding`) |
| Projets de vie | `#life/projects` | Projets (`project`), Jalons (`milestone`) |
| Apprentissage | `#life/learning` | Parcours (`course`), Sessions (`study`), Révisions (`flashcard`) |
| Documents | `#life/documents` | Documents (`document`), Démarches (`procedure`) |
| Maison | `#life/home` | Équipements (`equipment`), Entretiens (`maintenance`) |
| Nutrition | `#life/nutrition` | Repas (`meal`), Objectifs nutrition (`nutritionTarget`), Recettes (`recipe`) |
| Santé avancée | `#life/health` | Observations (`symptom`), Sommeil (`sleep`), Rendez-vous (`appointment`) |
| Relations | `#life/relations` | Contacts (`contact`), Échanges (`interaction`) |
| Voyages | `#life/travel` | Voyages (`trip`), Réservations (`booking`), Préparatifs (`packing`) |
| Carrière | `#life/career` | Candidatures (`application`), Réalisations (`achievement`), Compétences (`careerSkill`) |
| Décisions | `#life/decisions` | Décisions (`decision`), Options (`option`), Bilans (`decisionReview`) |
| Journal | `#life/journal` | Entrées (`journal`) |
| Automatisations | `#life/automation` | Règles (`rule`) |
| Assistant | `#life/assistant` | Préférences du jour (`planning`), Briefs (`brief`) |
| Vie numérique | `#life/digital` | Services (`service`), Temps d’écran (`screenTime`) |
| Sécurité | `#life/security` | Risques (`risk`), Sauvegardes (`backupCheck`) |
| Impact | `#life/impact` | Engagements (`impactGoal`), Contributions (`contribution`) |
| Foyer | `#life/household` | Membres (`member`), Tâches du foyer (`chore`), Dépenses partagées (`sharedExpense`), Remboursements (`settlement`) |
| Progression | `#life/progress` | Indicateurs (`indicator`), Mesures (`measurement`) |
| Équilibre | `#life/balance` | Satisfaction (`lifeRating`), Charge quotidienne (`energyDay`) |

Total : 20 OS, 62 modèles spécialisés. Explorer indexe aussi les 13 collections historiques hors OS. Les fiches s’ouvrent dans le dialogue existant. Liens directs : `#record/<collection>/<id encodé par encodeURIComponent>`, par exemple `#record/tasks/abc`. Les collections sont celles de `Q.collections`. Un lien inconnu affiche une erreur sans créer ni modifier de fiche. Fermer une fiche ouverte par lien ramène à Explorer. Ces liens ne synchronisent et ne partagent pas les données.

## Sections ajoutées en 3.2

| Domaine | Modèles ajoutés |
|---|---|
| finance | Échéances (`commitment`), scénarios (`scenario`) |
| decisions | Critères (`criterion`), évaluations (`optionScore`) |
| security | Récupération (`recovery`) |
| nutrition | Ingrédients (`ingredient`), menus (`menu`), stock (`stock`), courses (`shopping`) |
| health | Programmes (`trainingProgram`), séances (`trainingSession`) |
| journal | Périodes de vie (`lifePeriod`) |

`#workbench` contient les commandes, parcours métier, bilans, agents et le client de synchronisation. Il est accessible depuis Pilotage. Les nouveaux modèles suivent les routes `#life/<domaine>/<type>` existantes.

## Sections ajoutées en 3.3

- `#life/health/trainingExercise` : exercices détaillés par programme.
- `#life/health/exerciseSet` : séries réalisées par séance et exercice.
- Foyer → Dépenses partagées : poids de répartition facultatifs et aperçu.
- Centre de pilotage → Bilan : dix scores composites avec calculs, sources et couverture.
