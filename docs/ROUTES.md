# Routes et modèles actifs — 2.3

Catalogue dérivé de src/os.ts. Les noms français existants sont conservés : Documents correspond à Admin OS, Impact à Eco OS, Progression à Game OS.

Écrans racine : `#today`, `#plan`, `#notes`, `#tracking`, `#life`, `#wave`, `#explore`.

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

Total : 20 OS, 48 modèles spécialisés. Explorer indexe aussi les 13 collections historiques hors OS. Les fiches s’ouvrent dans le dialogue existant ; les liens profonds vers une fiche individuelle restent à ajouter.
