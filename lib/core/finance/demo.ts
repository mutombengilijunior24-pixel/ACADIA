/**
 * Entreprise FICTIVE de démonstration : « SOKAMA SARL », commerce de gros alimentaire imaginaire.
 * Aucune donnée réelle. Montants en milliers de CDF, exercices 2021 à 2023, SYSCOHADA révisé.
 * Les bilans ont été construits d'un exercice à l'autre à partir des flux : bilan, compte de résultat et
 * tableau des flux de trésorerie concordent exactement (un test l'impose).
 *
 * Scénario pédagogique : chiffre d'affaires en hausse mais marges en baisse, allongement du délai clients
 * et des stocks (effet ciseaux), trésorerie devenue négative et financée par des crédits de trésorerie,
 * endettement en hausse, effet de levier devenu défavorable en 2023, résultat 2023 porté en partie par
 * la cession d'un camion (HAO), dettes fiscales et sociales en forte hausse.
 */
import { newExercise } from "./statements";
import type { FinanceDossier, ValueOrigin } from "./types";

export const DEMO_NOTICE = "DONNÉES FICTIVES — ENTREPRISE IMAGINAIRE — DÉMONSTRATION ACADIA";

const VALUES: FinanceDossier["values"] = {
  "ex-2021": { AD: 15000, AH: 15000, AI: 2190000, AK: 1490000, AM: 405000, AN: 295000, AQ: 30000, AS: 30000, AZ: 2235000, BB: 603750, BG: 802013, BH: 20000, BI: 742013, BJ: 40000, BK: 1405763, BS: 235675, BT: 235675, BZ: 3876438, CA: 500000, CF: 70000, CG: 636000, CJ: 219380, CP: 1425380, DA: 1300000, DC: 20000, DD: 1320000, DF: 2745380, DI: 10000, DJ: 1006058, DK: 80000, DM: 15000, DP: 1111058, DQ: 20000, DT: 20000, DZ: 3876438, TA: 6000000, RA: 4873750, RB: -43750, XA: 1170000, TD: 60000, XB: 6060000, TH: 10000, RE: 60000, RG: 120000, RH: 150000, RI: 50000, RJ: 20000, XC: 840000, RK: 330000, XD: 510000, RL: 95000, XE: 415000, TK: 2000, RM: 105600, XF: -103600, XG: 311400, TO: 3000, RP: 1000, XH: 2000, RS: 94020, XI: 219380, ZA: 170000, FA: 314380, FC: -43750, FD: -52013, FE: 77058, ZB: 295675, FG: 250000, ZC: -250000, FN: 80000, ZD: -80000, FO: 150000, FQ: 70000, ZE: 80000, ZF: 0, ZG: 45675, ZH: 215675 },
  "ex-2022": { AD: 10000, AH: 10000, AI: 2345000, AK: 1460000, AM: 435000, AN: 450000, AQ: 30000, AS: 30000, AZ: 2385000, BB: 903093, BG: 1214300, BH: 18000, BI: 1151300, BJ: 45000, BK: 2117393, BS: 60000, BT: 60000, BZ: 4562393, CA: 500000, CF: 91938, CG: 773442, CJ: 149355, CP: 1514735, DA: 1590000, DC: 20000, DD: 1610000, DF: 3124735, DI: 9000, DJ: 1150694, DK: 102000, DM: 18000, DP: 1279694, DQ: 20000, DR: 137964, DT: 157964, DZ: 4562393, TA: 7080000, RA: 6104943, RB: -299343, XA: 1274400, TD: 66000, XB: 7146000, TH: 12000, RE: 68000, RG: 145000, RH: 175000, RI: 58000, RJ: 24000, XC: 882400, RK: 375000, XD: 507400, RL: 110000, XE: 397400, TK: 1500, RM: 183536, XF: -182036, XG: 215364, RP: 2000, XH: -2000, RS: 64009, XI: 149355, ZA: 215675, FA: 259355, FC: -299343, FD: -412287, FE: 168636, ZB: -283639, FG: 260000, ZC: -260000, FN: 60000, ZD: -60000, FO: 400000, FQ: 110000, ZE: 290000, ZF: 230000, ZG: -313639, ZH: -97964 },
  "ex-2023": { AD: 5000, AH: 5000, AI: 2340000, AK: 1430000, AM: 473000, AN: 437000, AQ: 30000, AS: 30000, AZ: 2375000, BB: 1313733, BG: 1852417, BH: 15000, BI: 1782417, BJ: 55000, BK: 3166150, BS: 60000, BT: 60000, BZ: 5601150, CA: 500000, CF: 106874, CG: 867861, CJ: 94176, CP: 1568911, DA: 2040000, DC: 20000, DD: 2060000, DF: 3628911, DI: 7000, DJ: 1334063, DK: 136000, DM: 22000, DP: 1499063, DQ: 20000, DR: 453176, DT: 473176, DZ: 5601150, TA: 8850000, RA: 7800390, RB: -410640, XA: 1460250, TD: 72000, XB: 8922000, TH: 8000, RE: 80000, RG: 185000, RH: 215000, RI: 70000, RJ: 30000, XC: 960250, RK: 430000, XD: 530250, RL: 120000, XE: 410250, TK: 1000, RM: 326713, XF: -325713, XG: 84537, TN: 90000, RO: 40000, XH: 50000, RS: 40361, XI: 94176, ZA: -97964, FA: 164176, FC: -410640, FD: -638117, FE: 219369, ZB: -665212, FG: 150000, FI: 90000, ZC: -60000, FN: 40000, ZD: -40000, FO: 600000, FQ: 150000, ZE: 450000, ZF: 410000, ZG: -315212, ZH: -413176 },
};

