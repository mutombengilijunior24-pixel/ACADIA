# ACADIA — Architecture Email (P16)

## État réel au moment de la rédaction

**Aucun domaine n'est acheté ou configuré. Aucun fournisseur d'email transactionnel n'est
branché. Aucun enregistrement DNS (SPF/DKIM/DMARC) n'existe.** Ce document décrit l'architecture
prévue pour le jour où ces éléments existeront réellement — il ne prétend à aucun moment qu'ils
sont opérationnels aujourd'hui.

## Abstraction logicielle

`lib/email/EmailProvider.ts` définit une interface :

```ts
interface EmailProvider {
  sendEmail(input: EmailInput): Promise<EmailResult>;
}
```

avec des fonctions d'aide typées par cas d'usage (`sendVerificationEmail`,
`sendPasswordResetEmail`, `sendSubmissionNotification`, `sendFeedbackNotification`,
`sendRevisionNotification`, `sendSupervisorInvitation`) qui construisent le sujet/corps puis
délèguent à `sendEmail()`.

L'implémentation actuellement active est `NoOpEmailProvider` : elle n'envoie rien, journalise
la tentative (`EmailLogEntry`, `data/email-log.json`) avec `status: "not_configured"`, et
retourne ce statut à l'appelant. **Aucun code de l'application n'affiche jamais "email envoyé"
si cette implémentation est active** — l'UI affiche explicitement « Email non configuré » (voir
`ACADIA_P16_TEST_REPORT.md`, test H).

Le jour où un fournisseur réel est branché, une nouvelle implémentation (ex.
`ResendEmailProvider`, `SendgridEmailProvider`) remplace `NoOpEmailProvider` derrière la même
interface — aucun appelant n'a besoin de changer.

## Variables d'environnement prévues (déclarées, non renseignées)

Ajoutées à `.env.example` :

```
EMAIL_FROM=
EMAIL_REPLY_TO=
EMAIL_PROVIDER=
EMAIL_API_KEY=
EMAIL_DOMAIN=
```

`EMAIL_API_KEY` ne doit **jamais** être lue côté client — uniquement dans du code serveur
(`route.ts` ou fonctions appelées depuis un Server Component/Route Handler), exactement comme
`OPENAI_API_KEY` aujourd'hui.

## Domaine et sous-domaines (conceptuel, non acheté)

Si un domaine `acadia.app` (exemple, non réservé) était acquis, l'architecture prévue serait :

- `no-reply@acadia.app` — notifications automatiques (soumission, feedback, rappel).
- `support@acadia.app` — support utilisateur.
- `supervision@acadia.app` — communications liées à l'encadrement, éventuel reply-to.

Sous-domaine dédié à l'envoi transactionnel recommandé (pratique standard pour préserver la
réputation du domaine principal), par exemple `mail.acadia.app`.

## SPF / DKIM / DMARC (conceptuel)

- **SPF** : un enregistrement TXT sur le domaine d'envoi autorisant les serveurs du fournisseur
  choisi (ex. `v=spf1 include:_spf.<fournisseur>.com ~all`).
- **DKIM** : une paire de clés générée par le fournisseur, la clé publique publiée en TXT sur un
  sous-domaine dédié (ex. `selector._domainkey.mail.acadia.app`).
- **DMARC** : une politique (`v=DMARC1; p=quarantine; rua=mailto:...`) publiée sur
  `_dmarc.acadia.app`, à démarrer en mode `p=none` (observation) avant `quarantine`/`reject`.

Aucun de ces enregistrements n'est publié aujourd'hui — leur configuration dépend du choix
définitif d'un domaine et d'un fournisseur, hors du périmètre technique de ce sprint.

## Environnements

- **Dev** : `EMAIL_PROVIDER` non défini → `NoOpEmailProvider` toujours utilisée, aucun risque
  d'envoi accidentel pendant le développement.
- **Staging** : recommandé de pointer vers un domaine de test du fournisseur (bac à sable) une
  fois choisi, jamais vers le domaine de production.
- **Production** : seul environnement où un fournisseur réel serait activé, une fois le domaine
  et les enregistrements DNS ci-dessus effectivement en place.

## Ce que ce sprint NE fait PAS

- N'achète aucun nom de domaine.
- Ne configure aucun DNS.
- Ne crée de compte chez aucun fournisseur (Resend, SendGrid, Postmark, etc.).
- N'envoie aucun email réel, en développement comme en test.
