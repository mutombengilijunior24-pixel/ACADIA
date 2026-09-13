"use client";

// ============================================================
// ACADIA — RÉVÉLATION AU DÉFILEMENT (10/09/2026)
//
// Le "petit mouvement en avant" demandé (référence acquisition.com) :
// une section apparaît légèrement translatée + en fondu quand elle
// entre dans le viewport. IntersectionObserver + transitions CSS —
// aucune dépendance d'animation ajoutée (même discipline que
// HeroFlowPreview.tsx). Respecte prefers-reduced-motion.
// ============================================================

import { useEffect, useRef, useState, type ReactNode } from "react";

export default function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"} ${className}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
