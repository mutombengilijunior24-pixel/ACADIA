// ============================================================
// ACADIA — PROTECTION DES ROUTES (P13)
//
// Dans cette version de Next.js, le fichier historiquement nommé
// `middleware.ts` est renommé `proxy.ts` (fonction exportée `proxy`) —
// voir node_modules/next/dist/docs/.../file-conventions/proxy.md.
// Proxy s'exécute par défaut sur le runtime Node.js dans cette
// version, ce qui permet d'utiliser `node:crypto` directement dans
// verifySessionToken sans restriction Edge.
//
// Protège /dashboard/** : redirige vers /login si aucune session
// valide n'est présente. Les routes API d'authentification et les
// assets restent accessibles sans session.
// ============================================================

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/UserStore";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = pathname.startsWith("/dashboard");
  if (!isProtected) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // P16 — /dashboard/supervisor est réservé aux comptes ayant
  // réellement le rôle "supervisor" (auto-déclaré, voir
  // ACADIA_P16_ARCHITECTURE.md §5). Un étudiant y accédant est
  // renvoyé vers son propre tableau de bord, jamais bloqué en erreur.
  if (pathname.startsWith("/dashboard/supervisor")) {
    const user = await findUserById(session.userId);
    if (!user || user.role !== "supervisor") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
