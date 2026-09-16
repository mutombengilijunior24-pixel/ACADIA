# ACADIA — Payment Engine

Documentation du moteur de paiement pay-as-you-progress (mission Payment Engine,
14/09/2026). Complète l'audit `Mission 1` — ne le répète pas.

## Architecture

```
PaymentProvider (interface)
        ↓
PaymentService          — orchestration (initiation, règlement webhook)
        ↓
PaymentRepository       — accès Prisma Payment centralisé
        ↓
EntitlementService      — source métier des entitlements (inchangée)
```

Le domaine métier ne dépend jamais d'un provider concret : `PaymentProviderFactory.getPaymentProvider()`
est le SEUL endroit qui lit `PAYMENT_MODE`/`MOBILE_MONEY_PROVIDER`.

Fichiers :
- `lib/server/billing/payment/PaymentStatus.ts` — statuts canoniques (`pending|processing|succeeded|failed|cancelled|expired`).
- `lib/server/billing/payment/PaymentProvider.ts` — contrat provider-agnostique.
- `lib/server/billing/payment/MockPaymentProvider.ts` — simulateur, sans état process partagé.
- `lib/server/billing/payment/{OrangeMoney,AirtelMoney,CinetPay}Provider.ts` — adapters placeholder, échouent explicitement (`ProviderNotConfiguredError`).
- `lib/server/billing/payment/PaymentProviderFactory.ts` — résolution centralisée.
- `lib/server/billing/payment/PaymentRepository.ts` — accès `prisma.payment.*`.
- `lib/server/billing/payment/PaymentService.ts` — `initiateRealCheckout`, `settleFromWebhook`, `verifyPendingPayment`.
- `lib/server/billing/EntitlementService.ts` — inchangé dans son rôle, ajoute `grantEntitlementForPayment` (unique créateur d'`Entitlement`).
- `app/api/webhooks/payments/[provider]/route.ts` — réception webhook.

## Mode bêta (inchangé)

`PricingConfig.isBetaMode()` reste l'unique bascule. En bêta, `EntitlementService.checkout()`
accorde l'entitlement immédiatement (`provider="beta_free"`), exactement comme avant cette
mission — comportement non modifié et re-testé (voir Tests).

## Mode réel (hors bêta)

`checkout()` délègue à `PaymentService.initiateRealCheckout()` :
1. Crée un `Payment` (`status="pending"`) via `PaymentRepository`.
2. Appelle `provider.initiate()` — **jamais dans une transaction DB ouverte**.
3. Met à jour le `Payment` avec le statut/`providerRef` retournés.
4. Ne crée **jamais** d'entitlement à cette étape.

## MockPaymentProvider

Simule les 6 statuts sans état process partagé : le résultat final voulu est encodé dans
`providerRef` (`mock_<statut>_<uuid>`) à l'initiation, relu par `verify()`/`parseWebhookPayload()`.
Le code métier ne sait jamais qu'il parle au Mock — aucun `if(mock)` dans `PaymentService`/`EntitlementService`.

Pour simuler un webhook signé en test :
```ts
import { createHmac } from "node:crypto";
const secret = process.env.MOCK_PAYMENT_WEBHOOK_SECRET || "acadia-mock-payment-dev-secret";
const body = JSON.stringify({ providerEventId, providerRef });
const signature = createHmac("sha256", secret).update(body).digest("hex");
// POST /api/webhooks/payments/mock, header x-mock-signature: signature, body: body
```

## Webhook

`POST /api/webhooks/payments/[provider]` — **aucune session utilisateur** (`getSessionUser`
n'est jamais utilisé ici). Authenticité vérifiée par `provider.verifyWebhookSignature(rawBody, headers)`.

Ordre de traitement :
1. Provider connu ? (`isKnownPaymentProviderName`) sinon 404.
2. Corps brut lu, signature vérifiée — sinon 401 (provider non configuré = 401 aussi, jamais un succès silencieux).
3. Payload normalisé (`parseWebhookPayload`) — sinon 400.
4. `WebhookEvent` créé (hors transaction — voir "Idempotence" ci-dessous) — si la contrainte
   unique `(provider, providerEventId)` est violée, retour 200 immédiat sans retraiter.
5. `Payment` retrouvé via `providerRef` ; introuvable → `WebhookEvent.status="failed"`, 200 quand même
   (un retry du provider ne résoudra jamais une référence inexistante).
6. Transaction courte : `settleFromWebhook` (met à jour `Payment`, accorde l'entitlement si `succeeded`
   via `grantEntitlementForPayment`), puis `WebhookEvent.status="processed"`.
7. `ProductEvents`/`AuditLog` hors transaction (best-effort, jamais bloquant).
8. Réponse 200.

## Idempotence

Deux mécanismes distincts, jamais confondus :
- **Checkout** (client) : `Payment.idempotencyKey` (unique) — un double clic/retry réutilise le même `Payment`.
- **Webhook** (provider) : `WebhookEvent(provider, providerEventId)` (unique) — un webhook rejoué
  1, 2 ou 10 fois ne déclenche qu'un octroi.

**Point d'implémentation critique** : la création du `WebhookEvent` se fait **en dehors** de toute
transaction plus large. Un `INSERT` qui viole une contrainte unique à l'intérieur d'une transaction
Postgres avorte le reste de cette transaction (même si l'exception JS est interceptée) — l'isoler
évite qu'un doublon légitime ne fasse échouer le `COMMIT` d'un traitement par ailleurs valide.
Bug réel constaté et corrigé pendant les tests de cette mission (voir rapport, Tests).

## Sécurité

- Le client ne transmet jamais `amount`/`currency`/`status` — le serveur les détermine seuls
  (`PricingConfig`, `PaymentProvider`).
- Ownership du projet vérifié avant tout checkout (route `billing/checkout`, inchangé).
- Aucun PIN, aucun secret, aucun payload brut complet n'est journalisé — seul `rawPayloadHash`
  (sha256) est conservé sur `WebhookEvent`.

## Configuration (`.env.example`)

```
PAYMENT_MODE=mock            # "mock" (défaut) | "live"
MOBILE_MONEY_PROVIDER=       # requis si PAYMENT_MODE=live : orange_money | airtel_money | cinetpay
MOCK_PAYMENT_WEBHOOK_SECRET= # dev uniquement, jamais un secret de provider réel
```

## Brancher Orange Money (quand la documentation officielle sera disponible)

1. Implémenter réellement `lib/server/billing/payment/OrangeMoneyProvider.ts` (`initiate`,
   `verify`, `verifyWebhookSignature`, `parseWebhookPayload`) à partir de la spec officielle —
   ne rien y ajouter qui ne soit pas documenté par Orange.
2. Renseigner `ORANGE_MONEY_API_URL`/`_API_KEY`/`_SECRET`/`_MERCHANT_ID` (noms réservés dans
   `.env.example`, valeurs réelles UNIQUEMENT dans `.env.local`/Vercel, jamais committées).
3. `PAYMENT_MODE=live`, `MOBILE_MONEY_PROVIDER=orange_money`.
4. Aucun changement requis dans `EntitlementService`, `PaymentService`, la route webhook ou le
   catalogue de prix — c'est tout l'intérêt de l'abstraction `PaymentProvider`.

## Brancher Airtel Money

Même procédure, `lib/server/billing/payment/AirtelMoneyProvider.ts` + variables `AIRTEL_MONEY_*`.

## Limitations connues

- Le montant reste en USD (`PricingConfig`) — la conversion CDF, si nécessaire commercialement,
  n'est pas traitée ici (décision humaine).
- Aucun mécanisme de remboursement/révocation automatique (voir audit Mission 1, §Q).
- Pas de polling automatique périodique des paiements `pending` — `verifyPendingPayment()` existe
  mais n'est appelée par aucune route planifiée aujourd'hui (à brancher si le webhook ne suffit pas).
