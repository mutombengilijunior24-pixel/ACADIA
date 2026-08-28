# ACADIA — Préparation au déploiement P17

**Aucun déploiement réel n'a été effectué dans ce sprint.** Ce document prépare
l'architecture de déploiement ; il ne constitue pas une preuve de déploiement.

## 1. Provisionnement de la base de données

- **Développement** : SQLite local, déjà opérationnel (`prisma/dev.db`).
- **Staging/Production** : provisionner une instance PostgreSQL managée (ex. Neon,
  Supabase, Railway, RDS). Une fois l'URL de connexion obtenue, changer
  `datasource db { provider = "postgresql" }` dans `prisma/schema.prisma`, définir
  `DATABASE_URL`, puis `npx prisma migrate deploy`.

## 2. Variables d'environnement

Voir `.env.example` (catégorisé DATABASE / AUTH / AI / EMAIL / STORAGE / APP / SECURITY /
FUTURE PAYMENTS). Chaque environnement (dev/staging/prod) doit avoir son propre fichier
de secrets, jamais commité, jamais partagé entre environnements.

## 3. Migrations

`npx prisma migrate dev` en développement (crée et applique). `npx prisma migrate deploy`
en staging/production (applique uniquement les migrations déjà générées, jamais de
`db push` ou de reset destructif). Voir `ACADIA_P17_MIGRATION_GUIDE.md`.

## 4. Stockage de documents

Non provisionné. Options documentées dans
`ACADIA_P17_PRODUCTION_ARCHITECTURE.md` §9 (S3, Cloudflare R2, Supabase Storage) —
implémenter `DocumentStorageProvider` avec le fournisseur choisi le moment venu, sans
changer les appelants.

## 5. Email

Non provisionné. Voir `ACADIA_P16_EMAIL_ARCHITECTURE.md`.

## 6. Domaine / HTTPS / DNS

Aucun domaine réel n'est réservé. Architecture conceptuelle déjà documentée en P16
(`app.[domaine]`, `api.[domaine]`, sous-domaine email dédié). HTTPS est géré nativement
par la plupart des plateformes d'hébergement Next.js managées (ex. Vercel) une fois un
domaine effectivement pointé — non configuré ici.

## 7. Monitoring

Non configuré. Recommandation : brancher un service de logs structurés/erreurs (ex.
Sentry pour les erreurs applicatives) une fois un hébergement de production choisi — les
événements structurés déjà prévus côté serveur (voir `ACADIA_P17_SECURITY.md` §6-7)
facilitent cette intégration future sans réécriture.

## 8. Sauvegardes

Voir `ACADIA_P17_BACKUP_POLICY.md` — non configurées.

## 9. Statut honnête

**Architecture de déploiement préparée et documentée. Aucun environnement de staging ou
de production n'a été provisionné ou testé dans ce sprint.**
