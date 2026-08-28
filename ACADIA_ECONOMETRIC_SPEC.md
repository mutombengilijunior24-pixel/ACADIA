# ACADIA — Spécification de préparation économétrique

Ce document décrit le **socle** de données et de logique nécessaire pour qu'ACADIA puisse, à terme, préparer une analyse économétrique — sans construire dès maintenant un moteur de calcul statistique complet (conformément au Bloc 5 du sprint : « nous ne demandons pas encore de construire un logiciel économétrique complet »).

Rien de ce document n'est implémenté à ce stade. Il sert de contrat pour les développements futurs et doit être révisé une fois `ACADIA_SEG_METHODOLOGY.md` complété avec la source réelle.

---

## 1. Principe directeur

Tout ce qui suit doit être traité comme une **proposition méthodologique éditable**, jamais comme un résultat automatique définitif. Chaque objet créé par le système doit porter un statut (`draft | proposed | accepted | rejected`, réutilisant `ProposalStatus` de `ResearchTypes.ts`) et rester modifiable par le chercheur.

## 2. Modèle de variables (réutilise l'existant)

`ResearchVariable` (déjà défini dans `lib/core/research/ResearchTypes.ts`) couvre déjà : `id`, `name`, `role` (`independent | dependent | mediating | moderating | control | descriptive`), `definition`, `dimensions`, `indicators`, `linkedObjectiveIds`, `status`, `confidence`.

**Ce qui manque pour l'opérationnalisation (Bloc 3)** — extension proposée, à ajouter sans casser l'existant :

```ts
interface VariableOperationalization {
  variableId: string;                 // référence ResearchVariable.id
  conceptualDefinition: string;        // définition conceptuelle (théorique)
  operationalDefinition: string;       // définition opérationnelle (mesurable)
  nature: "quantitative" | "qualitative" | "categorical" | "ordinal";
  unit?: string;                       // ex. "% du chiffre d'affaires"
  measurementMethod?: string;          // comment la mesure est obtenue
  possibleMeasures?: string[];         // ex. ["chiffre d'affaires", "ROA", "ROE"] proposés, jamais imposés
  source?: string;                     // origine des données (enquête, base secondaire...)
  status: ProposalStatus;
  confidence: ConfidenceLevel;
}
```

