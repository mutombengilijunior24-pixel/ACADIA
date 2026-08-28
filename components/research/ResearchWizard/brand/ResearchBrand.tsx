"use client";

import Image from "next/image";
import logoAcadia from "@/public/logos/Logo technologique Acadia (1).png";

type ResearchBrandVariant = "full" | "compact" | "symbol";

interface ResearchBrandProps {
  /**
   * full    — logotype complet (mark + wordmark + signature), pour les écrans premium (accueil).
   * compact — recadrage sur le symbole A / boussole, pour les en-têtes de navigation.
   * symbol  — recadrage serré, pour les espaces très contraints (mobile).
   */
  variant?: ResearchBrandVariant;
  className?: string;
}

const SYMBOL_BOX: Record<Exclude<ResearchBrandVariant, "full">, string> = {
  compact: "h-9 w-9 sm:h-10 sm:w-10",
  symbol: "h-7 w-7",
};

export default function ResearchBrand({
  variant = "full",
  className = "",
}: ResearchBrandProps) {
  if (variant === "full") {
    return (
      <Image
        src={logoAcadia}
        alt="ACADIA — L'assistant intelligent de la recherche académique"
        className={`h-auto w-24 sm:w-28 ${className}`}
        priority
      />
    );
  }

  return (
    <span
      role="img"
      aria-label="ACADIA"
      className={`relative inline-block shrink-0 overflow-hidden rounded-lg ${SYMBOL_BOX[variant]} ${className}`}
    >
      <Image
        src={logoAcadia}
        alt=""
        fill
        sizes="40px"
        className="origin-top scale-[1.6] object-cover object-top"
        priority
      />
    </span>
  );
}
