import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      message: "Publication du questionnaire opérationnelle",
      questionnaireId: body?.questionnaireId ?? null,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Erreur lors de la publication du questionnaire.",
      },
      { status: 500 }
    );
  }
}