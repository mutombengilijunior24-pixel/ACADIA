import type { DataKind, DimensionProposal } from "./types";

/**
 * Base de connaissances méthodologiques (sciences de gestion, économie, sciences sociales).
 * Ce sont des PISTES d'opérationnalisation, toujours présentées comme suggestions à adapter :
 * elles ne remplacent ni la revue de littérature ni la définition retenue par le chercheur.
 */
export interface KnowledgeConcept {
  id: string;
  label: string;
  /** Expressions qui désignent ce concept (comparées sur leurs racines). */
  aliases: string[];
  /** {unit} est remplacé par la population ou l'unité d'analyse. */
  definition: string;
  ambiguity?: string;
  pitfall?: string;
  dimensions: DimensionProposal[];
  precisions: string[];
}

const ind = (label: string, dataType: DataKind, measure: string, example?: string) => ({ label, dataType, measure, example });

export const KNOWLEDGE: KnowledgeConcept[] = [
  {
    id: "digitalisation",
    label: "Digitalisation",
    aliases: ["digitalisation", "numérisation", "transformation numérique", "transformation digitale", "présence en ligne", "commerce électronique", "e-commerce", "outils numériques", "usage du numérique", "technologies numériques"],
    definition: "Degré d'intégration d'outils et de canaux numériques dans les activités (vente, communication, paiement, relation client, gestion) de {unit}.",
    ambiguity: "Le terme peut désigner une simple présence en ligne, l'usage d'outils numériques ou la transformation des processus : le niveau de digitalisation étudié doit être précisé.",
    pitfall: "Ne pas réduire la digitalisation à la possession d'une page sur les réseaux sociaux : une présence en ligne inactive ne transforme pas les activités.",
    dimensions: [
      { name: "Présence et canaux en ligne", indicators: [ind("Canaux numériques utilisés (site, réseaux sociaux, plateforme de vente, messagerie)", "nominal", "choix multiples", "« Quels canaux utilisez-vous pour vendre ou communiquer ? »"), ind("Fréquence d'animation des canaux", "ordinal", "jamais / mensuelle / hebdomadaire / quotidienne")] },
      { name: "Transactions numériques", indicators: [ind("Part des ventes initiées ou conclues en ligne", "quantitative", "% du chiffre d'affaires sur la période", "estimation du dirigeant ou registre des ventes"), ind("Moyens de paiement numériques acceptés (mobile money, carte, virement)", "nominal", "choix multiples")] },
      { name: "Outils numériques de gestion", indicators: [ind("Outils utilisés (comptabilité, stock, facturation, CRM)", "nominal", "choix multiples"), ind("Intensité d'usage déclarée", "ordinal", "échelle de Likert en 5 points")] },
      { name: "Relation client numérique", indicators: [ind("Commandes, service après-vente ou avis clients gérés en ligne", "binary", "oui / non par pratique")] },
      { name: "Ressources et compétences", indicators: [ind("Compétences numériques du personnel", "ordinal", "faible / moyen / élevé"), ind("Budget consacré au numérique", "quantitative", "montant ou % des charges")] },
    ],
    precisions: [
      "Préciser si la digitalisation sera mesurée par un indice composite, par niveaux (faible, moyen, élevé) ou pratique par pratique.",
      "Fixer la période de référence des usages déclarés.",
    ],
  },
  {
    id: "creation-de-valeur",
    label: "Création de valeur",
    aliases: ["création de valeur", "valeur créée", "valeur ajoutée", "création de richesse", "création de richesses"],
    definition: "Accroissement, sur une période donnée, de la valeur produite par {unit} pour ses parties prenantes (propriétaires, clients, salariés, collectivité).",
    ambiguity: "La valeur peut être financière (marge, valeur ajoutée), commerciale (clients, fidélité), organisationnelle ou sociale : la ou les formes retenues doivent être définies.",
    pitfall: "Ne pas réduire automatiquement la création de valeur au chiffre d'affaires : des ventes en hausse ne créent pas de valeur si les coûts augmentent davantage.",
    dimensions: [
      { name: "Valeur économique et financière", indicators: [ind("Évolution du chiffre d'affaires", "quantitative", "% de variation sur la période"), ind("Marge bénéficiaire", "quantitative", "% ou montant", "documents comptables ou déclaration du dirigeant"), ind("Valeur ajoutée (production − consommations intermédiaires)", "quantitative", "montant")] },
      { name: "Valeur commerciale (clients)", indicators: [ind("Évolution du nombre de clients actifs", "quantitative", "nombre ou % de variation"), ind("Fidélisation et réachat", "ordinal", "échelle de fréquence"), ind("Satisfaction des clients perçue", "ordinal", "échelle de Likert en 5 points")] },
      { name: "Valeur organisationnelle", indicators: [ind("Réduction des coûts ou des délais de transaction", "ordinal", "diminution / stabilité / augmentation"), ind("Accès à de nouveaux marchés ou zones", "binary", "oui / non")] },
      { name: "Valeur sociale et partenariale", indicators: [ind("Emplois créés ou maintenus", "quantitative", "nombre sur la période"), ind("Valeur perçue par les partenaires", "ordinal", "échelle de Likert")] },
    ],
    precisions: [
      "Choisir les formes de valeur retenues et la source des données (dirigeants, documents comptables, clients).",
      "Fixer une période de comparaison (avant/après, année de référence).",
    ],
  },
  {
    id: "performance",
    label: "Performance",
    aliases: ["performance", "performance financière", "performance organisationnelle", "performance commerciale"],
    definition: "Degré d'atteinte des résultats attendus par {unit}, selon des critères (financiers, commerciaux, opérationnels, sociaux) à définir.",
    ambiguity: "« Performance » recouvre des réalités très différentes (financière, commerciale, opérationnelle, sociale) : la dimension étudiée doit être choisie.",
    dimensions: [
      { name: "Financière", indicators: [ind("Rentabilité (résultat / actifs ou capitaux propres)", "quantitative", "%"), ind("Marge nette", "quantitative", "%")] },
      { name: "Commerciale", indicators: [ind("Évolution des ventes", "quantitative", "% de variation"), ind("Part de marché estimée", "quantitative", "%")] },
      { name: "Opérationnelle", indicators: [ind("Délais de production ou de service", "quantitative", "jours ou heures"), ind("Taux d'erreurs ou de rebuts", "quantitative", "%")] },
      { name: "Sociale", indicators: [ind("Absentéisme", "quantitative", "taux"), ind("Rotation du personnel", "quantitative", "taux annuel")] },
    ],
    precisions: ["Préciser la dimension de la performance retenue et la période de mesure."],
  },
  {
    id: "satisfaction",
    label: "Satisfaction",
    aliases: ["satisfaction", "satisfaction des clients", "satisfaction client", "satisfaction des usagers"],
    definition: "Jugement que portent les personnes concernées par {unit} sur l'écart entre leurs attentes et ce qu'elles ont effectivement reçu.",
    dimensions: [
      { name: "Qualité perçue", indicators: [ind("Appréciation de la qualité du produit ou du service", "ordinal", "échelle de Likert en 5 points")] },
      { name: "Comportements d'intention", indicators: [ind("Intention de recommander", "ordinal", "note de 0 à 10"), ind("Intention de revenir", "ordinal", "échelle de Likert")] },
      { name: "Insatisfaction exprimée", indicators: [ind("Réclamations enregistrées", "quantitative", "nombre sur la période")] },
    ],
    precisions: ["Préciser qui évalue (clients, usagers, employés) et sur quel service."],
  },
  {
    id: "qualite-de-service",
    label: "Qualité de service",
    aliases: ["qualité de service", "qualité des services", "qualité du service"],
    definition: "Écart perçu entre le service attendu et le service reçu auprès de {unit}.",
    dimensions: [
      { name: "Fiabilité", indicators: [ind("Respect des engagements annoncés", "ordinal", "échelle de Likert")] },
      { name: "Réactivité", indicators: [ind("Rapidité de prise en charge", "ordinal", "échelle de Likert"), ind("Temps d'attente", "quantitative", "minutes")] },
      { name: "Assurance et empathie", indicators: [ind("Compétence et courtoisie perçues du personnel", "ordinal", "échelle de Likert")] },
      { name: "Éléments tangibles", indicators: [ind("État des locaux et des équipements", "ordinal", "échelle de Likert")] },
    ],
    precisions: ["Préciser le service évalué et le point de vue (usagers, clients)."],
  },
  {
    id: "motivation",
    label: "Motivation",
    aliases: ["motivation", "motivation du personnel", "motivation des employés", "motivation des agents"],
    definition: "Ensemble des forces qui poussent les membres de {unit} à s'engager dans leur travail et à y persévérer.",
    ambiguity: "Préciser s'il s'agit de motivation intrinsèque (intérêt du travail) ou extrinsèque (rémunération, reconnaissance).",
    dimensions: [
      { name: "Motivation intrinsèque", indicators: [ind("Intérêt pour les tâches", "ordinal", "échelle de Likert")] },
      { name: "Motivation extrinsèque", indicators: [ind("Satisfaction à l'égard de la rémunération et des primes", "ordinal", "échelle de Likert"), ind("Reconnaissance perçue", "ordinal", "échelle de Likert")] },
      { name: "Engagement observable", indicators: [ind("Absentéisme", "quantitative", "jours d'absence par an"), ind("Heures supplémentaires volontaires", "quantitative", "heures par mois")] },
    ],
    precisions: ["Préciser si la motivation est déclarée (questionnaire) ou observée (indicateurs RH)."],
  },
  {
    id: "productivite",
    label: "Productivité",
    aliases: ["productivité", "productivité du travail", "rendement"],
    definition: "Rapport entre la production obtenue par {unit} et les ressources mobilisées pour l'obtenir.",
    dimensions: [{ name: "Productivité du travail", indicators: [ind("Production par travailleur", "quantitative", "unités ou montant par personne"), ind("Production par heure travaillée", "quantitative", "unités par heure")] }],
    precisions: ["Préciser l'unité de production retenue et la période."],
  },
  {
    id: "rentabilite",
    label: "Rentabilité",
    aliases: ["rentabilité"],
    definition: "Capacité de {unit} à dégager un résultat au regard des moyens engagés.",
    dimensions: [{ name: "Rentabilité", indicators: [ind("Rentabilité économique (résultat / actif)", "quantitative", "%"), ind("Rentabilité financière (résultat net / capitaux propres)", "quantitative", "%"), ind("Marge nette", "quantitative", "%")] }],
    precisions: ["Préciser la source comptable et l'exercice étudié."],
  },
  {
    id: "acces-au-credit",
    label: "Accès au crédit",
    aliases: ["accès au crédit", "accès au financement", "microcrédit", "microfinance", "crédit"],
    definition: "Possibilité effective pour {unit} d'obtenir un financement adapté, et conditions dans lesquelles il est obtenu.",
    dimensions: [
      { name: "Accès", indicators: [ind("Demande de crédit déposée", "binary", "oui / non"), ind("Crédit obtenu", "binary", "oui / non")] },
      { name: "Conditions", indicators: [ind("Montant obtenu", "quantitative", "montant"), ind("Taux d'intérêt", "quantitative", "%"), ind("Garanties exigées", "nominal", "types")] },
    ],
    precisions: ["Préciser l'institution et la période de référence."],
  },
  {
    id: "formation",
    label: "Formation",
    aliases: ["formation", "formation du personnel", "renforcement des capacités", "formation continue"],
    definition: "Actions d'apprentissage organisées pour développer les compétences des membres de {unit}.",
    dimensions: [
      { name: "Participation", indicators: [ind("Heures de formation suivies", "quantitative", "heures par an"), ind("Nombre de formations suivies", "quantitative", "nombre")] },
      { name: "Adéquation et transfert", indicators: [ind("Utilité perçue pour le poste", "ordinal", "échelle de Likert"), ind("Application des acquis au travail", "ordinal", "échelle de Likert")] },
    ],
    precisions: ["Préciser le type de formation et la période."],
  },
  {
    id: "leadership",
    label: "Leadership",
    aliases: ["leadership", "style de leadership", "style de management", "style de direction"],
    definition: "Manière dont les responsables de {unit} orientent, mobilisent et soutiennent leurs équipes.",
    ambiguity: "Préciser le cadre théorique retenu (par exemple leadership transformationnel, transactionnel ou participatif).",
    dimensions: [
      { name: "Leadership transformationnel", indicators: [ind("Vision partagée et inspiration perçues", "ordinal", "échelle de Likert")] },
      { name: "Leadership transactionnel", indicators: [ind("Récompenses liées aux objectifs", "ordinal", "échelle de Likert")] },
      { name: "Participation aux décisions", indicators: [ind("Consultation des collaborateurs", "ordinal", "échelle de fréquence")] },
    ],
    precisions: ["Préciser qui évalue le leadership (collaborateurs, responsables)."],
  },
  {
    id: "gouvernance",
    label: "Gouvernance",
    aliases: ["gouvernance", "bonne gouvernance"],
    definition: "Règles et pratiques de direction, de contrôle et de redevabilité au sein de {unit}.",
    ambiguity: "Le terme est large : préciser les mécanismes étudiés (transparence, contrôle, participation, redevabilité).",
    dimensions: [
      { name: "Transparence", indicators: [ind("Publication des comptes ou des décisions", "binary", "oui / non")] },
      { name: "Contrôle et redevabilité", indicators: [ind("Existence d'organes de contrôle actifs", "binary", "oui / non"), ind("Fréquence des réunions de contrôle", "quantitative", "nombre par an")] },
    ],
    precisions: ["Préciser les mécanismes de gouvernance retenus."],
  },
  {
    id: "confiance",
    label: "Confiance des clients",
    aliases: ["confiance des clients", "confiance", "confiance des consommateurs"],
    definition: "Disposition des clients de {unit} à s'en remettre au vendeur (produit, paiement, livraison) malgré l'incertitude.",
    dimensions: [{ name: "Objets de la confiance", indicators: [ind("Confiance dans le vendeur", "ordinal", "échelle de Likert"), ind("Confiance dans le paiement en ligne", "ordinal", "échelle de Likert"), ind("Confiance dans la livraison", "ordinal", "échelle de Likert")] }],
    precisions: ["Préciser si la confiance est mesurée auprès des clients ou estimée par les dirigeants."],
  },
  {
    id: "acces-internet",
    label: "Accès à Internet",
    aliases: ["accès à internet", "connexion internet", "connectivité", "internet"],
    definition: "Disponibilité, qualité et coût de la connexion Internet dont dispose {unit}.",
    dimensions: [{ name: "Accès", indicators: [ind("Type de connexion (mobile, fixe, satellite)", "nominal", "catégories"), ind("Interruptions de connexion", "ordinal", "rarement / parfois / souvent"), ind("Dépense mensuelle de connexion", "quantitative", "montant")] }],
    precisions: ["Préciser la période et le lieu d'usage (local commercial, domicile)."],
  },
  {
    id: "electricite",
    label: "Disponibilité de l'électricité",
    aliases: ["disponibilité de l'électricité", "électricité", "énergie électrique", "délestage", "délestages"],
    definition: "Disponibilité de l'énergie électrique nécessaire aux activités de {unit}.",
    dimensions: [{ name: "Disponibilité", indicators: [ind("Heures d'électricité disponibles par jour", "quantitative", "heures"), ind("Coupures par semaine", "quantitative", "nombre"), ind("Source d'appoint (groupe, solaire)", "nominal", "catégories")] }],
    precisions: ["Préciser si la mesure est déclarée ou relevée, et sur quelle période."],
  },
  {
    id: "livraison",
    label: "Livraison",
    aliases: ["livraison", "livraisons", "logistique"],
    definition: "Capacité de {unit} à acheminer les produits vers les clients dans des conditions de délai, de coût et de fiabilité acceptables.",
    dimensions: [{ name: "Service de livraison", indicators: [ind("Délai moyen de livraison", "quantitative", "heures ou jours"), ind("Livraisons échouées ou retardées", "quantitative", "% des commandes"), ind("Coût de livraison supporté", "quantitative", "montant")] }],
    precisions: ["Préciser qui assure la livraison (interne, prestataire, client)."],
  },
];

