import { NextResponse } from "next/server";
import { z } from "zod";
import { openai } from "@/lib/openai";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

const bodySchema = z.object({ prompt: z.string().min(1).max(4000) });

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("ai-generate", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Trop de requêtes IA récentes. Réessayez plus tard." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const { prompt } = parsed.data;

  try {
    const response = await openai.responses.create({
      model: "gpt-5",
      input: prompt,
    });

    return NextResponse.json({
      text: response.output_text,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Erreur IA",
      },
      {
        status: 500,
      }
    );
  }
}