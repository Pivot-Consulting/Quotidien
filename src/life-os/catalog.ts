export type LifeDomainId =
  | 'finances'
  | 'projets-vie'
  | 'apprentissage'
  | 'documents'
  | 'maison'
  | 'nutrition'
  | 'sante-avancee'
  | 'relations'
  | 'voyages'
  | 'carriere'
  | 'decisions'
  | 'journal'
  | 'automatisations'
  | 'assistant'
  | 'vie-numerique'
  | 'securite'
  | 'impact'
  | 'foyer'
  | 'gamification'
  | 'equilibre';

export type LifeDomainGroup = 'organiser' | 'se-developper' | 'prendre-soin' | 'piloter';

export interface LifeDomainDefinition {
  id: LifeDomainId;
  label: string;
  icon: string;
  group: LifeDomainGroup;
  description: string;
  outcomes: readonly string[];
  starters: readonly string[];
}

export const LIFE_GROUP_LABELS: Record<LifeDomainGroup, string> = {
  organiser: 'Organiser',
  'se-developper': 'Se développer',
  'prendre-soin': 'Prendre soin de soi',
  piloter: 'Piloter sa vie',
};

export const LIFE_DOMAINS: readonly LifeDomainDefinition[] = [
  { id:'finances', label:'Finances', icon:'€', group:'piloter', description:'Budget, patrimoine, abonnements, factures et objectifs d’épargne.', outcomes:['Budget mensuel','Prévisions','Patrimoine'], starters:['Créer mon budget du mois','Lister mes abonnements','Définir un objectif d’épargne'] },
  { id:'projets-vie', label:'Projets de vie', icon:'◆', group:'organiser', description:'Piloter les projets complexes avec jalons, risques, budget et décisions.', outcomes:['Vision','Jalons','Risques'], starters:['Créer un projet de vie','Définir le prochain jalon','Lister les risques principaux'] },
  { id:'apprentissage', label:'Apprentissage', icon:'◫', group:'se-developper', description:'Cours, compétences, révisions, lectures et répétition espacée.', outcomes:['Parcours','Révisions','Compétences'], starters:['Créer un parcours d’apprentissage','Ajouter une ressource','Planifier une révision'] },
  { id:'documents', label:'Documents & administratif', icon:'▤', group:'organiser', description:'Coffre documentaire, échéances, garanties et renouvellements.', outcomes:['Coffre','Échéances','Renouvellements'], starters:['Ajouter un document important','Créer une échéance administrative','Préparer une checklist de dossier'] },
  { id:'maison', label:'Maison', icon:'⌂', group:'piloter', description:'Inventaire, entretien, travaux, appareils, plantes et véhicules.', outcomes:['Inventaire','Entretien','Travaux'], starters:['Ajouter un équipement','Planifier un entretien','Créer un projet travaux'] },
  { id:'nutrition', label:'Nutrition', icon:'◉', group:'prendre-soin', description:'Menus, recettes, courses, stock, coûts et objectifs nutritionnels.', outcomes:['Menus','Courses','Recettes'], starters:['Planifier les repas de la semaine','Créer une liste de courses','Ajouter une recette'] },
  { id:'sante-avancee', label:'Santé avancée', icon:'✚', group:'prendre-soin', description:'Symptômes, traitements, rendez-vous, constantes et dossier santé.', outcomes:['Suivi','Rendez-vous','Dossier'], starters:['Noter un symptôme','Préparer un rendez-vous','Ajouter un traitement'] },
  { id:'relations', label:'Relations', icon:'◎', group:'prendre-soin', description:'Contacts, interactions, anniversaires, engagements et cadeaux.', outcomes:['Contacts','Suivis','Moments importants'], starters:['Ajouter une personne importante','Planifier une prise de nouvelles','Noter une idée cadeau'] },
  { id:'voyages', label:'Voyages', icon:'✈', group:'piloter', description:'Itinéraires, réservations, budget, documents et valises.', outcomes:['Itinéraire','Réservations','Budget'], starters:['Créer un voyage','Préparer la checklist valise','Ajouter une réservation'] },
  { id:'carriere', label:'Carrière', icon:'▣', group:'se-developper', description:'Compétences, réalisations, candidatures, portfolio et plan de carrière.', outcomes:['Portfolio','Compétences','Opportunités'], starters:['Ajouter une réalisation','Créer un objectif de carrière','Suivre une candidature'] },
  { id:'decisions', label:'Décisions', icon:'◇', group:'se-developper', description:'Comparer les options, critères, risques et résultats réels.', outcomes:['Options','Critères','Réévaluation'], starters:['Documenter une décision','Lister les options','Programmer une réévaluation'] },
  { id:'journal', label:'Journal avancé', icon:'✎', group:'se-developper', description:'Mémoire personnelle, gratitude, leçons, photos et rétrospectives.', outcomes:['Mémoire','Leçons','Rétrospectives'], starters:['Écrire le journal du jour','Noter une leçon','Préparer une rétrospective mensuelle'] },
  { id:'automatisations', label:'Automatisations', icon:'⚡', group:'organiser', description:'Déclencheurs, conditions et actions entre les espaces de Quotidien.', outcomes:['Règles','Déclencheurs','Actions'], starters:['Créer une règle','Automatiser une revue hebdomadaire','Créer une alerte conditionnelle'] },
  { id:'assistant', label:'Assistant personnel', icon:'✦', group:'organiser', description:'Planification, synthèses, classement et suggestions validées par l’utilisateur.', outcomes:['Synthèses','Suggestions','Planification'], starters:['Préparer ma journée','Résumer ma semaine','Découper un objectif'] },
  { id:'vie-numerique', label:'Vie numérique', icon:'⌘', group:'piloter', description:'Appareils, licences, comptes, domaines, sauvegardes et hygiène numérique.', outcomes:['Inventaire','Renouvellements','Nettoyage'], starters:['Inventorier mes appareils','Lister mes licences','Planifier un nettoyage numérique'] },
  { id:'securite', label:'Sécurité & urgence', icon:'⚑', group:'prendre-soin', description:'Contacts, consignes, informations médicales et plans d’urgence.', outcomes:['Contacts','Consignes','Kit urgence'], starters:['Ajouter un contact d’urgence','Créer une fiche médicale','Préparer une checklist urgence'] },
  { id:'impact', label:'Impact environnemental', icon:'♻', group:'piloter', description:'Énergie, transports, déchets, réparations et objectifs de réduction.', outcomes:['Consommations','Réduction','Réemploi'], starters:['Définir un objectif de réduction','Suivre une consommation','Planifier une réparation'] },
  { id:'foyer', label:'Foyer partagé', icon:'⌂+', group:'organiser', description:'Calendrier, responsabilités, courses, budget et informations communes.', outcomes:['Partage','Responsabilités','Coordination'], starters:['Créer une responsabilité','Ajouter un élément partagé','Préparer la semaine du foyer'] },
  { id:'gamification', label:'Progression & défis', icon:'★', group:'se-developper', description:'Niveaux, défis, récompenses et séries désactivables.', outcomes:['Défis','Niveaux','Récompenses'], starters:['Créer un défi de 30 jours','Définir une récompense','Choisir un domaine à renforcer'] },
  { id:'equilibre', label:'Équilibre de vie', icon:'◐', group:'piloter', description:'Vue globale des domaines investis, négligés et prioritaires.', outcomes:['Radar de vie','Priorités','Tendances'], starters:['Évaluer mes domaines de vie','Choisir un domaine prioritaire','Préparer ma revue mensuelle'] },
] as const;

export const LIFE_DOMAIN_BY_ID = new Map<LifeDomainId, LifeDomainDefinition>(LIFE_DOMAINS.map(domain => [domain.id, domain]));
