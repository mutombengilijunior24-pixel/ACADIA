"use client";

import "./stage-connect.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Download,
  Hourglass,
  Loader2,
  Search,
  Users,
  Wallet,
} from "lucide-react";

import { buildWorkbook } from "@/lib/core/export/xlsx";
import {
  FACULTIES,
  isPaid,
  LEVELS,
  optionsTotal,
  paidOptions,
  STAGE_STATUS_LABELS,
  STAGE_STATUSES,
  STAGE_TYPE_LABELS,
  STAGE_TYPES,
  type StageStatus,
  type StageType,
} from "@/lib/core/stages/catalog";
import { stageWorkbookSheets } from "@/lib/core/stages/export";
import { facultyOf } from "@/lib/core/stages/report";

import { FacultyAccessPanel } from "./FacultyAccessPanel";
import { StageCrmDetail, type AdminDetailJson } from "./StageCrmDetail";
import type { ApplicationJson } from "./types";

interface Row extends ApplicationJson {
  accountEmail: string | null;
  attendanceDays: number;
}

type Period = "today" | "7" | "30" | "all";
const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  "7": "7 jours",
  "30": "30 jours",
  all: "Tout",
};
const sameDay = (iso: string, ref: number) =>
  new Date(iso).toDateString() === new Date(ref).toDateString();
const fullName = (r: Row) =>
  [r.lastName, r.postName, r.firstName].filter(Boolean).join(" ");
const select =
  "min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100";

