// ============================================================
// ACADIA — INSCRIPTION (P13, rôle dès l'inscription en P17)
// ============================================================

import { cookies } from "next/headers";
import { createUser, findUserByEmail } from "@/lib/auth/UserStore";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/passwords";
import { createSessionToken, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { toPublicUser, type UserRole } from "@/lib/auth/AuthTypes";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { logAudit } from "@/lib/server/audit/AuditLog";

export const runtime = "nodejs";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface RegisterBody {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  domain?: string;
  role?: UserRole;
  profile?: {
    studyLevel?: string;
    program?: string;
    institution?: string;
    faculty?: string;
    department?: string;
    academicTitle?: string;
    domain?: string;
    specialties?: string;
    academicYear?: string;
  };
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limit = rateLimiter.check(rateLimitKey("register", ip), 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives d'inscription. Réessayez plus tard." }, { status: 429 });
  }

  let body: RegisterBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  const firstName = (body.firstName ?? "").trim();
  const role: UserRole = body.role === "supervisor" ? "supervisor" : "student";

  if (!isValidEmail(email)) {
    return Response.json({ error: "Adresse email invalide." }, { status: 400 });
  }
  if (!firstName) {
    return Response.json({ error: "Le prénom est requis." }, { status: 400 });
  }
  if (!isPasswordStrongEnough(password)) {
    return Response.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  }
  if (await findUserByEmail(email)) {
    return Response.json({ error: "Un compte existe déjà avec cette adresse email." }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const profile = body.profile ?? {};

  let user;
  try {
    user = await createUser({
      email,
      passwordHash,
      firstName,
      lastName: body.lastName,
      domain: body.domain,
      role,
      studentProfile:
        role === "student"
          ? { studyLevel: profile.studyLevel, institution: profile.institution, faculty: profile.faculty, department: profile.department }
          : undefined,
      supervisorProfile:
        role === "supervisor"
          ? {
              academicTitle: profile.academicTitle,
              institution: profile.institution,
              faculty: profile.faculty,
              department: profile.department,
              domain: profile.domain,
              specialties: profile.specialties,
              activeAcademicYear: profile.academicYear,
              professionalEmail: email,
            }
          : undefined,
    });
  } catch (error) {
    // La vérification ci-dessus (findUserByEmail) n'est pas atomique avec
    // cette création : deux inscriptions simultanées avec le même email
    // (double clic, deux onglets) peuvent toutes deux la franchir avant
    // qu'aucune n'ait encore été committée. La contrainte unique
    // PostgreSQL (User.email) reste la vraie garantie — on la traduit ici
    // en réponse propre plutôt que de laisser un 500 non géré remonter.
    const isUniqueEmailConflict =
      typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
    if (isUniqueEmailConflict) {
      return Response.json({ error: "Un compte existe déjà avec cette adresse email." }, { status: 409 });
    }
    throw error;
  }

  await logAudit({ actorId: user.id, action: "USER_CREATED", entityType: "User", entityId: user.id, metadata: { role } });

  const token = createSessionToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  return Response.json({ user: toPublicUser(user) }, { status: 201 });
}
