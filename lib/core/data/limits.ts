/**
 * Limites de l'importateur — configurables, documentées, jamais appliquées par troncature.
 *
 * Les valeurs par défaut couvrent largement les jeux de données habituels des recherches
 * universitaires (questionnaires de quelques centaines à quelques dizaines de milliers de
 * répondants, quelques dizaines à centaines de questions). Le fichier est lu dans le
 * navigateur : les limites protègent la mémoire de l'appareil de l'utilisateur.
 */
export interface ImportLimits {
  /** Taille maximale du fichier, en octets. */
  maxFileBytes: number;
  /** Nombre maximal d'observations (hors en-tête). */
  maxRows: number;
  /** Nombre maximal de colonnes. */
  maxColumns: number;
  /** Nombre maximal de cellules (lignes × colonnes). */
  maxCells: number;
  /** XLSX : taille décompressée maximale de l'archive (protection « zip bomb »). */
  maxUncompressedBytes: number;
  /** XLSX : rapport maximal taille décompressée / taille compressée d'une entrée. */
  maxCompressionRatio: number;
}

export const DEFAULT_IMPORT_LIMITS: ImportLimits = {
  maxFileBytes: 25 * 1024 * 1024,
  maxRows: 200_000,
  maxColumns: 1_000,
  maxCells: 5_000_000,
  maxUncompressedBytes: 300 * 1024 * 1024,
  maxCompressionRatio: 250,
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace(".", ",")} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
