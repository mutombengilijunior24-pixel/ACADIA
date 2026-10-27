/**
 * Ce que permet le nombre d'observations. Règle de l'établissement : au moins 5 périodes avant toute
 * analyse approfondie ; au-delà, chaque test exige son propre minimum (repères usuels, à valider par
 * l'encadreur). Les tests sur séries courtes ont une puissance faible : ACADIA le dit à chaque fois.
 */
import { ADF_MIN_OBS, COINTEGRATION_MIN_OBS } from "./timeseries";

export const MIN_OBSERVATIONS = 5;
/** En dessous, les conclusions sont présentées comme indicatives. */
export const INDICATIVE_BELOW = 10;
/** En dessous, les tests ont une puissance faible (prudence dans la rédaction). */
export const LOW_POWER_BELOW = 30;

export type ReadinessLevel = "bloque" | "indicatif" | "partiel" | "complet";

export const READINESS_LABELS: Record<ReadinessLevel, string> = {
  bloque: "Analyse impossible",
  indicatif: "Analyse indicative",
  partiel: "Analyse partielle",
  complet: "Analyse complète",
};

export interface Readiness {
  level: ReadinessLevel;
  observations: number;
  canEstimate: boolean;
  canTestStationarity: boolean;
  canTestCointegration: boolean;
  canTestGranger: boolean;
  messages: string[];
}

/** `observations` : périodes où toutes les variables du modèle sont disponibles ; `params` : coefficients à estimer (constante comprise). */
export function readiness(observations: number, params: number): Readiness {
  const messages: string[] = [];
  if (observations < MIN_OBSERVATIONS) {
    return {
      level: "bloque",
      observations,
      canEstimate: false,
      canTestStationarity: false,
      canTestCointegration: false,
      canTestGranger: false,
      messages: [`${observations} observation(s) disponible(s) : il faut au moins ${MIN_OBSERVATIONS} périodes (par exemple 5 années) avant d'entreprendre une analyse économétrique. Complétez vos séries.`],
    };
  }
  const canEstimate = observations - params >= 2;
  if (!canEstimate) messages.push(`Avec ${observations} observations, on ne peut pas estimer ${params} coefficients (il faut au moins ${params + 2} observations) : retirez une variable explicative ou allongez la période.`);
  const canTestStationarity = observations >= ADF_MIN_OBS;
  if (!canTestStationarity) messages.push(`Le test de stationnarité (ADF) exige au moins ${ADF_MIN_OBS} observations consécutives : il n'est pas réalisé, ce qui limite la portée des résultats.`);
  const canTestCointegration = observations >= COINTEGRATION_MIN_OBS;
  const canTestGranger = observations >= COINTEGRATION_MIN_OBS;
  if (canTestStationarity && !canTestCointegration) messages.push(`La cointégration et la causalité de Granger exigent au moins ${COINTEGRATION_MIN_OBS} observations : elles ne sont pas testées.`);
  if (observations < INDICATIVE_BELOW) messages.push(`Moins de ${INDICATIVE_BELOW} observations : les résultats sont indicatifs et doivent être présentés avec prudence.`);
  else if (observations < LOW_POWER_BELOW) messages.push(`${observations} observations : les tests ont une puissance limitée sur une série aussi courte ; rédigez vos conclusions avec prudence.`);
  const level: ReadinessLevel = !canEstimate || observations < INDICATIVE_BELOW ? "indicatif" : !canTestCointegration ? "partiel" : "complet";
  return { level, observations, canEstimate, canTestStationarity, canTestCointegration, canTestGranger, messages };
}
