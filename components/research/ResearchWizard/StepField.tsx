"use client";

import { BarChart3, Briefcase } from "lucide-react";

import { useResearch } from "@/contexts/ResearchContext";
import { specialtiesFor, type DomainId } from "@/lib/core/orchestrator/taxonomy";
import { chosenSpecialty, WIZARD_DOMAINS } from "@/lib/core/research/workflow";
import ResearchOptionCard from "./brand/ResearchOptionCard";
import ResearchStepHeader from "./brand/ResearchStepHeader";

const DOMAIN_ICON: Record<string, typeof Briefcase> = { management: Briefcase, economics: BarChart3 };

/**
 * Domaine et spécialité : le même référentiel que le moteur d'interprétation
 * (lib/core/orchestrator/taxonomy.ts), limité aux sciences économiques et de gestion.
 */
export default function StepField() {
  const { currentResearch, updateCurrentResearch } = useResearch();
  const current = chosenSpecialty(currentResearch);
  const domainId = (WIZARD_DOMAINS.find((d) => d.label === currentResearch.domain)?.id ?? current?.domain ?? null) as DomainId | null;

  function chooseDomain(id: DomainId, label: string) {
    updateCurrentResearch("domain", label);
    if (current && current.domain !== id) updateCurrentResearch("specialty", "");
  }

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={1}
        category="Cadrage"
        title="Votre domaine et votre spécialité"
        description="ACADIA est conçu pour les sciences économiques et de gestion. Votre spécialité oriente la récolte et l'interprétation de vos données."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {WIZARD_DOMAINS.map((d) => (
          <ResearchOptionCard
            key={d.id}
            icon={DOMAIN_ICON[d.id]}
            title={d.label}
            description={d.description}
            selected={domainId === d.id}
            onClick={() => chooseDomain(d.id, d.label)}
          />
        ))}
      </div>

      {domainId && (
        <div>
          <p className="mb-3 text-sm font-semibold text-acadia-navy">Votre spécialité</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {specialtiesFor(domainId).map((s) => (
              <ResearchOptionCard
                key={s.id}
                title={s.label}
                selected={currentResearch.specialty === s.id}
                onClick={() => updateCurrentResearch("specialty", s.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
