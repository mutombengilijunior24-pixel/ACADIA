import { NextResponse } from "next/server";

import {
  understandResearchSubject,
} from "@/lib/core/research/SubjectUnderstandingEngine";

export async function POST(
  request: Request
) {
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
    console.error(
      "ACADIA A1 ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de l'analyse du sujet.",
      },
      {
        status: 500,
      }
    );
  }
}