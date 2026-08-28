import type { ResearchData } from "@/types/Research";

import type {
  GeneratedQuestionnaire,
  QuestionnaireOption,
  QuestionnaireQuestion,
  QuestionnaireSection,
  QuestionnaireVariable,
  ResearchQuestionnaireMode,
} from "./QuestionnaireTypes";

import { validateQuestionnaire } from "./QuestionnaireValidator";

import {
  reasonAboutQuestionnaire,
} from "./QuestionnaireReasoning";

/* =========================================================
   ÉCHELLES
========================================================= */

export const LIKERT_OPTIONS: QuestionnaireOption[] = [
  {
    label: "Pas du tout d'accord",
    value: "1",
  },
  {
    label: "Pas d'accord",
    value: "2",
  },
  {
    label: "Neutre",
    value: "3",
  },
  {
    label: "D'accord",
    value: "4",
  },
  {
    label: "Tout à fait d'accord",
    value: "5",
  },
];

export const FREQUENCY_OPTIONS: QuestionnaireOption[] = [
  {
    label: "Jamais",
    value: "1",
  },
  {
    label: "Rarement",
    value: "2",
  },
  {
    label: "Parfois",
    value: "3",
  },
  {
    label: "Souvent",
    value: "4",
  },
  {
    label: "Toujours",
    value: "5",
  },
];

export const YES_NO_OPTIONS: QuestionnaireOption[] = [
  {
    label: "Oui",
    value: "oui",
  },
  {
    label: "Non",
    value: "non",
  },
];

/* =========================================================
   OUTILS
========================================================= */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cleanText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

/* =========================================================
   OBJECTIFS
========================================================= */

function selectObjective(
  objectives: string[],
  dimensionIndex: number,
  indicatorIndex: number
): {
  objective: string | undefined;
  objectiveIndex: number | undefined;
} {
  if (objectives.length === 0) {
    return {
      objective: undefined,
      objectiveIndex: undefined,
    };
  }

  const index =
    (dimensionIndex + indicatorIndex) %
    objectives.length;

  return {
    objective: objectives[index],
    objectiveIndex: index,
  };
}

/* =========================================================
   TYPE DE RECHERCHE
========================================================= */

function detectResearchType(
  researchType: string
): ResearchQuestionnaireMode {
  const type = normalize(researchType);

  if (
    type.includes("qual") ||
    type.includes("exploratoire")
  ) {
    return "qualitative";
  }

  if (
    type.includes("mixte") ||
    type.includes("mixed")
  ) {
    return "mixed";
  }

  return "quantitative";
}

/* =========================================================
   DÉTECTION DES VARIABLES
========================================================= */

