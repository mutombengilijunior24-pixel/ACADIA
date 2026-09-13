// ============================================================
// ACADIA — ANALYSE EN PROFONDEUR (10/09/2026)
//
// Réutilise l'orchestrateur A1+A2 existant (analyzeResearch,
// lib/core/research/ResearchIntelligenceEngine.ts) — jamais recodé.
// Le sujet et la compréhension déjà obtenus via la preview sans
// compte (voir app/api/preview/route.ts) servent de point de départ ;
// l'étudiant peut compléter avec ce qu'il a déjà trouvé (notes
// libres, jamais un fait inventé par ACADIA). Ajoute uniquement les
// orientations théoriques (nouvelles, lib/ai/openai/TheoreticalOrientationAI.ts)
// — variables, relations et hypothèses viennent intégralement d'A1/A2.
// ============================================================

import { z } from "zod";
import { randomUUID } from "node:crypto";
import { getSessionUser, unauthorized, notFound, forbidden } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, updateResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { analyzeResearch } from "@/lib/core/research/ResearchIntelligenceEngine";
import { proposeTheoreticalOrientations } from "@/lib/ai/openai/TheoreticalOrientationAI";
import { searchPhenomenonContext } from "@/lib/ai/openai/PhenomenonContextAI";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { buildResearchAnalysisResponse } from "@/lib/core/research/ResearchAnalysisResponse";
import { ensureEntitlement, EntitlementRequiredError } from "@/lib/server/billing/EntitlementService";
import { getCatalogEntry, getEffectivePriceUsd } from "@/lib/server/billing/PricingConfig";
import type { ResearchData } from "@/types/Research";
import type { TheoreticalOrientation, SourcedContextItem, ResearchAnalysisVersion } from "@/lib/core/research/ResearchTypes";

export const runtime = "nodejs";

