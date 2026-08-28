# ACADIA — Matrice des environnements (P18-FINAL)

| Variable | Développement (actuel) | Staging (cible) | Production (cible) |
|---|---|---|---|
| `DATABASE_URL` | SQLite locale (`prisma/dev.db`) | PostgreSQL Neon/Supabase dédié | PostgreSQL Neon/Supabase dédié, **distinct** du staging |
| `SESSION_SECRET` | Valeur locale de développement | Valeur générée dédiée, distincte du dev | Valeur générée dédiée, distincte du staging |
| `OPENAI_API_KEY` | Clé développeur | Clé dédiée recommandée (quotas séparés) | Clé dédiée recommandée |
| `EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_FROM` | Vide (`NoOpEmailProvider`) | `resend` + clé staging + domaine vérifié | `resend` + clé production |
| `STORAGE_PROVIDER`/`STORAGE_*` | Vide (stockage local) | `r2` + bucket staging | `r2` + bucket production, **distinct** du staging |
| `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` | Vide (aucun monitoring) | DSN projet Sentry staging | DSN projet Sentry production (ou environnement séparé dans le même projet Sentry) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | `https://staging.<domaine>` | `https://app.<domaine>` |
| `NODE_ENV` | `development` | `production` (build), `NEXT_PUBLIC_APP_URL` distingue staging/prod | `production` |
| `RATE_LIMIT_KV_URL` | Vide (rate limiting en mémoire process) | Vide tant qu'un KV managé n'est pas choisi (voir §Rate limiting) | Idem |

## Règle absolue

**Jamais de secret partagé entre environnements.** Un `SESSION_SECRET` de production ne
doit jamais être réutilisé en staging (une session valide en staging ne doit jamais
être acceptée en production, et inversement). Chaque environnement a son propre fichier
`.env.<environnement>`, jamais commité (voir `.gitignore`).

## Rate limiting distribué

Non nécessaire tant qu'un seul processus serveur tourne (cas du staging à faible
échelle). Si un déploiement multi-instance est un jour choisi, un KV managé
(`RATE_LIMIT_KV_URL`) devra être introduit — non fait ici, conformément à la consigne de
ne pas ajouter Redis « pour le plaisir » sans besoin réel démontré.

## Statut actuel réel

Seul l'environnement **Développement** existe et fonctionne aujourd'hui. Staging et
Production restent des cibles documentées, non provisionnées (voir
`ACADIA_P18_POSTGRES_RUNBOOK.md`, `ACADIA_EMAIL_SETUP.md`, `ACADIA_STORAGE_SETUP.md`,
`ACADIA_MONITORING_SETUP.md`, `ACADIA_DOMAIN_SETUP.md` pour chaque blocage précis).
