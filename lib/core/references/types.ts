/**
 * Vérificateur de références (« APA check ») : types partagés par le contrôle de forme (sans internet ni
 * IA), le contrôle d'existence (bases bibliographiques ouvertes) et le contrôle du contexte.
 */

/** Convention de présentation : APA 7 adaptée au français (« et », « s.d. ») ou APA 7 anglaise (« & », « n.d. »). */
export type Convention = "apa_fr" | "apa_en";

export const CONVENTION_LABELS: Record<Convention, string> = {
  apa_fr: "APA 7, adaptation française (« et », « s.d. »)",
  apa_en: "APA 7, version anglaise (« & », « n.d. »)",
};

/** Fragment de texte avec son italique (lu dans le Word ; absent d'un texte collé). */
export interface TextRun {
  text: string;
  italic: boolean;
}

export interface DocParagraph {
  index: number;
  text: string;
  runs: TextRun[];
  /** Style Word (« Heading1 », « Titre1 »…), si présent. */
  style: string | null;
  /** Paragraphe d'une note de bas de page. */
  footnote: boolean;
}

export interface PersonName {
  /** Nom de famille tel qu'écrit (« Kotler », « Mbuyi Kalala », « van Dijk »). */
  family: string;
  /** Prénoms ou initiales tels qu'écrits (« P. », « Philip »), éventuellement vide. */
  given: string;
  /** Auteur collectif (« Banque centrale du Congo »). */
  corporate: boolean;
}

export type ReferenceKind = "article" | "livre" | "chapitre" | "memoire" | "rapport" | "web" | "texte_juridique" | "cours" | "autre";

export const REFERENCE_KIND_LABELS: Record<ReferenceKind, string> = {
  article: "Article de revue",
  livre: "Livre",
  chapitre: "Chapitre d'ouvrage collectif",
  memoire: "Mémoire, thèse ou TFC",
  rapport: "Rapport",
  web: "Page web",
  texte_juridique: "Texte juridique",
  cours: "Notes de cours",
  autre: "Autre",
};

/** Références que les bases internationales n'indexent presque jamais : jamais « suspectes » pour cette seule raison. */
export const LOCAL_KINDS: ReferenceKind[] = ["memoire", "rapport", "texte_juridique", "cours"];

export interface ParsedReference {
  id: string;
  index: number;
  raw: string;
  runs: TextRun[];
  authors: PersonName[];
  year: number | null;
  /** Lettre de l'année (2017a). */
  yearSuffix: string;
  noDate: boolean;
  title: string | null;
  /** Revue (article) ou ouvrage collectif (chapitre). */
  container: string | null;
  publisher: string | null;
  place: string | null;
  /** Édition (« 15 » pour la 15e édition), si indiquée. */
  edition: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  url: string | null;
  isbn: string | null;
  kind: ReferenceKind;
  /** Présentation détectée : APA (année après les auteurs) ou présentation « classique » (année à la fin). */
  layout: "apa" | "classique";
  /** Rubrique de la bibliographie (« Ouvrages », « Webographie »…), si présente. */
  section: string | null;
  /** Lecture incertaine : la structure n'a pas été reconnue avec assurance. */
  uncertain: boolean;
}

export interface InTextCitation {
  id: string;
  raw: string;
  /** Noms de famille cités (sans « et al. »). */
  authors: string[];
  etAl: boolean;
  /** Connecteur entre les deux derniers auteurs, tel qu'écrit. */
  connector: "et" | "&" | "and" | null;
  year: number | null;
  yearSuffix: string;
  noDate: boolean;
  pages: string | null;
  /** Citation narrative « Kotler (2017) » ou entre parenthèses « (Kotler, 2017) ». */
  narrative: boolean;
  paragraphIndex: number;
  footnote: boolean;
  /** Phrase qui contient la citation (pour le contrôle du contexte). */
  sentence: string;
}

export type IssueSeverity = "erreur" | "a_verifier" | "conseil";

export interface FormIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  referenceId?: string;
  citationId?: string;
  /** Proposition de correction (texte), jamais appliquée sans l'étudiant. */
  fix?: string;
}
