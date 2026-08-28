// ============================================================
// ACADIA — FOURNISSEUR EMAIL RÉEL : RESEND (P18-FINAL)
//
// Implémentation réelle derrière l'interface EmailProvider
// (lib/email/EmailProvider.ts). Code prêt, jamais activé tant que
// EMAIL_PROVIDER="resend" et EMAIL_API_KEY/EMAIL_FROM ne sont pas
// réellement fournis (voir resolveProvider() dans EmailProvider.ts
// et ACADIA_EMAIL_SETUP.md pour la procédure d'activation).
//
// Distingue toujours sent / failed — ne renvoie jamais "sent" sans
// confirmation explicite de l'API Resend.
// ============================================================

import { Resend } from "resend";
import { logEmail } from "@/lib/supervision/EmailLogStore";
import type { EmailInput, EmailProvider, EmailResult } from "./EmailProvider";

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async sendEmail(input: EmailInput): Promise<EmailResult> {
    try {
      const { error } = await this.client.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.body,
      });

      if (error) {
        const result: EmailResult = { status: "failed", error: error.message };
        logEmail({ to: input.to, subject: input.subject, template: input.template, status: result.status, error: result.error });
        return result;
      }

      const result: EmailResult = { status: "sent" };
      logEmail({ to: input.to, subject: input.subject, template: input.template, status: result.status });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur inconnue lors de l'envoi de l'email.";
      const result: EmailResult = { status: "failed", error: message };
      logEmail({ to: input.to, subject: input.subject, template: input.template, status: result.status, error: message });
      return result;
    }
  }
}
