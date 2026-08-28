"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Presentation, UserPlus, ArrowLeft } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/contexts/AuthContext";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

// ============================================================
// P17 — Le rôle se choisit désormais AU MOMENT de l'inscription
// (Partie 10 du sprint), plutôt que via une action a posteriori
// dans les paramètres (P16). L'ancien mécanisme "Devenir directeur"
// (/dashboard/settings) reste disponible pour les comptes déjà
// créés en étudiant qui changent d'avis plus tard — ce n'est plus
// le chemin principal.
// ============================================================

type Step = "choice" | "student" | "supervisor";

const STUDY_LEVELS = ["Licence", "Master", "Autre"];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [step, setStep] = useState<Step>("choice");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Champs communs
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [institution, setInstitution] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");

  // Étudiant
  const [studyLevel, setStudyLevel] = useState("Master");

  // Directeur
  const [academicTitle, setAcademicTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");

  async function handleSubmit(e: React.FormEvent, role: "student" | "supervisor") {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const profile =
      role === "student"
        ? { institution, faculty, department, studyLevel }
        : { institution, faculty, department, academicTitle, domain, specialties, academicYear };

    const result = await register({ email, password, firstName, lastName: lastName || undefined, role, profile });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(role === "supervisor" ? "/dashboard/supervisor?onboarding=1" : "/dashboard?onboarding=1");
  }

  if (step === "choice") {
    return (
      <AuthShell
        title="Créer votre compte ACADIA."
        subtitle="Comment allez-vous utiliser ACADIA ?"
        footer={
          <>
            Déjà un compte ?{" "}
            <Link href="/login" className="font-semibold text-acadia-blue hover:underline">
              Se connecter
            </Link>
          </>
        }
      >
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setStep("student")}
            className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-5 text-left transition hover:border-acadia-blue hover:bg-acadia-blue-50/40"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-acadia-blue-50 text-2xl">
              <GraduationCap className="h-6 w-6 text-acadia-blue" />
            </div>
            <div>
              <p className="font-bold text-acadia-navy">Étudiant / Chercheur</p>
              <p className="text-sm text-slate-500">Je construis mon mémoire ou mon travail de recherche.</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setStep("supervisor")}
            className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-5 text-left transition hover:border-acadia-blue hover:bg-acadia-blue-50/40"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-acadia-blue-50 text-2xl">
              <Presentation className="h-6 w-6 text-acadia-blue" />
            </div>
            <div>
              <p className="font-bold text-acadia-navy">Directeur / Professeur</p>
              <p className="text-sm text-slate-500">J&apos;encadre des étudiants dans leurs travaux de recherche.</p>
            </div>
          </button>
        </div>
      </AuthShell>
    );
  }

  const isStudent = step === "student";

  return (
    <AuthShell
      title={isStudent ? "Compte étudiant / chercheur" : "Compte directeur / professeur"}
      subtitle="Academic Intelligence pour Sciences Économiques et de Gestion."
      footer={
        <>
          Déjà un compte ?{" "}
          <Link href="/login" className="font-semibold text-acadia-blue hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={() => setStep("choice")}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-acadia-blue"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Changer de choix
      </button>

      <form onSubmit={(e) => handleSubmit(e, isStudent ? "student" : "supervisor")} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-600">
            Prénom
            <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Junior" />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Nom {isStudent && <span className="font-normal text-slate-400">(optionnel)</span>}
            <input required={!isStudent} value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Ngili" />
          </label>
        </div>

        <label className="block text-sm font-semibold text-slate-600">
          {isStudent ? "Adresse email" : "Email professionnel"}
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="vous@universite.cd" />
        </label>

        <label className="block text-sm font-semibold text-slate-600">
          Mot de passe
          <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="8 caractères minimum" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-slate-600">
            Institution
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Université de Lubumbashi" />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Faculté
            <input value={faculty} onChange={(e) => setFaculty(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Sciences Économiques et de Gestion" />
          </label>
        </div>

        <label className="block text-sm font-semibold text-slate-600">
          Département
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Économie" />
        </label>

        {isStudent ? (
          <label className="block text-sm font-semibold text-slate-600">
            Niveau d&apos;étude
            <select value={studyLevel} onChange={(e) => setStudyLevel(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none">
              {STUDY_LEVELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-slate-600">
                Titre académique
                <input value={academicTitle} onChange={(e) => setAcademicTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Professeur, Chef de travaux..." />
              </label>
              <label className="block text-sm font-semibold text-slate-600">
                Année académique
                <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="2026-2027" />
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-600">
              Domaine
              <input value={domain} onChange={(e) => setDomain(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Économie, Gestion, Finance..." />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              Spécialités <span className="font-normal text-slate-400">(optionnel, séparées par des virgules)</span>
              <input value={specialties} onChange={(e) => setSpecialties(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Économétrie, Finance d'entreprise" />
            </label>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-2xs text-amber-700">
              Votre profil académique sera marqué « en attente de vérification » — ACADIA ne vérifie pas
              encore automatiquement l&apos;identité institutionnelle des directeurs.
            </p>
          </>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        <ResearchPrimaryButton type="submit" size="lg" disabled={submitting} className="w-full">
          <UserPlus className="h-4 w-4" /> {submitting ? "Création..." : "Créer mon compte"}
        </ResearchPrimaryButton>

        <p className="text-center text-2xs text-slate-400">
          En créant un compte, vous acceptez qu&apos;ACADIA vous accompagne — jamais qu&apos;il décide à votre place.
        </p>
      </form>
    </AuthShell>
  );
}