function download(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** MNJ Stage Connect — tableau de suivi des candidats (administrateurs). */
export default function StageCrm() {
  const [rows, setRows] = useState<Row[] | null>(null);
  // Heure de référence des filtres « aujourd'hui / 7 jours », fixée à chaque chargement (rendu pur).
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("all");
  const [type, setType] = useState<StageType | "">("");
  const [fac, setFac] = useState("");
  const [dept, setDept] = useState("");
  const [level, setLevel] = useState("");
  const [status, setStatus] = useState<StageStatus | "">("");
  const [payment, setPayment] = useState<"" | "paid" | "unpaid">("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const closeDetail = useCallback(() => setOpen(null), []);
  // Fiche enregistrée : la ligne du tableau reprend les faits et l'étape recalculée par le serveur.
  const onSaved = useCallback((d: AdminDetailJson) => {
    const { attendance, ...rest } = d;
    setRows((list) => (list ?? []).map((r) => (r.id === d.id ? { ...r, ...rest, attendanceDays: attendance.length } : r)));
  }, []);

  const load = useCallback(async (purpose?: "export") => {
    const res = await fetch(
      `/api/admin/stages${purpose ? "?purpose=export" : ""}`,
      { cache: "no-store" },
    );
    const data = (await res.json().catch(() => ({}))) as {
      applications?: Row[];
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Accès impossible.");
    return data.applications ?? [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((r) => {
        if (cancelled) return;
        setRows(r);
        setLoadedAt(Date.now());
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (period === "today" && !sameDay(r.createdAt, loadedAt)) return false;
      if (
        (period === "7" || period === "30") &&
        loadedAt - Date.parse(r.createdAt) > Number(period) * 86_400_000
      )
        return false;
      if (type && r.type !== type) return false;
      if (fac && r.faculty !== fac) return false;
      if (dept && r.department !== dept) return false;
      if (level && r.level !== level) return false;
      if (status && r.status !== status) return false;
      if (payment === "paid" && !isPaid(r.paymentStatus)) return false;
      if (payment === "unpaid" && isPaid(r.paymentStatus)) return false;
      return (
        !needle ||
        [
          fullName(r),
          r.phone,
          r.email,
          r.university,
          r.department,
          r.preferredCompany ?? "",
          r.assignedCompany ?? "",
        ].some((v) => v.toLowerCase().includes(needle))
      );
    });
  }, [rows, loadedAt, period, type, fac, dept, level, status, payment, q]);

  const all = rows ?? [];
  const paidCount = all.filter((r) => isPaid(r.paymentStatus)).length;
  const kpis = [
    { icon: Users, label: "Candidats", value: all.length },
    {
      icon: CalendarDays,
      label: "Inscrits aujourd'hui",
      value: all.filter((r) => sameDay(r.createdAt, loadedAt)).length,
    },
    {
      icon: Hourglass,
      label: "En attente d'orientation",
      value: all.filter((r) => r.status === "en_attente").length,
    },
    { icon: BadgeCheck, label: "Accompagnements réglés", value: paidCount },
    {
      icon: Briefcase,
      label: "En stage",
      value: all.filter((r) => r.status === "en_stage").length,
    },
    {
      icon: Wallet,
      label: "Montant réglé",
      value: `${all.reduce((sum, r) => sum + optionsTotal(paidOptions(r)), 0)} $`,
    },
  ];
  const facultyCounts = FACULTIES.map((f) => ({
    ...f,
    count: all.filter((r) => r.faculty === f.id).length,
  })).filter((f) => f.count);
  const departments = [
    ...new Set(
      all.filter((r) => !fac || r.faculty === fac).map((r) => r.department),
    ),
  ].sort();

  const exportXlsx = async (scope: "selection" | "today") => {
    try {
      const fresh = await load("export");
      setRows(fresh);
      setLoadedAt(Date.now());
      const data =
        scope === "today"
          ? fresh.filter((r) => sameDay(r.createdAt, Date.now()))
          : filtered.map((r) => fresh.find((x) => x.id === r.id) ?? r);
      const stamp = new Date().toISOString().slice(0, 10);
      const title =
        scope === "today"
          ? `Candidats du ${new Date().toLocaleDateString("fr-FR")}`
          : `Sélection du ${new Date().toLocaleDateString("fr-FR")} (${data.length} candidats)`;
      download(
        buildWorkbook(stageWorkbookSheets(data, title)),
        `mnj-stage-connect-${scope === "today" ? "jour" : "selection"}-${stamp}.xlsx`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 px-6 py-7 text-white sm:px-8">
        <div
          className="sc-float pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-500/25 blur-3xl"
          aria-hidden
        />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">
          MNJ Stage Connect · Administration
        </p>
        <h1 className="relative mt-1 text-2xl font-black sm:text-3xl">
          Tableau de suivi des candidats
        </h1>
        <p className="relative mt-1 max-w-2xl text-sm text-violet-100">
          Classés par faculté, filière et niveau ; chaque dossier se suit de
          l&apos;inscription au stage terminé. Export Excel de la sélection ou
          des inscrits du jour.
        </p>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportXlsx("today")}
            className="sc-glow inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-4 text-sm font-bold"
          >
            <Download size={16} aria-hidden /> Excel : inscrits du jour
          </button>
          <button
            type="button"
            onClick={() => void exportXlsx("selection")}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-bold ring-1 ring-white/25 hover:bg-white/15"
          >
            <Download size={16} aria-hidden /> Excel : sélection affichée (
            {filtered.length})
          </button>
        </div>
      </header>

      {error ? (
        <p
          className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {rows === null ? (
        <p
          className="flex items-center gap-2 text-sm text-slate-600"
          role="status"
        >
          <Loader2
            size={18}
            className="animate-spin text-violet-600"
            aria-hidden
          />{" "}
          Chargement…
        </p>
      ) : (
        <>
          <section
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
            aria-label="Indicateurs"
          >
            {kpis.map((k, i) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className="sc-fade-up rounded-2xl border border-slate-200 bg-white p-4"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <Icon size={18} className="text-violet-600" aria-hidden />
                  <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">
                    {k.value}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">
                    {k.label}
                  </p>
                </div>
              );
            })}
          </section>

          {facultyCounts.length ? (
            <section className="flex flex-wrap gap-2" aria-label="Par faculté">
              <button
                type="button"
                onClick={() => setFac("")}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${!fac ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
              >
                Toutes les facultés ({all.length})
              </button>
              {facultyCounts.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFac(f.id === fac ? "" : f.id)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${fac === f.id ? "bg-violet-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-violet-300"}`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </section>
          ) : null}

          <section
            className="flex flex-wrap items-center gap-2"
            aria-label="Filtres"
          >
            <label className="relative min-w-[14rem] flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                className={`${select} w-full pl-9`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, téléphone, université, entreprise…"
                aria-label="Rechercher"
              />
            </label>
            <select
              className={select}
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              aria-label="Période"
            >
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <option key={p} value={p}>
                  {PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
            <select
              className={select}
              value={type}
              onChange={(e) => setType(e.target.value as StageType | "")}
              aria-label="Type de stage"
            >
              <option value="">Tous les stages</option>
              {STAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {STAGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <select
              className={select}
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              aria-label="Filière"
            >
              <option value="">Toutes les filières</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              className={select}
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              aria-label="Niveau"
            >
              <option value="">Tous les niveaux</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              className={select}
              value={status}
              onChange={(e) => setStatus(e.target.value as StageStatus | "")}
              aria-label="Étape"
            >
              <option value="">Toutes les étapes</option>
              {STAGE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              className={select}
              value={payment}
              onChange={(e) =>
                setPayment(e.target.value as "" | "paid" | "unpaid")
              }
              aria-label="Paiement"
            >
              <option value="">Tous les paiements</option>
              <option value="paid">Pack réglé</option>
              <option value="unpaid">Pack non réglé</option>
            </select>
          </section>

          <div>
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {[
                      "Inscrit le",
                      "Candidat",
                      "Stage",
                      "Faculté · filière",
                      "Niveau",
                      "Étape",
                      "Pack",
                    ].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setOpen(r.id)}
                      className={`cursor-pointer border-t border-slate-100 transition hover:bg-violet-50/60 ${open === r.id ? "bg-violet-50" : ""}`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {new Date(r.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="text-left font-semibold text-slate-900 hover:text-violet-700"
                          onClick={() => setOpen(r.id)}
                        >
                          {fullName(r)}
                        </button>
                        <span className="block text-xs text-slate-500">
                          {r.phone}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {STAGE_TYPE_LABELS[r.type]}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {facultyOf(r)}
                        <span className="block text-xs text-slate-500">
                          {r.department}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {r.level}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === "en_attente" ? "bg-amber-100 text-amber-900" : r.status === "annule" ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-900"}`}
                        >
                          {STAGE_STATUS_LABELS[r.status]}
                        </span>
                        {r.status === "en_stage" || r.status === "termine" ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            {r.attendanceDays} jour(s) signé(s)
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${isPaid(r.paymentStatus) ? "bg-emerald-100 text-emerald-900" : "bg-violet-100 text-violet-900"}`}
                        >
                          {isPaid(r.paymentStatus)
                            ? "Réglé"
                            : r.paymentStatus === "en_attente"
                              ? "En attente"
                              : "Non réglé"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!filtered.length ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        Aucun candidat pour ces critères.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {open ? <StageCrmDetail key={open} id={open} onClose={closeDetail} onSaved={onSaved} /> : null}
          </div>
        </>
      )}
      {rows !== null && !error ? <FacultyAccessPanel /> : null}
    </div>
  );
}
