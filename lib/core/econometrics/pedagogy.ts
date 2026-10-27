/**
 * Préparer la soutenance : formules à connaître, lexique de l'économétrie et questions probables du jury
 * avec des éléments de réponse tirés des résultats de l'étudiant (jamais des chiffres inventés).
 */
import type { EconometricAnalysis } from "./analysis";
import type { HypothesisResult, ModelGroup } from "./evaluate";

export const FORMULAS: Array<{ name: string; formula: string; meaning: string }> = [
  { name: "Estimateur des MCO", formula: "β̂ = (X'X)⁻¹ X'Y", meaning: "Les coefficients qui minimisent la somme des carrés des résidus." },
  { name: "Coefficient de détermination", formula: "R² = 1 − SCR / SCT", meaning: "Part de la variabilité de la variable expliquée rendue compte par le modèle." },
  { name: "R² ajusté", formula: "R²a = 1 − (1 − R²)·(n − 1)/(n − k − 1)", meaning: "R² corrigé du nombre de variables explicatives." },
  { name: "t de Student", formula: "t = β̂ / σ̂(β̂)", meaning: "Teste si un coefficient est différent de zéro (significatif si |t| dépasse la valeur critique, p < 0,05)." },
  { name: "Test de Fisher", formula: "F = (R²/k) / ((1 − R²)/(n − k − 1))", meaning: "Teste la significativité globale du modèle." },
  { name: "Dickey-Fuller augmenté", formula: "ΔY(t) = α + β·t + γ·Y(t−1) + Σ δi·ΔY(t−i) + ε(t)", meaning: "H0 : γ = 0 (racine unitaire, non stationnaire) ; rejet si la statistique est inférieure à la valeur critique de MacKinnon." },
  { name: "Durbin-Watson", formula: "DW = Σ (e(t) − e(t−1))² / Σ e(t)²", meaning: "Proche de 2 : pas d'autocorrélation d'ordre 1 ; vers 0 : autocorrélation positive." },
  { name: "Breusch-Godfrey", formula: "LM = n·R²(aux) ~ χ²(p)", meaning: "Teste l'autocorrélation des erreurs jusqu'à l'ordre p." },
  { name: "Breusch-Pagan", formula: "LM = n·R²(e² sur X) ~ χ²(k)", meaning: "Teste l'hétéroscédasticité (variance non constante des erreurs)." },
  { name: "Jarque-Bera", formula: "JB = n/6 · (S² + (K − 3)²/4) ~ χ²(2)", meaning: "Teste la normalité des résidus (S : asymétrie, K : aplatissement)." },
  { name: "Facteur d'inflation de la variance", formula: "VIF(j) = 1 / (1 − R²(j))", meaning: "Mesure la multicolinéarité ; au-delà de 10, les effets sont mal séparés." },
  { name: "Modèle à correction d'erreur", formula: "ΔY(t) = c + b·ΔX(t) + λ·ε(t−1) + u(t)", meaning: "λ (force de rappel) négatif et significatif : retour progressif vers l'équilibre de long terme." },
  { name: "Élasticité (modèle log-log)", formula: "ln Y = a + b·ln X  ⇒  b = (ΔY/Y) / (ΔX/X)", meaning: "Variation en % de Y associée à une hausse de 1 % de X." },
  { name: "Taux de croissance", formula: "g(t) = (X(t) / X(t−1) − 1) × 100", meaning: "Variation relative d'une période à l'autre." },
  { name: "Taux de croissance annuel moyen", formula: "TCAM = (X(fin) / X(début))^(1/n) − 1", meaning: "Croissance moyenne par période sur l'ensemble de la période." },
];

export const GLOSSARY: Array<{ term: string; definition: string }> = [
  { term: "Série temporelle", definition: "Suite d'observations d'une même variable dans le temps (années, trimestres, mois)." },
  { term: "Stationnarité", definition: "Une série est stationnaire si sa moyenne et sa variance ne dépendent pas du temps." },
  { term: "Racine unitaire", definition: "Propriété d'une série non stationnaire dont les chocs ont des effets permanents." },
  { term: "Ordre d'intégration I(d)", definition: "Nombre de différenciations nécessaires pour rendre une série stationnaire : I(0) stationnaire, I(1) stationnaire en différence première." },
  { term: "Régression fallacieuse", definition: "Relation statistiquement « significative » entre séries non stationnaires sans lien réel (Granger et Newbold, 1974)." },
  { term: "Cointégration", definition: "Des séries I(1) sont cointégrées si une combinaison d'entre elles est stationnaire : elles partagent une relation d'équilibre de long terme." },
  { term: "Modèle à correction d'erreur", definition: "Modèle qui décrit la dynamique de court terme et la vitesse de retour vers l'équilibre de long terme." },
  { term: "MCO", definition: "Moindres carrés ordinaires : méthode d'estimation qui minimise la somme des carrés des écarts entre valeurs observées et ajustées." },
  { term: "Coefficient", definition: "Variation de la variable expliquée associée à une variation d'une unité (ou de 1 %) de la variable explicative, toutes choses égales par ailleurs." },
  { term: "Élasticité", definition: "Variation en pourcentage d'une variable associée à une variation de 1 % d'une autre." },
  { term: "p-value", definition: "Probabilité d'observer un résultat au moins aussi marqué si l'hypothèse nulle était vraie ; au-dessous de 0,05, on rejette l'hypothèse nulle au seuil de 5 %." },
  { term: "Seuil de signification", definition: "Risque d'erreur accepté (1 %, 5 % ou 10 %) pour rejeter une hypothèse nulle." },
  { term: "Autocorrélation", definition: "Dépendance des erreurs d'une période à l'autre ; elle biaise les écarts-types des MCO." },
  { term: "Hétéroscédasticité", definition: "Variance des erreurs qui change selon les observations." },
  { term: "Multicolinéarité", definition: "Forte corrélation entre variables explicatives, qui empêche de séparer leurs effets." },
  { term: "Causalité au sens de Granger", definition: "X « cause » Y au sens de Granger si les valeurs passées de X améliorent la prévision de Y : c'est une précédence temporelle, pas une preuve de causalité économique." },
  { term: "Toutes choses égales par ailleurs", definition: "Les autres variables du modèle étant maintenues constantes." },
  { term: "Déflateur du PIB", definition: "Rapport entre PIB nominal et PIB réel : indice du niveau général des prix de la production." },
  { term: "Vitesse de circulation", definition: "Nombre de fois qu'une unité de monnaie finance la production au cours d'une période (V = PY / M)." },
  { term: "Dépréciation", definition: "Perte de valeur de la monnaie nationale : il faut davantage de francs pour obtenir un dollar." },
];

