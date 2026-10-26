/**
 * Formules des indicateurs : un petit langage lisible (« XI / CP », « (BK - BB + BT) / (DP + DT) »,
 * « BI / (XB * (1 + tva)) * jours »), analysé une fois puis évalué de façon déterministe.
 * Aucun eval ni Function : seuls les codes de postes, les agrégats nommés, les paramètres et quelques
 * fonctions (prev, avg, abs, min, max) sont autorisés. Un poste manquant rend l'indicateur
 * « non calculable » avec la liste des postes manquants : jamais de valeur inventée.
 */

export type Node =
  | { t: "num"; v: number }
  | { t: "id"; name: string }
  | { t: "neg"; e: Node }
  | { t: "bin"; op: "+" | "-" | "*" | "/"; a: Node; b: Node }
  | { t: "call"; fn: "prev" | "avg" | "abs" | "min" | "max"; args: Node[] };

const FUNCTIONS = new Set(["prev", "avg", "abs", "min", "max"]);

export class FormulaError extends Error {}

function tokenize(src: string): string[] {
  const tokens: string[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|([-+*/(),]))/y;
  let index = 0;
  while (index < src.length) {
    if (/^\s+$/.test(src.slice(index))) break;
    re.lastIndex = index;
    const m = re.exec(src);
    if (!m) throw new FormulaError(`Caractère inattendu dans « ${src} » à la position ${index}.`);
    tokens.push(m[1] ?? m[2] ?? m[3]);
    index = re.lastIndex;
  }
  return tokens;
}

export function parseFormula(src: string): Node {
  const tokens = tokenize(src);
  let i = 0;
  const peek = () => tokens[i];
  const take = (expected?: string) => {
    const tok = tokens[i];
    if (tok === undefined || (expected && tok !== expected)) throw new FormulaError(`« ${src} » : « ${expected ?? "expression"} » attendu.`);
    i += 1;
    return tok;
  };
  const expr = (): Node => {
    let node = term();
    while (peek() === "+" || peek() === "-") {
      const op = take() as "+" | "-";
      node = { t: "bin", op, a: node, b: term() };
    }
    return node;
  };
  const term = (): Node => {
    let node = factor();
    while (peek() === "*" || peek() === "/") {
      const op = take() as "*" | "/";
      node = { t: "bin", op, a: node, b: factor() };
    }
    return node;
  };
  const factor = (): Node => {
    const tok = take();
    if (tok === "-") return { t: "neg", e: factor() };
    if (tok === "(") {
      const node = expr();
      take(")");
      return node;
    }
    if (/^\d/.test(tok)) return { t: "num", v: Number(tok) };
    if (/^[A-Za-z_]/.test(tok)) {
      if (peek() === "(") {
        if (!FUNCTIONS.has(tok)) throw new FormulaError(`« ${src} » : fonction inconnue « ${tok} ».`);
        take("(");
        const args = [expr()];
        while (peek() === ",") {
          take(",");
          args.push(expr());
        }
        take(")");
        return { t: "call", fn: tok as "prev", args };
      }
      return { t: "id", name: tok };
    }
    throw new FormulaError(`« ${src} » : « ${tok} » inattendu.`);
  };
  const node = expr();
  if (i !== tokens.length) throw new FormulaError(`« ${src} » : « ${tokens[i]} » inattendu.`);
  return node;
}

/** Identifiants cités par une formule (pour les contrôles d'intégrité du catalogue). */
export function identifiersOf(node: Node): string[] {
  switch (node.t) {
    case "num":
      return [];
    case "id":
      return [node.name];
    case "neg":
      return identifiersOf(node.e);
    case "bin":
      return [...identifiersOf(node.a), ...identifiersOf(node.b)];
    case "call":
      return node.args.flatMap(identifiersOf);
  }
}

export type Evaluation = { ok: true; value: number } | { ok: false; reason: "missing"; codes: string[] } | { ok: false; reason: "zero_division" } | { ok: false; reason: "no_previous" };

/** Résolution d'un identifiant pour un exercice donné (index dans la série chronologique). */
export type Resolver = (name: string, exerciseIndex: number) => Evaluation;

export function evaluate(node: Node, exerciseIndex: number, resolve: Resolver): Evaluation {
  switch (node.t) {
    case "num":
      return { ok: true, value: node.v };
    case "id":
      return resolve(node.name, exerciseIndex);
    case "neg": {
      const r = evaluate(node.e, exerciseIndex, resolve);
      return r.ok ? { ok: true, value: -r.value } : r;
    }
    case "bin": {
      const a = evaluate(node.a, exerciseIndex, resolve);
      const b = evaluate(node.b, exerciseIndex, resolve);
      if (!a.ok || !b.ok) return combineFailures([a, b]);
      if (node.op === "/") return b.value === 0 ? { ok: false, reason: "zero_division" } : { ok: true, value: a.value / b.value };
      return { ok: true, value: node.op === "+" ? a.value + b.value : node.op === "-" ? a.value - b.value : a.value * b.value };
    }
    case "call": {
      if (node.fn === "prev") return exerciseIndex === 0 ? { ok: false, reason: "no_previous" } : evaluate(node.args[0], exerciseIndex - 1, resolve);
      if (node.fn === "avg") {
        if (exerciseIndex === 0) return { ok: false, reason: "no_previous" };
        const now = evaluate(node.args[0], exerciseIndex, resolve);
        const before = evaluate(node.args[0], exerciseIndex - 1, resolve);
        if (!now.ok || !before.ok) return combineFailures([now, before]);
        return { ok: true, value: (now.value + before.value) / 2 };
      }
      const args = node.args.map((a) => evaluate(a, exerciseIndex, resolve));
      const failed = args.filter((a) => !a.ok);
      if (failed.length) return combineFailures(args);
      const values = args.map((a) => (a as { value: number }).value);
      return { ok: true, value: node.fn === "abs" ? Math.abs(values[0]) : node.fn === "min" ? Math.min(...values) : Math.max(...values) };
    }
  }
}

function combineFailures(results: Evaluation[]): Evaluation {
  const missing = results.flatMap((r) => (!r.ok && r.reason === "missing" ? r.codes : []));
  if (missing.length) return { ok: false, reason: "missing", codes: [...new Set(missing)] };
  const other = results.find((r) => !r.ok);
  return other ?? { ok: false, reason: "missing", codes: [] };
}
