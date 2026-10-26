"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { useAuth } from "@/contexts/AuthContext";
import type { StageType } from "@/lib/core/stages/catalog";

/** Lien d'inscription à un stage : directement le formulaire si l'étudiant est connecté, sinon création du compte puis formulaire. */
export function StageStartLink({ type, className, style, children }: { type: StageType; className?: string; style?: CSSProperties; children: ReactNode }) {
  const { user } = useAuth();
  const target = `/dashboard/stages?type=${type}`;
  return (
    <Link href={user ? target : `/register?next=${encodeURIComponent(target)}`} className={className} style={style}>
      {children}
    </Link>
  );
}
