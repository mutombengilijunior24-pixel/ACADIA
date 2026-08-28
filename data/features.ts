// P13 — cette liste décrit UNIQUEMENT des capacités réellement
// construites (P1-P12). Avant P13, plusieurs entrées décrivaient
// des fonctionnalités inexistantes (export Excel, bibliographie
// APA/MLA/Chicago, préparation à la soutenance avec questions du
// jury, ANOVA) — jamais une fonctionnalité annoncée qui n'existe
// pas dans le produit.

export const features = [
  {
    icon: "brain",
    title: "Compréhension du sujet",
    description:
      "Analyse votre sujet et propose variables, objectifs, hypothèses et problématique — toujours à valider par vous.",
    color: "bg-blue-100 text-blue-600",
    benefits: [
      "Analyse du sujet de recherche",
      "Variables et hypothèses proposées",
      "Objectifs et problématique structurés",
    ],
  },

  {
    icon: "clipboard",
    title: "Instrument de collecte",
    description:
      "Génère un questionnaire ou un guide d'entretien adapté à vos variables, entièrement modifiable avant diffusion.",
    color: "bg-violet-100 text-violet-600",
    benefits: [
      "Questions reliées à vos variables",
      "Guide d'entretien pour le qualitatif",
      "Édition complète avant publication",
    ],
  },

  {
    icon: "chart",
    title: "Analyse statistique",
    description:
      "Statistiques descriptives, analyses bivariées (khi², corrélations) et modèle économétrique (régression MCO) — calculés de façon déterministe.",
    color: "bg-green-100 text-green-600",
    benefits: [
      "Statistiques descriptives complètes",
      "Tests bivariés avec seuils de signification",
      "Régression MCO avec diagnostics",
    ],
  },

  {
    icon: "book",
    title: "Interprétation & discussion",
    description:
      "Une interprétation prudente de vos résultats, confrontée à vos hypothèses — jamais une causalité affirmée à partir d'une simple association.",
    color: "bg-orange-100 text-orange-600",
    benefits: [
      "Lecture économique des coefficients",
      "Confrontation aux hypothèses",
      "Limites et précautions explicites",
    ],
  },

  {
    icon: "export",
    title: "Export professionnel",
    description: "Exportez votre travail scientifique en DOCX ou PDF, avec page de garde, table des matières et bibliographie.",
    color: "bg-pink-100 text-pink-600",
    benefits: [
      "Export DOCX éditable",
      "Export PDF paginé",
      "Mise en page académique modifiable",
    ],
  },

  {
    icon: "graduation",
    title: "Production scientifique",
    description: "Une structure de travail scientifique complète (IRMRD), avec un contrôle de préparation avant révision par votre encadreur.",
    color: "bg-cyan-100 text-cyan-600",
    benefits: [
      "Structure Introduction–Méthodologie–Résultats–Discussion",
      "Contrôle de préparation du document",
      "Édition humaine à chaque section",
    ],
  },
];
