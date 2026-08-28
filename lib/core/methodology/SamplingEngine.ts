export interface SamplingResult {
  population: number;
  sampleSize: number | null;
  method: string;
  marginOfError: number;
  confidenceLevel: number;
  explanation: string;
}

export function calculateSampleSize(
  population: number,
  marginOfError = 0.05
): SamplingResult {
  if (
    !population ||
    population <= 0
  ) {
    return {
      population: 0,
      sampleSize: null,
      method: "Non calculable",
      marginOfError:
        marginOfError * 100,
      confidenceLevel: 95,
      explanation:
        "La taille de la population doit être renseignée.",
    };
  }

  // Formule de Yamane
  const sample =
    population /
    (
      1 +
      population *
        Math.pow(
          marginOfError,
          2
        )
    );

  const sampleSize =
    Math.ceil(sample);

  return {
    population,
    sampleSize,
    method:
      "Formule de Yamane",
    marginOfError:
      marginOfError * 100,
    confidenceLevel: 95,
    explanation:
      `Pour une population de ${population} personnes, avec une marge d'erreur de 5 %, la taille recommandée de l'échantillon est de ${sampleSize} personnes.`,
  };
}