# ACADIA — Sécurité P17

## 1. Authentification

Inchangé depuis P13, conservé car déjà conforme aux bonnes pratiques : bcrypt (12 rounds),
cookie de session HMAC-SHA256 signé (`acadia_session`), `HttpOnly`, `SameSite=lax`,
`Secure` en production, expiration 30 jours, comparaison de signature en temps constant
(`timingSafeEqual`). Aucun mot de passe ni jeton n'est jamais stocké côté client.

## 2. Autorisation — jamais un id client de confiance

Principe déjà appliqué en P16 pour toutes les routes `/api/supervision/**`, **étendu et
renforcé en P17** : chaque route qui touche une ressource appartenant à un utilisateur
vérifie la relation réelle en base (`lib/server/auth/authorize.ts`) avant toute lecture ou
écriture — jamais uniquement `role === "supervisor"`, toujours en plus
`assignment.supervisorId === session.user.id` ou équivalent. Un `researchId`,
`studentId` ou `supervisorId` reçu dans le corps ou l'URL d'une requête n'est **jamais**
utilisé pour décider d'un accès sans vérification côté serveur contre la base.

## 3. Rôles

`role` n'est jamais accepté tel quel dans le corps d'une requête générique de mise à jour
de profil. Le passage à `supervisor` passe exclusivement par
`POST /api/auth/become-supervisor` (auto-déclaration explicite, documentée comme non
vérifiée institutionnellement — voir `ACADIA_P17_PRODUCTION_ARCHITECTURE.md` §7). Aucune
route ne permet à un client d'écrire `role=admin`.

## 4. En-têtes de sécurité

`next.config.ts` définit :

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY` (protection contre le clickjacking — ACADIA n'a pas besoin
  d'être embarqué en iframe tiers)
- `Permissions-Policy` restreignant caméra/microphone/géolocalisation (non utilisés par
  le produit)

Une `Content-Security-Policy` stricte n'a **pas** été activée dans ce sprint : le produit
utilise des scripts inline via Next.js/Tailwind au build et l'activer sans audit complet
des sources risquait de casser silencieusement des fonctionnalités déjà livrées (export
PDF, etc.) sans possibilité de le vérifier exhaustivement dans le temps imparti — documenté
ici comme limite assumée plutôt que fait à moitié.

## 5. Rate limiting

`lib/server/security/RateLimiter.ts` — interface + implémentation de développement en
mémoire process (fenêtre glissante). Appliquée aux routes sensibles : `/api/auth/login`,
`/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password`,
`/api/supervision/invitations`, `/api/supervision/invitations/accept`.

**Limite assumée et explicite** : une implémentation en mémoire process ne fonctionne
correctement que sur un seul processus serveur — inefficace derrière plusieurs instances
en production. Recommandation de production documentée : Redis/KV partagé (ex. Upstash),
non installé dans ce sprint.

## 6. Journal d'audit

`AuditLog` (table Prisma) enregistre : `USER_CREATED`, `ROLE_ASSIGNED`,
`SUPERVISOR_VERIFIED`, `RESEARCH_CREATED`, `SUBMISSION_CREATED`, `FEEDBACK_CREATED`,
`CORRECTION_UPDATED`, `EXPORT_CREATED`, `LOGIN_FAILED`, `ACCESS_DENIED`. Jamais de mot de
passe, clé API, ou contenu intégral d'un document scientifique dans les métadonnées
journalisées.

## 7. Gestion des erreurs

Les routes API ne renvoient jamais de trace d'erreur interne au client. Réponse
structurée uniforme :

```json
{ "success": false, "error": { "code": "...", "message": "..." } }
```

Le détail technique est journalisé côté serveur uniquement (console structurée).

## 8. Ce qui reste à faire pour une vraie production (documenté, non fait ici)

- CSP stricte, auditée composant par composant.
- Rate limiting distribué (Redis/KV).
- Vérification institutionnelle réelle du rôle directeur.
- Chiffrement au repos de la base de données (dépend du fournisseur managé choisi).
- Test d'intrusion externe.
