# ACADIA — Blocage PostgreSQL staging (P18)

## Statut

**Aucune instance PostgreSQL n'est accessible dans cet environnement de développement.**
Ni serveur local (`psql` absent), ni Docker pour en démarrer un, ni identifiants de
connexion vers un service managé (Neon, Supabase, Railway, RDS...) fournis dans
l'environnement ou les fichiers de configuration. Installer un PostgreSQL simulé ou
prétendre qu'un environnement de staging existe violerait la règle anti-hallucination du
sprint — ce document remplace donc l'exécution réelle de la Partie 1.

## Ce qui est déjà prêt (aucun travail supplémentaire requis le jour venu)

- `prisma/schema.prisma` : compatible PostgreSQL sans changement de structure — seuls les
  champs `String` servant de JSON (SQLite ne supportant pas nativement le type `Json`)
  pourraient être promus en `Json`/`Jsonb` PostgreSQL pour de meilleures performances de
  requête, mais ce n'est pas requis pour un premier déploiement (String fonctionne aussi
  bien sous PostgreSQL).
- Toutes les requêtes applicatives passent par Prisma Client — aucun SQL brut, aucune
  fonctionnalité spécifique à SQLite utilisée dans le code applicatif.
- `scripts/migrate-json-to-db.ts` fonctionne indépendamment du fournisseur de base
  (utilise `PrismaClient` générique).

## Procédure exacte à exécuter dès qu'une instance réelle est disponible

1. Provisionner une base PostgreSQL de staging (ex. Neon, Supabase, Railway).
2. Renseigner dans `.env.staging` (jamais commité) :
   ```
   DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<database>?sslmode=require"
   ```
3. Dans `prisma/schema.prisma`, changer :
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
4. Exécuter :
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```
5. Rejouer le scénario de test complet déjà validé sous SQLite en P17
   (`ACADIA_P17_TEST_REPORT.md` §4) contre cette base PostgreSQL réelle : création de
   compte, connexion, création de projet, sauvegarde, questionnaire, dataset,
   observations, supervision, invitation, soumission, feedback, corrections,
   notifications, journal d'audit, export.
6. Documenter les résultats dans une mise à jour de `ACADIA_P18_TEST_REPORT.md`.

## Variables nécessaires (à obtenir avant de pouvoir lever ce blocage)

- `DATABASE_URL` (staging), `DATABASE_URL` (production, distincte).
- Accès réseau sortant depuis l'environnement d'exécution vers l'hôte PostgreSQL choisi.
- Un plan de sauvegarde du fournisseur managé (la plupart en proposent un par défaut —
  à vérifier et documenter dans `ACADIA_P18_TEST_REPORT.md` une fois choisi).

## Impact sur le verdict GO/NO-GO

Ce blocage, à lui seul, **n'empêche pas** un verdict « GO FOR PRIVATE BETA » si SQLite
reste utilisé pour un tout premier déploiement à très faible échelle (un seul processus
serveur, peu d'utilisateurs simultanés) — mais il **empêche** un verdict de production à
plus grande échelle tant qu'une base réellement gérée n'est pas en place (voir
`ACADIA_P18_TEST_REPORT.md` §21).
