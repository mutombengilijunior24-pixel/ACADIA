import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  return NextResponse.json({
    success: true,
    questionnaireId: id,
    message: "API questionnaire opérationnelle",
  });
}