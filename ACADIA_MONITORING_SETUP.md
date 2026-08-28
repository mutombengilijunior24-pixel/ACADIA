# ACADIA — Monitoring : configuration Sentry (P18-FINAL)

## Statut

**Code prêt (`instrumentation.ts`, `instrumentation-client.ts`), non activé.** Aucun
compte/projet Sentry disponible dans cet environnement. Sans `SENTRY_DSN`, aucune
initialisation n'a lieu — aucun événement n'est envoyé nulle part.

## Ce qui a été préparé dans ce sprint

- `@sentry/nextjs` installé (`package.json`).
- `instrumentation.ts` (racine) : `register()` initialise Sentry **côté serveur**
  uniquement si `SENTRY_DSN` est défini et que le runtime est Node.js ; `onRequestError`
  transmet les erreurs serveur non interceptées à Sentry (uniquement si configuré).
- `instrumentation-client.ts` (racine) : initialise Sentry **côté navigateur**
  uniquement si `NEXT_PUBLIC_SENTRY_DSN` est défini.
- `sendDefaultPii: false` dans les deux cas — Sentry ne reçoit jamais automatiquement de
  données personnelles (IP, cookies) par défaut. Aucun mot de passe, token de session,
  clé API ou contenu de document n'est jamais transmis (aucun code applicatif n'envoie
  de contenu métier à Sentry ; seules les erreurs interceptées par Next.js le sont, avec
  leur message et leur pile d'appel).
- **Non fait** : intégration `withSentryConfig` dans `next.config.ts` (upload de source
  maps) — nécessite un `SENTRY_AUTH_TOKEN` + organisation/projet Sentry réels, non
  disponibles ; sans cela, les erreurs restent capturées mais les stack traces resteront
  minifiées en production tant que cette étape n'est pas complétée.

## Étape à faire par le propriétaire du projet

1. Créer un compte sur https://sentry.io. **Coût** : plan gratuit (Developer) jusqu'à
   5 000 erreurs/mois — suffisant pour un staging ; plans payants au-delà.
2. Créer un projet « Next.js ».
3. Copier le DSN fourni.

## Variables à renseigner (jamais commitées)

```
SENTRY_DSN="https://...@...ingest.sentry.io/..."
NEXT_PUBLIC_SENTRY_DSN="https://...@...ingest.sentry.io/..."
```

(Le DSN client est public par nature — Sentry le documente comme non sensible ; le DSN
serveur peut rester privé mais n'a pas besoin d'être secret non plus.)

## Ce qui sera couvert dès l'activation

Erreurs serveur non interceptées (routes API, rendu de page), erreurs client (React),
échecs d'export (déjà journalisés via `console.error` dans `app/api/export/pdf/route.ts`
depuis la correction du bug P18-FINAL — remonteront automatiquement à Sentry une fois
actif), erreurs Prisma, erreurs d'appel OpenAI.

## Checklist

| Élément | Statut |
|---|---|
| SDK installé | ✅ |
| Code d'initialisation conditionnelle | ✅ (prêt, inactif sans DSN) |
| Compte Sentry | 🔴 NON DISPONIBLE |
| Upload de source maps (build) | 🔴 NON FAIT (nécessite un token d'auth Sentry) |
| Environnements distincts (dev/staging/prod) | ✅ Déjà géré via `environment: process.env.NODE_ENV` |
