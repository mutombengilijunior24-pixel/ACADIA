import { describe, expect, it } from "vitest";

import { parsePastedQuestionnaire, parseScaleDefinition } from "@/lib/core/survey/PastedQuestionnaire";
import { controlQuestionnaireQuality } from "@/lib/core/survey/SurveyQualityControl";

const summary = (text: string) => parsePastedQuestionnaire(text).questions.map((q) => `${q.type}|${q.text}|${q.options.map((o) => o.label).join("/")}`);

describe("questionnaire collé (style ChatGPT)", () => {
  const CHATGPT = `QUESTIONNAIRE D'ENQUÊTE
Impact du crédit bancaire sur la croissance des PME à Lubumbashi

Bonjour, dans le cadre de notre mémoire de Master, nous vous prions de répondre à ce questionnaire. Vos réponses resteront anonymes.

**Section 1 : Identification du répondant**
1. Sexe :
☐ Masculin ☐ Féminin
2. Âge :
3. Niveau d'études :
a) Primaire
b) Secondaire
c) Universitaire
4. Secteur d'activité de votre entreprise :
- Commerce
- Services
- Industrie
- Autre (à préciser) : ……………

Section 2 : Accès au crédit
5. Avez-vous déjà bénéficié d'un crédit bancaire ? (Oui / Non)
6. Quel est le montant du dernier crédit obtenu (en USD) ?
7. Quelles difficultés avez-vous rencontrées pour obtenir un crédit ? (plusieurs réponses possibles)
☐ Taux d'intérêt élevés
☐ Garanties exigées
☐ Lenteur administrative

Section 3 : Perception (1 = Pas du tout d'accord, 2 = Pas d'accord, 3 = Neutre, 4 = D'accord, 5 = Tout à fait d'accord)
8. Le crédit a amélioré mon chiffre d'affaires.
9. Le crédit m'a permis d'embaucher du personnel.

10. Quelles suggestions faites-vous aux banques ?
…………………………………………`;

  it("titre, introduction, sections et types reconnus", () => {
    const q = parsePastedQuestionnaire(CHATGPT);
    expect(q.title).toBe("Impact du crédit bancaire sur la croissance des PME à Lubumbashi");
    expect(q.description).toMatch(/^Bonjour, dans le cadre de notre mémoire/);
    expect(q.questions).toHaveLength(10);
    const scale = "Pas du tout d'accord/Pas d'accord/Neutre/D'accord/Tout à fait d'accord";
    expect(summary(CHATGPT)).toEqual([
      "single_choice|Sexe|Masculin/Féminin",
      "age|Âge|",
      "single_choice|Niveau d'études|Primaire/Secondaire/Universitaire",
      "single_choice|Secteur d'activité de votre entreprise|Commerce/Services/Industrie/Autre (à préciser)",
      "boolean|Avez-vous déjà bénéficié d'un crédit bancaire ?|",
      "number|Quel est le montant du dernier crédit obtenu (en USD) ?|",
      "multiple_choice|Quelles difficultés avez-vous rencontrées pour obtenir un crédit ? (plusieurs réponses possibles)|Taux d'intérêt élevés/Garanties exigées/Lenteur administrative",
      `scale|Le crédit a amélioré mon chiffre d'affaires.|${scale}`,
      `scale|Le crédit m'a permis d'embaucher du personnel.|${scale}`,
      "long_text|Quelles suggestions faites-vous aux banques ?|",
    ]);
    expect(q.questions.map((x) => x.section)).toEqual([
      "Section 1 : Identification du répondant",
      "Section 1 : Identification du répondant",
      "Section 1 : Identification du répondant",
      "Section 1 : Identification du répondant",
      "Section 2 : Accès au crédit",
      "Section 2 : Accès au crédit",
      "Section 2 : Accès au crédit",
      "Section 3 : Perception",
      "Section 3 : Perception",
      "Section 3 : Perception",
    ]);
    expect(q.ignored).toEqual([]);
  });

  it("aucune question perdue par le contrôle qualité appliqué à la création", () => {
    const q = parsePastedQuestionnaire(CHATGPT);
    const control = controlQuestionnaireQuality(q.questions);
    expect(control.questions).toHaveLength(q.questions.length);
  });
});

