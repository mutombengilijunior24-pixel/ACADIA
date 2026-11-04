// MNJ Stage Connect — journal vocal du stagiaire. Le soir, l'étudiant dicte sa journée ; ses paroles sont
// transcrites (l'audio n'est jamais conservé), ACADIA lui pose quelques questions sur ce qui manque, puis
// rédige la journée en sections, à partir UNIQUEMENT de ce qu'il a dit, de ses journées précédentes et de
// son dossier. Ce module, sans IA, porte les règles : fenêtre de modification, sections, garde-fou
// « à vérifier » (noms et chiffres absents de ce que l'étudiant a dit), brouillon du rapport.

import { z } from "zod";

import { ACTIVITIES_MIN } from "./catalog";
import { shiftDay } from "./workflow";

export const JOURNAL_LIMITS = {
  /** Durée maximale d'une note vocale (secondes). */
  maxSeconds: 300,
  /** Taille maximale d'un envoi audio (sous la limite de 4,5 Mo des fonctions Vercel). */
  maxBytes: 4 * 1024 * 1024,
  transcriptMax: 20_000,
  activitiesMax: 12_000,
  notesPerDay: 10,
  writesPerDay: 6,
  reportsPerDay: 5,
} as const;

/** Sections d'une journée rédigée, dans l'ordre. */
export const JOURNAL_SECTIONS = ["Contexte et mission du jour", "Activités réalisées", "Outils et méthodes", "Difficultés et solutions", "Ce que j'ai appris et compétences mobilisées", "Suite prévue"] as const;
export type JournalSectionTitle = (typeof JOURNAL_SECTIONS)[number];

export interface JournalSection {
  title: JournalSectionTitle;
  text: string;
}

/**
 * Une journée peut être dictée et validée le jour même et le lendemain (jusqu'à 23 h 59, heure de
 * Lubumbashi) : l'étudiant peut dicter le soir, chez lui. L'heure de départ, elle, reste signée sur place.
 */
export function journalWindowOpen(day: string, today: string): boolean {
  return today === day || today === shiftDay(day, 1);
}

export function journalError(input: { status: string; record: { day: string } | null; day: string; today: string }): string | null {
  if (input.status === "annule") return "Ce dossier est annulé.";
  if (!input.record) return "Signez d'abord votre arrivée de ce jour-là.";
  if (!journalWindowOpen(input.day, input.today)) return "Cette journée ne peut plus être modifiée : le journal se complète le jour même ou le lendemain.";
  return null;
}

/** Texte d'une journée rédigée : chaque section précédée de son titre, sur sa propre ligne. */
export function joinSections(sections: JournalSection[]): string {
  return sections
    .filter((s) => s.text.trim())
    .map((s) => `${s.title}\n${s.text.trim()}`)
    .join("\n\n");
}

/** Retrouve les sections d'un compte rendu (pour le rapport) ; un texte libre n'a qu'un bloc sans titre. */
export function splitSections(text: string): Array<{ title: JournalSectionTitle | null; text: string }> {
  const out: Array<{ title: JournalSectionTitle | null; text: string }> = [];
  let current: { title: JournalSectionTitle | null; lines: string[] } = { title: null, lines: [] };
  const flush = () => {
    const body = current.lines.join("\n").trim();
    if (body || current.title) out.push({ title: current.title, text: body });
  };
  for (const line of text.split(/\r?\n/)) {
    const title = JOURNAL_SECTIONS.find((t) => t === line.trim());
    if (title) {
      flush();
      current = { title, lines: [] };
    } else current.lines.push(line);
  }
  flush();
  return out.filter((s) => s.text || s.title);
}

export interface TranscriptEntry {
  kind: "note" | "reponse";
  text: string;
  question?: string;
  /** Heure affichée (HH:MM). */
  at: string;
}

/** Ajoute une note ou une réponse aux paroles transcrites de la journée. */
export function appendTranscript(existing: string | null, entry: TranscriptEntry): string {
  const block = entry.kind === "reponse" && entry.question ? `[Réponse ${entry.at}] Question : ${entry.question}\n${entry.text.trim()}` : `[Note ${entry.at}]\n${entry.text.trim()}`;
  return [existing?.trim(), block].filter(Boolean).join("\n\n").slice(0, JOURNAL_LIMITS.transcriptMax);
}

