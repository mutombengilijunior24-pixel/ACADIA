"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, UserPlus, ClipboardList, Copy, Check, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupervision } from "@/contexts/SupervisionContext";
import GuidanceVideo from "@/components/shared/GuidanceVideo";

interface StudentRow {
  assignmentId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  latestSubmission: {
    id: string;
    researchId: string;
    researchTitle: string;
    version: number;
    status: string;
    submittedAt: string;
  } | null;
  submissionCount: number;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Nouvelle soumission",
  resubmitted: "Nouvelle version",
  under_review: "En cours d'examen",
  feedback_ready: "Feedback envoyé",
  revision_required: "Révision demandée",
  accepted: "Validée",
};

export default function SupervisorDashboardPage() {
  const { user } = useAuth();
  const { listMyStudents, createInvitation } = useSupervision();
  const router = useRouter();

  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "to_review" | "waiting" | "validated">("all");

  const load = useCallback(async () => {
    const data = await listMyStudents();
    setStudents(data);
  }, [listMyStudents]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleInvite() {
    setCreatingInvite(true);
    const invitation = await createInvitation();
    setInviteLink(`${window.location.origin}/invite/${invitation.code}`);
    setCreatingInvite(false);
  }

  function handleCopyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const toReviewCount = students?.filter((s) => s.latestSubmission && ["submitted", "resubmitted"].includes(s.latestSubmission.status)).length ?? 0;
  const waitingCount = students?.filter((s) => s.latestSubmission?.status === "revision_required").length ?? 0;
  const readyCount = students?.filter((s) => s.latestSubmission?.status === "feedback_ready").length ?? 0;
  const validatedCount = students?.filter((s) => s.latestSubmission?.status === "accepted").length ?? 0;

  const filtered = (students ?? []).filter((s) => {
    const matchesSearch =
      !search ||
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.latestSubmission?.researchTitle ?? "").toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "all") return true;
    if (filter === "to_review") return s.latestSubmission && ["submitted", "resubmitted"].includes(s.latestSubmission.status);
    if (filter === "waiting") return s.latestSubmission?.status === "revision_required";
    if (filter === "validated") return s.latestSubmission?.status === "accepted";
    return true;
  });

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-acadia-blue">Espace directeur</p>
          <GuidanceVideo title="Comment fonctionne l'encadrement ACADIA ?" duration="30-60s" />
        </div>
        <h1 className="mt-1 text-3xl font-black text-acadia-navy">
          Bonjour Professeur {user?.firstName ?? ""} 👋
        </h1>
        <p className="mt-2 text-slate-500">
          ACADIA vous aide à comprendre rapidement l&apos;état des travaux de vos étudiants — la décision
          scientifique reste toujours la vôtre.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="À examiner" value={toReviewCount} color="bg-blue-50 text-blue-700" />
        <StatCard label="Révision en attente" value={waitingCount} color="bg-amber-50 text-amber-700" />
        <StatCard label="Feedback envoyé" value={readyCount} color="bg-violet-50 text-violet-700" />
        <StatCard label="Validés" value={validatedCount} color="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-acadia-navy">Vos étudiants</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInvite}
              disabled={creatingInvite}
              className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              <UserPlus className="h-4 w-4" /> Inviter un étudiant
            </button>
            <Link
              href="/dashboard/supervisor/canevas"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ClipboardList className="h-4 w-4" /> Canevas académique
            </Link>
          </div>
        </div>

        {inviteLink && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-acadia-blue-50 p-4">
            <input readOnly value={inviteLink} className="flex-1 truncate bg-transparent text-sm text-acadia-navy outline-none" />
            <button type="button" onClick={handleCopyLink} className="shrink-0 rounded-lg bg-white p-2 text-acadia-blue shadow-sm">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        )}

        {students === null ? null : students.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-lg font-bold text-acadia-navy">Votre espace de supervision est prêt.</h3>
            <p className="mt-2 text-sm text-slate-500">Ajoutez votre premier étudiant pour commencer.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un étudiant ou un travail..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              {(["all", "to_review", "waiting", "validated"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    filter === f ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {f === "all" ? "Tous" : f === "to_review" ? "À corriger" : f === "waiting" ? "En attente" : "Validés"}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                    <th className="pb-3">Étudiant</th>
                    <th className="pb-3">Travail</th>
                    <th className="pb-3">Version</th>
                    <th className="pb-3">Dernière activité</th>
                    <th className="pb-3">État</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.assignmentId}>
                      <td className="py-3 font-semibold text-acadia-navy">
                        {s.firstName} {s.lastName}
                      </td>
                      <td className="py-3 text-slate-600">{s.latestSubmission?.researchTitle ?? "—"}</td>
                      <td className="py-3 text-slate-600">{s.latestSubmission ? `V${s.latestSubmission.version}` : "—"}</td>
                      <td className="py-3 text-slate-500">
                        {s.latestSubmission ? new Date(s.latestSubmission.submittedAt).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="py-3">
                        {s.latestSubmission ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-2xs font-semibold text-slate-600">
                            {STATUS_LABEL[s.latestSubmission.status] ?? s.latestSubmission.status}
                          </span>
                        ) : (
                          <span className="text-2xs text-slate-400">Aucune soumission</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        {s.latestSubmission && (
                          <button
                            type="button"
                            onClick={() => router.push(`/dashboard/supervisor/review/${s.latestSubmission!.id}`)}
                            className="rounded-lg bg-acadia-blue-50 px-3 py-1.5 text-xs font-semibold text-acadia-blue hover:bg-acadia-blue-100"
                          >
                            Examiner
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-2 inline-flex rounded-xl px-3 py-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}
