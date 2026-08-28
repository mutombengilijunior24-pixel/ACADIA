// ============================================================
// ACADIA — INSTRUMENTATION CLIENT (P18-FINAL)
//
// Initialise Sentry côté navigateur UNIQUEMENT si
// NEXT_PUBLIC_SENTRY_DSN est réellement renseigné (voir
// ACADIA_MONITORING_SETUP.md). Cette variable est publique par
// nature (embarquée dans le bundle client) — ce n'est PAS un secret,
// contrairement à SENTRY_DSN côté serveur qui peut rester privé.
// ============================================================

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  });
}
