"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GraduationCap, Mail, Inbox, ArrowRight } from "lucide-react";
import { useSupervision } from "@/contexts/SupervisionContext";

const STATUS_LABEL: Record<string, string> = {
  submitted: "En attente d'examen par votre directeur",
  resubmitted: "Nouvelle version en attente d'examen",
  under_review: "En cours d'examen",
  feedback_ready: "Feedback disponible",
  revision_required: "Révision demandée — soumettez une nouvelle version",
  accepted: "Version validée par votre directeur",
};

interface SupervisorInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profile: { academicTitle?: string; institution?: string; isActive: boolean } | null;
}

export default function MyEncadrement() {
  const { getMySupervisor, listSubmissions, messages, refreshMessages } = useSupervision();
  const [supervisor, setSupervisor] = useState<SupervisorInfo | null | undefined>(undefined);
  const [submissions, setSubmissions] = useState<
    { id: string; researchId: string; researchTitle: string; version: number; status: string; submittedAt: string }[]
  >([]);

  const load = useCallback(async () => {
    const [sup, subs] = await Promise.all([getMySupervisor(), listSubmissions()]);
    setSupervisor(sup as SupervisorInfo | null);
    setSubmissions(subs);
    await refreshMessages();
  }, [getMySupervisor, listSubmissions, refreshMessages]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const latest = submissions[0];
  const unreadMessages = messages.filter((m) => !m.readAt);

  if (supervisor === undefined) return null;

  return (
    <section className="mt-14 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-7 w-7 text-acadia-blue" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Mon encadrement</p>
          <h2 className="mt-0.5 text-xl font-black text-acadia-navy">Directeur de recherche</h2>
        </div>
      </div>

      {!supervisor ? (
        <p className="mt-4 text-sm text-slate-500">
          Vous n&apos;avez pas encore de directeur associé. Demandez un lien d&apos;invitation à votre directeur pour
          l&apos;associer à votre compte.
        </p>
      ) : (
        <div className="mt-4 space-y-5">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-acadia-navy">
              {supervisor.firstName} {supervisor.lastName}
            </p>
            {supervisor.profile?.academicTitle && <p className="text-sm text-slate-500">{supervisor.profile.academicTitle}</p>}
            {supervisor.profile?.institution && <p className="text-sm text-slate-500">{supervisor.profile.institution}</p>}
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
              <Mail className="h-3 w-3" /> {supervisor.email}
            </p>
          </div>

          {latest ? (
            <div className="rounded-2xl border border-acadia-blue-100 bg-acadia-blue-50/40 p-4">
              <p className="text-2xs font-bold uppercase tracking-wider text-acadia-blue">Dernière soumission</p>
              <p className="mt-1 text-sm font-semibold text-acadia-navy">
                {latest.researchTitle} — V{latest.version}
              </p>
              <p className="mt-1 text-sm text-slate-600">{STATUS_LABEL[latest.status] ?? latest.status}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Aucune version soumise pour le moment — soumettez votre travail depuis la page de votre recherche.
            </p>
          )}

          {submissions.length > 0 && (
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Historique des soumissions</p>
              <ul className="mt-2 space-y-1.5">
                {submissions.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">V{s.version} — {s.researchTitle}</span>
                    <span className="text-2xs text-slate-400">{new Date(s.submittedAt).toLocaleDateString("fr-FR")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-slate-400">
              <Inbox className="h-3.5 w-3.5" /> Messages ({unreadMessages.length} non lu{unreadMessages.length > 1 ? "s" : ""})
            </p>
            {messages.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400 italic">Aucun message pour le moment.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {messages.slice(0, 3).map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className={m.readAt ? "text-slate-500" : "font-semibold text-acadia-navy"}>{m.subject}</span>
                    <span className="text-2xs text-slate-400">{new Date(m.createdAt).toLocaleDateString("fr-FR")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {latest && (
            <Link
              href={`/dashboard/research/${latest.researchId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-acadia-blue hover:underline"
            >
              Voir ma recherche <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
