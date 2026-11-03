/**
 * Lecture d'un mémoire Word (.docx) DANS LE NAVIGATEUR : texte de chaque paragraphe, italique de chaque
 * fragment (exigé par l'APA pour les titres d'ouvrages et les revues) et notes de bas de page (où beaucoup
 * de mémoires placent leurs références). Le document ne quitte jamais l'ordinateur de l'étudiant.
 */
import { strFromU8, unzipSync } from "fflate";

import type { DocParagraph, TextRun } from "./types";

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

/** Italique d'un fragment : « <w:i/> » ou « <w:i w:val="1|true|on"/> », mais pas « w:val="0|false" ». */
const isItalic = (rPr: string) => /<w:i(?:\s+w:val="(?:1|true|on)")?\s*\/>/.test(rPr) && !/<w:i\s+w:val="(?:0|false|off)"\s*\/>/.test(rPr);

function paragraphsOf(xml: string, footnote: boolean, start: number): DocParagraph[] {
  const out: DocParagraph[] = [];
  const paragraphs = xml.match(/<w:p[\s>][\s\S]*?<\/w:p>/g) ?? [];
  for (const p of paragraphs) {
    const style = /<w:pStyle\s+w:val="([^"]+)"/.exec(p)?.[1] ?? null;
    const runs: TextRun[] = [];
    // Fragments de texte (les codes de champ Zotero/Mendeley, dans <w:instrText>, sont ignorés).
    for (const r of p.match(/<w:r[\s>][\s\S]*?<\/w:r>/g) ?? []) {
      const rPr = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(r)?.[1] ?? "";
      let text = "";
      for (const piece of r.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br\/>|<w:noBreakHyphen\/>/g) ?? []) {
        if (piece === "<w:tab/>") text += "\t";
        else if (piece === "<w:br/>") text += " ";
        else if (piece === "<w:noBreakHyphen/>") text += "-";
        else text += decode(piece.replace(/^<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>$/, ""));
      }
      if (!text) continue;
      const italic = isItalic(rPr);
      const last = runs.at(-1);
      if (last && last.italic === italic) last.text += text;
      else runs.push({ text, italic });
    }
    const text = runs.map((r) => r.text).join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    out.push({ index: start + out.length, text, runs, style, footnote });
  }
  return out;
}

export interface DocText {
  paragraphs: DocParagraph[];
  footnotes: DocParagraph[];
}

/** Paragraphes du corps du texte, puis des notes de bas de page (séparateurs de notes exclus). */
export function readDocx(bytes: Uint8Array): DocText {
  const files = unzipSync(bytes, { filter: (f) => f.name === "word/document.xml" || f.name === "word/footnotes.xml" });
  const document = files["word/document.xml"];
  if (!document) throw new Error("Ce fichier n'est pas un document Word (.docx) lisible.");
  const paragraphs = paragraphsOf(strFromU8(document), false, 0);
  const notesXml = files["word/footnotes.xml"] ? strFromU8(files["word/footnotes.xml"]) : "";
  const notes = (notesXml.match(/<w:footnote\s[\s\S]*?<\/w:footnote>/g) ?? []).filter((n) => !/w:type="(?:separator|continuationSeparator|continuationNotice)"/.test(n));
  const footnotes = paragraphsOf(notes.join(""), true, paragraphs.length);
  return { paragraphs, footnotes };
}

/** Texte collé : un paragraphe par ligne non vide, sans italique connu. */
export function paragraphsFromText(text: string, footnote = false, start = 0): DocParagraph[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line, i) => ({ index: start + i, text: line, runs: [{ text: line, italic: false }], style: null, footnote }));
}
