import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

// Système hérité (pré-P17, JSON plat) sans notion de propriétaire par
// questionnaire — impossible de vérifier "cette personne possède bien
// CE questionnaire" comme pour le module Survey. Exiger au minimum une
// session ACADIA valide réduit fortement l'exposition (fini le
// scraping anonyme par un bot Internet) sans prétendre à une
// autorisation par propriétaire que ce modèle de données ne permet pas.
const answersSchema = z.object({ answers: z.record(z.string(), z.unknown()) }).or(z.object({ responses: z.record(z.string(), z.unknown()) }));

/* =========================================================
   TYPES
========================================================= */

type StoredResponse = {
  id: string;
  questionnaireId: string;
  answers: Record<string, unknown>;
  submittedAt: string;
};

type ResponseDatabase = {
  questionnaires: Record<
    string,
    {
      questionnaireId: string;
      responses: StoredResponse[];
      totalResponses: number;
      updatedAt: string;
    }
  >;
};

/* =========================================================
   FICHIER DE STOCKAGE
========================================================= */

const DATABASE_FILE = path.join(
  process.cwd(),
  "questionnaire-responses.json"
);

/* =========================================================
   LECTURE DE LA BASE
========================================================= */

async function readDatabase(): Promise<ResponseDatabase> {
  try {
    const file = await fs.readFile(
      DATABASE_FILE,
      "utf-8"
    );

    return JSON.parse(file);
  } catch {
    return {
      questionnaires: {},
    };
  }
}

/* =========================================================
   ÉCRITURE DE LA BASE
========================================================= */

async function writeDatabase(
  database: ResponseDatabase
) {
  await fs.writeFile(
    DATABASE_FILE,
    JSON.stringify(database, null, 2),
    "utf-8"
  );
}

/* =========================================================
   GET
   Vérifie que l'API fonctionne et retourne les réponses
========================================================= */

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const { id } = await context.params;

    const database = await readDatabase();

    const questionnaire =
      database.questionnaires[id];

    return NextResponse.json({
      success: true,

      message:
        "API questionnaire opérationnelle",

      questionnaireId: id,

      totalResponses:
        questionnaire?.totalResponses ?? 0,

      responses:
        questionnaire?.responses ?? [],
    });
  } catch (error) {
    console.error(
      "GET questionnaire responses error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Erreur lors de la récupération des réponses.",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
   POST
   Enregistre une nouvelle réponse
========================================================= */

export async function POST(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  try {
    const { id } = await context.params;

    /* ---------------------------------------------
       RÉCUPÉRATION DU CORPS DE LA REQUÊTE
    --------------------------------------------- */

    const rawBody = await request.json().catch(() => null);
    const parsed = answersSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Les réponses envoyées sont invalides.",
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------
       LECTURE DE LA BASE
    --------------------------------------------- */

    const database = await readDatabase();

    /* ---------------------------------------------
       CRÉATION DU QUESTIONNAIRE S'IL N'EXISTE PAS
    --------------------------------------------- */

    if (!database.questionnaires[id]) {
      database.questionnaires[id] = {
        questionnaireId: id,
        responses: [],
        totalResponses: 0,
        updatedAt:
          new Date().toISOString(),
      };
    }

    const questionnaire =
      database.questionnaires[id];

    /* ---------------------------------------------
       NOUVELLE RÉPONSE
    --------------------------------------------- */

    const answers = "answers" in parsed.data ? parsed.data.answers : parsed.data.responses;

    const newResponse: StoredResponse = {
      id: `response-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`,

      questionnaireId: id,

      answers,

      submittedAt:
        new Date().toISOString(),
    };

    /* ---------------------------------------------
       ENREGISTREMENT
    --------------------------------------------- */

    questionnaire.responses.push(
      newResponse
    );

    questionnaire.totalResponses =
      questionnaire.responses.length;

    questionnaire.updatedAt =
      new Date().toISOString();

    /* ---------------------------------------------
       SAUVEGARDE
    --------------------------------------------- */

    await writeDatabase(database);

    /* ---------------------------------------------
       RÉPONSE API
    --------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        message:
          "Réponse enregistrée avec succès.",

        questionnaireId: id,

        responseId:
          newResponse.id,

        totalResponses:
          questionnaire.totalResponses,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST questionnaire response error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "Une erreur est survenue lors de l'enregistrement des réponses.",
      },
      {
        status: 500,
      }
    );
  }
}