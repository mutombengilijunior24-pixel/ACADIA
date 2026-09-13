import type { ReactNode } from "react";

/* ============================================================
   ACADIA — PAGE CONTAINER (Bloc I, refonte visuelle 11/09/2026)

   Reprend tel quel le shell déjà éprouvé par le module Survey
   (app/dashboard/survey/page.tsx : `p-4 sm:p-6 lg:p-8` +
   `mx-auto max-w-6xl`) plutôt que d'en inventer un nouveau.
   MainLayout fournit déjà le <main> englobant (components/layout/
   MainLayout.tsx) — ce composant reste donc un simple <div>, pour
   ne jamais produire un second <main> imbriqué (bug présent
   auparavant sur certaines pages).
============================================================ */

interface PageContainerProps {
  children: ReactNode;
  /** Élargit ou restreint le conteneur pour un cas particulier. */
  maxWidthClassName?: string;
  className?: string;
}

export default function PageContainer({
  children,
  maxWidthClassName = "max-w-6xl",
  className = "",
}: PageContainerProps) {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className={`mx-auto ${maxWidthClassName} ${className}`}>{children}</div>
    </div>
  );
}
