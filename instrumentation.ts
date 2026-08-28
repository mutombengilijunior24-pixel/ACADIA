// ============================================================
// ACADIA — INSTRUMENTATION SERVEUR (P18-FINAL)
//
// Initialise Sentry côté serveur UNIQUEMENT si SENTRY_DSN est
// réellement renseigné (voir ACADIA_MONITORING_SETUP.md). Sans DSN,
// aucune tentative d'envoi n'est faite — jamais un faux "monitoring
// actif". Aucun secret (mot de passe, token de session, clé API)
// n'est jamais transmis à Sentry (voir sendDefaultPii: false et le
// filtrage explicite dans onRequestError ci-dessous).
// ============================================================

export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string | string[]> },
  context: Record<string, unknown>
) {
  if (!process.env.SENTRY_DSN) return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context as never);
}
