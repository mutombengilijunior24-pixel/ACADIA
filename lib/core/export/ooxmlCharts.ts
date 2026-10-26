/**
 * Graphiques NATIFS Office (DrawingML « chartSpace ») : dans Word comme dans Excel, ce sont de vrais
 * graphiques — infobulles au survol, données modifiables (« Modifier les données »), couleurs et
 * styles changeables — et non des images. Les valeurs sont reliées à un tableau de données :
 * la feuille « Graphiques » du classeur Excel, ou un classeur incorporé dans le document Word.
 */
import { chartTable, type ChartSpec } from "./chartSpecs";

/** Emplacement du tableau de données dans le classeur (ligne d'en-tête, 1 = première ligne). */
export interface ChartDataRef {
  sheet: string;
  headerRow: number;
  /** Colonne de départ (0 = A). */
  firstCol?: number;
}

const esc = (t: string) =>
  t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const hex = (color: string) => color.replace("#", "").toUpperCase();
const fill = (color: string, alpha?: number) => `<a:solidFill><a:srgbClr val="${hex(color)}">${alpha !== undefined ? `<a:alpha val="${alpha}"/>` : ""}</a:srgbClr></a:solidFill>`;
const TEXT = "334155";
const GRID = "E2E8F0";

function col(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    letters = String.fromCharCode(65 + r) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function quoteSheet(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

function range(ref: ChartDataRef, column: number, count: number): string {
  const c = col((ref.firstCol ?? 0) + column);
  return `${quoteSheet(ref.sheet)}!$${c}$${ref.headerRow + 1}:$${c}$${ref.headerRow + count}`;
}

function headerCell(ref: ChartDataRef, column: number): string {
  return `${quoteSheet(ref.sheet)}!$${col((ref.firstCol ?? 0) + column)}$${ref.headerRow}`;
}

function strRef(formula: string, values: string[]): string {
  return `<c:strRef><c:f>${esc(formula)}</c:f><c:strCache><c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join("")}</c:strCache></c:strRef>`;
}

function numRef(formula: string, values: number[], format = "General"): string {
  return `<c:numRef><c:f>${esc(formula)}</c:f><c:numCache><c:formatCode>${esc(format)}</c:formatCode><c:ptCount val="${values.length}"/>${values.map((v, i) => (Number.isFinite(v) ? `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>` : "")).join("")}</c:numCache></c:numRef>`;
}

const textProps = (size = 1000, bold = false, color = TEXT) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size}" b="${bold ? 1 : 0}">${fill(`#${color}`)}<a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="fr-FR"/></a:p></c:txPr>`;

function dataLabels(opts: { value?: boolean; percent?: boolean; format?: string; position?: string; color?: string; bold?: boolean }): string {
  return `<c:dLbls>${opts.format ? `<c:numFmt formatCode="${esc(opts.format)}" sourceLinked="0"/>` : ""}<c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${textProps(900, opts.bold ?? true, opts.color ?? TEXT)}${opts.position ? `<c:dLblPos val="${opts.position}"/>` : ""}<c:showLegendKey val="0"/><c:showVal val="${opts.value ? 1 : 0}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${opts.percent ? 1 : 0}"/><c:showBubbleSize val="0"/></c:dLbls>`;
}

function axisTitle(text: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1000" b="1"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="1000" b="1"/><a:t>${esc(text)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
}

function catAx(id: number, cross: number, position: "b" | "l", reversed = false): string {
  return `<c:catAx><c:axId val="${id}"/><c:scaling><c:orientation val="${reversed ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${position}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln w="9525">${fill(`#${GRID}`)}</a:ln></c:spPr>${textProps(900)}<c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
}

function valAx(id: number, cross: number, position: "b" | "l", opts: { format?: string; max?: number; title?: string; between?: boolean; crossesMax?: boolean } = {}): string {
  return `<c:valAx><c:axId val="${id}"/><c:scaling><c:orientation val="minMax"/>${opts.max !== undefined ? `<c:max val="${opts.max}"/><c:min val="0"/>` : ""}</c:scaling><c:delete val="0"/><c:axPos val="${position}"/><c:majorGridlines><c:spPr><a:ln w="9525">${fill(`#${GRID}`)}</a:ln></c:spPr></c:majorGridlines>${opts.title ? axisTitle(opts.title) : ""}<c:numFmt formatCode="${esc(opts.format ?? "General")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:ln><a:noFill/></a:ln></c:spPr>${textProps(900)}<c:crossAx val="${cross}"/><c:crosses val="${opts.crossesMax ? "max" : "autoZero"}"/>${opts.between === false ? "" : '<c:crossBetween val="between"/>'}</c:valAx>`;
}

function chartTitle(title: string): string {
  return `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="fr-FR" sz="1200" b="1">${fill("#1E293B")}</a:rPr><a:t>${esc(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`;
}

const legend = (position: "r" | "b") => `<c:legend><c:legendPos val="${position}"/><c:overlay val="0"/>${textProps(1000, false)}</c:legend>`;

function plot(spec: ChartSpec, ref: ChartDataRef): { plotArea: string; legend: string } {
  const table = chartTable(spec);
  const n = table.rows.length;
  const cats = table.rows.map((r) => String(r[0]));
  const categories = strRef(range(ref, 0, n), cats);
  const name = (column: number, label: string) => `<c:tx>${strRef(headerCell(ref, column), [label])}</c:tx>`;
  switch (spec.kind) {
    case "donut": {
      const points = spec.colors.map((c, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr>${fill(c)}<a:ln w="19050">${fill("#FFFFFF")}</a:ln></c:spPr></c:dPt>`).join("");
      return {
        plotArea: `<c:plotArea><c:layout/><c:doughnutChart><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${name(1, spec.valueName)}${points}${dataLabels({ percent: true, format: "0.0%", color: "FFFFFF" })}<c:cat>${categories}</c:cat><c:val>${numRef(range(ref, 1, n), spec.values)}</c:val></c:ser><c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart><c:spPr><a:noFill/></c:spPr></c:plotArea>`,
        legend: legend("r"),
      };
    }
    case "bars": {
      const points = spec.colors.map((c, i) => `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${fill(c)}</c:spPr></c:dPt>`).join("");
      return {
        plotArea: `<c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${name(1, spec.valueName)}<c:invertIfNegative val="0"/>${points}${dataLabels({ value: true, position: "outEnd" })}<c:cat>${categories}</c:cat><c:val>${numRef(range(ref, 1, n), spec.values)}</c:val></c:ser><c:gapWidth val="45"/><c:axId val="101"/><c:axId val="102"/></c:barChart>${catAx(101, 102, "l", true)}${valAx(102, 101, "b", { title: spec.valueName, crossesMax: true })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`,
        legend: "",
      };
    }
    case "histogram":
      return {
        plotArea: `<c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/>${name(1, spec.valueName)}<c:spPr><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${hex(spec.colors[0])}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${hex(spec.colors[1])}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></c:spPr><c:invertIfNegative val="0"/>${dataLabels({ value: true, position: "outEnd" })}<c:cat>${categories}</c:cat><c:val>${numRef(range(ref, 1, n), spec.values)}</c:val></c:ser><c:gapWidth val="4"/><c:axId val="101"/><c:axId val="102"/></c:barChart>${catAx(101, 102, "b")}${valAx(102, 101, "l", { title: spec.valueName })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`,
        legend: "",
      };
    case "stacked": {
      const series = spec.series
        .map((s, j) => `<c:ser><c:idx val="${j}"/><c:order val="${j}"/>${name(j + 1, s.name)}<c:spPr>${fill(s.color)}</c:spPr><c:invertIfNegative val="0"/>${dataLabels({ value: true, format: '0" %"', position: "ctr", color: "FFFFFF" })}<c:cat>${categories}</c:cat><c:val>${numRef(range(ref, j + 1, n), s.values, '0.0" %"')}</c:val></c:ser>`)
        .join("");
      return {
        plotArea: `<c:plotArea><c:layout/><c:barChart><c:barDir val="bar"/><c:grouping val="stacked"/><c:varyColors val="0"/>${series}<c:gapWidth val="55"/><c:overlap val="100"/><c:axId val="101"/><c:axId val="102"/></c:barChart>${catAx(101, 102, "l", true)}${valAx(102, 101, "b", { format: '0" %"', max: 100, crossesMax: true })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`,
        legend: legend("b"),
      };
    }
    case "means": {
      const points = spec.colors.map((c, i) => `<c:dPt><c:idx val="${i}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${fill(c)}</c:spPr></c:dPt>`).join("");
      const errors = `<c:errBars><c:errBarType val="both"/><c:errValType val="cust"/><c:noEndCap val="0"/><c:plus>${numRef(range(ref, 2, n), spec.sds)}</c:plus><c:minus>${numRef(range(ref, 2, n), spec.sds)}</c:minus><c:spPr><a:ln w="15875">${fill("#334155")}</a:ln></c:spPr></c:errBars>`;
      return {
        plotArea: `<c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="1"/><c:ser><c:idx val="0"/><c:order val="0"/>${name(1, spec.valueName)}<c:invertIfNegative val="0"/>${points}${dataLabels({ value: true, format: "0.00", position: "inEnd", color: "FFFFFF" })}${errors}<c:cat>${categories}</c:cat><c:val>${numRef(range(ref, 1, n), spec.means)}</c:val></c:ser><c:gapWidth val="90"/><c:axId val="101"/><c:axId val="102"/></c:barChart>${catAx(101, 102, "b")}${valAx(102, 101, "l", { title: spec.valueName })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`,
        legend: "",
      };
    }
    case "scatter": {
      const xs = table.rows.map((r) => Number(r[0]));
      const ys = table.rows.map((r) => Number(r[1]));
      const trend = spec.trendline ? `<c:trendline><c:spPr><a:ln w="22225">${fill(spec.lineColor)}</a:ln></c:spPr><c:trendlineType val="linear"/><c:dispRSqr val="0"/><c:dispEq val="0"/></c:trendline>` : "";
      return {
        plotArea: `<c:plotArea><c:layout/><c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/><c:ser><c:idx val="0"/><c:order val="0"/>${name(1, spec.yLabel)}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="7"/><c:spPr>${fill(spec.color, 70000)}<a:ln w="9525">${fill(spec.color)}</a:ln></c:spPr></c:marker>${trend}<c:xVal>${numRef(range(ref, 0, n), xs)}</c:xVal><c:yVal>${numRef(range(ref, 1, n), ys)}</c:yVal><c:smooth val="0"/></c:ser><c:axId val="101"/><c:axId val="102"/></c:scatterChart>${valAx(101, 102, "b", { title: spec.xLabel, between: false })}${valAx(102, 101, "l", { title: spec.yLabel, between: false })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`,
        legend: "",
      };
    }
    case "line": {
      const series = spec.series
        .map((s, j) => `<c:ser><c:idx val="${j}"/><c:order val="${j}"/>${name(j + 1, s.name)}<c:spPr><a:ln w="28575" cap="rnd">${fill(s.color)}<a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${fill(s.color)}<a:ln w="9525">${fill(s.color)}</a:ln></c:spPr></c:marker><c:cat>${categories}</c:cat><c:val>${numRef(range(ref, j + 1, n), s.values.map((v) => (v === null ? Number.NaN : v)), "#,##0.##")}</c:val><c:smooth val="0"/></c:ser>`)
        .join("");
      return {
        plotArea: `<c:plotArea><c:layout/><c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${series}<c:marker val="1"/><c:axId val="101"/><c:axId val="102"/></c:lineChart>${catAx(101, 102, "b")}${valAx(102, 101, "l", { title: spec.valueName, format: "#,##0" })}<c:spPr><a:noFill/></c:spPr></c:plotArea>`,
        legend: legend("b"),
      };
    }
  }
}

/** XML d'un graphique natif. `embeddedRel` : relation vers le classeur incorporé (Word). */
export function chartSpaceXml(spec: ChartSpec, ref: ChartDataRef, embeddedRel?: string): string {
  const { plotArea, legend: legendXml } = plot(spec, ref);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:lang val="fr-FR"/><c:roundedCorners val="0"/><c:chart>${chartTitle(spec.title)}${plotArea}${legendXml}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr>${fill("#FFFFFF")}<a:ln><a:noFill/></a:ln></c:spPr>${textProps(1000, false)}${embeddedRel ? `<c:externalData r:id="${embeddedRel}"><c:autoUpdate val="0"/></c:externalData>` : ""}</c:chartSpace>`;
}

/** Hauteur conseillée (en pixels) d'un graphique natif selon son contenu. */
export function nativeChartSize(spec: ChartSpec): { width: number; height: number } {
  switch (spec.kind) {
    case "bars":
      return { width: 600, height: Math.max(220, 70 + spec.categories.length * 34) };
    case "stacked":
      return { width: 600, height: Math.max(230, 110 + spec.categories.length * 46) };
    case "donut":
      return { width: 520, height: 280 };
    case "scatter":
      return { width: 600, height: 340 };
    default:
      return { width: 600, height: 300 };
  }
}
