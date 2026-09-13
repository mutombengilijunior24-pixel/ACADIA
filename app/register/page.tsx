"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GraduationCap, Presentation, UserPlus, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/contexts/AuthContext";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import { PENDING_PREVIEW_KEY } from "@/lib/client/previewStorage";

// ============================================================
// P17 — Le rôle se choisit désormais AU MOMENT de l'inscription
// (Partie 10 du sprint), plutôt que via une action a posteriori
// dans les paramètres (P16). L'ancien mécanisme "Devenir directeur"
// (/dashboard/settings) reste disponible pour les comptes déjà
// créés en étudiant qui changent d'avis plus tard — ce n'est plus
// le chemin principal.
// ============================================================

type Step = "choice" | "student" | "supervisor" | "institutional";

const STUDY_LEVELS = ["Licence", "Master", "Autre"];

// ACADIA cible actuellement exclusivement la Faculté des Sciences
// Économiques et de Gestion — ce n'est donc plus demandé à
// l'inscription (retiré du parcours utilisateur), mais la valeur
// reste renseignée automatiquement pour ne rien casser côté export/
// canevas qui utilisent encore ce champ (StudentProfile.faculty /
// SupervisorProfile.faculty, colonnes Prisma non supprimées).
const DEFAULT_FACULTY = "Sciences Économiques et de Gestion";

// Liste validée des institutions partenaires ACADIA. Le nom complet
// n'est affiché ("ACRONYME — NOM COMPLET") que lorsqu'il est déjà
// documenté ailleurs dans ACADIA (components/research/ResearchWizard/
// StepUniversity.tsx pour UNILU/UNIKIN/UPC) — jamais inventé pour les
// autres institutions, conformément à la consigne.
const INSTITUTIONS: { acronym: string; fullName?: string }[] = [
  { acronym: "UNILU", fullName: "Université de Lubumbashi" },
  { acronym: "UNH", fullName: "Université Nouveaux Horizons" },
  { acronym: "ECOPO", fullName: "École Supérieure de la Gouvernance Économique et Politique de Lubumbashi" },
  { acronym: "UNIKIN", fullName: "Université de Kinshasa" },
  { acronym: "UNIKIS" },
  { acronym: "UPN" },
  { acronym: "UNIGOM" },
  { acronym: "UOM" },
  { acronym: "UNIKOL" },
  { acronym: "UNIKAM" },
  { acronym: "UPC", fullName: "Université Protestante au Congo" },
  { acronym: "UPL" },
];