export function demoDossier(): FinanceDossier {
  const exercises = [2021, 2022, 2023].map((year) => newExercise(year));
  const values = structuredClone(VALUES);
  const origins = Object.fromEntries(Object.entries(values).map(([id, codes]) => [id, Object.fromEntries(Object.keys(codes).map((code) => [code, "demo" as ValueOrigin]))]));
  return {
    company: { name: "SOKAMA SARL (entreprise fictive)", sector: "commerce", currency: "CDF", currencyOther: "", unit: 1000, city: "Lubumbashi" },
    exercises,
    values,
    origins,
    corrections: [],
  };
}

/** Sujet d'exemple associé à la démonstration (fictif) : des ENTRÉES de l'étudiant, jamais des résultats. */
export const DEMO_RESEARCH = {
  title: "Endettement, crédit clients et performance financière d'une entreprise commerciale de Lubumbashi : cas de SOKAMA SARL (2021-2023)",
  mainQuestion: "Comment l'endettement et la gestion du crédit clients ont-ils influencé la performance financière de SOKAMA SARL entre 2021 et 2023 ?",
  problem: "SOKAMA SARL (entreprise fictive) a vu son chiffre d'affaires progresser fortement entre 2021 et 2023, mais sa trésorerie s'est dégradée et son endettement a augmenté.",
  specificQuestions: "L'endettement de SOKAMA SARL a-t-il amélioré sa rentabilité financière entre 2021 et 2023 ?\nL'allongement du délai de recouvrement des créances clients a-t-il dégradé la trésorerie de SOKAMA SARL ?",
  generalObjective: "Analyser l'effet de l'endettement et de la gestion du crédit clients sur la performance financière de SOKAMA SARL.",
  specificObjectives: "Analyser l'effet de l'endettement sur la rentabilité financière de SOKAMA SARL entre 2021 et 2023.\nAnalyser l'incidence du crédit accordé aux clients sur la trésorerie de SOKAMA SARL.",
  hypotheses: "L'endettement améliore la rentabilité financière de SOKAMA SARL (effet de levier positif).\nL'allongement du délai de recouvrement des créances clients dégrade la trésorerie de SOKAMA SARL.",
  population: "SOKAMA SARL (entreprise fictive)",
  field: "Lubumbashi",
  period: "2021-2023",
};
