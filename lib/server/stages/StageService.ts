// ============================================================
// MNJ STAGE CONNECT — candidatures, suivi, présences et accès.
//
// userId toujours fourni par la route depuis la session serveur.
// L'ÉTAPE d'un dossier n'est jamais saisie à la main : elle est
// recalculée à partir des faits (paiement, documents reçus, entreprise,
// placement, dates) par lib/core/stages/workflow.ts, puis enregistrée
// avec une trace d'audit à chaque changement.
//
// Paiement : moteur de paiement d'ACADIA (PaymentService). Un Payment
// est créé (projectId = "stage:<id>"), le fournisseur réel confirme par
// webhook authentifié, et SEUL ce webhook (ou la confirmation d'un
// administrateur pour un paiement au bureau) fait passer le pack à
// « réglé ». Jamais de succès simulé.
//
// Présences : horodatées par le serveur (jamais par le navigateur),
// une ligne par jour, non modifiables une fois la journée clôturée.
//
// Accès faculté / maître de stage : jetons aléatoires de 256 bits dont
// seule l'empreinte SHA-256 est conservée, à durée limitée, révocables,
// chaque consultation tracée.
// ============================================================

import { createHash, randomBytes } from "node:crypto";

import type { Payment, Prisma, StageAccess, StageApplication, StageAttendance } from "@prisma/client";

import { DEFAULT_STAGE_OPTIONS, FACULTY_BY_ID, isPaid, normalizeOptions, optionsTotal, REQUIRED_DOCUMENTS, STAGE_PACK, type StageApplicationInput, type StageOptionId, type StageType } from "@/lib/core/stages/catalog";
import { momoAccountsSchema, normalizeMsisdn, paymentReference, type MomoAccount, type PaymentDeclaration } from "@/lib/core/stages/momo";
import { attendanceError, computeStatus, dayKey, defaultEndDate, isDay, type AttendanceAction, type WorkflowFacts } from "@/lib/core/stages/workflow";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { getPaymentProvider } from "@/lib/server/billing/payment/PaymentProviderFactory";
import * as PaymentRepository from "@/lib/server/billing/payment/PaymentRepository";
import { initiateRealCheckout } from "@/lib/server/billing/payment/PaymentService";
import { isTerminalPaymentStatus, type PaymentStatus } from "@/lib/server/billing/payment/PaymentStatus";
import { prisma } from "@/lib/server/db/prisma";

export class StageError extends Error {
  constructor(
    readonly code: "not_found" | "already_exists" | "already_paid" | "invalid_state" | "invalid_input" | "forbidden",
    message: string,
  ) {
    super(message);
  }
}

export const STAGE_SCOPE_PREFIX = "stage:";

export interface StageApplicationView extends Omit<StageApplication, "skills" | "documentsReceived" | "packOptions"> {
  skills: string[];
  documentsReceived: string[];
  packOptions: string[];
}

export interface AttendanceView {
  day: string;
  arrivalAt: Date;
  departureAt: Date | null;
  activities: string | null;
  tutorConfirmedAt: Date | null;
}

export interface PaymentChannels {
  /** Code à indiquer comme motif du transfert. */
  reference: string;
  /** Paiement en ligne automatique disponible (agrégateur configuré). */
  online: boolean;
  /** Numéros Mobile Money de MNJ actifs, pour le paiement déclaré puis vérifié. */
  momo: MomoAccount[];
}

export interface StageDossier extends StageApplicationView {
  attendance: AttendanceView[];
  /** Jour de référence du serveur (AAAA-MM-JJ), pour que l'écran et le serveur raisonnent sur la même date. */
  today: string;
  payment: PaymentChannels;
}

/* ------------------------------------ Réglages ------------------------------------ */

const MOMO_KEY = "momo_accounts";