function institutionLabel(i: { acronym: string; fullName?: string }): string {
  return i.fullName ? `${i.acronym} — ${i.fullName}` : i.acronym;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  // "next" — retour vers le contexte d'entrée (ex. arrivée depuis
  // /survey) : jamais une URL arbitraire, uniquement un chemin interne
  // commençant par /dashboard, jamais une redirection externe.
  const next = searchParams.get("next");
  const safeNext = next && next.startsWith("/dashboard") ? next : null;
  const isSurveyIntent = safeNext?.startsWith("/dashboard/survey") ?? false;

  // Arrivée depuis Survey (/survey -> "Créer une enquête") : parcours
  // d'inscription institutionnel direct, jamais l'écran de choix
  // Étudiant/Chercheur — décidé de façon synchrone depuis l'URL, avant
  // le premier rendu, pour qu'aucun flash de l'écran de choix n'apparaisse.
  const [step, setStep] = useState<Step>(isSurveyIntent ? "institutional" : "choice");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Champs communs
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [institution, setInstitution] = useState("");
  const [institutionOther, setInstitutionOther] = useState("");
  const [department, setDepartment] = useState("");

  // Inscription institutionnelle (Survey)
  const [institutionName, setInstitutionName] = useState("");

  // Étudiant
  const [studyLevel, setStudyLevel] = useState("Master");

  // Directeur
  const [academicTitle, setAcademicTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");

  function redirectAfterAuth(fallback: string) {
    if (safeNext) {
      router.push(safeNext.includes("onboarding=") ? safeNext : `${safeNext}${safeNext.includes("?") ? "&" : "?"}onboarding=1`);
    } else {
      router.push(fallback);
    }
  }

  async function handleSubmit(e: React.FormEvent, role: "student" | "supervisor") {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);

    const resolvedInstitution = institution === "Autre" ? institutionOther.trim() : institution;
    const profile =
      role === "student"
        ? { institution: resolvedInstitution, faculty: DEFAULT_FACULTY, department, studyLevel }
        : { institution: resolvedInstitution, faculty: DEFAULT_FACULTY, department, academicTitle, domain, specialties, academicYear };

    try {
      const result = await register({ email, password, firstName, lastName: lastName || undefined, role, profile });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const hasPendingPreview = role === "student" && (() => {
        try {
          return Boolean(sessionStorage.getItem(PENDING_PREVIEW_KEY));
        } catch {
          return false;
        }
      })();

      redirectAfterAuth(
        hasPendingPreview
          ? "/dashboard/preview-resume"
          : role === "supervisor"
            ? "/dashboard/supervisor?onboarding=1"
            : "/dashboard?onboarding=1"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Inscription institutionnelle (arrivée depuis Survey) — réutilise le
  // même système d'authentification (POST /api/auth/register, même
  // table User, même session) : un compte ACADIA normal, avec un profil
  // "student" portant le nom de l'institution renseigné. Jamais un
  // deuxième système de comptes, jamais d'ownerId envoyé par le client
  // (toujours déterminé côté serveur à partir de la session).
  async function handleInstitutionalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await register({
        email,
        password,
        firstName,
        lastName: lastName || undefined,
        role: "student",
        profile: { institution: institutionName.trim() },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      redirectAfterAuth("/dashboard/survey?onboarding=1");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "institutional") {
    return (
      <AuthShell
        title="Bienvenue sur ACADIA Survey"
        subtitle="Votre espace pour créer, diffuser et piloter vos enquêtes."
        footer={
          <>
            Déjà un compte ?{" "}
            <Link href="/login?next=/dashboard/survey" className="font-semibold text-acadia-blue hover:underline">
              Se connecter
            </Link>
          </>
        }
      >
        <form onSubmit={handleInstitutionalSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-600">
            Nom de l&apos;institution / organisation
            <input
              required
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
              placeholder="Université de Lubumbashi"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold text-slate-600">
              Prénom du responsable
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Jean" />
            </label>
            <label className="block text-sm font-semibold text-slate-600">
              Nom du responsable
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="Test" />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-600">
            Adresse e-mail
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none" placeholder="vous@institution.cd" />
          </label>

          <label className="block text-sm font-semibold text-slate-600">
            Mot de passe
            <div className="relative mt-1.5">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-11 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
                placeholder="8 caractères minimum"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-acadia-blue"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </label>

          <label className="block text-sm font-semibold text-slate-600">
            Confirmation du mot de passe
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
              placeholder="Ressaisissez votre mot de passe"
            />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

          <ResearchPrimaryButton type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {submitting ? "Création de votre espace..." : "Créer mon espace"}
          </ResearchPrimaryButton>

          <p className="text-center text-2xs text-slate-400">
            En créant un compte, vous acceptez qu&apos;ACADIA vous accompagne — jamais qu&apos;il décide à votre place.
          </p>
        </form>
      </AuthShell>
    );
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
          <div className="relative mt-1.5">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-11 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
              placeholder="8 caractères minimum"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-acadia-blue"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </label>

        <label className="block text-sm font-semibold text-slate-600">
          Confirmation du mot de passe
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
            placeholder="Ressaisissez votre mot de passe"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-600">
          Institution
          <select
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            required
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
          >
            <option value="" disabled>
              Sélectionnez votre institution
            </option>
            {INSTITUTIONS.map((i) => (
              <option key={i.acronym} value={i.acronym}>{institutionLabel(i)}</option>
            ))}
            <option value="Autre">Autre</option>
          </select>
        </label>

        {institution === "Autre" && (
          <label className="block text-sm font-semibold text-slate-600">
            Nom de votre institution
            <input
              value={institutionOther}
              onChange={(e) => setInstitutionOther(e.target.value)}
              required
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
              placeholder="Nom complet de l'institution"
            />
          </label>
        )}

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

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
