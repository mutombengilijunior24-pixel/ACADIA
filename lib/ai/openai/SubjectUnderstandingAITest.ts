import {
  understandResearchWithAI,
} from "./SubjectUnderstandingAI";


const testResearch = {

  title:
    "Influence de l'accès au financement sur la pérennité des petites entreprises minières à Lubumbashi",

  domain:
    "Sciences de gestion",

  level:
    "Master",

  university:
    "Université de Lubumbashi",

  researchType:
    "Quantitative",

  problem:
    "Malgré leur importance dans l'économie locale, de nombreuses petites entreprises minières rencontrent des difficultés de financement qui pourraient compromettre leur pérennité.",

  objective:
    "Analyser l'influence de l'accès au financement sur la pérennité des petites entreprises minières à Lubumbashi.",

  objectives: [
    "Identifier les principales sources de financement accessibles aux petites entreprises minières.",
    "Évaluer le niveau d'accès au financement.",
    "Analyser le niveau de pérennité des petites entreprises minières.",
    "Déterminer la relation entre l'accès au financement et la pérennité."
  ],

  population:
    "Petites entreprises minières",

  location:
    "Lubumbashi"
};


async function test() {

  console.log(
    "======================================"
  );

  console.log(
    "ACADIA — VRAI TEST A1 + OPENAI"
  );

  console.log(
    "======================================"
  );

  const result =
    await understandResearchWithAI(
      testResearch
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  console.log(
    "======================================"
  );
}

test();