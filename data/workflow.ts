// P13 — corrige plusieurs étapes qui décrivaient des fonctionnalités
// inexistantes (SPSS, ANOVA, bibliographie APA/MLA/Chicago,
// présentation PowerPoint, coaching de soutenance, questions du
// jury) comme si elles étaient déjà construites. Chaque étape décrit
// désormais une capacité réellement présente dans le produit (P1-P12).

export const journey = [
  {
    id: 1,
    step: "01",
    icon: "folder",
    title: "Créer votre projet",
    description:
      "Décrivez votre sujet ou votre idée de recherche. ACADIA prépare instantanément votre espace de travail.",
    status: "completed",
    locked: false,
  },

  {
    id: 2,
    step: "02",
    icon: "brain",
    title: "Compréhension du sujet",
    description:
      "Analyse du sujet, problématique, objectifs, hypothèses, variables et méthodologie — toujours à valider par vous.",
    status: "current",
    locked: false,
  },

  {
    id: 3,
    step: "03",
    icon: "clipboard",
    title: "Instrument de collecte",
    description:
      "Un questionnaire ou un guide d'entretien adapté à vos variables, entièrement modifiable avant diffusion.",
    status: "locked",
    locked: true,
  },

  {
    id: 4,
    step: "04",
    icon: "chart",
    title: "Analyse statistique",
    description:
      "Statistiques descriptives, analyses bivariées (khi², corrélations) et régression économétrique (MCO) — calculées de façon déterministe.",
    status: "locked",
    locked: true,
  },

  {
    id: 5,
    step: "05",
    icon: "book",
    title: "Interprétation & discussion",
    description:
      "Une lecture prudente de vos résultats, confrontée à vos hypothèses — jamais une causalité affirmée à partir d'une association.",
    status: "locked",
    locked: true,
  },

  {
    id: 6,
    step: "06",
    icon: "file",
    title: "Travail scientifique",
    description:
      "Une structure complète (Introduction, Méthodologie, Résultats, Discussion, Conclusion) préparée à partir de vos données validées.",
    status: "locked",
    locked: true,
  },

  {
    id: 7,
    step: "07",
    icon: "graduation",
    title: "Export du document",
    description:
      "Votre travail scientifique exporté en DOCX ou PDF, avec page de garde, table des matières et bibliographie.",
    status: "locked",
    locked: true,
  },
];