/* ------------------------------ Garde-fou « à vérifier » ------------------------------ */

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Mots courants qui commencent souvent une phrase : jamais signalés. */
const COMMON = new Set(
  "je j nous on il elle ils elles le la les l un une des du de d au aux en dans avec pour par sur sous ce cet cette ces ceci cela ca mon ma mes notre nos leur leurs son sa ses lors ensuite enfin puis apres avant pendant durant aujourd hui hier demain matin soir midi apres-midi journee semaine mois ainsi alors donc mais et ou car or toutefois cependant neanmoins par ailleurs egalement grace afin tout tous toute toutes chaque plusieurs certains certaines cette premiere premier deuxieme second troisieme dernier derniere lundi mardi mercredi jeudi vendredi samedi dimanche janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre contexte activites outils methodes difficultes solutions suite prevue ce que appris competences mobilisees mission".split(" "),
);

/**
 * Termes de la version rédigée qui n'apparaissent dans aucune source (ce que l'étudiant a dit ou écrit,
 * son dossier) : noms propres, sigles et nombres. Ils sont montrés « à vérifier » : l'IA a pu les ajouter.
 */
const NUMBER = /\d+(?:[.,]\d+)?/g;
const numbersIn = (s: string) => new Set([...s.matchAll(NUMBER)].map((m) => m[0].replace(",", ".")));
/** Mot sans élision ni accents : « l'Excel » → « excel ». */
const wordKey = (w: string) => fold(w).replace(/^[a-z][’']/, "").replace(/[^a-z0-9-]/g, "");

export function unverifiedTerms(written: string, sources: string[]): string[] {
  const source = sources.join(" ");
  const words = new Set(fold(source).split(/[^a-z0-9-]+/).filter(Boolean));
  const numbers = numbersIn(source);
  const found = new Set<string>();
  const body = written
    .split(/\r?\n/)
    .filter((l) => !JOURNAL_SECTIONS.includes(l.trim() as JournalSectionTitle))
    .join("\n");
  // Nombres (25 factures, 3,5 %, 2026).
  for (const m of body.matchAll(NUMBER)) if (!numbers.has(m[0].replace(",", "."))) found.add(m[0]);
  // Noms propres et sigles : un mot à majuscule qui ne commence pas une phrase, ou un sigle en capitales.
  for (const sentence of body.split(/(?<=[.!?:;])\s+|\n+/)) {
    sentence
      .split(/\s+/)
      .map((t) => t.replace(/^[«"“(]+|[»"”),.;:!?]+$/g, ""))
      .forEach((token, i) => {
        const bare = token.replace(/^[DdLlJjQq][’']/, "");
        const acronym = /^[A-Z]{2,}[0-9]*$/.test(bare);
        if (!acronym && (i === 0 || !/^\p{Lu}\p{Ll}/u.test(bare))) return;
        const key = wordKey(bare);
        if (key.length < 2 || COMMON.has(key) || words.has(key)) return;
        found.add(bare);
      });
  }
  return [...found].slice(0, 25);
}

/* ------------------------------ Rapport : parties rédigées ------------------------------ */

export const reportDraftSchema = z.object({
  remerciements: z.string().trim().max(6000),
  introduction: z.string().trim().max(12000),
  bilan: z.string().trim().max(12000),
  conclusion: z.string().trim().max(8000),
});
export type ReportDraftParts = z.infer<typeof reportDraftSchema>;
export interface ReportDraft extends ReportDraftParts {
  generatedAt: string | null;
  updatedAt: string;
}

export const REPORT_PART_LABELS: Record<keyof ReportDraftParts, string> = { remerciements: "Remerciements", introduction: "Introduction", bilan: "Bilan du stage", conclusion: "Conclusion" };

export function parseReportDraft(json: string | null): ReportDraft | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as Partial<ReportDraft>;
    const parts = reportDraftSchema.safeParse(v);
    return parts.success ? { ...parts.data, generatedAt: typeof v.generatedAt === "string" ? v.generatedAt : null, updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : new Date(0).toISOString() } : null;
  } catch {
    return null;
  }
}

/** Journées utilisables pour rédiger le rapport : départ signé et compte rendu suffisant. */
export const usableDays = <T extends { departureAt: unknown; activities: string | null }>(records: T[]) => records.filter((r) => (r.activities ?? "").trim().length >= ACTIVITIES_MIN);
