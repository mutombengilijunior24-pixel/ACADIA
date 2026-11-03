/**
 * Connecteurs aux bases bibliographiques ouvertes. Chaque notice est recopiée telle que la base la donne
 * (jamais complétée). Délais courts, aucune donnée personnelle envoyée : seulement le titre, l'auteur,
 * l'année, le DOI ou l'ISBN d'une référence publiée.
 *
 * Crossref : sans clé ; « pool poli » avec une adresse de contact (REFERENCE_LOOKUP_MAILTO), sinon pool
 * public (une requête à la fois). OpenAlex : clé facultative (OPENALEX_API_KEY) ; recherche par DOI gratuite.
 */
import type { PersonName, ReferenceKind, SourceId, WorkRecord } from "@/lib/core/references";

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export class SourceUnavailable extends Error {
  constructor(public source: SourceId, message: string) {
    super(message);
  }
}

const TIMEOUT_MS = 7000;
const mailto = () => process.env.REFERENCE_LOOKUP_MAILTO?.trim() || null;

/**
 * Crossref : une requête à la fois dans le pool public (trois dans le pool poli), espacées pour rester
 * sous la limite de débit (environ une recherche par seconde dans le pool public).
 */
let crossrefActive = 0;
let crossrefLastStart = 0;
const crossrefQueue: Array<() => void> = [];
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function crossrefSlot<T>(run: () => Promise<T>): Promise<T> {
  const limit = mailto() ? 3 : 1;
  if (crossrefActive >= limit) await new Promise<void>((resolve) => crossrefQueue.push(resolve));
  crossrefActive += 1;
  try {
    const spacing = mailto() ? 350 : 1100;
    const waitMs = crossrefLastStart + spacing - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    crossrefLastStart = Date.now();
    return await run();
  } finally {
    crossrefActive -= 1;
    crossrefQueue.shift()?.();
  }
}

async function getJson(source: SourceId, url: string, fetcher: Fetcher, attempt = 0): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const contact = mailto();
    const res = await fetcher(url, { signal: controller.signal, headers: { Accept: "application/json", "User-Agent": `ACADIA/1.0 (https://acadiaacademie.com${contact ? `; mailto:${contact}` : ""})` }, cache: "no-store" });
    if (res.status === 404) return { status: 404, body: null };
    // Limite de débit ou surcharge passagère : une seconde tentative, après une pause.
    if ((res.status === 429 || res.status === 503) && attempt === 0) {
      clearTimeout(timer);
      await sleep(1500);
      return getJson(source, url, fetcher, 1);
    }
    if (!res.ok) throw new SourceUnavailable(source, `${source} : réponse ${res.status}`);
    return { status: res.status, body: await res.json() };
  } catch (error) {
    if (error instanceof SourceUnavailable) throw error;
    throw new SourceUnavailable(source, `${source} : ${error instanceof Error ? error.message : "erreur réseau"}`);
  } finally {
    clearTimeout(timer);
  }
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const first = (v: unknown) => (Array.isArray(v) ? str(v[0]) : str(v));
const stripTags = (s: string | null) => (s ? s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null : null);

/** « Philip Kotler » → Kotler, Philip (dernier mot = nom), faute de mieux quand la base ne sépare pas. */
export function splitDisplayName(name: string): PersonName {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { family: parts[0], given: "", corporate: false };
  return { family: parts.at(-1)!, given: parts.slice(0, -1).join(" "), corporate: false };
}

// ---------------------------------------------------------------------------------------------------------
// Crossref.

const CROSSREF_KIND: Record<string, ReferenceKind> = { "journal-article": "article", book: "livre", monograph: "livre", "edited-book": "livre", "book-chapter": "chapitre", "book-section": "chapitre", report: "rapport", dissertation: "memoire", "posted-content": "rapport", "proceedings-article": "article" };

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  subtitle?: string[];
  author?: Array<{ given?: string; family?: string; name?: string }>;
  issued?: { "date-parts"?: number[][] };
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  ISBN?: string[];
  type?: string;
  abstract?: string;
  URL?: string;
}

export function fromCrossref(item: CrossrefItem): WorkRecord | null {
  const title = first(item.title);
  if (!title) return null;
  const subtitle = first(item.subtitle);
  return {
    source: "crossref",
    id: item.DOI ?? title,
    doi: item.DOI ?? null,
    title: subtitle && !title.includes(subtitle) ? `${title} : ${subtitle}` : title,
    authors: (item.author ?? []).map((a) => (a.family ? { family: a.family, given: a.given ?? "", corporate: false } : { family: a.name ?? "?", given: "", corporate: true })),
    year: item.issued?.["date-parts"]?.[0]?.[0] ?? null,
    container: first(item["container-title"]),
    volume: str(item.volume),
    issue: str(item.issue),
    pages: str(item.page),
    publisher: str(item.publisher),
    isbn: item.ISBN ?? [],
    kind: item.type ? (CROSSREF_KIND[item.type] ?? "autre") : null,
    abstract: stripTags(item.abstract ?? null),
    url: str(item.URL),
  };
}