Exemple (fourni dans le prompt, reproduit tel quel à titre d'illustration du contrat — pas une donnée réelle) :

> Variable : Performance financière — Type : variable dépendante — Mesures possibles selon le contexte du sujet : chiffre d'affaires, rentabilité, marge, ROA, ROE. Aucun indicateur n'est imposé sans justification liée au sujet réel du chercheur.

## 3. Modèle d'hypothèses (réutilise l'existant)

`ResearchHypothesis` existe déjà (`id`, `statement`, `role`, `variableIds[]`, `objectiveId`, `status`, `confidence`) mais n'est câblée nulle part. Extension proposée pour couvrir le Bloc 4 :

```ts
interface HypothesisDetail {
  hypothesisId: string;                // référence ResearchHypothesis.id
  independentVariableId: string;
  dependentVariableId: string;
  expectedDirection?: "positive" | "negative" | "unspecified";
  theoreticalJustification?: string;   // texte libre, jamais une référence inventée
  relatedIndicatorIds?: string[];
  envisagedTest?: string;              // ex. "Test de Student sur le coefficient"
  status: ProposalStatus;
}
```

Règle absolue héritée du prompt : une corrélation identifiée par l'analyse **n'est jamais présentée comme une preuve de causalité**. Toute hypothèse validée statistiquement doit être accompagnée d'un texte de prudence méthodologique généré systématiquement (pas optionnel).

## 4. Modèle économétrique (nouveau — Bloc 5)

```ts
interface EconometricModel {
  id: string;
  projectId: string;
  dependentVariableId: string;                 // Y
  explanatoryVariableIds: string[];             // X1..Xk
  relatedHypothesisIds: string[];
  observationUnit: string;                      // ex. "PME", "ménage", "agent"
  sampleSizePlanned?: number;
  equation: string;                             // représentation textuelle : "Y = β0 + β1X1 + ... + βkXk + ε"
  status: "draft" | "proposed" | "accepted";
  readinessScore?: EconometricReadiness;        // voir §7
}
```

Exemple de forme (reproduit du prompt à titre de gabarit, pas une estimation réelle) :

```
Y  = Performance
X1 = Digitalisation
X2 = Taille de l'entreprise
X3 = Expérience
X4 = Accès au financement

Y = β0 + β1X1 + β2X2 + β3X3 + β4X4 + ε
```

## 5. Modèle de dataset (nouveau — Bloc 6)

```ts
interface DatasetVariable {
  variable_id: string;      // référence ResearchVariable.id
  nom: string;
  label: string;
  type: "quantitative" | "qualitative" | "categorical" | "ordinal";
  role: "dependent" | "independent" | "control" | "mediating" | "moderating";
  unite?: string;
  modalites?: string[];     // pour qualitative/catégorielle
  codage?: Record<string, string | number>;
  valeurManquante?: string | number; // convention utilisée (ex. -999, "NA")
  source?: string;
  indicateurId?: string;    // référence ResearchIndicator.id
  hypotheseAssocieeId?: string; // référence ResearchHypothesis.id
}

interface Dataset {
  id: string;
  projectId: string;
  variables: DatasetVariable[];
  observationCount?: number;
  exportFormats: Array<"csv" | "xlsx" | "spss" | "gretl" | "eviews">; // R/Python : plus tard
}
```

Ne pas construire les intégrations d'export maintenant — seul le modèle de données doit exister à ce stade, conformément au prompt ("créer d'abord un modèle de données propre").

## 6. Statistiques et sorties de régression (nouveau — Bloc 7-8, cadre uniquement)

Progression analytique à respecter strictement dans cet ordre (voir aussi `ACADIA_SEG_METHODOLOGY.md` §5) :

1. Descriptives : effectif, fréquence, %, moyenne, médiane, min, max, écart-type
2. Tri à plat
3. Tri croisé
4. Relations bivariées
5. Analyses multivariées
6. Régression / économétrie (MCO)

Sortie MCO à structurer (types de résultats, pas de moteur de calcul) :

```ts
interface RegressionResult {
  modelId: string;
  coefficients: Array<{
    variableId: string;
    coefficient: number;
    standardError: number;
    tStatistic: number;
    pValue: number;
  }>;
  rSquared: number;
  adjustedRSquared: number;
  residualSumOfSquares: number;
  regressionStandardError: number;
  fStatistic: number;
  fProbability: number;
  durbinWatson?: number;
  aic?: number;
  schwarz?: number;
  hannanQuinn?: number;
}
```

## 7. Tests économétriques (nouveau — Bloc 9, cadre de sélection + pédagogie)

Le système ne doit **jamais afficher tous les tests automatiquement**. Chaque test doit être sélectionné selon type de données / modèle / structure temporelle / nature des variables / hypothèses / objectif, et être explicable via 6 questions fixes :

```ts
interface EconometricTest {
  id: string;
  name:
    | "student" | "fisher" | "durbin-watson"
    | "breusch-pagan-godfrey" | "white" | "chow"
    | "reset-ramsey" | "causality";
  purpose: string;          // "Pourquoi ce test ?"
  whatItTests: string;      // "Que teste-t-il ?"
  nullHypothesis: string;   // "H0"
  alternativeHypothesis: string; // "H1"
  lowPValueMeaning: string; // "Que signifie une p-value faible ?"
  reasonableConclusion: string; // "Quelle conclusion peut-on raisonnablement tirer ?"
  applicableWhen: string[]; // conditions déclenchant sa pertinence
}
```

## 8. Interprétation intelligente (nouveau — Bloc 10)

Structure obligatoire en 9 points pour toute interprétation générée (jamais un simple "p-value = X donc significatif") :

```ts
interface ResultInterpretation {
  resultId: string;
  statisticalResult: string;      // 1. résultat statistique
  relationSense: string;          // 2. sens de la relation
  magnitude: string;              // 3. ampleur
  significance: string;           // 4. significativité
  hypothesisCoherence: string;    // 5. cohérence avec l'hypothèse
  economicImplication: string;    // 6. implication économique/gestionnaire
  limitations: string;            // 7. limites
  causalityCaution: string;       // 8. prudence sur la causalité — texte systématique, non désactivable
  literatureLink?: string;        // 9. lien avec la littérature — uniquement si source réelle fournie par le chercheur
}
```

Règle absolue : ne jamais inventer une référence, un résultat ou une confirmation d'auteur sans source fournie par l'utilisateur.

## 9. Discussion scientifique (nouveau — Bloc 11)

```ts
interface Discussion {
  resultId: string;
  observedResult: string;
  hypothesis: string;
  theory: string;
  empiricalLiterature?: string;   // vide tant qu'aucune source n'est fournie, jamais généré seul
  fieldContext: string;
  explanation: string;
  implication: string;
}
```

## 10. Econometric Readiness (nouveau — Bloc 17)

Indicateur de préparation, **pas une note scientifique** :

```ts
interface EconometricReadiness {
  dependentVariableIdentified: boolean;
  explanatoryVariablesIdentified: boolean;
  hypothesesAssociated: boolean;
  indicatorsDefined: boolean;
  datasetStructureDefined: boolean;
  dataImported: boolean;
  modelToEstimate: boolean;
  testsSelected: boolean;
  score: string; // ex. "4 / 8 éléments prêts" — calculé, jamais saisi manuellement
}
```

## 11. Ce qui n'est pas construit dans ce sprint

Aucun moteur de calcul statistique réel (pas de régression exécutée, pas de lecture de fichier de données, pas d'intégration SPSS/Gretl/EViews). Ce document ne couvre que le **modèle de données et les contrats d'interprétation** — la priorité 5 du sprint ("préparation économétrique") s'arrête au socle, conformément à la consigne explicite du prompt.
