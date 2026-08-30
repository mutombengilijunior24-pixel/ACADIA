// ============================================================
// ACADIA — MODULE SURVEY : GÉNÉRATION STRUCTURÉE ("Travailler avec ACADIA")
//
// Hybride, jamais un second moteur IA : le bloc de profil du
// répondant (catégorie, institution, faculté, niveau, âge, sexe) est
// déterministe — ces champs ne nécessitent aucune compréhension du
// sujet, et une génération IA n'y apporterait aucune valeur. Le bloc
// de contenu (usage, évaluation, besoins, perceptions) est produit par
// le moteur méthodologique IA (lib/ai/openai/SurveyQuestionnaireAI.ts),
// qui réutilise le même client/modèle OpenAI que les moteurs A1/A2 de
// Research — jamais un second système OpenAI.
//
// Générique : aucune institution ni structure d'enquête n'est codée
// en dur, le sujet réel de l'enquête (objectif fourni par le
// chercheur) reste un CONTEXTE, jamais recopié directement dans une
// question.
// ============================================================

import { generateContentQuestionsWithAI, type AIContentQuestion } from "@/lib/ai/openai/SurveyQuestionnaireAI";

export interface SurveyBriefInput {
  title: string;
  objective: string;
  problem?: string;
  targetAudience?: string;
  institution?: string;
  categories: string[]; // ex. ["Étudiant", "Enseignant"]
  measure: {
    institution?: boolean;
    faculty?: boolean;
    level?: boolean;
    age?: boolean;
    sex?: boolean;
    status?: boolean;
  };
  isAnonymous: boolean;
}

export interface GeneratedOption {
  label: string;
  value: string;
  order: number;
}

export interface GeneratedQuestion {
  section: string;
  order: number;
  type:
    | "short_text"
    | "long_text"
    | "single_choice"
    | "multiple_choice"
    | "scale"
    | "boolean"
    | "number"
    | "age"
    | "date"
    | "institution"
    | "faculty"
    | "level"
    | "category";
  text: string;
  required: boolean;
  variable?: string;
  indicator?: string;
  visibleForCategoryLabels?: string[];
  options?: GeneratedOption[];
}

export interface GeneratedCategory {
  label: string;
  order: number;
}

export interface GeneratedSurvey {
  categories: GeneratedCategory[];
  questions: GeneratedQuestion[];
}

const SECTION_PROFILE = "Profil du répondant";

function subject(brief: SurveyBriefInput): string {
  return (brief.objective || brief.title).trim();
}

export function slugify(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || `option_${index}`;
}

function toGeneratedQuestion(q: AIContentQuestion, order: number): GeneratedQuestion {
  return {
    section: q.dimension || "Contenu",
    order,
    type: q.type,
    text: q.text,
    required: q.required,
    variable: q.variable,
    indicator: q.indicator,
    visibleForCategoryLabels: q.visibleForCategoryLabels?.length ? q.visibleForCategoryLabels : undefined,
    options: q.options.length ? q.options.map((o, i) => ({ label: o.label, value: slugify(o.label, i), order: i })) : undefined,
  };
}

/**
 * Génère le questionnaire complet : bloc de profil déterministe +
 * bloc de contenu produit par le moteur méthodologique IA. Ne
 * retombe jamais silencieusement sur un contenu dégradé en cas
 * d'échec IA — l'appelant (route API) doit propager l'erreur pour
 * que l'utilisateur voie un message clair et un bouton "Réessayer",
 * jamais un questionnaire de mauvaise qualité présenté comme réussi.
 */
export async function generateSurveyStructure(brief: SurveyBriefInput): Promise<GeneratedSurvey> {
  const categories: GeneratedCategory[] = brief.categories.map((label, i) => ({ label, order: i }));
  const questions: GeneratedQuestion[] = [];
  let order = 0;
  const push = (q: Omit<GeneratedQuestion, "order">) => questions.push({ ...q, order: order++ });

  // -------- Profil du répondant (déterministe) --------
  if (categories.length > 0) {
    push({
      section: SECTION_PROFILE,
      type: "category",
      text: "Vous participez à cette enquête en tant que :",
      required: true,
      options: categories.map((c) => ({ label: c.label, value: c.label, order: c.order })),
    });
  }
  if (brief.measure.institution) {
    push({ section: SECTION_PROFILE, type: "institution", text: "Institution", required: true });
  }
  if (brief.measure.faculty) {
    push({ section: SECTION_PROFILE, type: "faculty", text: "Faculté / École", required: true });
  }
  if (brief.measure.level) {
    const studentLike = categories.find((c) => /étudiant|student/i.test(c.label));
    push({
      section: SECTION_PROFILE,
      type: "level",
      text: "Niveau d'étude",
      required: false,
      visibleForCategoryLabels: studentLike ? [studentLike.label] : undefined,
    });
  }
  if (brief.measure.age) {
    push({ section: SECTION_PROFILE, type: "age", text: "Âge", required: false });
  }
  if (brief.measure.sex) {
    push({
      section: SECTION_PROFILE,
      type: "single_choice",
      text: "Sexe",
      required: false,
      options: [
        { label: "Femme", value: "F", order: 0 },
        { label: "Homme", value: "M", order: 1 },
      ],
    });
  }

  // -------- Contenu (moteur méthodologique IA) --------
  const contentQuestions = await generateContentQuestionsWithAI({
    title: brief.title,
    objective: brief.objective,
    problem: brief.problem,
    targetAudience: brief.targetAudience,
    institution: brief.institution,
    categories: brief.categories,
  });
  for (const q of contentQuestions) {
    push(toGeneratedQuestion(q, order));
  }

  return { categories, questions };
}

/**
 * Description professionnelle générée à partir des seules informations
 * fournies par le chercheur — jamais un contexte institutionnel inventé,
 * jamais le raisonnement interne du moteur exposé au répondant.
 * Déterministe : ce texte est déjà correct et stable, une génération IA
 * n'y apporterait aucune valeur supplémentaire.
 */
export function generateSurveyDescription(brief: SurveyBriefInput): string {
  const sujet = subject(brief);
  const parts: string[] = [];

  parts.push(`Cette enquête vise à ${lowerFirst(sujet)}.`);

  const audience = brief.targetAudience?.trim();
  const institution = brief.institution?.trim();
  if (audience || institution) {
    const who = audience ? `à ${audience}` : "aux personnes concernées";
    const where = institution ? ` au sein de ${institution}` : "";
    parts.push(`Elle s'adresse ${who}${where}.`);
  }

  if (brief.problem?.trim()) {
    parts.push(`Elle cherche notamment à mieux comprendre : ${brief.problem.trim()}.`);
  }

  parts.push(
    brief.isAnonymous
      ? "Les réponses sont anonymes et permettront de mieux cerner les besoins réels afin d'orienter les actions à entreprendre."
      : "Vos réponses permettront de mieux cerner les besoins réels afin d'orienter les actions à entreprendre."
  );

  return parts.join(" ");
}

function lowerFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
