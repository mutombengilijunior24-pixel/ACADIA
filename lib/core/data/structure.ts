import { displayRaw } from "./cells";
import { normalizeText } from "./research";
import type { ColumnMapping, ImportedDataset, StructureCandidate, VariableMetadata } from "./types";

/**
 * Familles de structure de données proposées à partir des colonnes observées.
 * Jamais à partir du nom du fichier. Tous les résultats sont des propositions révisables :
 * plusieurs colonnes de dates ne suffisent pas à démontrer une série temporelle exploitable.
 */

const FINANCIAL_TERMS = [
  "actif", "passif", "bilan", "chiffre d affaires", "resultat net", "capitaux propres", "dettes", "tresorerie",
  "charges", "produits", "ebe", "ebitda", "amortissement", "creances", "stocks", "revenue", "total assets",
];

export function detectStructure(dataset: ImportedDataset, variables: VariableMetadata[], mappings: ColumnMapping[]): StructureCandidate[] {
  const candidates: StructureCandidate[] = [];
  const typeOf = (type: VariableMetadata["effectiveType"]) => variables.filter((variable) => variable.effectiveType === type);
  const temporal = typeOf("temporal");
  const identifiers = typeOf("identifier");
  const freeText = typeOf("free_text");
  const ordinal = typeOf("ordinal");
  const quantitative = [...typeOf("quantitative_continuous"), ...typeOf("quantitative_discrete")];
  const nonEmpty = variables.filter((variable) => variable.effectiveType !== "unclassified");

  if (mappings.length > 0) {
    candidates.push({
      family: "questionnaire",
      confidence: mappings.some((m) => m.confirmed) ? "high" : "medium",
      evidence: [`${mappings.length} colonne(s) associée(s) à des questions du questionnaire ACADIA.`],
      status: "proposed",
    });
  } else if (ordinal.length >= 3) {
    candidates.push({
      family: "questionnaire",
      confidence: "low",
      evidence: [`${ordinal.length} colonnes ressemblent à des échelles ordinales (type Likert) : données de questionnaire probables.`],
      status: "proposed",
    });
  }

  if (freeText.length > 0) {
    candidates.push({
      family: "qualitative_text",
      confidence: freeText.length >= Math.ceil(nonEmpty.length / 2) ? "medium" : "low",
      evidence: [`${freeText.length} colonne(s) de texte libre (questions ouvertes, verbatims).`],
      status: "proposed",
    });
  }

  // Panel : un identifiant répété dans le temps, chaque couple (unité, date) étant unique.
  const panelEvidence: string[] = [];
  for (const time of temporal) {
    for (const column of dataset.columns) {
      if (column.index === time.column) continue;
      const units = dataset.rows.map((row) => displayRaw(row[column.index]).trim()).filter(Boolean);
      const distinctUnits = new Set(units).size;
      if (distinctUnits < 2 || distinctUnits === units.length) continue;
      const pairs = new Set(dataset.rows.map((row) => `${displayRaw(row[column.index])}\u0001${displayRaw(row[time.column])}`));
      if (pairs.size === dataset.rows.length && distinctUnits <= units.length / 2) {
        panelEvidence.push(`« ${column.originalHeader.trim() || column.technicalName} » se répète (${distinctUnits} unités) et chaque couple (unité, « ${time.originalHeader.trim() || time.technicalName} ») est unique.`);
      }
    }
  }
  if (panelEvidence.length) {
    candidates.push({ family: "panel", confidence: "low", evidence: [...panelEvidence.slice(0, 2), "À confirmer : vérifier que les mêmes unités sont observées à plusieurs périodes."], status: "proposed" });
  }

  if (temporal.length === 1 && !panelEvidence.length) {
    const values = dataset.rows.map((row) => displayRaw(row[temporal[0].column]).trim()).filter(Boolean);
    if (values.length >= 10 && new Set(values).size === values.length && (quantitative.length > 0 || identifiers.length === 0)) {
      candidates.push({
        family: "time_series",
        confidence: "low",
        evidence: [
          `Une date unique par ligne (« ${temporal[0].originalHeader.trim()} », ${values.length} périodes).`,
          "À confirmer : la régularité des périodes et la nature des mesures n'ont pas été vérifiées.",
        ],
        status: "proposed",
      });
    }
  }

  const financialColumns = dataset.columns.filter((column) => {
    const header = normalizeText(column.originalHeader);
    return FINANCIAL_TERMS.some((term) => header.includes(term));
  });
  if (financialColumns.length >= 2) {
    candidates.push({
      family: "financial",
      confidence: "low",
      evidence: [`En-têtes à vocation comptable : ${financialColumns.slice(0, 4).map((c) => `« ${c.originalHeader.trim()} »`).join(", ")}.`, "Indice faible : à confirmer par le chercheur."],
      status: "proposed",
    });
  }

  if (!panelEvidence.length && !candidates.some((c) => c.family === "time_series")) {
    candidates.push({
      family: "cross_sectional",
      confidence: temporal.length === 0 ? "medium" : "low",
      evidence: [temporal.length === 0 ? "Aucune dimension temporelle : une ligne par unité observée à un moment donné (données transversales probables)." : "Des dates sont présentes mais ne structurent pas les observations dans le temps de façon démontrée."],
      status: "proposed",
    });
  }

  const hasTextAndNumbers = freeText.length > 0 && (quantitative.length > 0 || ordinal.length > 0 || typeOf("nominal").length > 0);
  if (hasTextAndNumbers) {
    candidates.push({
      family: "mixed",
      confidence: "low",
      evidence: ["Le jeu combine des variables structurées (catégories, échelles ou mesures) et du texte libre."],
      status: "proposed",
    });
  }

  return candidates;
}
