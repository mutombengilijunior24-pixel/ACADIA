/**
 * Provenance du jeu de données : DÉCLARÉE par l'utilisateur pour CHAQUE fichier importé, jamais déduite
 * des valeurs (un fichier qui ressemble à un questionnaire n'est pas pour autant une enquête réelle).
 * Elle est rattachée à l'identifiant d'import du jeu courant ; un nouvel import repart sans provenance.
 * Conservée en mémoire pendant la session uniquement (aucune persistance) : un rechargement la perd.
 */
export type ProvenanceKind = "real_survey" | "synthetic_test" | "demo" | "documentary" | "unknown" | "other";

export interface DataProvenance {
  kind: ProvenanceKind;
  /** Courte description facultative fournie par l'utilisateur. */
  description: string;
}

export const PROVENANCE_KINDS: ProvenanceKind[] = ["real_survey", "synthetic_test", "demo", "documentary", "unknown", "other"];

export const PROVENANCE_LABELS: Record<ProvenanceKind, string> = {
  real_survey: "Données d'une enquête réelle",
  synthetic_test: "Données de test synthétiques",
  demo: "Données de démonstration",
  documentary: "Données documentaires ou administratives",
  unknown: "Provenance inconnue",
  other: "Autre source",
};

export const SYNTHETIC_WARNING = "Jeu de données synthétique — validation du logiciel uniquement ; aucune conclusion ne peut être tirée sur la population étudiée.";
export const DEMO_WARNING = "Jeu de données de démonstration — illustration du logiciel uniquement ; aucune conclusion ne peut être tirée sur la population étudiée.";
export const UNKNOWN_WARNING = "Provenance des données non renseignée : les résultats ne peuvent pas être présentés comme des preuves empiriques tant que l'origine des données n'est pas établie.";
export const OTHER_WARNING = "Source déclarée « autre » : la nature des données et leur représentativité doivent être précisées avant toute généralisation.";

export const UNDECLARED: DataProvenance = { kind: "unknown", description: "" };

export function provenanceWarning(provenance: DataProvenance | ProvenanceKind): string | null {
  const kind = typeof provenance === "string" ? provenance : provenance.kind;
  if (kind === "synthetic_test") return SYNTHETIC_WARNING;
  if (kind === "demo") return DEMO_WARNING;
  if (kind === "unknown") return UNKNOWN_WARNING;
  if (kind === "other") return OTHER_WARNING;
  return null;
}

/** Données non réelles : aucune portée sur une population. */
export const isIllustrative = (kind: ProvenanceKind) => kind === "synthetic_test" || kind === "demo";

/** Qualificatif prudent des résultats (« empiriques » seulement pour des données réelles déclarées). */
export function evidenceWording(provenance: DataProvenance | ProvenanceKind): { adjective: string; scope: string } {
  const kind = typeof provenance === "string" ? provenance : provenance.kind;
  if (kind === "real_survey" || kind === "documentary") return { adjective: "empiriques", scope: "dans l'échantillon étudié" };
  if (isIllustrative(kind)) return { adjective: "de démonstration", scope: "sur ce jeu de test, sans portée sur la population" };
  return { adjective: "à confirmer", scope: "sur ce jeu de données dont l'origine reste à établir" };
}

/** Phrase de rapport : source DÉCLARÉE, explicitement distinguée d'une provenance vérifiée. */
export function provenanceStatement(provenance: DataProvenance): string {
  const note = provenance.description.trim() ? ` — « ${provenance.description.trim()} »` : "";
  if (provenance.kind === "unknown") return `Provenance des données : non renseignée par l'utilisateur${note}.`;
  return `Provenance des données déclarée par l'utilisateur : ${PROVENANCE_LABELS[provenance.kind]}${note}. Cette provenance n'a pas été vérifiée indépendamment par ACADIA.`;
}

/* ---------------------------------------------------------------- */
/* Rattachement au jeu de données courant (mémoire de session)       */
/* ---------------------------------------------------------------- */

export type ProvenanceRegistry = Readonly<Record<string, DataProvenance>>;

export function declareProvenance(registry: ProvenanceRegistry, importId: string, provenance: DataProvenance): ProvenanceRegistry {
  return { ...registry, [importId]: { kind: provenance.kind, description: provenance.description.slice(0, 300) } };
}

/** Provenance déclarée pour ce jeu de données, ou null si l'utilisateur ne l'a pas encore indiquée. */
export function provenanceFor(registry: ProvenanceRegistry, importId: string | null | undefined): DataProvenance | null {
  return importId ? (registry[importId] ?? null) : null;
}
