// ============================================================
// ACADIA — ABSTRACTION EMAIL (P16)
//
// Aucun fournisseur d'email réel n'est configuré (voir
// ACADIA_P16_EMAIL_ARCHITECTURE.md) : `NoOpEmailProvider` est la
// seule implémentation active. Elle n'envoie jamais rien et ne
// prétend jamais l'inverse — chaque tentative est journalisée
// avec `status: "not_configured"` (EmailLogStore). Le jour où
// EMAIL_PROVIDER/EMAIL_API_KEY sont réellement renseignés, une
// nouvelle implémentation remplace celle-ci derrière la même
// interface, sans changer les appelants.
// ============================================================

import { logEmail } from "@/lib/supervision/EmailLogStore";
import type { EmailLogStatus } from "@/lib/core/supervision/SupervisionTypes";

export interface EmailInput {
  to: string;
  subject: string;
  body: string;
  template: string;
}

export interface EmailResult {
  status: EmailLogStatus;
  error?: string;
}

export interface EmailProvider {
  sendEmail(input: EmailInput): Promise<EmailResult>;
}

class NoOpEmailProvider implements EmailProvider {
  async sendEmail(input: EmailInput): Promise<EmailResult> {
    const result: EmailResult = { status: "not_configured" };
    logEmail({ to: input.to, subject: input.subject, template: input.template, status: result.status });
    return result;
  }
}

function resolveProvider(): EmailProvider {
  // Activé UNIQUEMENT si EMAIL_PROVIDER="resend" et EMAIL_API_KEY/
  // EMAIL_FROM sont tous les deux réellement renseignés (voir
  // ACADIA_EMAIL_SETUP.md). Sans cela, on retombe sur NoOpEmailProvider
  // — jamais une fausse promesse d'envoi réel.
  if (process.env.EMAIL_PROVIDER === "resend") {
    const apiKey = process.env.EMAIL_API_KEY;
    const from = process.env.EMAIL_FROM;

    if (apiKey && from) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ResendEmailProvider } = require("./ResendEmailProvider") as typeof import("./ResendEmailProvider");
      return new ResendEmailProvider(apiKey, from);
    }

    console.error(
      "[ACADIA] EMAIL_PROVIDER=\"resend\" mais EMAIL_API_KEY ou EMAIL_FROM manque — repli sur NoOpEmailProvider."
    );
  }

  return new NoOpEmailProvider();
}

export const emailProvider: EmailProvider = resolveProvider();

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export async function sendVerificationEmail(to: string, link: string): Promise<EmailResult> {
  return emailProvider.sendEmail({
    to,
    subject: "ACADIA — Vérifiez votre adresse email",
    body: `Confirmez votre adresse email ACADIA : ${link}`,
    template: "verification",
  });
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<EmailResult> {
  return emailProvider.sendEmail({
    to,
    subject: "ACADIA — Réinitialisation de mot de passe",
    body: `Réinitialisez votre mot de passe ACADIA : ${link}`,
    template: "password_reset",
  });
}

export async function sendSubmissionNotification(to: string, studentName: string, researchTitle: string): Promise<EmailResult> {
  return emailProvider.sendEmail({
    to,
    subject: "ACADIA — Nouvelle soumission reçue",
    body: `${studentName} a soumis une nouvelle version de « ${researchTitle} ». Connectez-vous à ACADIA (${appUrl()}/dashboard/supervisor) pour l'examiner.`,
    template: "submission_notification",
  });
}

export async function sendFeedbackNotification(to: string, researchTitle: string): Promise<EmailResult> {
  return emailProvider.sendEmail({
    to,
    subject: "ACADIA — Nouveau feedback de votre directeur",
    body: `Votre directeur a envoyé un feedback sur « ${researchTitle} ». Connectez-vous à ACADIA (${appUrl()}/dashboard) pour le consulter en détail.`,
    template: "feedback_notification",
  });
}

export async function sendRevisionNotification(to: string, researchTitle: string): Promise<EmailResult> {
  return emailProvider.sendEmail({
    to,
    subject: "ACADIA — Une nouvelle version a été soumise",
    body: `Une nouvelle version de « ${researchTitle} » a été soumise pour votre examen.`,
    template: "revision_notification",
  });
}

export async function sendSupervisorInvitation(to: string, supervisorName: string, link: string): Promise<EmailResult> {
  return emailProvider.sendEmail({
    to,
    subject: `ACADIA — Invitation d'encadrement de ${supervisorName}`,
    body: `${supervisorName} vous invite à rejoindre son espace d'encadrement sur ACADIA : ${link}`,
    template: "supervisor_invitation",
  });
}
