import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  context: RouteContext
) {
  const { id } = await context.params;

  return NextResponse.json({
    success: true,
    questionnaireId: id,
    message: "API questionnaire opérationnelle",
  });
}