const crossrefUrl = (path: string, params: Record<string, string>) => {
  const q = new URLSearchParams(params);
  const contact = mailto();
  if (contact) q.set("mailto", contact);
  return `https://api.crossref.org${path}${q.size ? `?${q}` : ""}`;
};

export async function crossrefByDoi(doi: string, fetcher: Fetcher = fetch) {
  const { status, body } = await crossrefSlot(() => getJson("crossref", crossrefUrl(`/works/${encodeURIComponent(doi)}`, {}), fetcher));
  if (status === 404) return null;
  return fromCrossref((body as { message: CrossrefItem }).message);
}

export async function crossrefSearch(query: string, fetcher: Fetcher = fetch) {
  const { body } = await crossrefSlot(() => getJson("crossref", crossrefUrl("/works", { "query.bibliographic": query, rows: "5" }), fetcher));
  const items = (body as { message?: { items?: CrossrefItem[] } } | null)?.message?.items ?? [];
  return items.map(fromCrossref).filter((x): x is WorkRecord => !!x);
}

/** Titres de revues trouvés pour un nom de revue (pour savoir si la revue est indexée). */
export async function crossrefContainers(container: string, fetcher: Fetcher = fetch) {
  const { body } = await crossrefSlot(() => getJson("crossref", crossrefUrl("/works", { "query.container-title": container, rows: "5" }), fetcher));
  const items = (body as { message?: { items?: CrossrefItem[] } } | null)?.message?.items ?? [];
  return items.map((i) => first(i["container-title"])).filter((x): x is string => !!x);
}

// ---------------------------------------------------------------------------------------------------------
// OpenAlex.

const OPENALEX_KIND: Record<string, ReferenceKind> = { article: "article", book: "livre", "book-chapter": "chapitre", dissertation: "memoire", report: "rapport", preprint: "rapport" };

interface OpenAlexWork {
  id?: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string;
  publication_year?: number | null;
  authorships?: Array<{ author?: { display_name?: string }; raw_author_name?: string }>;
  primary_location?: { source?: { display_name?: string } | null; landing_page_url?: string | null } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null };
  type?: string;
  abstract_inverted_index?: Record<string, number[]> | null;
}

/** Résumé OpenAlex : index inversé (mot → positions) remis dans l'ordre. */
export function abstractFromIndex(index: Record<string, number[]> | null | undefined): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(" ") || null;
}

export function fromOpenAlex(w: OpenAlexWork): WorkRecord | null {
  const title = str(w.title) ?? str(w.display_name);
  if (!title) return null;
  const pages = w.biblio?.first_page ? (w.biblio.last_page && w.biblio.last_page !== w.biblio.first_page ? `${w.biblio.first_page}–${w.biblio.last_page}` : w.biblio.first_page) : null;
  return {
    source: "openalex",
    id: w.id ?? title,
    doi: w.doi ? w.doi.replace(/^https?:\/\/doi\.org\//i, "") : null,
    title,
    authors: (w.authorships ?? []).map((a) => splitDisplayName(a.author?.display_name ?? a.raw_author_name ?? "?")),
    year: w.publication_year ?? null,
    container: str(w.primary_location?.source?.display_name),
    volume: str(w.biblio?.volume),
    issue: str(w.biblio?.issue),
    pages,
    publisher: null,
    isbn: [],
    kind: w.type ? (OPENALEX_KIND[w.type] ?? "autre") : null,
    abstract: abstractFromIndex(w.abstract_inverted_index),
    url: str(w.primary_location?.landing_page_url),
  };
}

const openAlexUrl = (path: string, params: Record<string, string>) => {
  const q = new URLSearchParams(params);
  const key = process.env.OPENALEX_API_KEY?.trim();
  if (key) q.set("api_key", key);
  const contact = mailto();
  if (contact) q.set("mailto", contact);
  return `https://api.openalex.org${path}${q.size ? `?${q}` : ""}`;
};

export async function openAlexByDoi(doi: string, fetcher: Fetcher = fetch) {
  const { status, body } = await getJson("openalex", openAlexUrl(`/works/doi:${encodeURIComponent(doi)}`, {}), fetcher);
  return status === 404 ? null : fromOpenAlex(body as OpenAlexWork);
}

export async function openAlexSearch(query: string, fetcher: Fetcher = fetch) {
  const { body } = await getJson("openalex", openAlexUrl("/works", { search: query, per_page: "5" }), fetcher);
  return ((body as { results?: OpenAlexWork[] } | null)?.results ?? []).map(fromOpenAlex).filter((x): x is WorkRecord => !!x);
}

// ---------------------------------------------------------------------------------------------------------
// HAL (archive ouverte française : thèses, articles et ouvrages francophones).

const HAL_KIND: Record<string, ReferenceKind> = { ART: "article", OUV: "livre", COUV: "chapitre", THESE: "memoire", MEM: "memoire", HDR: "memoire", REPORT: "rapport", UNDEFINED: "rapport", COMM: "article" };

interface HalDoc {
  docid?: number | string;
  title_s?: string[];
  authLastName_s?: string[];
  authFirstName_s?: string[];
  producedDateY_i?: number;
  journalTitle_s?: string;
  volume_s?: string;
  issue_s?: string[] | string;
  page_s?: string;
  doiId_s?: string;
  uri_s?: string;
  abstract_s?: string[];
  docType_s?: string;
  publisher_s?: string[];
}

export function fromHal(d: HalDoc): WorkRecord | null {
  const title = first(d.title_s);
  if (!title) return null;
  const last = d.authLastName_s ?? [];
  const given = d.authFirstName_s ?? [];
  return {
    source: "hal",
    id: String(d.docid ?? title),
    doi: str(d.doiId_s),
    title,
    authors: last.map((family, i) => ({ family, given: given[i] ?? "", corporate: false })),
    year: d.producedDateY_i ?? null,
    container: str(d.journalTitle_s),
    volume: str(d.volume_s),
    issue: first(d.issue_s),
    pages: str(d.page_s),
    publisher: first(d.publisher_s),
    isbn: [],
    kind: d.docType_s ? (HAL_KIND[d.docType_s] ?? "autre") : null,
    abstract: first(d.abstract_s),
    url: str(d.uri_s),
  };
}

const halWords = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 12)
    .join(" ");