function detectVariables(title: string) {
  const cleanTitle = cleanText(title);

  const patterns = [
    /influence\s+(?:de|du|des|d')(.+?)\s+sur\s+(.+)/i,

    /impact\s+(?:de|du|des|d')(.+?)\s+sur\s+(.+)/i,

    /effet\s+(?:de|du|des|d')(.+?)\s+sur\s+(.+)/i,

    /relation\s+entre\s+(.+?)\s+et\s+(.+)/i,

    /influence\s+(.+?)\s+sur\s+(.+)/i,

    /impact\s+(.+?)\s+sur\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanTitle.match(pattern);

    if (match) {
      return {
        independent: cleanText(match[1]),
        dependent: cleanText(
          match[2].replace(/[.?]+$/, "")
        ),
      };
    }
  }

  const normalized = normalize(
    cleanTitle
  );

  const dictionary = [
    {
      keywords: [
        "remuneration",
        "motivation",
      ],
      independent: "Rémunération",
      dependent: "Motivation",
    },

    {
      keywords: [
        "evaluation",
        "motivation",
      ],
      independent:
        "Évaluation du personnel",
      dependent: "Motivation",
    },

    {
      keywords: [
        "gouvernance",
        "performance",
      ],
      independent: "Gouvernance",
      dependent: "Performance",
    },

    {
      keywords: [
        "formation",
        "performance",
      ],
      independent: "Formation",
      dependent: "Performance",
    },

    {
      keywords: [
        "satisfaction",
        "performance",
      ],
      independent: "Satisfaction",
      dependent: "Performance",
    },

    {
      keywords: [
        "gestion",
        "performance",
      ],
      independent: "Gestion",
      dependent: "Performance",
    },

    {
      keywords: [
        "conditions",
        "travail",
        "motivation",
      ],
      independent:
        "Conditions de travail",
      dependent: "Motivation",
    },
  ];

  for (const item of dictionary) {
    if (
      item.keywords.every(
        (keyword) =>
          normalized.includes(keyword)
      )
    ) {
      return {
        independent:
          item.independent,
        dependent:
          item.dependent,
      };
    }
  }

  return {
    independent:
      "Variable explicative",
    dependent:
      "Variable expliquée",
  };
}

/* =========================================================
   DIMENSIONS
========================================================= */

function getDimensions(
  variable: string
): string[] {
  const normalized =
    normalize(variable);

  if (
    normalized.includes("evaluation") ||
    normalized.includes("appreciation")
  ) {
    return [
      "Fréquence",
      "Critères utilisés",
      "Objectivité",
      "Régularité",
      "Feedback",
      "Participation",
    ];
  }

  if (
    normalized.includes("motivation")
  ) {
    return [
      "Satisfaction au travail",
      "Engagement professionnel",
      "Implication",
      "Reconnaissance",
      "Accomplissement",
      "Persévérance",
    ];
  }

  if (
    normalized.includes(
      "remuneration"
    ) ||
    normalized.includes("salaire")
  ) {
    return [
      "Niveau de rémunération",
      "Régularité du paiement",
      "Équité perçue",
      "Satisfaction salariale",
      "Incitations",
    ];
  }

  if (
    normalized.includes("performance")
  ) {
    return [
      "Productivité",
      "Qualité du travail",
      "Efficacité",
      "Atteinte des objectifs",
      "Engagement",
    ];
  }

  if (
    normalized.includes("formation")
  ) {
    return [
      "Accès à la formation",
      "Pertinence des formations",
      "Fréquence",
      "Acquisition de compétences",
      "Application des acquis",
    ];
  }

  if (
    normalized.includes("gouvernance")
  ) {
    return [
      "Transparence",
      "Participation",
      "Responsabilité",
      "Prise de décision",
      "Contrôle",
    ];
  }

  if (
    normalized.includes(
      "condition"
    ) &&
    normalized.includes("travail")
  ) {
    return [
      "Environnement de travail",
      "Sécurité",
      "Matériel disponible",
      "Charge de travail",
      "Relations professionnelles",
    ];
  }

  return [
    "Perception",
    "Pratiques",
    "Satisfaction",
    "Efficacité",
    "Résultats",
  ];
}

/* =========================================================
   INDICATEURS
========================================================= */

function getIndicators(
  variable: string,
  dimension: string
): string[] {
  const variableName =
    normalize(variable);

  const dimensionName =
    normalize(dimension);

  if (
    variableName.includes(
      "evaluation"
    )
  ) {
    const map: Record<
      string,
      string[]
    > = {
      frequence: [
        "Périodicité des évaluations",
        "Nombre d'évaluations réalisées",
      ],

      criteresutilises: [
        "Clarté des critères",
        "Pertinence des critères",
      ],

      objectivite: [
        "Impartialité perçue",
        "Équité de l'évaluation",
      ],

      regularite: [
        "Respect du calendrier",
        "Continuité des évaluations",
      ],

      feedback: [
        "Retour après évaluation",
        "Clarté du feedback",
      ],

      participation: [
        "Participation du salarié",
        "Possibilité de donner son avis",
      ],
    };

    return (
      map[dimensionName] ??
      [dimension]
    );
  }

  if (
    variableName.includes(
      "motivation"
    )
  ) {
    const map: Record<
      string,
      string[]
    > = {
      satisfactionautravail: [
        "Satisfaction générale",
        "Plaisir au travail",
      ],

      engagementprofessionnel: [
        "Attachement à l'organisation",
        "Volonté de contribuer",
      ],

      implication: [
        "Effort fourni",
        "Participation aux activités",
      ],

      reconnaissance: [
        "Reconnaissance des efforts",
        "Valorisation du travail",
      ],

      accomplissement: [
        "Recherche de réussite",
        "Volonté de progresser",
      ],

      perseverance: [
        "Persévérance",
        "Maintien de l'effort",
      ],
    };

    return (
      map[dimensionName] ??
      [dimension]
    );
  }

  if (
    variableName.includes(
      "remuneration"
    ) ||
    variableName.includes("salaire")
  ) {
    return [
      `Niveau de ${dimension.toLowerCase()}`,
      `Perception de ${dimension.toLowerCase()}`,
    ];
  }

  return [
    `Niveau de ${dimension.toLowerCase()}`,
    `Perception de ${dimension.toLowerCase()}`,
  ];
}
/* =========================================================
   QUESTIONS QUANTITATIVES
========================================================= */

function createLikertQuestion(
  number: number,
  sectionId: string,
  variable: string,
  dimension: string,
  indicator: string,
  objective: string | undefined,
  objectiveIndex: number | undefined,
  text: string
): QuestionnaireQuestion {
  return {
    id: `Q${number}`,

    number,

    sectionId,

    type: "likert",

    text,

    required: true,

    variable,

    dimension,

    indicator,

    objective,

    objectiveIndex,

    objectiveRole:
      objectiveIndex !==
      undefined
        ? "specific"
        : undefined,

    methodologicalPurpose:
      `Mesurer l'indicateur « ${indicator} » de la dimension « ${dimension} » de la variable « ${variable} » afin de contribuer à l'objectif spécifique correspondant.`,

    analysisHint:
      "Analyse descriptive par fréquences, pourcentages et moyenne des réponses.",

    scale:
      LIKERT_OPTIONS,
  };
}

/* =========================================================
   QUESTIONS QUALITATIVES
========================================================= */

function createOpenQuestion(
  number: number,
  sectionId: string,
  variable: string,
  dimension: string,
  objective: string | undefined,
  objectiveIndex: number | undefined,
  text: string
): QuestionnaireQuestion {
  return {
    id: `Q${number}`,

    number,

    sectionId,

    type: "long_text",

    text,

    required: true,

    variable,

    dimension,

    objective,

    objectiveIndex,

    objectiveRole:
      objectiveIndex !==
      undefined
        ? "specific"
        : undefined,

    methodologicalPurpose:
      `Explorer la perception, l'expérience ou l'explication du répondant concernant la dimension « ${dimension} » de la variable « ${variable} ».`,

    analysisHint:
      "Analyse qualitative par regroupement des réponses et analyse thématique.",
  };
}

/* =========================================================
   QUESTION MIXTE
========================================================= */

function createMixedQuestion(
  number: number,
  sectionId: string,
  variable: string,
  dimension: string,
  indicator: string,
  objective: string | undefined,
  objectiveIndex: number | undefined,
  text: string
): QuestionnaireQuestion {
  return {
    id: `Q${number}`,

    number,

    sectionId,

    type: "likert",

    text,

    required: true,

    variable,

    dimension,

    indicator,

    objective,

    objectiveIndex,

    objectiveRole:
      objectiveIndex !==
      undefined
        ? "specific"
        : undefined,

    methodologicalPurpose:
      `Mesurer quantitativement l'indicateur « ${indicator} » tout en permettant une analyse complémentaire des perceptions liées à « ${dimension} » de « ${variable} ».`,

    analysisHint:
      "Analyse quantitative par fréquences et moyennes, complétée par une interprétation qualitative.",
    
    scale:
      LIKERT_OPTIONS,
  };
}

/* =========================================================
   INTRODUCTION
========================================================= */

function buildIntroduction(
  research: ResearchData
): QuestionnaireSection {
  const problemText =
    research.problem?.trim()
      ? ` Elle vise notamment à apporter des éléments de réponse à la problématique suivante : « ${research.problem.trim()} ».`
      : "";

  return {
    id: "introduction",

    title: "Introduction",

    description: cleanText(
      `Cette enquête est réalisée dans le cadre d'une étude portant sur « ${research.title} ».${problemText} Les informations recueillies seront utilisées uniquement à des fins académiques et seront traitées dans le respect de la confidentialité.`
    ),

    type: "introduction",

    questions: [],
  };
}

/* =========================================================
   PROFIL
========================================================= */

function buildProfileSection(
  research: ResearchData
): QuestionnaireSection {
  const population =
    research.population?.trim()
      ? research.population
      : "la population étudiée";

  return {
    id: "profile",

    title:
      "Profil du répondant",

    description:
      `Cette section permet de décrire les caractéristiques générales des personnes interrogées dans le cadre de l'étude portant sur ${population}.`,

    type: "profile",

    questions: [
      {
        id: "Q1",

        number: 1,

        sectionId: "profile",

        type: "single_choice",

        text:
          "Quel est votre sexe ?",

        required: true,

        options: [
          {
            label: "Homme",
            value: "homme",
          },

          {
            label: "Femme",
            value: "femme",
          },

          {
            label:
              "Préfère ne pas répondre",
            value:
              "non_precise",
          },
        ],
      },

      {
        id: "Q2",

        number: 2,

        sectionId: "profile",

        type: "single_choice",

        text:
          "Dans quelle tranche d'âge vous situez-vous ?",

        required: true,

        options: [
          {
            label:
              "Moins de 25 ans",
            value:
              "moins_25",
          },

          {
            label:
              "25–34 ans",
            value:
              "25_34",
          },

          {
            label:
              "35–44 ans",
            value:
              "35_44",
          },

          {
            label:
              "45–54 ans",
            value:
              "45_54",
          },

          {
            label:
              "55 ans et plus",
            value:
              "55_plus",
          },
        ],
      },

      {
        id: "Q3",

        number: 3,

        sectionId: "profile",

        type: "single_choice",

        text:
          "Quel est votre niveau d'études ?",

        required: true,

        options: [
          {
            label:
              "Secondaire",
            value:
              "secondaire",
          },

          {
            label:
              "Graduat / Licence",
            value:
              "graduat_licence",
          },

          {
            label:
              "Master",
            value:
              "master",
          },

          {
            label:
              "Doctorat",
            value:
              "doctorat",
          },
        ],
      },

      {
        id: "Q4",

        number: 4,

        sectionId: "profile",

        type: "single_choice",

        text:
          "Depuis combien de temps travaillez-vous dans cette organisation ?",

        required: true,

        options: [
          {
            label:
              "Moins d'un an",
            value:
              "moins_1",
          },

          {
            label:
              "1 à 5 ans",
            value:
              "1_5",
          },

          {
            label:
              "6 à 10 ans",
            value:
              "6_10",
          },

          {
            label:
              "Plus de 10 ans",
            value:
              "plus_10",
          },
        ],
      },
    ],
  };
}

/* =========================================================
   SECTION QUANTITATIVE
========================================================= */

function buildQuantitativeVariableSection(
  sectionId: string,
  variableType:
    | "independent_variable"
    | "dependent_variable",
  variable: string,
  objectives: string[],
  startNumber: number
): QuestionnaireSection {
  const dimensions =
    getDimensions(variable);

  const questions:
    QuestionnaireQuestion[] =
    [];

  let number = startNumber;

  dimensions.forEach(
    (
      dimension,
      dimensionIndex
    ) => {
      const indicators =
        getIndicators(
          variable,
          dimension
        );

      indicators.forEach(
        (
          indicator,
          indicatorIndex
        ) => {
          const {
            objective,
            objectiveIndex,
          } =
            selectObjective(
              objectives,
              dimensionIndex,
              indicatorIndex
            );

          const questionText =
            `Les ${indicator.toLowerCase()} de ${variable.toLowerCase()} sont-ils satisfaisants dans votre organisation ?`;

          questions.push(
            createLikertQuestion(
              number,
              sectionId,
              variable,
              dimension,
              indicator,
              objective,
              objectiveIndex,
              questionText
            )
          );

          number++;
        }
      );
    }
  );

  return {
    id: sectionId,

    title:
      variableType ===
      "independent_variable"
        ? `Variable explicative : ${variable}`
        : `Variable expliquée : ${variable}`,

    description:
      variableType ===
      "independent_variable"
        ? `Cette section mesure les dimensions de la variable explicative « ${variable} ».`
        : `Cette section mesure les dimensions de la variable expliquée « ${variable} ».`,

    type: variableType,

    questions,
  };
}
/* =========================================================
   SECTION QUALITATIVE
========================================================= */

function buildQualitativeVariableSection(
  sectionId: string,
  variableType:
    | "independent_variable"
    | "dependent_variable",
  variable: string,
  objectives: string[],
  startNumber: number
): QuestionnaireSection {
  const dimensions =
    getDimensions(variable);

  const questions:
    QuestionnaireQuestion[] =
    [];

  let number = startNumber;

  dimensions.forEach(
    (
      dimension,
      dimensionIndex
    ) => {
      const {
        objective,
        objectiveIndex,
      } =
        selectObjective(
          objectives,
          dimensionIndex,
          0
        );

      questions.push(
        createOpenQuestion(
          number,
          sectionId,
          variable,
          dimension,
          objective,
          objectiveIndex,
          `Comment décririez-vous ${dimension.toLowerCase()} de ${variable.toLowerCase()} dans votre organisation ?`
        )
      );

      number++;
    }
  );

  return {
    id: sectionId,

    title:
      variableType ===
      "independent_variable"
        ? `Exploration de ${variable}`
        : `Expérience et perception de ${variable}`,

    description:
      `Cette section explore les perceptions, expériences et explications relatives à « ${variable} ».`,

    type: variableType,

    questions,
  };
}

/* =========================================================
   SECTION MIXTE
========================================================= */

function buildMixedVariableSection(
  sectionId: string,
  variableType:
    | "independent_variable"
    | "dependent_variable",
  variable: string,
  objectives: string[],
  startNumber: number
): QuestionnaireSection {
  const dimensions =
    getDimensions(variable);

  const questions:
    QuestionnaireQuestion[] =
    [];

  let number = startNumber;

  dimensions.forEach(
    (
      dimension,
      dimensionIndex
    ) => {
      const indicators =
        getIndicators(
          variable,
          dimension
        );

      indicators
        .slice(0, 2)
        .forEach(
          (
            indicator,
            indicatorIndex
          ) => {
            const {
              objective,
              objectiveIndex,
            } =
              selectObjective(
                objectives,
                dimensionIndex,
                indicatorIndex
              );

            questions.push(
              createMixedQuestion(
                number,
                sectionId,
                variable,
                dimension,
                indicator,
                objective,
                objectiveIndex,
                `Dans quelle mesure ${indicator.toLowerCase()} de ${variable.toLowerCase()} est-il satisfaisant dans votre organisation ?`
              )
            );

            number++;
          }
        );

      const {
        objective,
        objectiveIndex,
      } =
        selectObjective(
          objectives,
          dimensionIndex,
          0
        );

      questions.push(
        createOpenQuestion(
          number,
          sectionId,
          variable,
          dimension,
          objective,
          objectiveIndex,
          `Comment expliquez-vous votre perception concernant ${dimension.toLowerCase()} de ${variable.toLowerCase()} ?`
        )
      );

      number++;
    }
  );

  return {
    id: sectionId,

    title:
      variableType ===
      "independent_variable"
        ? `Variable explicative : ${variable}`
        : `Variable expliquée : ${variable}`,

    description:
      `Cette section combine des mesures quantitatives et une exploration qualitative de « ${variable} ».`,

    type: variableType,

    questions,
  };
}

/* =========================================================
   RELATION QUANTITATIVE
========================================================= */

function buildQuantitativeRelationshipSection(
  independent: string,
  dependent: string,
  startNumber: number
): QuestionnaireSection {
  return {
    id: "relationship",

    title:
      "Relation entre les variables",

    description:
      `Cette section permet d'examiner la perception de la relation entre ${independent.toLowerCase()} et ${dependent.toLowerCase()}.`,

    type: "relationship",

    questions: [
      {
        id: `Q${startNumber}`,

        number: startNumber,

        sectionId: "relationship",

        type: "likert",

        text:
          `Selon vous, ${independent.toLowerCase()} influence-t-elle ${dependent.toLowerCase()} ?`,

        required: true,

        variable:
          `${independent} → ${dependent}`,

        methodologicalPurpose:
          `Mesurer la perception du lien entre la variable explicative « ${independent} » et la variable expliquée « ${dependent} ».`,
        
        analysisHint:
          "Analyse de fréquences et possibilité de mise en relation avec les mesures des deux variables.",

        scale:
          LIKERT_OPTIONS,
      },

      {
        id:
          `Q${startNumber + 1}`,

        number:
          startNumber + 1,

        sectionId:
          "relationship",

        type:
          "yes_no",

        text:
          `Pensez-vous qu'une amélioration de ${independent.toLowerCase()} pourrait améliorer ${dependent.toLowerCase()} ?`,

        required: true,

        variable:
          `${independent} → ${dependent}`,

        methodologicalPurpose:
          "Recueillir une appréciation directe de l'existence d'une relation perçue entre les deux variables.",

        analysisHint:
          "Analyse par fréquences et pourcentages.",

        options:
          YES_NO_OPTIONS,
      },

      {
        id:
          `Q${startNumber + 2}`,

        number:
          startNumber + 2,

        sectionId:
          "relationship",

        type:
          "text",

        text:
          `Quels aspects de ${independent.toLowerCase()} vous semblent les plus susceptibles d'influencer ${dependent.toLowerCase()} ?`,

        required: false,

        variable:
          `${independent} → ${dependent}`,

        methodologicalPurpose:
          "Identifier les mécanismes ou dimensions de la variable explicative susceptibles d'être associés à la variable expliquée.",

        analysisHint:
          "Regroupement thématique des réponses complémentaires.",
      },
    ],
  };
}

/* =========================================================
   RELATION QUALITATIVE
========================================================= */

function buildQualitativeRelationshipSection(
  independent: string,
  dependent: string,
  startNumber: number
): QuestionnaireSection {
  return {
    id: "relationship",

    title:
      "Relation entre les phénomènes étudiés",

    description:
      "Cette section cherche à comprendre comment les participants expliquent le lien entre les deux phénomènes étudiés.",

    type: "relationship",

    questions: [
      createOpenQuestion(
        startNumber,
        "relationship",
        `${independent} → ${dependent}`,
        "Relation entre les variables",
        undefined,
        undefined,
        `Comment expliquez-vous la relation entre ${independent.toLowerCase()} et ${dependent.toLowerCase()} ?`
      ),

      createOpenQuestion(
        startNumber + 1,
        "relationship",
        `${independent} → ${dependent}`,
        "Facteurs explicatifs",
        undefined,
        undefined,
        `Quels éléments de ${independent.toLowerCase()} vous semblent avoir le plus d'effet sur ${dependent.toLowerCase()} ?`
      ),
    ],
  };
}

/* =========================================================
   RELATION MIXTE
========================================================= */

function buildMixedRelationshipSection(
  independent: string,
  dependent: string,
  startNumber: number
): QuestionnaireSection {
  return {
    id: "relationship",

    title:
      "Relation entre les variables",

    description:
      "Cette section combine une mesure de la relation perçue et une exploration des explications fournies par les répondants.",

    type: "relationship",

    questions: [
      {
        id: `Q${startNumber}`,

        number: startNumber,

        sectionId: "relationship",

        type: "likert",

        text:
          `Dans quelle mesure pensez-vous que ${independent.toLowerCase()} influence ${dependent.toLowerCase()} ?`,

        required: true,

        variable:
          `${independent} → ${dependent}`,

        methodologicalPurpose:
          "Mesurer quantitativement l'intensité de la relation perçue entre les deux variables.",

        analysisHint:
          "Analyse descriptive et comparaison avec les indicateurs des variables.",

        scale:
          LIKERT_OPTIONS,
      },

      createOpenQuestion(
        startNumber + 1,
        "relationship",
        `${independent} → ${dependent}`,
        "Explication de la relation",
        undefined,
        undefined,
        `Comment expliquez-vous l'influence de ${independent.toLowerCase()} sur ${dependent.toLowerCase()} ?`
      ),
    ],
  };
}

/* =========================================================
   OBJECTIFS
========================================================= */

function buildObjectiveSection(
  objectives: string[],
  startNumber: number,
  mode: ResearchQuestionnaireMode
): QuestionnaireSection {
  if (objectives.length === 0) {
    return {
      id: "objectives",

      title:
        "Objectifs de l'étude",

      description:
        "Aucun objectif spécifique n'a été fourni.",

      type: "objectives",

      questions: [],
    };
  }

  const questions:
    QuestionnaireQuestion[] =
    objectives.map(
      (
        objective,
        index
      ) => {
        const isQualitative =
          mode ===
          "qualitative";

        return {
          id:
            `Q${startNumber + index}`,

          number:
            startNumber + index,

          sectionId:
            "objectives",

          type:
            isQualitative
              ? "long_text"
              : "likert",

          text:
            isQualitative
              ? `Pouvez-vous expliquer votre perception concernant l'objectif suivant : « ${objective} » ?`
              : `Dans quelle mesure les éléments observés permettent-ils de répondre à l'objectif suivant : « ${objective} » ?`,

          required: true,

          objective,

          objectiveIndex:
            index,

          objectiveRole:
            "specific",

          methodologicalPurpose:
            `Vérifier que les informations recueillies permettent de contribuer directement à l'objectif spécifique : « ${objective} ».`,
          
          analysisHint:
            isQualitative
              ? "Analyse thématique des réponses."
              : "Analyse descriptive des réponses.",

          scale:
            isQualitative
              ? undefined
              : LIKERT_OPTIONS,
        };
      }
    );

  return {
    id: "objectives",

    title:
      "Objectifs spécifiques",

    description:
      "Cette section veille à ce que les données collectées permettent effectivement de répondre aux objectifs spécifiques de l'étude.",

    type: "objectives",

    questions,
  };
}

/* =========================================================
   COMMENTAIRE FINAL
========================================================= */

function buildCommentSection(
  startNumber: number
): QuestionnaireSection {
  return {
    id: "comment",

    title:
      "Observations complémentaires",

    description:
      "Vous pouvez ajouter ici toute observation, suggestion ou précision que vous jugez utile.",

    type: "open_comment",

    questions: [
      {
        id:
          `Q${startNumber}`,

        number:
          startNumber,

        sectionId:
          "comment",

        type:
          "long_text",

        text:
          "Avez-vous une observation ou une recommandation à formuler concernant cette étude ?",

        required: false,

        methodologicalPurpose:
          "Permettre au répondant d'apporter une information complémentaire qui n'aurait pas été couverte par les questions précédentes.",

        analysisHint:
          "Analyse qualitative complémentaire.",
      },
    ],
  };
}
/* =========================================================
   CONSTRUCTION DES VARIABLES
========================================================= */

function buildVariables(
  independent: string,
  dependent: string
): QuestionnaireVariable[] {
  const independentDimensions =
    getDimensions(independent);

  const dependentDimensions =
    getDimensions(dependent);

  return [
    {
      id:
        "variable-independent",

      name:
        independent,

      role:
        "independent",

      dimensions:
        independentDimensions,

      indicators:
        independentDimensions.flatMap(
          (dimension) =>
            getIndicators(
              independent,
              dimension
            )
        ),
    },

    {
      id:
        "variable-dependent",

      name:
        dependent,

      role:
        "dependent",

      dimensions:
        dependentDimensions,

      indicators:
        dependentDimensions.flatMap(
          (dimension) =>
            getIndicators(
              dependent,
              dimension
            )
        ),
    },
  ];
}

/* =========================================================
   NOTES MÉTHODOLOGIQUES
========================================================= */

function buildMethodologyNotes(
  research: ResearchData,
  mode: ResearchQuestionnaireMode,
  independent: string,
  dependent: string
): string[] {
  const objectives =
    research.objectives ?? [];

  const notes: string[] = [];

  notes.push(
    `Type de questionnaire : ${mode}.`
  );

  notes.push(
    `Variable indépendante identifiée : ${independent}.`
  );

  notes.push(
    `Variable dépendante identifiée : ${dependent}.`
  );

  if (
    research.problem?.trim()
  ) {
    notes.push(
      "La problématique de recherche a été prise en compte dans la construction du questionnaire."
    );
  } else {
    notes.push(
      "Aucune problématique n'a été renseignée."
    );
  }

  if (
    research.objective?.trim()
  ) {
    notes.push(
      "L'objectif général de l'étude a été renseigné."
    );
  } else {
    notes.push(
      "Aucun objectif général n'a été renseigné."
    );
  }

  if (
    objectives.length > 0
  ) {
    notes.push(
      `${objectives.length} objectif(s) spécifique(s) ont été pris en compte.`
    );
  } else {
    notes.push(
      "Aucun objectif spécifique n'a été renseigné."
    );
  }

  if (
    mode ===
    "quantitative"
  ) {
    notes.push(
      "Le questionnaire privilégie les questions fermées, les échelles de Likert et les modalités permettant une codification statistique."
    );
  }

  if (
    mode ===
    "qualitative"
  ) {
    notes.push(
      "Le questionnaire privilégie les questions ouvertes permettant d'explorer les perceptions, expériences et explications des participants."
    );
  }

  if (
    mode ===
    "mixed"
  ) {
    notes.push(
      "Le questionnaire combine des mesures quantitatives et des questions ouvertes afin de compléter les résultats statistiques par les perceptions des répondants."
    );
  }

  return notes;
}

/* =========================================================
   MOTEUR PRINCIPAL
========================================================= */

export function generateQuestionnaire(
  research: ResearchData
): GeneratedQuestionnaire {
  /* -------------------------------------------------------
     1. IDENTIFICATION DES VARIABLES
  ------------------------------------------------------- */

  const {
    independent,
    dependent,
  } = detectVariables(
    research.title
  );

  /* -------------------------------------------------------
     2. TYPE DE RECHERCHE
  ------------------------------------------------------- */

  const mode =
    detectResearchType(
      research.researchType
    );

  /* -------------------------------------------------------
     3. OBJECTIFS
  ------------------------------------------------------- */

  const objectives =
    research.objectives ?? [];

  /* -------------------------------------------------------
     4. VARIABLES STRUCTURÉES
  ------------------------------------------------------- */

  const variables =
    buildVariables(
      independent,
      dependent
    );

  /* -------------------------------------------------------
     5. SECTIONS
  ------------------------------------------------------- */

  const sections:
    QuestionnaireSection[] =
    [];

  /* INTRODUCTION */

  sections.push(
    buildIntroduction(
      research
    )
  );

  /* PROFIL */

  sections.push(
    buildProfileSection(
      research
    )
  );

  let nextNumber = 5;

  /* -------------------------------------------------------
     6. VARIABLE INDÉPENDANTE
  ------------------------------------------------------- */

  let independentSection:
    QuestionnaireSection;

  if (
    mode ===
    "qualitative"
  ) {
    independentSection =
      buildQualitativeVariableSection(
        "independent",
        "independent_variable",
        independent,
        objectives,
        nextNumber
      );
  } else if (
    mode === "mixed"
  ) {
    independentSection =
      buildMixedVariableSection(
        "independent",
        "independent_variable",
        independent,
        objectives,
        nextNumber
      );
  } else {
    independentSection =
      buildQuantitativeVariableSection(
        "independent",
        "independent_variable",
        independent,
        objectives,
        nextNumber
      );
  }

  sections.push(
    independentSection
  );

  nextNumber +=
    independentSection
      .questions.length;

  /* -------------------------------------------------------
     7. VARIABLE DÉPENDANTE
  ------------------------------------------------------- */

  let dependentSection:
    QuestionnaireSection;

  if (
    mode ===
    "qualitative"
  ) {
    dependentSection =
      buildQualitativeVariableSection(
        "dependent",
        "dependent_variable",
        dependent,
        objectives,
        nextNumber
      );
  } else if (
    mode === "mixed"
  ) {
    dependentSection =
      buildMixedVariableSection(
        "dependent",
        "dependent_variable",
        dependent,
        objectives,
        nextNumber
      );
  } else {
    dependentSection =
      buildQuantitativeVariableSection(
        "dependent",
        "dependent_variable",
        dependent,
        objectives,
        nextNumber
      );
  }

  sections.push(
    dependentSection
  );

  nextNumber +=
    dependentSection
      .questions.length;

  /* -------------------------------------------------------
     8. RELATION ENTRE VARIABLES
  ------------------------------------------------------- */

  let relationshipSection:
    QuestionnaireSection;

  if (
    mode ===
    "qualitative"
  ) {
    relationshipSection =
      buildQualitativeRelationshipSection(
        independent,
        dependent,
        nextNumber
      );
  } else if (
    mode === "mixed"
  ) {
    relationshipSection =
      buildMixedRelationshipSection(
        independent,
        dependent,
        nextNumber
      );
  } else {
    relationshipSection =
      buildQuantitativeRelationshipSection(
        independent,
        dependent,
        nextNumber
      );
  }

  sections.push(
    relationshipSection
  );

  nextNumber +=
    relationshipSection
      .questions.length;

  /* -------------------------------------------------------
     9. OBJECTIFS SPÉCIFIQUES
  ------------------------------------------------------- */

  const objectiveSection =
    buildObjectiveSection(
      objectives,
      nextNumber,
      mode
    );

  if (
    objectiveSection
      .questions.length > 0
  ) {
    sections.push(
      objectiveSection
    );

    nextNumber +=
      objectiveSection
        .questions.length;
  }

  /* -------------------------------------------------------
     10. COMMENTAIRE FINAL
  ------------------------------------------------------- */

  sections.push(
    buildCommentSection(
      nextNumber
    )
  );

  /* -------------------------------------------------------
     11. QUESTIONS
  ------------------------------------------------------- */

  const questions =
    sections.flatMap(
      (section) =>
        section.questions
    );

  /* -------------------------------------------------------
     12. QUESTIONNAIRE
  ------------------------------------------------------- */

  const questionnaire:
    GeneratedQuestionnaire = {
    id:
      `questionnaire-${Date.now()}`,

    title:
      `Questionnaire d'enquête — ${research.title}`,

    description:
      `Questionnaire ${mode} construit à partir du sujet, de la problématique, de l'objectif général et des objectifs spécifiques fournis.`,

    researchType:
      mode,

    variables,

    sections,

    totalQuestions:
      questions.length,

    estimatedDuration:
      mode ===
      "qualitative"
        ? Math.max(
            15,
            Math.ceil(
              questions.length *
                2
            )
          )
        : mode === "mixed"
          ? Math.max(
              10,
              Math.ceil(
                questions.length *
                  0.8
              )
            )
          : Math.max(
              5,
              Math.ceil(
                questions.length *
                  0.4
              )
            ),

    methodologyNotes:
      buildMethodologyNotes(
        research,
        mode,
        independent,
        dependent
      ),

    generatedAt:
      new Date().toISOString(),
  };

  /* -------------------------------------------------------
     13. VALIDATION
  ------------------------------------------------------- */

  const validation =
    validateQuestionnaire(
      questionnaire
    );

  if (
    !validation.valid
  ) {
    console.warn(
      "ACADIA — Questionnaire invalide",
      validation.errors
    );
  }

  if (
    validation.warnings
      .length > 0
  ) {
    console.info(
      "ACADIA — Avertissements",
      validation.warnings
    );
  }

  /* -------------------------------------------------------
     14. RAISONNEMENT V2
  ------------------------------------------------------- */

  const reasoning =
    reasonAboutQuestionnaire(
      research,
      questionnaire
    );

  questionnaire.methodologyNotes.push(
    `Couverture des objectifs spécifiques : ${reasoning.coverageRate} %.`
  );

  reasoning.recommendations.forEach(
    (recommendation) => {
      questionnaire.methodologyNotes.push(
        recommendation
      );
    }
  );

  /* -------------------------------------------------------
     15. INFORMATIONS DE DEBUG
  ------------------------------------------------------- */

  console.info(
    "ACADIA — Analyse méthodologique",
    {
      researchType:
        mode,

      independentVariable:
        independent,

      dependentVariable:
        dependent,

      objectives:
        objectives.length,

      totalQuestions:
        questionnaire.totalQuestions,

      objectiveCoverage:
        reasoning.coverageRate,

      uncoveredObjectives:
        reasoning.uncoveredObjectives,

      orphanQuestions:
        reasoning.orphanQuestions,
    }
  );

  return questionnaire;
}