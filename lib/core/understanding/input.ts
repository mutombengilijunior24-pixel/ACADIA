import { z } from "zod";

import { contentStems } from "./text";
import type { Approach, FieldKey, ResearchUnderstandingInput } from "./types";

/** Limites de saisie : protègent le moteur et l'appel IA éventuel (taille du texte envoyé). */
export const INPUT_LIMITS = { text: 4000, item: 1000, items: 20 } as const;

export const FIELD_LABELS: Record<FieldKey, string> = {
  title: "Sujet ou titre provisoire",
  context: "Contexte de l'étude",
  problem: "Problématique",
  mainQuestion: "Question principale",
  specificQuestions: "Questions spécifiques",
  generalObjective: "Objectif général",
  specificObjectives: "Objectifs spécifiques",
  hypotheses: "Hypothèses",
  field: "Terrain ou zone d'étude",
  period: "Période étudiée",
  population: "Population ou unité d'analyse",
  concepts: "Concepts théoriques",
  notes: "Informations complémentaires",
};

/** Indispensables pour une compréhension complète (le sujet seul suffit à lancer l'analyse). */
export const ESSENTIAL_FIELDS: FieldKey[] = ["title", "problem", "mainQuestion", "generalObjective", "population", "field"];

const text = z.string().max(INPUT_LIMITS.text, `Texte trop long (${INPUT_LIMITS.text} caractères au maximum).`);
const list = z
  .array(z.string().max(INPUT_LIMITS.item, `Élément trop long (${INPUT_LIMITS.item} caractères au maximum).`))
  .max(INPUT_LIMITS.items, `${INPUT_LIMITS.items} éléments au maximum.`);

const schema = z.object({
  title: z.string({ error: "Le sujet ou titre provisoire est obligatoire." }).max(INPUT_LIMITS.item, `Sujet trop long (${INPUT_LIMITS.item} caractères au maximum).`),
  context: text.optional(),
  problem: text.optional(),
  mainQuestion: text.optional(),
  specificQuestions: list.optional(),
  generalObjective: text.optional(),
  specificObjectives: list.optional(),
  hypotheses: list.optional(),
  field: text.optional(),
  period: text.optional(),
  population: text.optional(),
  concepts: list.optional(),
  notes: text.optional(),
  approach: z.enum(["unspecified", "quantitative", "qualitative", "mixed"]).optional(),
});

export interface InputError {
  field: FieldKey | "approach" | "form";
  message: string;
}

export type InputValidation = { ok: true; input: ResearchUnderstandingInput } | { ok: false; errors: InputError[] };

/** Texte collé depuis une page web ou un tableau : les sauts de ligne HTML deviennent de vrais sauts de ligne, les autres balises disparaissent. */
export const stripMarkup = (value: string) =>
  value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>/gi, "")
    .replace(/&nbsp;/g, " ");
const clean = (value: string | undefined) => stripMarkup(value ?? "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
// Listes (objectifs, hypothèses…) : un élément par ligne, y compris après conversion des <br>.
const cleanList = (values: string[] | undefined) => (values ?? []).flatMap((value) => clean(value).split("\n")).map((value) => value.trim()).filter((value) => value.length > 0);

export function emptyInput(): ResearchUnderstandingInput {
  return {
    title: "",
    context: "",
    problem: "",
    mainQuestion: "",
    specificQuestions: [],
    generalObjective: "",
    specificObjectives: [],
    hypotheses: [],
    field: "",
    period: "",
    population: "",
    concepts: [],
    notes: "",
    approach: "unspecified",
  };
}

export function validateResearchInput(raw: unknown): InputValidation {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: "form", message: "Entrée invalide : un objet décrivant la recherche est attendu." }] };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => ({
        field: (typeof issue.path[0] === "string" ? issue.path[0] : "form") as InputError["field"],
        message: issue.message,
      })),
    };
  }
  const data = parsed.data;
  const input: ResearchUnderstandingInput = {
    title: clean(data.title).replace(/\n/g, " "),
    context: clean(data.context),
    problem: clean(data.problem),
    mainQuestion: clean(data.mainQuestion),
    specificQuestions: cleanList(data.specificQuestions),
    generalObjective: clean(data.generalObjective),
    specificObjectives: cleanList(data.specificObjectives),
    hypotheses: cleanList(data.hypotheses),
    field: clean(data.field),
    period: clean(data.period),
    population: clean(data.population),
    concepts: cleanList(data.concepts),
    notes: clean(data.notes),
    approach: (data.approach ?? "unspecified") as Approach,
  };
  if (!input.title) return { ok: false, errors: [{ field: "title", message: "Le sujet ou titre provisoire est obligatoire." }] };
  if (contentStems(input.title).length === 0) {
    return { ok: false, errors: [{ field: "title", message: "Le sujet ne contient aucun mot exploitable : décrivez ce que vous étudiez." }] };
  }
  return { ok: true, input };
}

export function providedFields(input: ResearchUnderstandingInput): FieldKey[] {
  return (Object.keys(FIELD_LABELS) as FieldKey[]).filter((field) => {
    const value = input[field];
    return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
  });
}
