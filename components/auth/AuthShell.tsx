"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "@/components/shared/Logo";

/**
 * P13 — coquille visuelle partagée par /login, /register,
 * /forgot-password et /reset-password : cohérence avec la landing
 * et le Wizard (mêmes tokens acadia-blue/navy, même carte
 * rounded-3xl), pour que l'utilisateur ait l'impression d'utiliser
 * UNE SEULE application.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">
      <div
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #2554EB 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #0B1B3A 0%, transparent 70%)" }}
      />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/">
            <Logo className="w-20" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-acadia-navy">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>

        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </main>
  );
}