describe("questionnaire copié depuis Word (puces perdues)", () => {
  it("les lignes courtes sous une question deviennent ses modalités ; une échelle de satisfaction est reconnue", () => {
    const text = `Questionnaire
1. Quel est votre sexe ?
Masculin
Féminin
2. Quelle est votre situation matrimoniale ?
Célibataire
Marié(e)
Veuf(ve)
3. Êtes-vous satisfait des services de votre banque ?
Très satisfait
Satisfait
Neutre
Insatisfait
Très insatisfait`;
    expect(summary(text)).toEqual([
      "single_choice|Quel est votre sexe ?|Masculin/Féminin",
      "single_choice|Quelle est votre situation matrimoniale ?|Célibataire/Marié(e)/Veuf(ve)",
      "scale|Êtes-vous satisfait des services de votre banque ?|Très satisfait/Satisfait/Neutre/Insatisfait/Très insatisfait",
    ]);
  });

  it("question écrite sur deux lignes, et « Oui / Non » sans parenthèses", () => {
    const text = `Q1. Dans quelle mesure la digitalisation des services
bancaires a-t-elle changé vos habitudes ?
Q2 : Avez-vous un compte mobile money ? Oui / Non`;
    expect(summary(text)).toEqual([
      "short_text|Dans quelle mesure la digitalisation des services bancaires a-t-elle changé vos habitudes ?|",
      "boolean|Avez-vous un compte mobile money ?|",
    ]);
  });
});

describe("échelles", () => {
  it("tableau markdown de ChatGPT : une affirmation par ligne", () => {
    const text = `### Section B : Perception des clients
| Affirmation | Pas du tout d'accord | Pas d'accord | Neutre | D'accord | Tout à fait d'accord |
|---|---|---|---|---|---|
| Les délais de traitement sont raisonnables | ☐ | ☐ | ☐ | ☐ | ☐ |
| Le personnel est accueillant | | | | | |`;
    const q = parsePastedQuestionnaire(text);
    expect(q.questions.map((x) => `${x.type}|${x.section}|${x.text}|${x.options.length}`)).toEqual([
      "scale|Section B : Perception des clients|Les délais de traitement sont raisonnables|5",
      "scale|Section B : Perception des clients|Le personnel est accueillant|5",
    ]);
  });

  it("échelle définie une fois, puis affirmations non numérotées", () => {
    const text = `Habitudes financières
1. Avez-vous un compte bancaire ? (Oui / Non)
Échelle : 1 = Jamais ; 2 = Rarement ; 3 = Parfois ; 4 = Souvent ; 5 = Toujours
Je consulte mon solde chaque semaine.
J'épargne une partie de mon revenu chaque mois.`;
    expect(summary(text)).toEqual([
      "boolean|Avez-vous un compte bancaire ?|",
      "scale|Je consulte mon solde chaque semaine.|Jamais/Rarement/Parfois/Souvent/Toujours",
      "scale|J'épargne une partie de mon revenu chaque mois.|Jamais/Rarement/Parfois/Souvent/Toujours",
    ]);
  });

  it("définitions d'échelle reconnues ou refusées", () => {
    expect(parseScaleDefinition("1 = Pas du tout d'accord ; 2 = Pas d'accord ; 3 = Neutre ; 4 = D'accord ; 5 = Tout à fait d'accord")).toHaveLength(5);
    expect(parseScaleDefinition("Très faible / Faible / Moyen / Élevé / Très élevé")).toEqual(["Très faible", "Faible", "Moyen", "Élevé", "Très élevé"]);
    expect(parseScaleDefinition("Quel est votre avis ?")).toBeNull();
    expect(parseScaleDefinition("Commerce / Services / Industrie / Agriculture")).toBeNull();
  });
});

describe("robustesse", () => {
  it("texte vide ou sans question : rien d'inventé", () => {
    expect(parsePastedQuestionnaire("").questions).toEqual([]);
    expect(parsePastedQuestionnaire("", "Mon sujet").title).toBe("Mon sujet");
    expect(parsePastedQuestionnaire("Merci pour votre participation.").questions).toEqual([]);
  });

  it("le texte d'une question n'est jamais réécrit", () => {
    const text = "1. Comment évaluez-vous   la qualité du service ?\n- Bonne\n- Mauvaise";
    expect(parsePastedQuestionnaire(text).questions[0].text).toBe("Comment évaluez-vous la qualité du service ?");
  });
});
