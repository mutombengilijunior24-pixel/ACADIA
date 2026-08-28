# ACADIA — Configuration email réelle : Resend (P18-FINAL)

## Statut

**Code prêt (`lib/email/ResendEmailProvider.ts`), non activé.** Aucun compte Resend
disponible dans cet environnement. `NoOpEmailProvider` reste actif tant que
`EMAIL_PROVIDER`/`EMAIL_API_KEY`/`EMAIL_FROM` ne sont pas fournis.

## Ce qui a été préparé dans ce sprint

- `lib/email/ResendEmailProvider.ts` : implémentation réelle de l'interface
  `EmailProvider` via le SDK officiel `resend`. Distingue toujours `sent`/`failed` selon
  la réponse réelle de l'API — ne renvoie jamais `sent` sans confirmation explicite.
  Chaque tentative reste journalisée dans `EmailLog` (même comportement que
  `NoOpEmailProvider`).
- `resolveProvider()` dans `EmailProvider.ts` bascule vers Resend uniquement si
  `EMAIL_PROVIDER="resend"` **et** `EMAIL_API_KEY`/`EMAIL_FROM` sont tous deux présents ;
  sinon repli sur `NoOpEmailProvider` avec avertissement serveur explicite.

## Étape à faire par le propriétaire du projet

1. Créer un compte sur https://resend.com. **Coût** : plan gratuit jusqu'à 3 000 emails/
   mois (100/jour) — largement suffisant pour un premier staging académique ; plans
   payants au-delà (~20$/mois pour 50 000/mois).
2. Vérifier un domaine d'envoi (Resend → Domains → Add Domain) — voir
   `ACADIA_DOMAIN_SETUP.md` pour les enregistrements DNS SPF/DKIM/DMARC exacts requis
   par Resend une fois le domaine choisi. **Sans domaine vérifié, Resend n'autorise
   d'envoyer que vers l'adresse email du compte lui-même** (mode test) — insuffisant
   pour de vrais utilisateurs.
3. Créer une clé API (Resend → API Keys).

## Variables à renseigner (jamais commitées)

```
EMAIL_PROVIDER="resend"
EMAIL_API_KEY="re_..."
EMAIL_FROM="ACADIA <noreply@votre-domaine-verifie.com>"
EMAIL_REPLY_TO="contact@votre-domaine-verifie.com"
```

## Emails déjà câblés dans le code (activés automatiquement dès que Resend est configuré)

`sendVerificationEmail`, `sendPasswordResetEmail`, `sendSubmissionNotification`,
`sendFeedbackNotification`, `sendRevisionNotification`, `sendSupervisorInvitation`
(`lib/email/EmailProvider.ts`) — tous déjà appelés depuis les routes métier
correspondantes (inscription, mot de passe oublié, soumission, feedback, invitation).
Aucun nouveau point d'appel n'a été ajouté ce sprint : le câblage applicatif existait
déjà depuis P16, seul le fournisseur réel manquait.

## Test à effectuer une fois configuré

1. Déclencher chaque type d'email via le flux réel (ex. « mot de passe oublié ») et
   vérifier la réception réelle dans une boîte de test.
2. Vérifier `EmailLog` : statut `sent` (pas seulement `not_configured`).
3. Tester un échec volontaire (adresse invalide) → statut `failed` avec message d'erreur
   exploitable, jamais une fausse confirmation d'envoi.

## Rappel important

Tant que ce fournisseur n'est pas activé, le produit continue d'afficher honnêtement
« email non configuré » côté client (correction apportée en P18, voir
`ACADIA_P18_EMAIL_STATUS.md`) — jamais un faux message de succès.
