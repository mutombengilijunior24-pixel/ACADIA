// Cette liste décrit UNIQUEMENT des capacités réellement construites —
// jamais une fonctionnalité annoncée qui n'existe pas dans le produit.
// Recentrage du 2026-11-14 : ACADIA se limite à la récolte et à
// l'interprétation des données (plus d'analyse de sujet ni de
// production scientifique annoncées ici).

export const features = [
  {
    icon: "clipboard",
    title: "Questionnaire d'enquête",
    description:
      "Créez votre questionnaire avec ACADIA, ou importez celui que vous avez déjà rédigé (Word, PDF, texte), puis diffusez-le par un simple lien.",
    color: "bg-violet-100 text-violet-600",
    benefits: [
      "Création guidée ou import d'un questionnaire existant",
      "Lien de diffusion à partager avec vos répondants",
      "Réponses centralisées, prêtes à analyser",
    ],
  },

  {
    icon: "chart",
    title: "Analyse statistique",
    description:
      "Statistiques descriptives, tests bivariés (khi², corrélations), économétrie et analyse financière, selon votre spécialité — calculés de façon déterministe.",
    color: "bg-green-100 text-green-600",
    benefits: [
      "Statistiques descriptives complètes",
      "Tests bivariés avec seuils de signification",
      "Économétrie et ratios financiers",
    ],
  },

  {
    icon: "book",
    title: "Interprétation des résultats",
    description:
      "Une interprétation prudente de vos résultats, confrontée à vos hypothèses — jamais une causalité affirmée à partir d'une simple association.",
    color: "bg-orange-100 text-orange-600",
    benefits: [
      "Lecture économique des résultats",
      "Confrontation aux hypothèses",
      "Limites et précautions explicites",
    ],
  },

  {
    icon: "export",
    title: "Export Word",
    description: "Exportez vos résultats, tableaux et interprétations dans un document Word que vous pouvez modifier librement.",
    color: "bg-pink-100 text-pink-600",
    benefits: [
      "Document Word éditable",
      "Tableaux et graphiques inclus",
      "Mise en page académique modifiable",
    ],
  },
];