export interface DefenseKit {
  pitch: string[];
  questions: Array<{ question: string; answer: string }>;
}

const num = (v: number | null, d = 2) => (v === null ? "n.d." : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));

export function buildDefenseKit(models: ModelGroup[], analyses: Record<string, EconometricAnalysis>, results: HypothesisResult[], periods: string[]): DefenseKit {
  const main = models[0] ? analyses[models[0].key] : undefined;
  const est = main?.estimation ?? null;
  const pitch = [
    `J'ai étudié ${periods.length} observations, de ${periods[0] ?? "?"} à ${periods[periods.length - 1] ?? "?"}.`,
    est ? `J'ai d'abord vérifié la stationnarité des séries, puis estimé par les MCO l'équation ${est.equation}, qui explique ${num((est.r2 ?? 0) * 100, 1)} % de la variabilité de ${est.dependentName}.` : "J'ai vérifié la stationnarité des séries avant toute estimation.",
    ...results.map((r, i) => `Hypothèse ${i + 1} : ${r.verdictLabel.toLowerCase()}${r.coefficient ? ` (coefficient ${num(r.coefficient.beta, 3)}, ${r.coefficient.p !== null && r.coefficient.p < 0.001 ? "p < 0,001" : `p = ${num(r.coefficient.p, 3)}`})` : ""}.`),
    "Ces résultats sont des associations statistiques compatibles (ou non) avec la théorie ; ils ne prouvent pas à eux seuls une causalité.",
  ];
  const questions: DefenseKit["questions"] = [
    { question: "Pourquoi avez-vous testé la stationnarité avant d'estimer votre modèle ?", answer: "Parce qu'une régression entre séries non stationnaires peut faire apparaître une relation qui n'existe pas (régression fallacieuse). Le test ADF m'a permis de connaître l'ordre d'intégration de chaque variable et de choisir la bonne spécification." },
    { question: "Combien d'observations avez-vous, et est-ce suffisant ?", answer: `${periods.length} observations. C'est ${periods.length >= 30 ? "un échantillon convenable pour des séries temporelles" : "un échantillon court : les tests ont une puissance limitée, c'est pourquoi je présente mes conclusions avec prudence"}.` },
  ];
  if (est) {
    const firstCoef = est.rows[1];
    questions.push({ question: `Que signifie le coefficient de ${firstCoef?.name ?? "votre variable explicative"} ?`, answer: results[0]?.reading ?? `Il vaut ${num(firstCoef?.beta ?? null, 3)} : c'est la variation de la variable expliquée associée à une variation d'une unité de cette variable, toutes choses égales par ailleurs.` });
    questions.push({ question: `Votre R² vaut ${num(est.r2, 3)} : qu'en concluez-vous ?`, answer: `Mon modèle rend compte de ${num((est.r2 ?? 0) * 100, 1)} % de la variabilité de ${est.dependentName}. Un R² élevé ne suffit pas : en séries temporelles, il peut venir de tendances communes ; c'est pourquoi j'ai vérifié la stationnarité${main?.cointegration ? " et la cointégration" : ""} et les tests sur les résidus.` });
    questions.push({ question: "Vos erreurs sont-elles autocorrélées ?", answer: `Durbin-Watson vaut ${num(est.dw)} et le test de Breusch-Godfrey donne ${est.bg.pValue === null ? "un résultat non disponible" : (est.bg.pValue < 0.001 ? "p < 0,001" : `p = ${num(est.bg.pValue, 3)}`)} : ${est.bg.pValue !== null && est.bg.pValue < 0.05 ? "il y a de l'autocorrélation, ce qui fragilise les écarts-types ; je le signale comme limite" : "l'absence d'autocorrélation d'ordre 1 n'est pas rejetée"}.` });
  }
  questions.push({ question: "Votre résultat prouve-t-il que X cause Y ?", answer: "Non. Il montre une association statistique, compatible avec la théorie retenue. La causalité au sens de Granger ne mesure qu'une précédence temporelle ; prouver une causalité économique demanderait un dispositif d'identification plus exigeant." });
  return { pitch, questions };
}
