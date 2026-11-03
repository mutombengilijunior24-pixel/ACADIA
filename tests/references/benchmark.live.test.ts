/**
 * Banc d'essai RÉEL du vérificateur (appels aux bases ouvertes) : lancé seulement à la demande,
 * `LIVE_REFERENCES=1 npx vitest run tests/references/benchmark.live.test.ts`. Il mesure la fiabilité sur
 * des références réelles, réelles avec erreurs, inventées et locales. Aucune donnée personnelle envoyée.
 */
import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { decideExistence, type ExistenceStatus } from "@/lib/core/references";
import { parseReference } from "@/lib/core/references/parse";
import { lookupReference } from "@/lib/server/references/lookup";

type Expected = "reelle" | "erreur" | "inventee" | "locale";

const BENCH: Array<[Expected, string, string | null]> = [
  ["reelle", "Granger, C. W. J., & Newbold, P. (1974). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111-120. https://doi.org/10.1016/0304-4076(74)90034-7", null],
  ["reelle", "Engle, R. F., & Granger, C. W. J. (1987). Co-integration and error correction: Representation, estimation, and testing. Econometrica, 55(2), 251-276.", null],
  ["reelle", "Jensen, M. C., & Meckling, W. H. (1976). Theory of the firm: Managerial behavior, agency costs and ownership structure. Journal of Financial Economics, 3(4), 305-360. https://doi.org/10.1016/0304-405X(76)90026-X", null],
  ["reelle", "Akerlof, G. A. (1970). The market for \"lemons\": Quality uncertainty and the market mechanism. The Quarterly Journal of Economics, 84(3), 488-500.", null],
  ["reelle", "Myers, S. C., & Majluf, N. S. (1984). Corporate financing and investment decisions when firms have information that investors do not have. Journal of Financial Economics, 13(2), 187-221.", null],
  ["reelle", "Dickey, D. A., & Fuller, W. A. (1979). Distribution of the estimators for autoregressive time series with a unit root. Journal of the American Statistical Association, 74(366), 427-431.", null],
  ["reelle", "Solow, R. M. (1956). A contribution to the theory of economic growth. The Quarterly Journal of Economics, 70(1), 65-94.", null],
  ["reelle", "Maslow, A. H. (1943). A theory of human motivation. Psychological Review, 50(4), 370-396. https://doi.org/10.1037/h0054346", null],
  ["reelle", "Coase, R. H. (1937). The nature of the firm. Economica, 4(16), 386-405.", null],
  ["reelle", "Spence, M. (1973). Job market signaling. The Quarterly Journal of Economics, 87(3), 355-374.", null],
  ["reelle", "Fama, E. F. (1970). Efficient capital markets: A review of theory and empirical work. The Journal of Finance, 25(2), 383-417.", null],
  ["reelle", "Kotler, P., & Keller, K. L. (2016). Marketing management (15th ed.). Pearson.", null],
  ["reelle", "Porter, M. E. (1985). Competitive advantage: Creating and sustaining superior performance. Free Press.", null],
  ["reelle", "Keynes, J. M. (1936). The general theory of employment, interest and money. Macmillan.", null],
  ["reelle", "Herzberg, F., Mausner, B., & Snyderman, B. B. (1959). The motivation to work. Wiley.", null],
  ["reelle", "McKinnon, R. I. (1973). Money and capital in economic development. Brookings Institution.", null],
  ["reelle", "KEYNES, John Maynard, Théorie générale de l'emploi, de l'intérêt et de la monnaie, Payot, Paris, 1969.", null],
  ["erreur", "Granger, C. W. J. et Newbold, P. (1976). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111-125.", null],
  ["erreur", "Engle, R. F., & Granger, C. W. J. (1987). Co-integration and error correction: Representation, estimation, and testing. Econometrica, 56(2), 251-276.", null],
  ["erreur", "Akerlof, G. A. (1971). The market for lemons: Quality uncertainty and the market mechanism. The Quarterly Journal of Economics, 84(3), 488-500.", null],
  ["erreur", "Jensen, M. C., & Meckling, W. H. (1976). Theory of the firm: Managerial behavior, agency costs and ownership structure. Journal of Finance, 3(4), 305-360.", null],
  ["inventee", "Mbuyi Kalala, J. (2019). Monetary policy transmission and dollarization in the Democratic Republic of Congo: A VAR approach. Journal of Econometrics, 210(2), 145-167. https://doi.org/10.1016/j.jeconom.2019.02.011", null],
  ["inventee", "Smith, J. A., & Brown, K. L. (2018). The impact of mobile money on financial inclusion in Central Africa. Journal of Development Economics, 135, 112-130.", null],
  ["inventee", "Kabasele, P. (2020). Inflation targeting and exchange rate volatility in Sub-Saharan Africa: Evidence from Katanga. World Development, 128, 104-120.", null],
  ["inventee", "Johnson, M. (2017). Corporate governance and firm performance in emerging markets: Evidence from Lubumbashi mining firms. Journal of Financial Economics, 125(3), 455-472.", null],
  ["inventee", "Keynes, J. M. (1950). The theory of money and inflation in Central Africa. Macmillan.", null],
  ["inventee", "Ngoy, A. et Mutombo, B. (2021). La politique monétaire de la BCC face à la dollarisation : une approche ARDL. Revue d'économie du développement, 29(2), 77-101.", null],
  ["locale", "KASONGO, J., Analyse de la rentabilité de la BCDC, Mémoire de licence, UNILU, Lubumbashi, 2020.", "Mémoires et TFC"],
  ["locale", "Banque Centrale du Congo. (2021). Rapport annuel 2020. BCC.", null],
  ["locale", "MULUMBA, K., Notes de cours d'économétrie, Faculté des sciences économiques, UNILU, 2019.", "Cours"],
];

