import { NextResponse } from "next/server";

import {
  understandResearchSubject,
} from "@/lib/core/research/SubjectUnderstandingEngine";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { sanitizeMessage } from "@/lib/ai/openai/errorClassification";

export const runtime = "nodejs";

export async function POST(
  request: Request
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const research =
      await request.json();

    if (
      !research ||
      typeof research.title !== "string" ||
      !research.title.trim()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Le sujet de recherche est obligatoire.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await understandResearchSubject(
        research
      );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Erreur lors de l'analyse du sujet.";
    console.error(
      "ACADIA A1 ERROR:",
      sanitizeMessage(rawMessage)
    );

    return NextResponse.json(
      {
        success: false,
        error: "ACADIA n'a pas pu terminer l'analyse. Veuillez réessayer.",
      },
      {
        status: 502,
      }
    );
  }
}