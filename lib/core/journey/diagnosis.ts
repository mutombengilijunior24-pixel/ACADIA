/**
 * Diagnostic de qualité des données, à partir du profil existant (lib/core/data/profile).
 * Quatre niveaux distincts : problème confirmé, anomalie potentielle, suggestion de nettoyage,
 * décision qui exige une confirmation humaine. Aucune correction n'est appliquée d'office ;
 * les actions proposées passent par les opérations réversibles de la préparation.
 */
import type { DatasetProfile, ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";
import { excludedRows, missingCodesByColumn } from "@/lib/core/data/preparation";
import { fold } from "@/lib/core/understanding/text";

import type { ConditionalQuestion, ConsistencyIssue } from "./consistency";
import type { PopulationGap } from "./population";
import type { FileStructure } from "./structure";

export type DiagnosisLevel = "confirmed" | "potential" | "suggestion" | "decision";

export type DiagnosisAction =
  | { type: "exclude_rows"; rows: number[]; label: string }
  | { type: "declare_missing_codes"; column: number; values: string[]; label: string }
  | { type: "toggle_structural"; column: number; enable: boolean; label: string };

export interface DiagnosisItem {
  id: string;
  level: DiagnosisLevel;
  title: string;
  detail: string;
  why: string;
  proposal: string;
  /** Conséquence de la décision (ou de l'absence de décision) sur les analyses. */
  consequence: string;
  columns: number[];
  action?: DiagnosisAction;
}

export interface DataDiagnosis {
  rows: number;
  rowsExcluded: number;
  rowsUsed: number;
  columns: number;
  questionUnits: number;
  technicalColumns: number;
  optionColumns: number;
  missingCellRate: number;
  types: Array<{ label: string; count: number }>;
  duplicates: number;
  declaredCodes: number;
  uncertainTypes: number;
  conditionalQuestions: number;
  coherenceAlerts: number;
  items: DiagnosisItem[];
  summary: string[];
}

const NOT_APPLICABLE = /^(non[- ]concern[ée]e?s?|sans objet|ne sait pas|nsp|n\/?a|na|refus|pas de r[ée]ponse|aucune r[ée]ponse|-)$/i;
const BOX = /^[□○◯☐▢■●•\-\s]+(?=\S)/;

export function diagnoseData(
  dataset: ImportedDataset,
  preparation: PreparationState,
  profile: DatasetProfile,
  structure: FileStructure,
  variables: VariableMetadata[],
  extra: { conditionals?: ConditionalQuestion[]; structural?: Record<number, string[]>; consistency?: ConsistencyIssue[]; populationGaps?: PopulationGap[] } = {},
): DataDiagnosis {
  const conditionals = extra.conditionals ?? [];
  const structural = extra.structural ?? {};
  const items: DiagnosisItem[] = [];
  const headerOf = (column: number) => structure.columns.find((c) => c.column === column)?.label ?? dataset.columns[column]?.technicalName ?? String(column);
  const codes = missingCodesByColumn(preparation);
  const analyzableColumns = structure.columns.filter((c) => c.kind === "question" || c.kind === "grid_item");

  // Écart entre la population ciblée et l'échantillon : décision humaine, jamais d'exclusion automatique.
  for (const gap of extra.populationGaps ?? []) {
    items.push({
      id: `population-${gap.rule}`,
      level: "decision",
      title: `${gap.count} répondant(s) hors de la population ciblée (${gap.unexpected.map((u) => `« ${u.value} »`).join(", ")})`,
      detail: gap.message,
      why: `Votre recherche porte sur ${gap.expected} : des réponses d'autres personnes peuvent modifier les pourcentages et les tests. Il peut aussi s'agir d'erreurs de saisie ou d'un champ d'étude plus large que celui annoncé.`,
      proposal: "Laisser ces répondants (et préciser la population dans votre méthodologie), ou les exclure explicitement (décision réversible).",
      consequence: `Sans décision, les ${gap.count} répondant(s) restent dans toutes les analyses et l'écart est signalé dans le rapport.`,
      columns: [gap.column],
      action: { type: "exclude_rows", rows: gap.rows, label: `Exclure ces ${gap.count} ligne(s)` },
    });
  }

  // Doublons exacts : décision humaine (exclusion réversible).
  const duplicates = profile.duplicateGroups.flatMap((g) => g.duplicateRows);
  if (duplicates.length) {
    items.push({
      id: "duplicates",
      level: "decision",
      title: `${duplicates.length} ligne(s) identique(s) à une autre`,
      detail: `Lignes du fichier : ${duplicates.map((r) => dataset.sourceRows[r]).slice(0, 15).join(", ")}${duplicates.length > 15 ? "…" : ""}.`,
      why: "Une même réponse comptée deux fois gonfle les effectifs et peut fausser les tests. Mais deux répondants peuvent aussi avoir répondu exactement la même chose.",
      proposal: "Exclure ces lignes si vous savez qu'il s'agit de doublons de saisie (décision réversible).",
      consequence: "Sans exclusion, ces lignes comptent dans tous les effectifs et tous les tests ; avec exclusion, elles sont retirées de toutes les analyses (valeurs conservées dans le fichier).",
      columns: [],
      action: { type: "exclude_rows", rows: duplicates, label: "Exclure ces lignes" },
    });
  }

  for (const info of analyzableColumns) {
    const p = profile.columns.find((c) => c.index === info.column);
    if (!p) continue;
    const header = headerOf(info.column);
    const declared = codes.get(info.column) ?? new Set<string>();
    if (info.constant) {
      items.push({ id: `constant-${info.column}`, level: "confirmed", title: `« ${header} » : une seule valeur`, detail: `Toutes les réponses valent « ${p.examples[0] ?? ""} ».`, why: "Une variable qui ne varie pas ne peut être associée à rien.", proposal: "Ne pas l'utiliser dans les analyses de relations.", consequence: "Aucun test de relation n'est possible avec cette question ; elle peut seulement être décrite.", columns: [info.column] });
    }
    // Codes de non-réponse détectés par le profil, ou réponses « non concerné ».
    const conditional = conditionals.find((c) => c.column === info.column);
    const candidates = new Map<string, number>();
    for (const c of p.missingCodeCandidates) if (!declared.has(c.value) && !conditional?.notApplicableValues.includes(c.value.trim())) candidates.set(c.value, c.count);
    // Les réponses « Non concernée » d'une question conditionnelle sont traitées à part (réponses structurelles).
    if (!conditional) for (const c of p.categories?.top ?? []) if (NOT_APPLICABLE.test(c.value.trim()) && !declared.has(c.value)) candidates.set(c.value, c.count);
    if (conditional) {
      const enabled = !!structural[info.column]?.length;
      const na = conditional.notApplicableValues.join(" / ") || "non concernée";
      items.push({
        id: `conditional-${info.column}`,
        level: "decision",
        title: `« ${header} » : question conditionnelle`,
        detail: `${conditional.condition ? `Condition : « ${conditional.condition} ». ` : ""}${conditional.eligibleCount} répondant(s) éligible(s) ayant répondu ; ${conditional.notApplicableCount} réponse(s) « ${na} » ; ${conditional.blankCount} vide(s).`,
        why: "« Non concernée » n'est ni un motif ni une non-réponse ordinaire : la personne n'était pas visée par la question. La compter comme une modalité fausserait les pourcentages des motifs.",
        proposal: enabled ? "Traitement appliqué : ces réponses sont retirées du dénominateur ; les pourcentages portent sur les répondants éligibles." : "Retirer « Non concernée » du dénominateur pour calculer les pourcentages sur les seuls répondants éligibles (recommandé).",
        consequence: enabled
          ? `Les motifs sont calculés sur ${conditional.eligibleCount} répondant(s) éligible(s) ; les ${conditional.notApplicableCount} « ${na} » sont indiquées à part, hors dénominateur.`
          : `« ${na} » est traitée comme une modalité : elle entre dans les pourcentages (${conditional.notApplicableCount} réponse(s)).`,
        columns: [info.column],
        action: conditional.notApplicableValues.length ? { type: "toggle_structural", column: info.column, enable: !enabled, label: enabled ? "Compter « Non concernée » comme une modalité" : "Retirer « Non concernée » du dénominateur" } : undefined,
      });
    }
    if (candidates.size) {
      const values = [...candidates.keys()];
      items.push({
        id: `codes-${info.column}`,
        level: "decision",
        title: `« ${header} » : réponse(s) de type « non-réponse » ou « non concerné »`,
        detail: values.map((v) => `« ${v} » (${candidates.get(v)} fois)`).join(", "),
        why: "Si ces valeurs restent des modalités, elles entrent dans les pourcentages et les tests comme une réponse ordinaire.",
        proposal: "Les déclarer comme non-réponse : elles seront exclues des calculs pour cette question, sans être supprimées du fichier.",
        consequence: "Sans déclaration, ces valeurs sont comptées comme des réponses dans les pourcentages et les tests ; après déclaration, elles sont exclues de cette question uniquement.",
        columns: [info.column],
        action: { type: "declare_missing_codes", column: info.column, values: [...declared, ...values], label: "Déclarer comme non-réponse" },
      });
    }
    if (p.missingRate >= 0.3 && p.present > 0) {
      const filtered = /^\s*(?:(?:q(?:uestion)?\s*)?\d+[.)°:-]?\s*)?(si |lorsque|en cas|dans le cas)/i.test(header);
      items.push({
        id: `missing-${info.column}`,
        level: "potential",
        title: `« ${header} » : ${Math.round(p.missingRate * 100)} % de réponses manquantes`,
        detail: `${p.missing} ligne(s) sans réponse sur ${p.missing + p.present}.`,
        why: filtered ? "La question semble filtrée (« Si… ») : les absences sont alors normales pour les personnes non concernées." : "Beaucoup d'absences réduisent les effectifs et peuvent biaiser les résultats si elles ne sont pas dues au hasard.",
        proposal: filtered ? "Aucune correction : interpréter cette question sur les seules personnes concernées." : "Vérifier la collecte ; les valeurs manquantes ne seront jamais remplacées.",
        consequence: "Les analyses n'utiliseront que les lignes renseignées : les effectifs de cette question seront plus faibles que le nombre de répondants.",
        columns: [info.column],
      });
    }
    const labels = (p.categories?.top ?? []).map((c) => c.value);
    const boxed = labels.filter((l) => BOX.test(l));
    if (boxed.length) {
      items.push({ id: `box-${info.column}`, level: "suggestion", title: `« ${header} » : symboles de case à cocher dans les réponses`, detail: `Ex. : « ${boxed[0]} ».`, why: "Sans conséquence sur les calculs si le symbole est présent partout ; il alourdit les tableaux.", proposal: "Les retirer dans le fichier source si vous souhaitez des tableaux plus lisibles (la préparation ACADIA ne modifie pas les valeurs).", consequence: "Aucune sur les calculs ; seulement sur la lisibilité des tableaux.", columns: [info.column] });
    }
    const byFold = new Map<string, string[]>();
    for (const l of labels) {
      const key = fold(l).replace(BOX, "").trim();
      byFold.set(key, [...(byFold.get(key) ?? []), l]);
    }
    const variants = [...byFold.values()].filter((v) => v.length > 1);
    if (variants.length) {
      items.push({ id: `variants-${info.column}`, level: "potential", title: `« ${header} » : une même réponse écrite de plusieurs façons`, detail: variants.map((v) => v.map((x) => `« ${x} »`).join(" / ")).join(" ; "), why: "Ces variantes seraient comptées comme des modalités différentes.", proposal: "Harmoniser l'écriture dans le fichier source, puis le réimporter.", consequence: "Sans harmonisation, une même réponse est répartie entre plusieurs modalités : pourcentages et tests en sont faussés.", columns: [info.column] });
    }
    const variable = variables.find((v) => v.column === info.column);
    const text = p.kindCounts.text ?? 0;
    if (variable && (variable.effectiveType === "quantitative_continuous" || variable.effectiveType === "quantitative_discrete") && text > 0) {
      items.push({ id: `nonnumeric-${info.column}`, level: "potential", title: `« ${header} » : ${text} valeur(s) non numérique(s)`, detail: `Exemples : ${p.examples.slice(0, 3).join(", ")}.`, why: "Ces valeurs seront écartées des calculs numériques (jamais converties en 0).", proposal: "Les corriger dans le fichier, ou les déclarer comme non-réponse si ce sont des codes.", consequence: "Ces lignes sont écartées des moyennes et des tests de cette variable.", columns: [info.column] });
    }
  }

  const unusable = structure.columns.filter((c) => c.kind === "technical" || c.kind === "identifier" || c.kind === "date" || c.kind === "empty");
  if (unusable.length) {
    items.push({ id: "unusable", level: "confirmed", title: `${unusable.length} colonne(s) non utilisable(s) comme variable d'analyse`, detail: unusable.map((c) => `« ${c.label} »`).join(", "), why: "Métadonnées techniques, identifiants, dates ou colonnes vides ne mesurent pas un concept de la recherche.", proposal: "Elles sont conservées dans le fichier mais ne seront pas proposées dans les analyses.", consequence: "Elles n'apparaissent dans aucun tableau ni test.", columns: unusable.map((c) => c.column) });
  }
  const options = structure.columns.filter((c) => c.kind === "option_of");
  if (options.length) {
    items.push({ id: "options", level: "confirmed", title: `${options.length} colonne(s) vrai/faux répétant les modalités d'une question`, detail: [...new Set(options.map((c) => structure.units.find((u) => u.id === c.unitId)?.text))].map((t) => `« ${t} »`).join(", "), why: "Les analyser séparément compterait plusieurs fois la même question.", proposal: "Utiliser la colonne de la question elle-même ; les colonnes vrai/faux sont mises de côté.", consequence: "Ces colonnes ne sont jamais proposées comme variables indépendantes : seule la question parente est analysée, une fois.", columns: options.map((c) => c.column) });
  }

  const excluded = excludedRows(preparation).size;
  const typeCounts = new Map<string, number>();
  for (const unit of structure.units.filter((u) => u.kind !== "technical")) {
    const label = unit.kind === "multi_choice" ? "choix multiples" : (variables.find((v) => v.column === unit.primaryColumn)?.effectiveType ?? "non classée");
    typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
  }
  const order: Record<DiagnosisLevel, number> = { confirmed: 0, decision: 1, potential: 2, suggestion: 3 };
  items.sort((a, b) => order[a.level] - order[b.level]);
  const questionUnits = structure.units.filter((u) => u.kind !== "technical").length;
  const declaredCodes = [...codes.values()].reduce((n, set) => n + set.size, 0);
  const keyColumns = new Set(structure.units.filter((u) => u.kind !== "technical" && u.primaryColumn !== null).map((u) => u.primaryColumn));
  const uncertainTypes = variables.filter((v) => keyColumns.has(v.column) && !v.analysisReady).length;
  const coherenceAlerts = extra.consistency?.length ?? 0;
  return {
    rows: dataset.rowCount,
    rowsExcluded: excluded,
    rowsUsed: dataset.rowCount - excluded,
    columns: dataset.columnCount,
    questionUnits,
    technicalColumns: unusable.length,
    optionColumns: options.length,
    missingCellRate: profile.missingCellRate,
    types: [...typeCounts.entries()].map(([label, count]) => ({ label, count })),
    duplicates: duplicates.length,
    declaredCodes,
    uncertainTypes,
    conditionalQuestions: conditionals.length,
    coherenceAlerts,
    items,
    summary: [
      `Votre fichier compte ${dataset.rowCount} ligne(s) et ${dataset.columnCount} colonne(s), soit ${questionUnits} question(s) une fois les colonnes techniques (${unusable.length}) et les colonnes vrai/faux de modalités (${options.length}) mises de côté.`,
      `${items.filter((i) => i.level === "decision").length} décision(s) vous sont demandées ; ${items.filter((i) => i.level === "potential").length} anomalie(s) potentielle(s) et ${items.filter((i) => i.level === "suggestion").length} suggestion(s) de nettoyage sont signalées.`,
      excluded ? `${excluded} ligne(s) exclue(s) par vous ; ${dataset.rowCount - excluded} seront utilisées.` : `Aucune ligne exclue : les ${dataset.rowCount} lignes seront utilisées (les valeurs manquantes sont écartées test par test, jamais remplacées).`,
      `${declaredCodes} code(s) de non-réponse déclaré(s) ; ${duplicates.length} doublon(s) potentiel(s) ; ${uncertainTypes} question(s) au type encore incertain ; ${conditionals.length} question(s) conditionnelle(s) ; ${coherenceAlerts} alerte(s) de cohérence entre réponses.`,
    ],
  };
}
