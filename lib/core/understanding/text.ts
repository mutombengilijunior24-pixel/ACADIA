/**
 * Outils de texte français pour le moteur de compréhension (sans dépendance).
 * La comparaison se fait sur des « racines » : minuscules, sans accents, sans mots-outils,
 * avec une réduction légère du pluriel et du féminin (commerciales → commercial).
 */

const STOPWORDS = new Set(
  (
    "a au aux avec ce ces cet cette d dans de des du elle elles en entre est et etre il ils l la le les leur leurs lui " +
    "ma mais me meme mes moi mon ne ni nos notre nous on ont ou par pas pour qu que quel quelle quelles quels qui sa sans se " +
    "ses si son sont sous sur ta te tes toi ton tu un une vos votre vous y ainsi aussi tres plus moins comme lors notamment " +
    "dont cela celle celui ceux leur etc cas etude etudie etudiee etudiees etudies chez vers afin selon tout tous toute toutes"
  ).split(" "),
);

export function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function stem(word: string): string {
  let w = word;
  if (w.length > 3 && (w.endsWith("s") || w.endsWith("x"))) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith("ll")) w = w.slice(0, -1);
  return w;
}

export function words(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Racines des mots porteurs de sens, dans l'ordre. */
export function contentStems(text: string): string[] {
  return words(text)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stem);
}

export function conceptKey(name: string): string {
  return contentStems(name).join("-") || fold(name).replace(/[^a-z0-9]+/g, "-");
}

/** Le texte (racines) contient-il le concept ? Tous les mots du concept, ou 2/3 pour un concept long. */
export function containsStems(textStems: Set<string>, concept: string[]): boolean {
  if (concept.length === 0) return false;
  const present = concept.filter((s) => textStems.has(s)).length;
  if (concept.length <= 2) return present === concept.length;
  return present >= Math.ceil((concept.length * 2) / 3);
}

export function stemSet(text: string): Set<string> {
  return new Set(contentStems(text));
}

export function overlap(a: string[], b: Set<string>): number {
  return a.filter((s) => b.has(s)).length;
}

/** Sépare une liste saisie : un élément par ligne (puces et numéros retirés). */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*·]|\d{1,2}[.)]|[a-z][.)]|H\d+\s*[:.)-]?)\s*/i, "").trim())
    .filter((line) => line.length > 0);
}

/** Sépare une énumération en ligne : « a, b, c et d ». */
export function splitEnumeration(text: string): string[] {
  return text
    .split(/,|;|\s+et\s+|\s+ou\s+/)
    .map((part) => part.replace(/[.!?]+$/, "").trim())
    .filter((part) => contentStems(part).length > 0);
}

export function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

/** Retire déterminants initiaux et ponctuation finale : « la digitalisation » → « digitalisation ». */
export function cleanPhrase(text: string): string {
  let result = text.trim().replace(/^[«"“(\s]+|[»"”).,;:!?\s]+$/g, "");
  for (let i = 0; i < 3; i += 1) {
    // Déterminant suivi d'une espace, ou élidé (l', d', de l') : « leadership » ne perd pas son « le ».
    const next = result.replace(/^(?:(?:la|le|les|un|une|des|du|de la|de|leur|leurs|son|sa|ses|cette|ce|ces)\s+|(?:de l|l|d)['’]\s*)(?=\S)/i, "");
    if (next === result) break;
    result = next;
  }
  return result.trim();
}

/** Courte empreinte stable d'un objet (pour détecter qu'un rapport est périmé). */
export function hashKey(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function excerpt(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
