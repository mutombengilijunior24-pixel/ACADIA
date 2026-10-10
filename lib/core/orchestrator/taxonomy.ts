/**
 * Référentiel des domaines et spécialités (perspective scientifique de l'étude).
 * Le domaine et la spécialité orientent l'interprétation ; ils ne choisissent pas, à eux seuls, la méthode.
 * Ajouter une spécialité = ajouter une entrée ici : aucune autre partie de l'architecture ne change.
 */
import { fold } from "@/lib/core/understanding/text";

export type DomainId = "management" | "economics" | "interdisciplinary";

export type SpecialtyId =
  | "hr"
  | "marketing"
  | "entrepreneurship"
  | "finance"
  | "management_other"
  | "monetary_banking"
  | "development"
  | "rural"
  | "economics_general"
  | "interdisciplinary_other"
  // Prévues : inscrites au référentiel, pas encore proposées comme parcours spécialisés.
  | "management_information_systems"
  | "customs";

export interface Domain {
  id: DomainId;
  label: string;
  description: string;
}

export interface Specialty {
  id: SpecialtyId;
  domain: DomainId;
  label: string;
  /** « available » : sélectionnable ; « planned » : inscrite au référentiel, non proposée. */
  status: "available" | "planned";
  /** Perspective d'interprétation des résultats. */
  perspective: string;
  /** Mots du sujet qui évoquent cette spécialité (déduction, jamais imposée). */
  keywords: string[];
}

export const DOMAINS: Domain[] = [
  { id: "management", label: "Gestion", description: "Ressources humaines, marketing, entrepreneuriat, finance d'entreprise…" },
  { id: "economics", label: "Économie", description: "Monnaie et banque, développement, économie rurale, économie générale…" },
  { id: "interdisciplinary", label: "Recherche interdisciplinaire / autre domaine", description: "Votre recherche croise plusieurs disciplines ou relève d'un autre domaine." },
];

export const SPECIALTIES: Specialty[] = [
  { id: "hr", domain: "management", label: "Ressources humaines", status: "available", perspective: "Lecture en gestion des ressources humaines : climat social, satisfaction, motivation et pratiques RH, sans attribuer de cause aux pratiques sans dispositif adapté.", keywords: ["personnel", "salarie", "employe", "agent", "satisfaction", "motivation", "rh", "ressources humaines", "remuneration", "formation", "recrutement", "absenteisme", "climat social"] },
  { id: "marketing", domain: "management", label: "Marketing et gestion commerciale", status: "available", perspective: "Lecture marketing : profils de clients, comportements d'achat, campagnes et conversions ; une association n'est pas l'effet d'une campagne.", keywords: ["client", "consommateur", "marketing", "campagne", "publicite", "fidelite", "vente", "marque", "conversion", "prix", "commercial"] },
  { id: "entrepreneurship", domain: "management", label: "Entrepreneuriat et PME", status: "available", perspective: "Lecture entrepreneuriale : création, croissance et contraintes des entreprises et des entrepreneurs.", keywords: ["entrepreneur", "entrepreneuriat", "pme", "creation", "startup", "petite entreprise", "commerce", "activite"] },
  { id: "finance", domain: "management", label: "Gestion financière", status: "available", perspective: "Lecture financière : structure, rentabilité, liquidité et solvabilité ; les postes comptables ne sont pas des observations indépendantes.", keywords: ["bilan", "compte de resultat", "rentabilite", "liquidite", "solvabilite", "financier", "tresorerie", "etats financiers", "ratio", "comptable"] },
  { id: "management_other", domain: "management", label: "Autre spécialité en gestion", status: "available", perspective: "Lecture en sciences de gestion.", keywords: ["gestion", "organisation", "management"] },
  { id: "monetary_banking", domain: "economics", label: "Économie monétaire et bancaire", status: "available", perspective: "Lecture monétaire et bancaire : inflation, taux de change, taux d'intérêt, crédit bancaire ; les séries temporelles exigent des méthodes propres.", keywords: ["inflation", "taux de change", "taux d'interet", "monnaie", "monetaire", "banque", "bancaire", "masse monetaire", "taux directeur", "devise"] },
  { id: "development", domain: "economics", label: "Économie du développement", status: "available", perspective: "Lecture en économie du développement : accès aux services (crédit, santé, éducation), pauvreté, inclusion ; attention à la sélection des répondants et à la causalité.", keywords: ["developpement", "pauvrete", "acces au credit", "credit", "microfinance", "inclusion", "menage", "revenu", "tontine", "informel"] },
  { id: "rural", domain: "economics", label: "Économie rurale", status: "available", perspective: "Lecture en économie rurale : exploitations, production agricole, revenus ruraux, filières.", keywords: ["rural", "agricole", "agriculteur", "exploitation", "recolte", "elevage", "filiere", "paysan"] },
  { id: "economics_general", domain: "economics", label: "Économie générale ou autre spécialité économique", status: "available", perspective: "Lecture économique générale.", keywords: ["economie", "economique", "croissance", "pib", "emploi", "chomage"] },
  { id: "interdisciplinary_other", domain: "interdisciplinary", label: "Recherche interdisciplinaire ou autre domaine", status: "available", perspective: "Lecture interdisciplinaire : précisez les disciplines mobilisées dans votre méthodologie.", keywords: [] },
  { id: "management_information_systems", domain: "management", label: "Informatique de gestion", status: "planned", perspective: "Lecture en systèmes d'information de gestion.", keywords: ["systeme d'information", "logiciel", "informatique", "erp"] },
  { id: "customs", domain: "economics", label: "Douane", status: "planned", perspective: "Lecture douanière : flux, recettes, contentieux.", keywords: ["douane", "douanier", "dedouanement", "tarif douanier"] },
];

export const domainOf = (id: DomainId | null | undefined) => DOMAINS.find((d) => d.id === id) ?? null;
export const specialtyOf = (id: SpecialtyId | null | undefined) => SPECIALTIES.find((s) => s.id === id) ?? null;

/** Spécialités proposées à l'utilisateur pour un domaine (les spécialités prévues restent masquées). */
export const specialtiesFor = (domain: DomainId) => SPECIALTIES.filter((s) => s.domain === domain && s.status === "available");

/** Spécialités évoquées par le sujet, de la plus à la moins citée (déduction, à confirmer). */
export function suggestSpecialties(text: string): Array<{ specialty: Specialty; hits: string[] }> {
  const t = ` ${fold(text).replace(/[^a-z0-9' ]+/g, " ")} `;
  return SPECIALTIES.filter((s) => s.status === "available")
    .map((specialty) => ({ specialty, hits: specialty.keywords.filter((k) => t.includes(` ${k}`)) }))
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length);
}