/** Numéros Mobile Money de MNJ (réglage modifiable dans le CRM) ; liste vide si absent ou illisible. */
export async function getMomoAccounts(): Promise<MomoAccount[]> {
  const row = await prisma.stageSetting.findUnique({ where: { key: MOMO_KEY } });
  if (!row) return [];
  try {
    const parsed = momoAccountsSchema.safeParse(JSON.parse(row.value));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export async function setMomoAccounts(adminId: string, accounts: MomoAccount[]): Promise<MomoAccount[]> {
  const value = JSON.stringify(accounts);
  await prisma.stageSetting.upsert({ where: { key: MOMO_KEY }, create: { key: MOMO_KEY, value, updatedById: adminId }, update: { value, updatedById: adminId } });
  await logAudit({ actorId: adminId, action: "STAGE_SETTINGS_UPDATED", entityType: "StageSetting", entityId: MOMO_KEY, metadata: { accounts: accounts.length, active: accounts.filter((a) => a.active).length } });
  return accounts;
}

/** Le paiement en ligne n'est proposé que si un vrai fournisseur est configuré (jamais de simulation en production). */
function onlinePaymentAvailable(): boolean {
  try {
    return !(getPaymentProvider().name === "mock" && process.env.NODE_ENV === "production");
  } catch {
    return false;
  }
}

async function paymentChannels(id: string): Promise<PaymentChannels> {
  return { reference: paymentReference(id), online: onlinePaymentAvailable(), momo: (await getMomoAccounts()).filter((a) => a.active) };
}

const list = (json: string): string[] => {
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const view = (a: StageApplication): StageApplicationView => ({ ...a, skills: list(a.skills), documentsReceived: list(a.documentsReceived), packOptions: list(a.packOptions) });

const attendanceView = (r: StageAttendance): AttendanceView => ({ day: r.day, arrivalAt: r.arrivalAt, departureAt: r.departureAt, activities: r.activities, tutorConfirmedAt: r.tutorConfirmedAt });

export const today = () => dayKey(new Date());

const facts = (a: StageApplication): WorkflowFacts => ({
  type: a.type as StageType,
  status: a.status,
  paymentStatus: a.paymentStatus,
  documentsReceived: list(a.documentsReceived),
  assignedCompany: a.assignedCompany,
  tutorName: a.tutorName,
  startDate: a.startDate,
  endDate: a.endDate,
});

/** Recalcule l'étape d'après les faits et l'enregistre si elle a changé (mise à jour conditionnelle, tracée). */
async function syncStatus<T extends StageApplication>(a: T, actorId?: string): Promise<T> {
  const next = computeStatus(facts(a), today());
  if (next === a.status) return a;
  const { count } = await prisma.stageApplication.updateMany({ where: { id: a.id, status: a.status }, data: { status: next } });
  if (count) await logAudit({ actorId, action: "STAGE_STATUS_CHANGED", entityType: "StageApplication", entityId: a.id, metadata: { from: a.status, to: next, auto: true } });
  return { ...a, status: next };
}

const ACTIVE = { notIn: ["termine", "annule"] };

export async function createApplication(userId: string, input: StageApplicationInput): Promise<StageApplicationView> {
  const existing = await prisma.stageApplication.findFirst({ where: { userId, type: input.type, status: ACTIVE } });
  if (existing) throw new StageError("already_exists", "Vous avez déjà un dossier en cours pour ce type de stage.");
  const created = await prisma.stageApplication.create({
    data: {
      userId,
      type: input.type,
      lastName: input.lastName,
      postName: input.postName,
      firstName: input.firstName,
      phone: input.phone,
      email: input.email,
      university: input.university,
      institutionId: input.institutionId || null,
      faculty: input.faculty,
      facultyName: input.facultyName || null,
      department: input.department,
      level: input.level,
      studentNumber: input.studentNumber || null,
      graduationYear: input.graduationYear,
      skills: JSON.stringify(input.skills),
      objectives: input.objectives,
      preferredCompany: input.preferredCompany || null,
      preferredCity: input.preferredCity || null,
      startMonth: input.startMonth || null,
      consentAt: new Date(),
    },
  });
  await logAudit({ actorId: userId, action: "STAGE_APPLICATION_CREATED", entityType: "StageApplication", entityId: created.id, metadata: { type: input.type, faculty: input.faculty, institution: input.institutionId || "libre" } });
  return view(created);
}

export async function listMine(userId: string): Promise<StageApplicationView[]> {
  const rows = await prisma.stageApplication.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 });
  return Promise.all(rows.map(async (a) => view(await syncStatus(a, userId))));
}

async function ownedOrThrow(userId: string, id: string): Promise<StageApplication> {
  const a = await prisma.stageApplication.findFirst({ where: { id, userId } });
  if (!a) throw new StageError("not_found", "Dossier introuvable.");
  return a;
}

async function dossier(a: StageApplication): Promise<StageDossier> {
  const [attendance, payment] = await Promise.all([prisma.stageAttendance.findMany({ where: { applicationId: a.id }, orderBy: { day: "asc" } }), paymentChannels(a.id)]);
  return { ...view(a), attendance: attendance.map(attendanceView), today: today(), payment };
}

/**
 * Paiement Mobile Money déclaré par l'étudiant (montant envoyé sur un numéro de MNJ, numéro de transaction du SMS).
 * Le dossier passe « à vérifier » : seule l'équipe, après contrôle sur le téléphone de MNJ, peut le déclarer réglé.
 * Un numéro de transaction ne peut servir qu'à un seul dossier.
 */
export async function declarePayment(userId: string, id: string, input: PaymentDeclaration): Promise<StageDossier> {
  const a = await ownedOrThrow(userId, id);
  if (a.status === "annule") throw new StageError("invalid_state", "Ce dossier est annulé.");
  if (isPaid(a.paymentStatus)) throw new StageError("already_paid", "Votre accompagnement est déjà réglé.");
  if (a.paymentStatus === "en_attente") throw new StageError("invalid_state", "Un paiement en ligne est déjà en cours pour ce dossier.");
  const options = normalizeOptions(input.options);
  if (!options.length) throw new StageError("invalid_input", "Choisissez au moins une option.");
  const account = (await getMomoAccounts()).find((m) => m.active && normalizeMsisdn(m.number) === normalizeMsisdn(input.account));
  if (!account) throw new StageError("invalid_input", "Ce numéro de MNJ n'est pas (ou plus) proposé : choisissez un numéro affiché.");
  try {
    await prisma.stageApplication.update({
      where: { id },
      data: { packOptions: JSON.stringify(options), packAcceptedAt: a.packAcceptedAt ?? new Date(), paymentStatus: "a_verifier", paymentMethod: account.operator, payAccount: account.number, payTransactionId: input.transactionId, paySenderPhone: input.senderPhone, payDeclaredAt: new Date() },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") throw new StageError("invalid_input", "Ce numéro de transaction a déjà été déclaré pour un autre dossier. Vérifiez-le dans votre SMS ou contactez MNJ.");
    throw e;
  }
  await logAudit({ actorId: userId, action: "STAGE_PAYMENT_DECLARED", entityType: "StageApplication", entityId: id, metadata: { operator: account.operator, options: options.join("+"), amountUsd: optionsTotal(options) } });
  return dossier(await syncStatus(await ownedOrThrow(userId, id), userId));
}

/** Dossier de l'étudiant : paiement rafraîchi, étape recalculée, présences. */
export async function getMine(userId: string, id: string): Promise<StageDossier> {
  const a = await ownedOrThrow(userId, id);
  return dossier(await syncStatus(await refreshPayment(a), userId));
}

export async function cancelMine(userId: string, id: string): Promise<StageApplicationView> {
  const a = await ownedOrThrow(userId, id);
  if (isPaid(a.paymentStatus)) throw new StageError("already_paid", "Ce dossier est réglé : contactez l'équipe MNJ pour l'annuler.");
  const updated = await prisma.stageApplication.update({ where: { id }, data: { status: "annule" } });
  await logAudit({ actorId: userId, action: "STAGE_APPLICATION_CANCELLED", entityType: "StageApplication", entityId: id });
  return view(updated);
}

/* ------------------------------------ Présences ------------------------------------ */

/** Signature de l'arrivée ou clôture de la journée (avec le compte rendu des activités). Heure = serveur. */
export async function signAttendance(userId: string, id: string, input: AttendanceAction): Promise<StageDossier> {
  const a = await syncStatus(await ownedOrThrow(userId, id), userId);
  const day = today();
  const existing = await prisma.stageAttendance.findUnique({ where: { applicationId_day: { applicationId: id, day } } });
  const error = attendanceError(computeStatus(facts(a), day), day, a.startDate, a.endDate, existing, input);
  if (error) throw new StageError("invalid_state", error);
  if (input.action === "arrivee") {
    try {
      await prisma.stageAttendance.create({ data: { applicationId: id, day, arrivalAt: new Date() } });
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") throw new StageError("invalid_state", "Votre arrivée est déjà signée pour aujourd'hui.");
      throw e;
    }
  } else {
    // Mise à jour conditionnelle : une journée clôturée ne peut plus être réécrite (double clic, deux onglets).
    const { count } = await prisma.stageAttendance.updateMany({ where: { applicationId: id, day, departureAt: null }, data: { departureAt: new Date(), activities: input.activities.trim() } });
    if (!count) throw new StageError("invalid_state", "Votre journée est déjà clôturée.");
  }
  await logAudit({ actorId: userId, action: "STAGE_ATTENDANCE_SIGNED", entityType: "StageApplication", entityId: id, metadata: { day, action: input.action } });
  return dossier(a);
}

/* ------------------------------------ Paiement ------------------------------------ */

export type CheckoutOutcome =
  | { state: "pending"; application: StageApplicationView; instructions: string | null }
  | { state: "already_paid"; application: StageApplicationView }
  | { state: "unavailable"; application: StageApplicationView; message: string };

const UNAVAILABLE = "Le paiement en ligne sera ouvert très prochainement. Votre choix est enregistré : vous pouvez aussi régler au bureau MNJ Stage Connect, l'équipe le confirmera dans votre dossier.";

/** Choix des options (recommandation, assurance) et initiation du paiement ; le montant est toujours calculé ici, jamais reçu du navigateur. */
export async function startCheckout(userId: string, id: string, input: { method: string; idempotencyKey: string; options: StageOptionId[] }): Promise<CheckoutOutcome> {
  const a = await ownedOrThrow(userId, id);
  if (a.status === "annule") throw new StageError("invalid_state", "Ce dossier est annulé.");
  if (isPaid(a.paymentStatus)) return { state: "already_paid", application: view(a) };
  const options = normalizeOptions(input.options);
  if (!options.length) throw new StageError("invalid_input", "Choisissez au moins une option.");
  const amountUsd = optionsTotal(options);
  const accepted = await prisma.stageApplication.update({ where: { id }, data: { packAcceptedAt: a.packAcceptedAt ?? new Date(), paymentMethod: input.method, packOptions: JSON.stringify(options) } });

  // Jamais de paiement simulé en production : sans fournisseur réel configuré, le paiement en ligne est indisponible.
  const provider = getPaymentProvider();
  if (provider.name === "mock" && process.env.NODE_ENV === "production") return { state: "unavailable", application: view(accepted), message: UNAVAILABLE };

  const { payment, instructions } = await initiateRealCheckout({ userId, projectId: `${STAGE_SCOPE_PREFIX}${id}`, entitlementKey: STAGE_PACK.key, amountUsd, currency: "USD", idempotencyKey: input.idempotencyKey });
  await logAudit({ actorId: userId, action: "STAGE_PAYMENT_INITIATED", entityType: "StageApplication", entityId: id, metadata: { provider: payment.provider, status: payment.status, method: input.method, options: options.join("+"), amountUsd } });
  if (payment.status === "failed") {
    // Fournisseur non configuré ou injoignable : le paiement est tracé « échoué », le dossier reste à régler.
    const updated = await prisma.stageApplication.update({ where: { id }, data: { paymentId: payment.id, paymentStatus: "non_paye" } });
    return { state: "unavailable", application: view(updated), message: UNAVAILABLE };
  }
  const updated = await prisma.stageApplication.update({ where: { id }, data: { paymentId: payment.id, paymentStatus: payment.status === "succeeded" ? "paye" : "en_attente", paidAt: payment.status === "succeeded" ? new Date() : null } });
  return { state: "pending", application: view(updated), instructions };
}

/** Reflet de l'état du Payment dans le dossier (chemin de secours si le webhook tarde). */
async function refreshPayment(a: StageApplication): Promise<StageApplication> {
  if (a.paymentStatus !== "en_attente" || !a.paymentId) return a;
  const payment = await PaymentRepository.findById(prisma, a.paymentId);
  if (!payment) return a;
  if (payment.status === "succeeded") return markPaid(prisma, a.id, payment);
  if (isTerminalPaymentStatus(payment.status as PaymentStatus)) return prisma.stageApplication.update({ where: { id: a.id }, data: { paymentStatus: "echoue" } });
  return a;
}

async function markPaid(db: Prisma.TransactionClient | typeof prisma, id: string, payment: Payment): Promise<StageApplication> {
  const updated = await db.stageApplication.update({ where: { id }, data: { paymentStatus: "paye", paidAt: new Date(), paymentId: payment.id } });
  await logAudit({ actorId: payment.userId, action: "STAGE_PAYMENT_CONFIRMED", entityType: "StageApplication", entityId: id, metadata: { provider: payment.provider, paymentId: payment.id } });
  return updated;
}

/**
 * Appelée par la route webhook (dans sa transaction) pour un paiement du pack Stage Connect confirmé
 * par le fournisseur : le pack passe à « réglé ». Même signature que l'octroi d'un entitlement.
 * L'étape du dossier est recalculée à la lecture suivante.
 */
export async function settleStagePack(db: Prisma.TransactionClient, payment: Payment): Promise<{ id: string } | null> {
  if (payment.status !== "succeeded" || payment.entitlementKey !== STAGE_PACK.key || !payment.projectId?.startsWith(STAGE_SCOPE_PREFIX)) return null;
  const id = payment.projectId.slice(STAGE_SCOPE_PREFIX.length);
  const a = await db.stageApplication.findFirst({ where: { id, userId: payment.userId } });
  if (!a) return null;
  if (isPaid(a.paymentStatus)) return { id: a.id };
  return { id: (await markPaid(db, id, payment)).id };
}

/* ------------------------------ Administration (CRM) ------------------------------ */

export interface AdminStageRow extends StageApplicationView {
  accountEmail: string | null;
  attendanceDays: number;
}

export async function adminList(): Promise<AdminStageRow[]> {
  const rows = await prisma.stageApplication.findMany({ orderBy: { createdAt: "desc" }, take: 5000, include: { user: { select: { email: true } }, _count: { select: { attendance: true } } } });
  return Promise.all(
    rows.map(async ({ user, _count, ...a }) => ({ ...view(await syncStatus(a as StageApplication)), accountEmail: user?.email ?? null, attendanceDays: _count.attendance })),
  );
}

export interface AdminStageDetail extends StageDossier {
  accountEmail: string | null;
  accesses: AccessView[];
}

export async function adminGet(id: string): Promise<AdminStageDetail> {
  const a = await prisma.stageApplication.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!a) throw new StageError("not_found", "Dossier introuvable.");
  const { user, ...rest } = a;
  const synced = await syncStatus(rest as StageApplication);
  const accesses = await prisma.stageAccess.findMany({ where: { applicationId: id }, orderBy: { createdAt: "desc" } });
  return { ...(await dossier(synced)), accountEmail: user?.email ?? null, accesses: accesses.map(accessView) };
}

export interface AdminPatch {
  adminNotes?: string;
  documentsReceived?: string[];
  assignedCompany?: string;
  companyAddress?: string;
  tutorName?: string;
  tutorRole?: string;
  tutorPhone?: string;
  tutorEmail?: string;
  startDate?: string;
  endDate?: string;
  paidAtOffice?: true;
  /** Options réglées au bureau (par défaut : celles choisies par l'étudiant, sinon la recommandation). */
  paidOptions?: StageOptionId[];
  /** Paiement Mobile Money déclaré : confirmé après vérification, ou refusé (introuvable). */
  paymentDecision?: "confirm" | "reject";
  action?: "cancel" | "reactivate";
}

const optional = (v: string | undefined) => (v === undefined ? undefined : v.trim() || null);

export async function adminUpdate(adminId: string, id: string, patch: AdminPatch): Promise<AdminStageDetail> {
  const a = await prisma.stageApplication.findUnique({ where: { id } });
  if (!a) throw new StageError("not_found", "Dossier introuvable.");
  const data: Prisma.StageApplicationUpdateInput = {};
  if (patch.adminNotes !== undefined) data.adminNotes = patch.adminNotes.trim() || null;
  if (patch.documentsReceived) {
    const allowed = new Set(REQUIRED_DOCUMENTS[a.type as StageType].map((d) => d.label));
    if (patch.documentsReceived.some((d) => !allowed.has(d))) throw new StageError("invalid_input", "Document inconnu pour ce type de stage.");
    data.documentsReceived = JSON.stringify([...new Set(patch.documentsReceived)]);
  }
  for (const key of ["assignedCompany", "companyAddress", "tutorName", "tutorRole", "tutorPhone", "tutorEmail"] as const) {
    const v = optional(patch[key]);
    if (v !== undefined) data[key] = v;
  }
  // Dates : la fin d'un stage académique est proposée automatiquement (début + 1 mois − 1 jour).
  const start = patch.startDate === undefined ? a.startDate : patch.startDate || null;
  let end = patch.endDate === undefined ? a.endDate : patch.endDate || null;
  if (patch.startDate && patch.endDate === undefined && !a.endDate && a.type === "academique") end = defaultEndDate(patch.startDate);
  if ((start && !isDay(start)) || (end && !isDay(end))) throw new StageError("invalid_input", "Date invalide.");
  if (start && end && end < start) throw new StageError("invalid_input", "La date de fin précède la date de début.");
  if (patch.startDate !== undefined || patch.endDate !== undefined || end !== a.endDate) {
    data.startDate = start;
    data.endDate = end;
  }
  if (patch.paidAtOffice) {
    if (isPaid(a.paymentStatus)) throw new StageError("already_paid", "Ce dossier est déjà réglé.");
    const chosen = normalizeOptions(patch.paidOptions ?? list(a.packOptions));
    data.paymentStatus = "paye_bureau";
    data.paidAt = new Date();
    data.packAcceptedAt = a.packAcceptedAt ?? new Date();
    data.packOptions = JSON.stringify(chosen.length ? chosen : DEFAULT_STAGE_OPTIONS);
  }
  if (patch.paymentDecision) {
    if (a.paymentStatus !== "a_verifier") throw new StageError("invalid_state", "Aucun paiement déclaré à vérifier sur ce dossier.");
    if (patch.paymentDecision === "confirm") {
      data.paymentStatus = "paye_momo";
      data.paidAt = new Date();
    } else {
      // Refusé : le numéro de transaction est libéré (il pourra être déclaré correctement), l'étudiant est invité à vérifier.
      data.paymentStatus = "echoue";
      data.payTransactionId = null;
    }
  }
  if (patch.action === "cancel") data.status = "annule";
  // Réactivation : l'étape est recalculée à partir des faits juste après.
  if (patch.action === "reactivate") {
    if (a.status !== "annule") throw new StageError("invalid_state", "Ce dossier n'est pas annulé.");
    data.status = "en_attente";
  }
  const updated = await prisma.stageApplication.update({ where: { id }, data });
  await logAudit({
    actorId: adminId,
    action: patch.paidAtOffice || patch.paymentDecision === "confirm" ? "STAGE_PAYMENT_CONFIRMED" : patch.paymentDecision === "reject" ? "STAGE_PAYMENT_REJECTED" : patch.action === "cancel" ? "STAGE_APPLICATION_CANCELLED" : "STAGE_APPLICATION_UPDATED",
    entityType: "StageApplication",
    entityId: id,
    metadata: { fields: Object.keys(data).join(","), paidAtOffice: !!patch.paidAtOffice, paymentDecision: patch.paymentDecision, action: patch.action, ...(patch.paidAtOffice ? { amountUsd: optionsTotal(list(String(data.packOptions))) } : {}) },
  });
  await syncStatus(updated, adminId);
  return adminGet(id);
}

/* ------------------------------ Accès faculté / maître de stage ------------------------------ */

export interface AccessView {
  id: string;
  kind: "tuteur" | "faculte";
  label: string;
  applicationId: string | null;
  university: string | null;
  facultyName: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

const accessView = (x: StageAccess): AccessView => ({
  id: x.id,
  kind: x.kind as AccessView["kind"],
  label: x.label,
  applicationId: x.applicationId,
  university: x.university,
  facultyName: x.facultyName,
  expiresAt: x.expiresAt,
  revokedAt: x.revokedAt,
  lastUsedAt: x.lastUsedAt,
  createdAt: x.createdAt,
});

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

function newToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** Lien du maître de stage pour un dossier placé ; l'ancien lien éventuel est révoqué. Le jeton n'est renvoyé qu'ici. */
export async function createTutorAccess(adminId: string, applicationId: string): Promise<{ token: string; access: AccessView }> {
  const a = await prisma.stageApplication.findUnique({ where: { id: applicationId } });
  if (!a) throw new StageError("not_found", "Dossier introuvable.");
  if (!a.tutorName || !isDay(a.endDate)) throw new StageError("invalid_state", "Inscrivez d'abord le placement (maître de stage et dates).");
  const expiresAt = new Date(`${a.endDate}T23:59:59Z`);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  if (expiresAt.getTime() < Date.now() + 7 * 86_400_000) expiresAt.setTime(Date.now() + 7 * 86_400_000);
  const { token, tokenHash } = newToken();
  const [, access] = await prisma.$transaction([
    prisma.stageAccess.updateMany({ where: { applicationId, kind: "tuteur", revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.stageAccess.create({ data: { kind: "tuteur", tokenHash, label: `Maître de stage — ${a.tutorName}`, applicationId, createdById: adminId, expiresAt } }),
  ]);
  await logAudit({ actorId: adminId, action: "STAGE_ACCESS_CREATED", entityType: "StageAccess", entityId: access.id, metadata: { kind: "tuteur", applicationId } });
  return { token, access: accessView(access) };
}

/** Accès de lecture d'une faculté à ses étudiants en stage académique. */
export async function createFacultyAccess(adminId: string, input: { university: string; facultyName: string; days: number }): Promise<{ token: string; access: AccessView }> {
  const { token, tokenHash } = newToken();
  const access = await prisma.stageAccess.create({
    data: { kind: "faculte", tokenHash, label: `${input.facultyName} — ${input.university}`, university: input.university.trim(), facultyName: input.facultyName.trim(), createdById: adminId, expiresAt: new Date(Date.now() + input.days * 86_400_000) },
  });
  await logAudit({ actorId: adminId, action: "STAGE_ACCESS_CREATED", entityType: "StageAccess", entityId: access.id, metadata: { kind: "faculte", university: input.university, faculty: input.facultyName, days: input.days } });
  return { token, access: accessView(access) };
}

export async function listFacultyAccesses(): Promise<AccessView[]> {
  return (await prisma.stageAccess.findMany({ where: { kind: "faculte" }, orderBy: { createdAt: "desc" }, take: 200 })).map(accessView);
}

export async function revokeAccess(adminId: string, id: string): Promise<void> {
  const { count } = await prisma.stageAccess.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!count) throw new StageError("not_found", "Accès introuvable ou déjà révoqué.");
  await logAudit({ actorId: adminId, action: "STAGE_ACCESS_REVOKED", entityType: "StageAccess", entityId: id });
}

/** Jeton valide (bon type, non révoqué, non expiré) ; sinon null — jamais de détail sur la raison. */
async function resolveAccess(token: string, kind: "tuteur" | "faculte"): Promise<StageAccess | null> {
  if (!TOKEN.test(token)) return null;
  const access = await prisma.stageAccess.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!access || access.kind !== kind || access.revokedAt || access.expiresAt.getTime() < Date.now()) return null;
  await prisma.stageAccess.update({ where: { id: access.id }, data: { lastUsedAt: new Date() } });
  return access;
}

/** Données visibles par le maître de stage : le stagiaire, son registre et ses comptes rendus. */
export interface TutorView {
  student: { name: string; university: string; faculty: string; department: string; level: string; type: StageType };
  company: string | null;
  tutorName: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  attendance: AttendanceView[];
  today: string;
}

const facultyOfApp = (a: StageApplication) => a.facultyName || FACULTY_BY_ID[a.faculty]?.label || a.faculty;
const nameOf = (a: StageApplication) => [a.lastName, a.postName, a.firstName].filter(Boolean).join(" ");

export async function tutorView(token: string): Promise<TutorView | null> {
  const access = await resolveAccess(token, "tuteur");
  if (!access?.applicationId) return null;
  const a = await prisma.stageApplication.findUnique({ where: { id: access.applicationId } });
  if (!a) return null;
  const synced = await syncStatus(a);
  const d = await dossier(synced);
  await logAudit({ action: "STAGE_ACCESS_VIEWED", entityType: "StageAccess", entityId: access.id, metadata: { kind: "tuteur" } });
  return {
    student: { name: nameOf(a), university: a.university, faculty: facultyOfApp(a), department: a.department, level: a.level, type: a.type as StageType },
    company: a.assignedCompany,
    tutorName: a.tutorName,
    startDate: a.startDate,
    endDate: a.endDate,
    status: synced.status,
    attendance: d.attendance,
    today: d.today,
  };
}

/** Confirmation des journées par le maître de stage (journées signées, jusqu'à aujourd'hui). */
export async function tutorConfirm(token: string, days: string[]): Promise<number | null> {
  const access = await resolveAccess(token, "tuteur");
  if (!access?.applicationId) return null;
  const valid = days.filter(isDay).filter((d) => d <= today());
  if (!valid.length) return 0;
  const { count } = await prisma.stageAttendance.updateMany({ where: { applicationId: access.applicationId, day: { in: valid }, tutorConfirmedAt: null }, data: { tutorConfirmedAt: new Date() } });
  if (count) await logAudit({ action: "STAGE_TUTOR_CONFIRMED", entityType: "StageApplication", entityId: access.applicationId, metadata: { days: count, accessId: access.id } });
  return count;
}

export interface FacultyStudent {
  id: string;
  name: string;
  studentNumber: string | null;
  department: string;
  level: string;
  status: string;
  company: string | null;
  tutorName: string | null;
  startDate: string | null;
  endDate: string | null;
  skills: string[];
  objectives: string;
  attendance: AttendanceView[];
}

export interface FacultyView {
  university: string;
  facultyName: string;
  expiresAt: Date;
  students: FacultyStudent[];
  today: string;
}

/** Étudiants en stage académique de la faculté (dossiers non annulés), avec leur registre de présences. */
export async function facultyView(token: string): Promise<FacultyView | null> {
  const access = await resolveAccess(token, "faculte");
  if (!access?.university || !access.facultyName) return null;
  const rows = await prisma.stageApplication.findMany({
    where: { type: "academique", status: { not: "annule" }, university: { equals: access.university, mode: "insensitive" } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 2000,
    include: { attendance: { orderBy: { day: "asc" } } },
  });
  const target = access.facultyName.toLocaleLowerCase("fr");
  const mine = rows.filter((a) => facultyOfApp(a).toLocaleLowerCase("fr") === target);
  const students = await Promise.all(
    mine.map(async ({ attendance, ...a }) => {
      const synced = await syncStatus(a as StageApplication);
      return {
        id: a.id,
        name: nameOf(a as StageApplication),
        studentNumber: a.studentNumber,
        department: a.department,
        level: a.level,
        status: synced.status,
        company: a.assignedCompany,
        tutorName: a.tutorName,
        startDate: a.startDate,
        endDate: a.endDate,
        skills: list(a.skills),
        objectives: a.objectives,
        attendance: attendance.map(attendanceView),
      };
    }),
  );
  await logAudit({ action: "STAGE_ACCESS_VIEWED", entityType: "StageAccess", entityId: access.id, metadata: { kind: "faculte", students: students.length } });
  return { university: access.university, facultyName: access.facultyName, expiresAt: access.expiresAt, students, today: today() };
}

/** Couples (établissement, faculté) présents dans les dossiers académiques : base des accès facultés. */
export async function facultyScopes(): Promise<Array<{ university: string; facultyName: string; count: number }>> {
  const rows = await prisma.stageApplication.findMany({ where: { type: "academique", status: { not: "annule" } }, select: { university: true, faculty: true, facultyName: true } });
  const map = new Map<string, { university: string; facultyName: string; count: number }>();
  for (const r of rows) {
    const facultyName = r.facultyName || FACULTY_BY_ID[r.faculty]?.label || r.faculty;
    const key = `${r.university.toLocaleLowerCase("fr")}\u0000${facultyName.toLocaleLowerCase("fr")}`;
    const entry = map.get(key) ?? { university: r.university, facultyName, count: 0 };
    entry.count += 1;
    map.set(key, entry);
  }
  return [...map.values()].sort((x, y) => x.university.localeCompare(y.university, "fr") || x.facultyName.localeCompare(y.facultyName, "fr"));
}

/** Erreurs → réponses HTTP explicites (table absente : module pas encore activé sur ce serveur). */
export function stageErrorResponse(error: unknown): Response {
  if (error instanceof StageError) {
    const status = { not_found: 404, already_exists: 409, already_paid: 409, invalid_state: 409, invalid_input: 400, forbidden: 403 }[error.code];
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2021" || code === "P2022") return Response.json({ error: "MNJ Stage Connect n'est pas encore activé sur ce serveur.", code: "unavailable" }, { status: 503 });
  console.error("[stage-connect]", error instanceof Error ? error.message : "erreur inconnue");
  return Response.json({ error: "Erreur du serveur. Réessayez dans un instant.", code: "server_error" }, { status: 500 });
}
