/** Moteur d'analyse et d'interprétation statistique (inférentiel) — API publique. */
export { runAnalysis, multipleTestingNote, INFERENTIAL_ENGINE_VERSION, type AnalysisRequest, type AnalysisReport, type AnalysisOutcome, type AnalysisDetail, type EffectSize, type Row } from "./run";
export { selectMethods, METHOD_LABELS, type MethodId, type MethodOption, type MethodSelection } from "./selection";
export { chiSquareTest, fisherExact2x2, welchTTest, pearsonCorrelation, spearmanCorrelation, oneWayAnova, brownForsythe, averageRanks, type Check, type CheckStatus } from "./tests";
export { pairObservations, ordinalOrder } from "./data";
export { fmt, fmtP } from "./format";
