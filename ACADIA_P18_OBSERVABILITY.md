# ACADIA — Observabilité (P18, Partie 8)

Statut par catégorie, sans invention d'un service externe non disponible.

## Journal d'audit applicatif — 🟡 PARTIEL

Table `AuditLog` (Prisma) + `lib/server/audit/AuditLog.ts`, `logAudit()` jamais bloquant
(try/catch interne). Événements câblés après ce sprint : `USER_CREATED`, `LOGIN_FAILED`,
`SUBMISSION_CREATED`, `FEEDBACK_CREATED`, `ROLE_ASSIGNED`, `CORRECTION_UPDATED`,
`ACCESS_DENIED` (générique via `forbidden()`). Non câblé : `EXPORT_CREATED` (voir
`ACADIA_P18_AUDIT.md` §7 pour la justification — routes d'export stateless et non
authentifiées, hors périmètre de ce sprint), `DOCUMENT_UPLOADED`/`DOCUMENT_DELETED`
(non applicables tant que `DocumentStorageProvider` n'est câblé à aucune fonctionnalité
réelle). Consultable uniquement via requête SQL directe — aucune interface
d'administration pour le lire.

## Journal des emails — ✅ FONCTIONNEL (pour ce qu'il est)

Table `EmailLog` : chaque tentative d'envoi journalisée avec `status: "not_configured"`.
Fiable pour vérifier qu'aucun envoi silencieux n'a échoué sans trace — mais ne journalise
qu'un statut fixe puisqu'aucun fournisseur réel n'existe.

## Logs applicatifs (console) — 🔴 NON STRUCTURÉ

`console.error`/`console.warn` utilisés ponctuellement (une douzaine de fichiers) sans
format structuré, sans niveau configurable, sans agrégation. En développement local, ces
logs ne sont visibles que dans le terminal du serveur Next.js — perdus au redémarrage.
Aucun mécanisme ne les centralise.

## Monitoring / APM externe — ⚪ NON CONFIGURÉ

Aucun SDK Sentry, Datadog, New Relic, Logtail, Axiom ou équivalent n'est installé
(vérifié dans `package.json` et par recherche dans le code source). Aucune variable
d'environnement associée n'existe. Ce n'est pas un oubli caché : c'est un choix qui
reste à faire par l'équipe/l'institution avant une mise en production réelle — un tel
service ne peut pas être ajouté de façon crédible sans compte réel et clé API fournis.

## Pages d'erreur applicatives — ✅ CORRIGÉ DANS CE SPRINT

**Gap réel identifié** : avant ce sprint, l'application n'avait aucune page
`app/error.tsx`, `app/global-error.tsx` ni `app/not-found.tsx` — une erreur non
interceptée dans un composant serveur ou une route inexistante retombait sur la page
d'erreur générique de Next.js (peu informative, sans branding, sans action de
récupération). Trois fichiers ajoutés dans ce sprint (correction d'état d'erreur, pas une
refonte visuelle — cohérent avec la règle du sprint) :

- `app/not-found.tsx` — 404 avec lien de retour au tableau de bord.
- `app/error.tsx` — limite d'erreur de segment de route, avec bouton « Réessayer » et
  journalisation `console.error` (aucune perte de données, l'utilisateur peut relancer
  sans recharger toute l'application).
- `app/global-error.tsx` — filet de sécurité racine (styles inline, car ce fichier
  s'exécute même si le rendu de `app/layout.tsx` lui-même échoue).

## Uptime / alerte externe — ⚪ NON CONFIGURÉ

Aucun service de supervision d'uptime (UptimeRobot, Better Uptime, Pingdom...) n'est
configuré — cohérent avec l'absence de tout déploiement de staging/production réel (voir
`ACADIA_P17_DEPLOYMENT.md`, inchangé).

## Résumé

| Catégorie | Statut |
|---|---|
| Journal d'audit applicatif | 🟡 Partiel (gaps fermés sauf EXPORT_CREATED, justifié) |
| Journal des emails | ✅ Fonctionnel pour son périmètre (not_configured) |
| Logs console | 🔴 Non structuré, non centralisé |
| Monitoring/APM externe | ⚪ Non configuré (service non disponible) |
| Pages d'erreur applicatives | ✅ Corrigé dans ce sprint |
| Uptime/alerte externe | ⚪ Non configuré (aucun déploiement réel) |

Aucune de ces lacunes n'est cachée : chacune est soit corrigée dans ce sprint (pages
d'erreur), soit documentée comme dépendant d'un service externe non disponible dans cet
environnement (monitoring, uptime), conformément à la règle anti-hallucination du sprint.
