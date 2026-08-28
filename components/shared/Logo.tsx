"use client";

// ============================================================
// ACADIA — LOGO PARTAGÉ (P13)
//
// Composant canonique du logo ACADIA, utilisé partout hors du
// Wizard (qui garde son propre ResearchBrand, déjà en place et
// fonctionnel — non modifié ici). Avant P13, plusieurs écrans
// (Navbar landing, Sidebar dashboard, Footer) pointaient vers un
// chemin d'image inexistant ou retombaient sur une icône générique
// GraduationCap — ce composant élimine ces incohérences.
// ============================================================

import Image from "next/image";
import logoAcadia from "@/public/logos/Logo technologique Acadia (1).png";

type LogoVariant = "full" | "mark";

interface LogoProps {
  /** full — logotype complet (mark + wordmark). mark — symbole seul, pour les espaces contraints. */
  variant?: LogoVariant;
  className?: string;
}

export default function Logo({ variant = "full", className = "" }: LogoProps) {
  if (variant === "mark") {
    return (
      <span role="img" aria-label="ACADIA" className={`relative inline-block shrink-0 overflow-hidden rounded-lg ${className || "h-9 w-9"}`}>
        <Image src={logoAcadia} alt="" fill sizes="40px" className="origin-top scale-[1.6] object-cover object-top" priority />
      </span>
    );
  }

  return <Image src={logoAcadia} alt="ACADIA — Academic Intelligence for Economics & Management" className={`h-auto w-28 ${className}`} priority />;
}
