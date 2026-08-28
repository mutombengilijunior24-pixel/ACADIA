# ACADIA — Domaine professionnel (P18-FINAL)

## Statut

**Non configuré.** Aucun domaine n'est possédé pour ACADIA dans cet environnement.
Aucune valeur de domaine n'a été codée en dur nulle part dans le code — l'application
utilise déjà exclusivement `process.env.NEXT_PUBLIC_APP_URL` (voir
`lib/email/EmailProvider.ts`, `appUrl()`), jamais une chaîne fixe.

## Étape à faire par le propriétaire du projet

1. Acheter un domaine (recommandé : Cloudflare Registrar — tarif au prix coûtant, pas
   de majoration ; ex. `~10-15$/an` pour un `.com`, variable selon le TLD choisi).
2. Configurer Cloudflare DNS pour ce domaine (gratuit).
3. Choisir la structure de sous-domaines :
   - `app.<domaine>` → application Next.js (staging puis production).
   - `api.<domaine>` → optionnel, si un jour une API publique séparée est nécessaire (non
     requis actuellement, l'application sert déjà ses propres routes API en same-origin).
   - `<domaine>` ou `mail.<domaine>` → domaine d'envoi email (voir `ACADIA_EMAIL_SETUP.md`).

## Enregistrements DNS à créer (une fois le domaine et l'hébergeur choisis)

| Type | Nom | Valeur | Usage |
|---|---|---|---|
| A / CNAME | `app` | fourni par l'hébergeur (Vercel/autre) | Application |
| TXT | `@` ou sous-domaine dédié | fourni par Resend lors de la vérification de domaine | SPF |
| CNAME | fourni par Resend (2-3 enregistrements) | fourni par Resend | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<adresse de supervision>` (à durcir en `p=quarantine` puis `p=reject` progressivement une fois les emails validés) | DMARC |

**Ne jamais déclarer ces enregistrements actifs avant qu'ils soient réellement créés et
propagés** (vérifiable via `dig TXT <domaine>` ou un outil DNS en ligne).

## Checklist

| Élément | Statut |
|---|---|
| Domaine acheté | 🔴 NON |
| DNS configuré | 🔴 NON (dépend du domaine) |
| SSL/HTTPS | ⚪ Géré automatiquement par la plupart des hébergeurs modernes une fois le domaine pointé — non applicable sans domaine |
| Canonical URL (`NEXT_PUBLIC_APP_URL`) | ✅ Déjà paramétrable, jamais codé en dur |
| Cookies `Secure` | ✅ Déjà conditionnés à `NODE_ENV === "production"` (voir `lib/auth/session.ts`) |
| CORS | ⚪ Non nécessaire actuellement (aucun appel cross-origin du frontend) |
| Redirections HTTP→HTTPS | ⚪ Gérées par l'hébergeur, pas par l'application |
| Callback URLs (invitations, reset password) | ✅ Déjà construites depuis `NEXT_PUBLIC_APP_URL`, jamais en dur |

## Impact sur le verdict

N'empêche pas une bêta privée sur un sous-domaine généré automatiquement par
l'hébergeur (ex. `acadia-staging.vercel.app`) avec HTTPS déjà fourni. Empêche
uniquement une adresse professionnelle propre (`app.acadia.cd` ou équivalent) et un
email d'envoi sous ce domaine.
