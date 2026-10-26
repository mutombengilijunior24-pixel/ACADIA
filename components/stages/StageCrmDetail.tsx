"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Ban, CheckCircle2, Circle, Copy, Link2, Loader2, RotateCcw, Save, Wallet, X } from "lucide-react";

import { isPaid, PAYMENT_METHODS, PAYMENT_STATE_LABELS, REQUIRED_DOCUMENTS, STAGE_PACK, STAGE_STATUS_LABELS, STAGE_TYPE_LABELS } from "@/lib/core/stages/catalog";
import { duration, facultyOf, fullName, summaryLine, timeOf } from "@/lib/core/stages/report";
import { defaultEndDate, formatDayTitle, nextStep, summarizeAttendance } from "@/lib/core/stages/workflow";

import type { DossierJson } from "./types";

export interface AccessJson {
  id: string;
  kind: "tuteur" | "faculte";
  label: string;
  university: string | null;
  facultyName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface AdminDetailJson extends DossierJson {
  accountEmail: string | null;
  accesses: AccessJson[];
}

const input = "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100";
const facts = (d: DossierJson) => ({ type: d.type, status: d.status, paymentStatus: d.paymentStatus, documentsReceived: d.documentsReceived, assignedCompany: d.assignedCompany, tutorName: d.tutorName, startDate: d.startDate, endDate: d.endDate });

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/** Fiche candidat (tiroir) : l'équipe saisit des FAITS ; l'étape du dossier en découle, calculée par le serveur. */
export function StageCrmDetail({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: (d: AdminDetailJson) => void }) {
  const [d, setD] = useState<AdminDetailJson | null>(null);
  const [form, setForm] = useState({ assignedCompany: "", companyAddress: "", tutorName: "", tutorRole: "", tutorPhone: "", tutorEmail: "", startDate: "", endDate: "", adminNotes: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const accept = useCallback(
    (data: AdminDetailJson) => {
      setD(data);
      setForm({ assignedCompany: data.assignedCompany ?? "", companyAddress: data.companyAddress ?? "", tutorName: data.tutorName ?? "", tutorRole: data.tutorRole ?? "", tutorPhone: data.tutorPhone ?? "", tutorEmail: data.tutorEmail ?? "", startDate: data.startDate ?? "", endDate: data.endDate ?? "", adminNotes: data.adminNotes ?? "" });
      onSaved(data);
    },
    [onSaved],
  );

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/stages/${id}`, { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { application?: AdminDetailJson; error?: string };
        if (cancelled) return;
        if (data.application) accept(data.application);
        else setMessage(data.error ?? "Dossier introuvable.");
      })
      .catch(() => !cancelled && setMessage("Connexion impossible."));
    return () => {
      cancelled = true;
    };
  }, [id, accept]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const patch = async (body: Record<string, unknown>, done = "Enregistré.") => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stages/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { application?: AdminDetailJson; error?: string };
      if (!res.ok || !data.application) setMessage(data.error ?? "Enregistrement impossible.");
      else {
        accept(data.application);
        setMessage(done);
      }
    } catch {
      setMessage("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const createLink = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/stages/${id}/tutor-access`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !data.path) setMessage(data.error ?? "Lien impossible à créer.");
      else {
        setLink(`${window.location.origin}${data.path}`);
        const refreshed = await fetch(`/api/admin/stages/${id}`, { cache: "no-store" }).then((r) => r.json() as Promise<{ application?: AdminDetailJson }>);
        if (refreshed.application) accept(refreshed.application);
      }
    } catch {
      setMessage("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const next = d ? nextStep(facts(d), d.today) : null;
  const summary = d ? summarizeAttendance(d.attendance, d.startDate, d.endDate, d.today) : null;
  const tutorLinks = d?.accesses.filter((a) => a.kind === "tuteur") ?? [];

  return (
    <>
      <button type="button" tabIndex={-1} aria-hidden onClick={onClose} className="sc-fade-up fixed inset-0 z-[60] cursor-default bg-slate-950/30 backdrop-blur-[2px]" />
      <aside className="sc-slide-in fixed inset-y-0 right-0 z-[61] w-full max-w-xl space-y-4 overflow-y-auto border-l border-violet-200 bg-white p-5 shadow-[0_30px_80px_-20px_rgba(76,29,149,0.55)] sm:p-6" aria-label={d ? `Dossier de ${fullName(d)}` : "Dossier"}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">{d ? STAGE_TYPE_LABELS[d.type] : "Dossier"}</p>
            <h3 className="text-lg font-extrabold text-slate-900">{d ? fullName(d) : "Chargement…"}</h3>
            {d ? (
              <p className="text-sm text-slate-600">
                {d.phone} · {d.email}
                {d.studentNumber ? ` · matricule ${d.studentNumber}` : ""}
              </p>
            ) : null}
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Fermer la fiche">
            <X size={18} aria-hidden />
          </button>
        </div>

        {!d ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" aria-hidden /> {message ?? "Chargement du dossier…"}
          </p>
        ) : (
          <>
            <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-100">Étape (calculée)</p>
              <p className="text-lg font-black">{STAGE_STATUS_LABELS[d.status]}</p>
              {next?.team.length ? (
                <ul className="mt-1 list-disc pl-5 text-sm text-violet-50">
                  {next.team.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["Établissement", d.university],
                ["Faculté · filière", `${facultyOf(d)} · ${d.department}`],
                ["Niveau", `${d.level}${d.graduationYear ? ` (fin ${d.graduationYear})` : ""}`],
                ["Souhait", `${d.preferredCompany ?? "—"} · ${d.preferredCity ?? "—"} · ${d.startMonth ?? "—"}`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold text-slate-500">{k}</dt>
                  <dd className="text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="text-sm">
              <p className="text-xs font-semibold text-slate-500">Compétences visées</p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {d.skills.map((s) => (
                  <span key={s} className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
                    {s}
                  </span>
                ))}
              </p>
              <p className="mt-2 text-xs font-semibold text-slate-500">Objectifs</p>
              <p className="mt-1 whitespace-pre-line text-slate-800">{d.objectives}</p>
            </div>

            <Block title="1. Pack et documents">
              <p className="text-sm text-slate-800">
                {PAYMENT_STATE_LABELS[d.paymentStatus]}
                {d.paymentMethod ? ` · choisi : ${PAYMENT_METHODS.find((m) => m.id === d.paymentMethod)?.label ?? d.paymentMethod}` : ""}
              </p>
              {!isPaid(d.paymentStatus) && d.status !== "annule" ? (
                <button type="button" disabled={busy} onClick={() => window.confirm(`Confirmer le paiement de ${STAGE_PACK.priceUsd} $ reçu au bureau pour ${fullName(d)} ?`) && void patch({ paidAtOffice: true }, "Paiement enregistré.")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-60">
                  <Wallet size={16} aria-hidden /> Paiement reçu au bureau
                </button>
              ) : null}
              <ul className="space-y-1.5">
                {REQUIRED_DOCUMENTS[d.type].map((doc) => {
                  const on = d.documentsReceived.includes(doc.label);
                  return (
                    <li key={doc.label}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void patch({ documentsReceived: on ? d.documentsReceived.filter((x) => x !== doc.label) : [...d.documentsReceived, doc.label] }, on ? "Document retiré." : "Document reçu.")}
                        aria-pressed={on}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-60"
                      >
                        {on ? <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden /> : <Circle size={18} className="shrink-0 text-slate-300" aria-hidden />}
                        <span className={on ? "font-semibold text-slate-900" : "text-slate-700"}>
                          {doc.label}
                          {doc.optional ? <span className="text-slate-400"> (facultatif)</span> : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Block>

            <Block title="2. Orientation et placement">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Entreprise visée">
                  <input className={input} value={form.assignedCompany} onChange={set("assignedCompany")} placeholder="Nom de l'entreprise" />
                </Field>
                <Field label="Adresse de l'entreprise">
                  <input className={input} value={form.companyAddress} onChange={set("companyAddress")} placeholder="Avenue, commune, ville" />
                </Field>
                <Field label="Maître de stage">
                  <input className={input} value={form.tutorName} onChange={set("tutorName")} placeholder="Nom complet" />
                </Field>
                <Field label="Fonction">
                  <input className={input} value={form.tutorRole} onChange={set("tutorRole")} placeholder="Ex. Chef comptable" />
                </Field>
                <Field label="Téléphone du maître de stage">
                  <input className={input} value={form.tutorPhone} onChange={set("tutorPhone")} inputMode="tel" />
                </Field>
                <Field label="E-mail du maître de stage">
                  <input className={input} value={form.tutorEmail} onChange={set("tutorEmail")} inputMode="email" />
                </Field>
                <Field label="Date de début">
                  <input className={input} type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate || (d.type === "academique" && e.target.value ? defaultEndDate(e.target.value) : f.endDate) }))} />
                </Field>
                <Field label={d.type === "academique" ? "Date de fin (1 mois par défaut)" : "Date de fin"}>
                  <input className={input} type="date" value={form.endDate} onChange={set("endDate")} />
                </Field>
              </div>
              <Field label="Notes internes">
                <textarea className={`${input} min-h-20 py-2`} value={form.adminNotes} onChange={set("adminNotes")} placeholder="Échanges, rendez-vous…" />
              </Field>
              <button type="button" disabled={busy} onClick={() => void patch(form)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-bold text-white shadow-md shadow-violet-500/30 disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} Enregistrer
              </button>
              <p className="text-xs text-slate-500">L&apos;entreprise fait passer le dossier à « Orienté » ; le maître de stage et les dates à « Placé » ; la date de début à « En stage » ; la date de fin passée à « Stage terminé ».</p>
            </Block>

            {d.tutorName && d.endDate ? (
              <Block title="3. Lien du maître de stage">
                <p className="text-sm text-slate-600">Le maître de stage confirme les journées signées par le stagiaire, sans compte. Le lien n&apos;est affiché qu&apos;une fois : envoyez-le par WhatsApp ou e-mail.</p>
                {link ? (
                  <div className="flex items-center gap-2 rounded-xl bg-violet-50 p-2">
                    <input className={`${input} font-mono text-xs`} readOnly value={link} aria-label="Lien du maître de stage" onFocus={(e) => e.target.select()} />
                    <button type="button" onClick={() => void navigator.clipboard?.writeText(link)} className="rounded-lg bg-violet-600 p-2 text-white" aria-label="Copier le lien">
                      <Copy size={16} aria-hidden />
                    </button>
                  </div>
                ) : null}
                <button type="button" disabled={busy} onClick={() => void createLink()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-60">
                  <Link2 size={16} aria-hidden /> {tutorLinks.some((a) => !a.revokedAt) ? "Remplacer le lien" : "Créer le lien"}
                </button>
                {tutorLinks.length ? (
                  <ul className="space-y-1 text-xs text-slate-500">
                    {tutorLinks.map((a) => (
                      <li key={a.id}>
                        Créé le {new Date(a.createdAt).toLocaleDateString("fr-FR")} · {a.revokedAt ? "remplacé" : `valable jusqu'au ${new Date(a.expiresAt).toLocaleDateString("fr-FR")}`}
                        {a.lastUsedAt ? ` · ouvert le ${new Date(a.lastUsedAt).toLocaleDateString("fr-FR")}` : " · jamais ouvert"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Block>
            ) : null}

            {summary && d.startDate ? (
              <Block title="4. Présences">
                <p className="text-sm text-slate-800">{summaryLine(summary)}</p>
                <ol className="max-h-72 space-y-1.5 overflow-y-auto">
                  {[...d.attendance].reverse().map((r) => (
                    <li key={r.day} className="rounded-xl border border-slate-100 p-2 text-xs">
                      <p className="flex flex-wrap justify-between gap-2 font-semibold text-slate-800">
                        <span>{formatDayTitle(r.day)}</span>
                        <span>
                          {timeOf(r.arrivalAt)} → {timeOf(r.departureAt)} {r.departureAt ? `(${duration(r)})` : ""} {r.tutorConfirmedAt ? "· confirmée" : ""}
                        </span>
                      </p>
                      {r.activities ? <p className="mt-1 text-slate-600">{r.activities}</p> : null}
                    </li>
                  ))}
                </ol>
              </Block>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {d.status === "annule" ? (
                <button type="button" disabled={busy} onClick={() => void patch({ action: "reactivate" }, "Dossier réactivé.")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700">
                  <RotateCcw size={16} aria-hidden /> Réactiver le dossier
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => window.confirm(`Annuler le dossier de ${fullName(d)} ?`) && void patch({ action: "cancel" }, "Dossier annulé.")} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 px-4 text-sm font-bold text-rose-700">
                  <Ban size={16} aria-hidden /> Annuler le dossier
                </button>
              )}
              {message ? (
                <p className="text-sm text-slate-600" role="status">
                  {message}
                </p>
              ) : null}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