const bodySchema = z.object({
  additionalNotes: z.string().trim().max(2000).optional(),
  // Research Intelligence V2 — le seul verrou existant contre un
  // double appel A1+A2+orientations théoriques était côté client
  // (DeepAnalysisSection.tsx se cache dès que variables.length > 0),
  // ce qui ne protège pas contre un second POST direct sur cette
  // route. force=true permet explicitement de relancer l'analyse
  // (ex. après modification du sujet) sans jamais bloquer
  // définitivement cette possibilité.
  force: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const limit = rateLimiter.check(rateLimitKey("deep-analysis", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'analyses récentes. Réessayez dans quelques minutes." }, { status: 429 });
  }

  // Mission Conversion + Pay-as-you-progress — "Variables 🔒" dans le
  // parcours affiché au chercheur correspond exactement à cette
  // capacité (A1 complet + A2). Pendant la bêta, ensureEntitlement
  // débloque automatiquement (prix effectif 0) — ne dégrade jamais le
  // parcours existant ; hors bêta avec un prix réel non encore payé,
  // répond 402 avec de quoi construire l'écran de déblocage.
  try {
    await ensureEntitlement(user.id, id, "RESEARCH_ANALYSIS");
  } catch (error) {
    if (error instanceof EntitlementRequiredError) {
      return Response.json(
        {
          error: "Cette analyse nécessite de débloquer l'étape « Analyse en profondeur ».",
          entitlementRequired: getCatalogEntry(error.key),
          priceUsd: getEffectivePriceUsd(error.key),
        },
        { status: 402 }
      );
    }
    throw error;
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const project = record.project;
  const understanding = project.understanding;
  const notes = parsed.data.additionalNotes;

  // Verrou serveur anti double-appel — une analyse en profondeur a
  // déjà produit des variables pour ce projet ; on ne relance jamais
  // A1+A2+orientations théoriques (3 appels OpenAI) sans intention
  // explicite du chercheur.
  if (project.variables.length > 0 && !parsed.data.force) {
    return Response.json(
      {
        error:
          "Une analyse en profondeur a déjà été effectuée pour ce projet. Renvoyez la requête avec force=true pour la relancer.",
        alreadyAnalyzed: true,
      },
      { status: 409 }
    );
  }

  // Préfère la question de recherche déjà reconnue (project.researchQuestions,
  // construite à la création du projet depuis la preview — voir
  // createResearchFromPreview) : c'est déjà un texte se terminant par
  // "?", garantissant que ResearchCore.buildResearchQuestions la
  // reconnaît de nouveau ici. Sinon, repli sur le problème brut de la
  // compréhension (peut ne pas se terminer par "?", auquel cas aucune
  // question n'est fabriquée — jamais une invention).
  const existingQuestion = project.researchQuestions.find((q) => q.type === "main")?.text;
  const problemText = [existingQuestion ?? understanding?.problem, notes].filter(Boolean).join(" ").trim();

  // Research Intelligence V3 — objective/objectives sont désormais
  // désignés par A1 lui-même (generalObjective/specificObjectives,
  // voir SubjectUnderstandingAI.ts) et A1 ÉCHOE tel quel ce qu'il
  // reçoit ici en le marquant KNOWN. On ne peut donc PAS lui
  // réinjecter sa propre proposition d'un run précédent
  // (understanding.objective/.objectives, jamais revue par le
  // chercheur) sans transformer silencieusement une proposition en
  // fait. Seuls les objectifs réellement ACCEPTÉS par le chercheur
  // (project.objectives, via le Wizard ou "Question & objectifs")
  // constituent une information KNOWN légitime à réinjecter.
  const acceptedGeneralObjective = project.objectives.find((o) => o.role === "general")?.text;
  const acceptedSpecificObjectives = project.objectives
    .filter((o) => o.role === "specific")
    .map((o) => o.text);

  const researchData: ResearchData = {
    title: project.title || "",
    domain: project.domain || "",
    level: project.level || "",
    university: project.university || "",
    researchType: project.researchType || "",
    problem: problemText,
    objective: acceptedGeneralObjective || "",
    objectives: acceptedSpecificObjectives,
    population: understanding?.population || "",
    populationSize: 0,
    location: understanding?.location || "",
    collectionMethod: "",
  };

  if (!researchData.title.trim()) {
    return Response.json({ error: "Le projet n'a pas encore de sujet à analyser." }, { status: 400 });
  }

  await trackProductEvent({ userId: user.id, projectId: id, eventType: "A1_STARTED" });
  await trackProductEvent({ userId: user.id, projectId: id, eventType: "A2_STARTED" });

  try {
    const result = await analyzeResearch(researchData, { userId: user.id, projectId: id });

    if (result.status === "failed") {
      return Response.json(
        { error: "ACADIA n'a pas pu approfondir cette analyse pour le moment. Réessayez dans un instant." },
        { status: 502 }
      );
    }

    await trackProductEvent({ userId: user.id, projectId: id, eventType: "A1_COMPLETED" });
    await trackProductEvent({ userId: user.id, projectId: id, eventType: "A2_COMPLETED" });
    await trackProductEvent({ userId: user.id, projectId: id, eventType: "VARIABLES_GENERATED" });

    // Orientations théoriques — nouvelle capacité, distincte d'A1/A2.
    let theoreticalOrientations: TheoreticalOrientation[] = [];
    try {
      const orientations = await proposeTheoreticalOrientations(
        {
          researchFocus: result.understanding.researchFocus,
          mainConcepts: result.understanding.mainConcepts,
          relationDescription: result.understanding.proposedRelationship?.description,
          domain: project.domain,
        },
        { userId: user.id, projectId: id }
      );
      theoreticalOrientations = orientations.map((o) => ({
        id: randomUUID(),
        theory: o.theory,
        reason: o.reason,
        confidence: o.confidence,
        status: "proposed" as const,
      }));
    } catch (error) {
      // Les orientations théoriques sont un complément, jamais bloquant
      // pour le reste de l'analyse en profondeur (variables/hypothèses
      // restent utilisables même si cet appel échoue).
      console.error("[ACADIA] Erreur orientations théoriques :", error);
    }

    // Research Intelligence V3 — phenomenonEvidence : jusqu'ici cette
    // recherche documentaire réelle (PhenomenonContextAI) n'était
    // déclenchée que côté preview sans compte. Un chercheur qui crée
    // son projet sans jamais passer par la preview n'obtenait donc
    // aucune source réelle. Complément best-effort, jamais bloquant,
    // jamais dupliqué (dédoublonné par sourceUrl avec l'existant).
    let sourcedContext: SourcedContextItem[] = project.sourcedContext ?? [];
    if (result.understanding.phenomenon) {
      try {
        const items = await searchPhenomenonContext(
          {
            phenomenon: result.understanding.phenomenon,
            domain: project.domain,
            location: result.understanding.location || project.location,
          },
          { userId: user.id, projectId: id }
        );
        if (items && items.length > 0) {
          const existingUrls = new Set(sourcedContext.map((item) => item.sourceUrl));
          const newItems: SourcedContextItem[] = items
            .filter((item) => item.sourceUrl && item.text && !existingUrls.has(item.sourceUrl))
            .map((item) => ({
              text: item.text,
              sourceUrl: item.sourceUrl,
              sourceTitle: item.sourceTitle,
              provenance: "PROVENANT_D_UNE_SOURCE" as const,
            }));
          if (newItems.length > 0) {
            sourcedContext = [...sourcedContext, ...newItems];
            await trackProductEvent({ userId: user.id, projectId: id, eventType: "PHENOMENON_EVIDENCE_FETCHED" });
          }
        }
      } catch (error) {
        // Best-effort : l'analyse en profondeur reste complète sans
        // contexte sourcé — jamais bloquant pour variables/hypothèses.
        console.error("[ACADIA] Erreur recherche de contexte du phénomène :", error);
      }
    }

    // Mission Server Contracts & Research Persistence — chaque analyse
    // en profondeur devient une VERSION ajoutée à analysisHistory,
    // jamais un écrasement silencieux (mission §4). project.understanding/
    // variables/relations restent aussi mis à jour à la racine pour la
    // rétrocompatibilité de tout code existant qui les lit directement.
    //
    // Re-lecture fraîche juste avant l'écriture : `project` a été lu au
    // tout début de la requête, avant les appels IA (20-40s) — une
    // seconde requête concurrente (même projet) aurait pu écrire entre
    // temps. Reconstruire le patch à partir d'un état fraîchement relu
    // réduit (sans l'éliminer complètement — payload JSON non
    // transactionnel, limite déjà partagée par tout ResearchStateService)
    // la fenêtre où une version concurrente pourrait être perdue.
    const freshRecord = await getResearchProjectRecord(id);
    if (!freshRecord) return notFound();
    const freshProject = freshRecord.project;

    const previousVersion = freshProject.analysisHistory?.[freshProject.analysisHistory.length - 1];
    const newVersion: ResearchAnalysisVersion = {
      id: randomUUID(),
      version: (previousVersion?.version ?? 0) + 1,
      parentVersion: previousVersion?.version,
      engineVersion: result.understanding.engineVersion,
      model: selectModel("DEEP_ANALYSIS", { researchModeTags: result.understanding.researchModeTags }).model,
      provenance: "AI_INFERENCE",
      validation: "generated",
      createdAt: new Date().toISOString(),
      understanding: result.project.understanding!,
      variables: result.variables,
      relations: result.relations,
      hypothesesAdded: result.hypotheses,
    };

    const updated = await updateResearchProjectRecord(user.id, id, {
      project: {
        ...freshProject,
        understanding: result.project.understanding,
        problem: result.project.problem,
        researchQuestions: result.project.researchQuestions.length > 0 ? result.project.researchQuestions : freshProject.researchQuestions,
        objectives: result.project.objectives.length > 0 ? result.project.objectives : freshProject.objectives,
        variables: result.variables,
        relations: result.relations,
        hypotheses: [...freshProject.hypotheses, ...result.hypotheses.filter((h) => !freshProject.hypotheses.some((existing) => existing.id === h.id))],
        theoreticalOrientations,
        sourcedContext,
        analysisHistory: [...(freshProject.analysisHistory ?? []), newVersion],
      },
    });

    if (!updated) return notFound();

    return Response.json(
      {
        project: updated.project,
        consistency: result.consistency,
        warnings: result.warnings,
        analysisResponse: buildResearchAnalysisResponse(updated.project),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ACADIA] Erreur analyse en profondeur :", error);
    return Response.json(
      { error: "ACADIA n'a pas pu approfondir cette analyse pour le moment. Réessayez dans un instant." },
      { status: 502 }
    );
  }
}