export async function halSearch(title: string, fetcher: Fetcher = fetch) {
  const words = halWords(title);
  if (!words) return [];
  const q = new URLSearchParams({ q: `title_t:(${words})`, fl: "docid,title_s,authLastName_s,authFirstName_s,producedDateY_i,journalTitle_s,volume_s,issue_s,page_s,doiId_s,uri_s,abstract_s,docType_s,publisher_s", rows: "5", wt: "json" });
  const { body } = await getJson("hal", `https://api.archives-ouvertes.fr/search/?${q}`, fetcher);
  return ((body as { response?: { docs?: HalDoc[] } } | null)?.response?.docs ?? []).map(fromHal).filter((x): x is WorkRecord => !!x);
}

// ---------------------------------------------------------------------------------------------------------
// Livres : Open Library et Google Books. L'année n'est pas reprise (première édition ou autre édition que
// celle de l'étudiant) : seule l'existence du livre, ses auteurs et son titre sont comparés.

interface OpenLibraryDoc {
  key?: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  publisher?: string[];
  isbn?: string[];
}

export async function openLibrarySearch(title: string, author: string | null, fetcher: Fetcher = fetch) {
  const q = new URLSearchParams({ title, limit: "5", fields: "key,title,subtitle,author_name,publisher,isbn" });
  if (author) q.set("author", author);
  const { body } = await getJson("openlibrary", `https://openlibrary.org/search.json?${q}`, fetcher);
  return ((body as { docs?: OpenLibraryDoc[] } | null)?.docs ?? [])
    .filter((d) => d.title)
    .map<WorkRecord>((d) => ({ source: "openlibrary", id: d.key ?? d.title!, doi: null, title: d.subtitle ? `${d.title} : ${d.subtitle}` : d.title!, authors: (d.author_name ?? []).map(splitDisplayName), year: null, container: null, volume: null, issue: null, pages: null, publisher: d.publisher?.[0] ?? null, isbn: (d.isbn ?? []).slice(0, 5), kind: "livre", abstract: null, url: d.key ? `https://openlibrary.org${d.key}` : null }));
}

interface GoogleVolume {
  id?: string;
  volumeInfo?: { title?: string; subtitle?: string; authors?: string[]; publisher?: string; industryIdentifiers?: Array<{ type?: string; identifier?: string }>; description?: string; infoLink?: string };
}

export async function googleBooksSearch(title: string, author: string | null, fetcher: Fetcher = fetch) {
  const q = new URLSearchParams({ q: `intitle:${title}${author ? ` inauthor:${author}` : ""}`, maxResults: "5", printType: "books" });
  const key = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (key) q.set("key", key);
  const { body } = await getJson("googlebooks", `https://www.googleapis.com/books/v1/volumes?${q}`, fetcher);
  return ((body as { items?: GoogleVolume[] } | null)?.items ?? [])
    .filter((v) => v.volumeInfo?.title)
    .map<WorkRecord>((v) => {
      const i = v.volumeInfo!;
      return { source: "googlebooks", id: v.id ?? i.title!, doi: null, title: i.subtitle ? `${i.title} : ${i.subtitle}` : i.title!, authors: (i.authors ?? []).map(splitDisplayName), year: null, container: null, volume: null, issue: null, pages: null, publisher: str(i.publisher), isbn: (i.industryIdentifiers ?? []).map((x) => x.identifier ?? "").filter(Boolean), kind: "livre", abstract: stripTags(i.description ?? null), url: str(i.infoLink) };
    });
}
