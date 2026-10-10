/**
 * Modèle de document commun aux exports : un même contenu est rendu en HTML (impression / PDF),
 * en Word (.docx) et, pour ses graphiques, dans le classeur Excel.
 */
import type { ChartSpec } from "./chartSpecs";
import { svgFromSpec } from "./svgCharts";

export type Block =
  | { type: "title"; text: string }
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string; tag?: string; bold?: boolean }
  | { type: "meta"; text: string }
  | { type: "warn"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "table"; head: string[]; rows: Array<Array<string | number>> }
  | { type: "chart"; spec: ChartSpec };

export interface ReportDocument {
  title: string;
  blocks: Block[];
}

export function chartsOf(doc: ReportDocument): ChartSpec[] {
  return doc.blocks.flatMap((b) => (b.type === "chart" ? [b.spec] : []));
}

/** Texte brut : les balises HTML éventuellement présentes dans un texte saisi ou collé (« <br> »…) ne sont jamais recopiées telles quelles. */
export const plainText = (text: string) =>
  text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<\/?[a-z][a-z0-9]*(\s[^<>]*)?\/?>/gi, "")
    .replace(/&nbsp;/g, " ");

const escRaw = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const esc = (text: string) => escRaw(plainText(text)).replace(/\n/g, "<br>");
const cell = (v: string | number) => (typeof v === "number" ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(v).replace(/[  ]/g, " ") : v);

const STYLE = `
@page { size: A4; margin: 18mm 16mm; }
body { font-family: Inter, "Segoe UI", Calibri, Arial, sans-serif; color: #0f172a; line-height: 1.55; margin: 32px auto; max-width: 860px; padding: 0 16px; }
h1.title { font-size: 26px; color: #312e81; margin: 0 0 6px; }
h1 { font-size: 20px; color: #312e81; border-bottom: 2px solid #c7d2fe; padding-bottom: 4px; margin-top: 30px; }
h2 { font-size: 16px; color: #1e293b; margin-top: 22px; }
h3 { font-size: 14px; color: #334155; margin-top: 16px; }
p { margin: 6px 0; }
table { border-collapse: collapse; margin: 8px 0 14px; font-size: 13px; width: 100%; }
th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; vertical-align: top; }
th { background: #e0e7ff; color: #1e1b4b; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
.meta { color: #475569; font-size: 13px; }
.tag { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 9px; background: #e0e7ff; color: #3730a3; margin-left: 4px; }
.warn { background: #fef3c7; padding: 8px 12px; border-left: 4px solid #f59e0b; border-radius: 4px; }
figure { margin: 12px 0 18px; padding: 10px; border: 1px solid #e2e8f0; border-radius: 12px; break-inside: avoid; }
figure svg { width: 100%; height: auto; }
figcaption { font-weight: 600; font-size: 13px; margin-bottom: 6px; color: #1e293b; }
.note { color: #64748b; font-size: 12px; margin-top: 4px; }
`;

export function renderHtml(doc: ReportDocument): string {
  const body = doc.blocks
    .map((b) => {
      switch (b.type) {
        case "title":
          return `<h1 class="title">${esc(b.text)}</h1>`;
        case "h1":
          return `<h1>${esc(b.text)}</h1>`;
        case "h2":
          return `<h2>${esc(b.text)}</h2>`;
        case "h3":
          return `<h3>${esc(b.text)}</h3>`;
        case "p":
          return `<p>${b.bold ? `<b>${esc(b.text)}</b>` : esc(b.text)}${b.tag ? `<span class="tag">${esc(b.tag)}</span>` : ""}</p>`;
        case "meta":
          return `<p class="meta">${esc(b.text)}</p>`;
        case "warn":
          return `<p class="warn">${esc(b.text)}</p>`;
        case "bullets":
          return `<ul>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
        case "table":
          return `<table><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td${typeof c === "number" ? ' class="num"' : ""}>${esc(String(cell(c)))}</td>`).join("")}</tr>`)
            .join("")}</tbody></table>`;
        case "chart": {
          const chart = svgFromSpec(b.spec);
          return chart ? `<figure><figcaption>${esc(chart.title)}</figcaption>${chart.svg}${chart.note ? `<p class="note">${esc(chart.note)}</p>` : ""}</figure>` : "";
        }
      }
    })
    .join("\n");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(doc.title)}</title><style>${STYLE}</style></head><body>${body}</body></html>`;
}

export { cell as formatCell };
