// P13 — corrige plusieurs réponses qui décrivaient des capacités
// inexistantes (ANOVA jamais implémentée, paiement Mobile Money
// jamais connecté) comme si elles étaient déjà actives. En bêta,
// ACADIA ne doit jamais affirmer "Oui" à une fonctionnalité qui
// n'existe pas encore réellement.

export const faq = [
  {
    question: "Est-ce qu'ACADIA rédige entièrement un mémoire ?",
    answer:
      "Non. ACADIA est un assistant académique qui vous accompagne dans la construction de votre mémoire. Vous restez toujours l'auteur de votre travail et gardez le contrôle sur chaque étape.",
  },

  {
    question: "Les universités acceptent-elles les travaux réalisés avec ACADIA ?",
    answer:
      "ACADIA vous aide à produire un travail structuré selon les méthodes de recherche en Sciences Économiques et de Gestion. Les exigences varient selon les universités et les directeurs de mémoire — vérifiez toujours les consignes propres à votre établissement.",
  },

  {
    question: "Puis-je utiliser ACADIA pour une Licence, un Master ou un Doctorat ?",
    answer:
      "Oui, pour la recherche en Sciences Économiques et de Gestion. ACADIA n'est aujourd'hui pas spécialisé pour les autres disciplines.",
  },

  {
    question: "Les questionnaires sont-ils générés automatiquement ?",
    answer:
      "Oui. En fonction de votre sujet, ACADIA propose un questionnaire ou un guide d'entretien cohérent avec votre problématique, vos objectifs et vos hypothèses — entièrement modifiable avant diffusion.",
  },

  {
    question: "Les analyses statistiques sont-elles fiables ?",
    answer:
      "ACADIA calcule les statistiques descriptives, les tests bivariés (corrélations, khi²) et un modèle économétrique (régression MCO) de façon déterministe — aucun résultat statistique n'est généré par l'IA.",
  },

  {
    question: "Dois-je payer pour utiliser ACADIA ?",
    answer:
      "En version bêta, ACADIA est accessible sans paiement. Un modèle de tarification est à l'étude mais n'est pas encore activé.",
  },

  {
    question: "Mes données sont-elles isolées de celles des autres utilisateurs ?",
    answer:
      "Oui. Chaque compte a ses propres projets, questionnaires, données et analyses, séparés de ceux des autres utilisateurs sur cet appareil.",
  },
];
