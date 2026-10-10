import type { GeneratedQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireTypes";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { ResearchData } from "@/types/Research";

import { classifyColumn } from "./classify";
import { confirmedStructure, confirmedTypes, missingCodesByColumn, statisticalTypeLabel, userMappings, userRoles } from "./preparation";
import { proposeMappings, summarizeResearch } from "./research";
import { detectStructure } from "./structure";
import type {
  ColumnMapping,
  DatasetProfile,
  ImportedDataset,
  PreparationState,
  StatisticalType,
  UnderstandingState,
  VariableMetadata,
  VariableRoleInStudy,
} from "./types";

/**
 * État de compréhension d'un jeu de données : ce qui est connu, détecté, confirmé, ambigu ou
 * manquant. Les rôles « dépendante / indépendante » ne sont JAMAIS déduits des données : ils
 * viennent soit d'une décision de l'utilisateur, soit d'une variable de la recherche associée
 * explicitement à la colonne. Aucun test statistique n'est choisi ici.
 */

export interface UnderstandingInput {
  dataset: ImportedDataset;
  profile: DatasetProfile;
  preparation: PreparationState;
  project?: ResearchProject | null;
  researchData?: ResearchData | null;
  questionnaire?: GeneratedQuestionnaire | null;
  sampleSize?: number | null;
}

const NON_ANALYTIC: StatisticalType[] = ["to_confirm", "unclassified"];

export function buildUnderstanding(input: UnderstandingInput): UnderstandingState {
  const { dataset, profile, preparation, project, questionnaire } = input;
  const types = confirmedTypes(preparation);
  const roles = userRoles(preparation);
  const userMapped = userMappings(preparation);
  const declaredCodes = missingCodesByColumn(preparation);

  // Correspondances : propositions automatiques, remplacées par les décisions de l'utilisateur.
  const proposed = new Map(proposeMappings(dataset.columns, questionnaire, project).map((m) => [m.column, m]));
  const mappings: ColumnMapping[] = [];
  for (const column of dataset.columns) {
    const decision = userMapped.get(column.index);
    const mapping = decision ? decision.value ?? undefined : proposed.get(column.index);
    if (mapping) mappings.push(mapping);
  }
  const mappingOf = new Map(mappings.map((m) => [m.column, m]));

  const variables: VariableMetadata[] = profile.columns.map((columnProfile) => {
    const mapping = mappingOf.get(columnProfile.index);
    const detected = classifyColumn(columnProfile, mapping);
    const confirmed = types.get(columnProfile.index);
    const effectiveType = confirmed?.value ?? detected.statisticalType;
    const typeSource: VariableMetadata["typeSource"] = confirmed ? "user" : detected.rule.startsWith("questionnaire:") ? "questionnaire" : "auto";
    const needsConfirmation = !confirmed && detected.confidence !== "high";

    let role: VariableMetadata["role"];
    const userRole = roles.get(columnProfile.index);
    if (userRole) {
      role = userRole.value ? { value: userRole.value, source: "user" } : undefined;
    } else if (mapping?.researchVariableId && project) {
      const variable = project.variables.find((v) => v.id === mapping.researchVariableId);
      if (variable) {
        role = {
          value: variable.role as VariableRoleInStudy,
          source: "research_variable",
          detail: `Rôle de la variable de recherche « ${variable.name} »${variable.status === "accepted" ? "" : " (proposé par ACADIA, non confirmé)"}.`,
        };
      }
    } else if (effectiveType === "identifier") {
      role = { value: "identifier", source: "classification" };
    } else if (effectiveType === "free_text") {
      role = { value: "qualitative_text", source: "classification" };
    }

    return {
      column: columnProfile.index,
      technicalName: columnProfile.technicalName,
      originalHeader: columnProfile.originalHeader,
      detected,
      confirmed: confirmed ? { statisticalType: confirmed.value, by: "user", at: confirmed.at, operationId: confirmed.id } : undefined,
      effectiveType,
      typeSource,
      needsConfirmation,
      role,
      mapping,
      analysisReady: !NON_ANALYTIC.includes(effectiveType) && !needsConfirmation,
    };
  });

  const facts = summarizeResearch({ project, data: input.researchData, questionnaire, sampleSize: input.sampleSize });
  const structure = detectStructure(dataset, variables, mappings);
  const structureDecision = confirmedStructure(preparation);
  const name = (v: { originalHeader: string; technicalName: string }) => `« ${v.originalHeader.trim() || v.technicalName} »`;

  const ambiguities: string[] = [];
  const questionsForUser: string[] = [];
  for (const variable of variables) {
    if (variable.effectiveType === "unclassified") continue;
    if (variable.needsConfirmation) {
      ambiguities.push(`${name(variable)} : type « ${statisticalTypeLabel(variable.detected.statisticalType)} » détecté avec une confiance ${variable.detected.confidence === "medium" ? "moyenne" : "faible"}.`);
      questionsForUser.push(
        variable.detected.statisticalType === "ordinal" && variable.detected.scale
          ? `${name(variable)} (valeurs ${variable.detected.scale.min} à ${variable.detected.scale.max}) est-elle une échelle ordonnée ?`
          : `Quel est le type de la variable ${name(variable)} ?`,
      );
    }
    if (variable.mapping && !variable.mapping.confirmed) {
      ambiguities.push(`${name(variable)} : correspondance avec la question ${variable.mapping.questionNumber} non confirmée.`);
      questionsForUser.push(`${name(variable)} correspond-elle à la question ${variable.mapping.questionNumber} « ${variable.mapping.questionText} » ?`);
    }
  }
  for (const column of profile.columns) {
    if (column.missingCodeCandidates.length && !declaredCodes.has(column.index)) {
      questionsForUser.push(`Dans ${name(column)}, ${column.missingCodeCandidates.map((c) => `« ${c.value} »`).join(", ")} signifie-t-il « non-réponse » ?`);
    }
    if (column.dates?.ambiguousFormat) ambiguities.push(`${name(column)} : format de date ambigu (JJ/MM ou MM/JJ).`);
  }
  if (profile.exactDuplicateRows > 0) {
    questionsForUser.push(`${profile.exactDuplicateRows} ligne(s) sont identiques à une ligne précédente : s'agit-il de doublons à exclure ou de réponses légitimement identiques ?`);
  }
  if (!structureDecision) questionsForUser.push("Confirmez la structure des données (transversale, questionnaire, série temporelle…).");

  const missingInformation: string[] = facts.filter((f) => f.provenance === "unknown").map((f) => `${f.label} : ${f.note ?? "non renseigné"}`);
  if (!project && !input.researchData?.title) missingInformation.unshift("Aucun projet de recherche n'est associé : les données sont comprises sans contexte méthodologique.");
  if (!questionnaire) missingInformation.push("Aucun questionnaire ACADIA associé : les correspondances colonnes → questions sont à établir manuellement.");
  if (!variables.some((v) => v.role && (v.role.value === "dependent" || v.role.value === "independent"))) {
    missingInformation.push("Aucune variable dépendante ou indépendante n'est désignée : aucune relation explicative ne sera supposée (normal pour une étude descriptive).");
  }

  const dataPrepared = profile.readiness !== "not_ready";
  const relevant = variables.filter((v) => v.effectiveType !== "unclassified");
  const unresolvedCodes = profile.columns.some((c) => c.missingCodeCandidates.length > 0 && !declaredCodes.has(c.index));

  return {
    facts,
    variables,
    structure: structure.map((candidate) => (candidate.family === structureDecision ? { ...candidate, status: "confirmed" } : candidate)),
    confirmedStructure: structureDecision,
    mappings,
    ambiguities,
    missingInformation,
    questionsForUser,
    dataPrepared,
    analysisReadyColumns: variables.filter((v) => v.analysisReady).length,
    readyForAnalysisSelection:
      dataPrepared && relevant.length > 0 && relevant.every((v) => v.analysisReady) && !unresolvedCodes && !!structureDecision && !variables.some((v) => v.mapping && !v.mapping.confirmed),
  };
}