/** Termes souvent trop vagues pour être vérifiés sans précision. */
export const VAGUE_TERMS = [
  "impact",
  "effet",
  "influence",
  "role",
  "efficacite",
  "efficience",
  "performance",
  "qualite",
  "developpement",
  "amelioration",
  "succes",
  "reussite",
  "bien-etre",
  "important",
  "importante",
  "significatif",
  "significative",
  "meilleur",
  "meilleure",
  "beaucoup",
  "considerablement",
];

/** Noms d'unités d'analyse fréquentes (servent à repérer la population dans une phrase). */
export const POPULATION_NOUNS = [
  "pme",
  "pmes",
  "entreprises",
  "entreprise",
  "menages",
  "etudiants",
  "eleves",
  "agents",
  "employes",
  "salaries",
  "travailleurs",
  "clients",
  "patients",
  "femmes",
  "jeunes",
  "commercants",
  "agriculteurs",
  "enseignants",
  "banques",
  "institutions",
  "organisations",
  "habitants",
  "consommateurs",
  "usagers",
  "cooperatives",
  "communes",
  "entrepreneurs",
  "entrepreneures",
  "entrepreneur",
  "repondants",
  "repondantes",
  "ecoles",
  "hopitaux",
];

/** Marqueurs (texte replié, sans accents). */
export const MARKERS = {
  causal: /\b(impacts?|effets?|influencen?t?|influences?|influe(?:nt)?|incidence|determine(?:nt)?|determinants?|cause(?:nt)?|entraine(?:nt)?|conduit a|ameliore(?:nt)?|favorise(?:nt)?|reduit|reduisent|augmente(?:nt)?|diminue(?:nt)?|contribue(?:nt)?|contribution|affecte(?:nt)?|explique(?:nt)?)\b/,
  association: /\b(associee?s?|association|liens?|liee?s?|relations?|correle(?:e|es|s)?|correlation|rapport entre|varie(?:nt)? avec|dans quelle mesure)\b/,
  comparative: /\b(compar\w*|differences?|differe(?:nt)?|ecarts? entre)\b/,
  descriptive: /\b(decrire|description|etat des lieux|caracteris\w*|dresser|profil|inventaire|recenser|niveau de|identifier les)\b/,
  exploratory: /\b(comprendre|explorer|exploratoire|perceptions?|representations?|vecu|experiences?|pourquoi|comment les|logiques?|strategies d'adaptation|sens donne)\b/,
  qualitative: /\b(entretiens?|qualitative?s?|recits?|focus groups?|observation participante|etude de cas|analyse de contenu|thematique)\b/,
  quantitative: /\b(questionnaires?|echantillon|regression|quantitative?s?|statistiques?|mesurer|enquete)\b/,
  mediator: /\b(par l'intermediaire|via|a travers|mediat\w*|par le biais)\b/,
  moderator: /\b(moder\w*|en fonction de|conditionne\w*)\b/,
};
