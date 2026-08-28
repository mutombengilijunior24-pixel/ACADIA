// P13 — remplace d'anciens chiffres d'adoption fabriqués (« 200+
// étudiants accompagnés », « 500+ documents réalisés ») par des
// faits vérifiables sur ce que le produit fait réellement — jamais
// une statistique d'usage inventée pour un produit encore en bêta
// sans utilisateurs réels mesurés.

export const stats = [
  {
    icon: "graduation",
    value: 8,
    suffix: "",
    title: "Blocs scientifiques",
    description: "Du cadrage du sujet à la production du travail scientifique final.",
    color: "bg-blue-100 text-blue-600",
  },
  {
    icon: "building",
    value: 3,
    suffix: "",
    title: "Familles d'analyse",
    description: "Descriptive, bivariée et économétrique — calculées de façon déterministe.",
    color: "bg-violet-100 text-violet-600",
  },
  {
    icon: "file",
    value: 2,
    suffix: "",
    title: "Formats d'export",
    description: "Document scientifique final en DOCX et PDF.",
    color: "bg-green-100 text-green-600",
  },
  {
    icon: "zap",
    value: 100,
    suffix: "%",
    title: "Calculs déterministes",
    description: "Aucun résultat statistique n'est généré par l'IA — jamais inventé.",
    color: "bg-yellow-100 text-yellow-600",
  },
];