const GOOD: Record<Expected, ExistenceStatus[]> = { reelle: ["verifiee", "a_corriger"], erreur: ["a_corriger"], inventee: ["suspecte", "introuvable"], locale: ["non_verifiable"] };

describe.skipIf(!process.env.LIVE_REFERENCES)("banc d'essai réel (bases ouvertes)", () => {
  it(
    "statuts attendus par catégorie",
    async () => {
      const rows: Array<{ expected: Expected; status: ExistenceStatus; ok: boolean; title: string; reason: string; source: string }> = [];
      for (const [expected, raw, section] of BENCH) {
        const ref = parseReference({ raw, runs: [], section, paragraphIndex: 0 }, rows.length);
        const v = decideExistence(ref, await lookupReference(ref, { cache: null }), "apa_fr");
        rows.push({ expected, status: v.status, ok: GOOD[expected].includes(v.status), title: (ref.title ?? raw).slice(0, 60), reason: v.reasons[0]?.slice(0, 110) ?? "", source: v.match?.source ?? "—" });
      }
      const by = (e: Expected) => rows.filter((r) => r.expected === e);
      const rate = (e: Expected) => by(e).filter((r) => r.ok).length / by(e).length;
      const lines = [...rows.map((r) => `${r.ok ? "OK " : "NON"} [${r.expected}] ${r.status.padEnd(14)} ${r.source.padEnd(11)} ${r.title} — ${r.reason}`), `Réelles reconnues : ${(rate("reelle") * 100).toFixed(0)} % ; erreurs repérées : ${(rate("erreur") * 100).toFixed(0)} % ; inventées non validées : ${(rate("inventee") * 100).toFixed(0)} % ; locales non accusées : ${(rate("locale") * 100).toFixed(0)} %`];
      // Détail écrit dans un fichier (la console des tests est muette dans cette configuration).
      if (process.env.LIVE_REFERENCES_OUT) writeFileSync(process.env.LIVE_REFERENCES_OUT, lines.join("\n"), "utf8");
      // Exigences minimales : aucune référence inventée validée, aucune référence locale déclarée suspecte.
      expect(by("inventee").filter((r) => r.status === "verifiee" || r.status === "a_corriger")).toEqual([]);
      expect(by("locale").filter((r) => r.status === "suspecte")).toEqual([]);
    },
    600_000,
  );
});
