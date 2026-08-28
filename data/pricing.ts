// P13 — corrige les fonctionnalités listées ici qui n'existent pas
// dans le produit (QR Code, export Excel, ANOVA, présentation
// PowerPoint, "soutenance IA" avec questions du jury prédites) —
// jamais une capacité annoncée qui n'est pas réellement construite.
// NB : le mécanisme de paiement/déblocage par étape (`price`,
// bouton "Débloquer cette étape") reste décoratif dans ce sprint —
// voir ACADIA_P13_PRODUCT_ARCHITECTURE.md, limite documentée.

export const pricingSteps = [
  {
    id: 1,
    status: "free",
    progress: 15,
    title: "Commencez votre recherche",
    subtitle: "Gratuit",
    description:
      "Lancez votre projet gratuitement et construisez les bases scientifiques de votre mémoire.",

    features: [
      "Création du projet",
      "Analyse du sujet",
      "Variables",
      "Objectifs",
      "Hypothèses",
      "Plan du mémoire",
    ],

    button: "Commencer gratuitement",

    price: null,

    color: "green",
  },

  {
    id: 2,
    status: "locked",
    progress: 30,
    title: "Continuez votre recherche",
    subtitle: "Questionnaire intelligent",
    description:
      "Votre sujet est prêt. Débloquez maintenant un questionnaire scientifique généré automatiquement.",

    features: [
      "Questions générées par IA",
      "Variables liées",
      "Validation scientifique",
      "Lien de partage",
    ],

    button: "Débloquer cette étape",

    price: 5,

    color: "purple",
  },

  {
    id: 3,
    status: "locked",
    progress: 45,
    title: "Continuez votre collecte",
    subtitle: "Publication & Réponses",
    description:
      "Diffusez votre questionnaire et recevez les réponses en temps réel.",

    features: [
      "Publication",
      "Notifications",
      "Réponses temps réel",
    ],

    button: "Débloquer cette étape",

    price: 3,

    color: "blue",
  },

  {
    id: 4,
    status: "locked",
    progress: 60,
    title: "Continuez votre analyse",
    subtitle: "Analyse statistique IA",
    description:
      "Analysez vos données sans logiciel statistique tiers — calculs déterministes.",

    features: [
      "Statistiques descriptives",
      "Corrélations",
      "Régression économétrique (MCO)",
      "Khi²",
      "Graphiques",
    ],

    button: "Débloquer cette étape",

    price: 7,

    color: "orange",
  },

  {
    id: 5,
    status: "locked",
    progress: 75,
    title: "Continuez votre rédaction",
    subtitle: "Interprétation intelligente",
    description:
      "Transformez automatiquement vos résultats en contenu scientifique.",

    features: [
      "Interprétation",
      "Discussion",
      "Conclusion",
      "Bibliographie",
      "Mise en page",
    ],

    button: "Débloquer cette étape",

    price: 5,

    color: "emerald",
  },

  {
    id: 6,
    status: "locked",
    progress: 90,
    title: "Finalisez votre travail scientifique",
    subtitle: "Production scientifique",
    description:
      "Structurez votre travail (Introduction, Méthodologie, Résultats, Discussion, Conclusion) et vérifiez sa préparation.",

    features: [
      "Structure IRMRD",
      "Contrôle de préparation",
      "Édition humaine à chaque section",
    ],

    button: "Débloquer cette étape",

    price: 5,

    color: "amber",
  },

  {
    id: 7,
    status: "premium",
    progress: 100,
    title: "Tout débloquer",
    subtitle: "ACADIA Premium",
    description:
      "Accédez immédiatement à toutes les fonctionnalités présentes et futures d'ACADIA.",

    features: [
      "Toutes les analyses statistiques",
      "Production scientifique complète",
      "Export DOCX & PDF illimité",
      "Mises à jour incluses",
      "Support prioritaire",
    ],

    button: "Découvrir ACADIA Premium",

    price: 19,

    color: "premium",
  },
];