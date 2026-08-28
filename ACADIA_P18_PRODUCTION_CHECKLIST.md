# ACADIA — Checklist de production (P18, Partie 20)

Légende : ✅ fait et vérifié réellement · 🟡 partiel · 🔴 bloquant connu · ⚪ non applicable / dépend d'un service externe non disponible.

| Catégorie | Statut | Détail |
|---|---|---|
| **DATABASE** | 🟡 | Prisma + SQLite fonctionnel et testé en développement (18 modèles, 3 migrations réelles appliquées). PostgreSQL de staging/production **non provisionné** — voir `ACADIA_P18_POSTGRES_BLOCKER.md`. Aucune donnée fictive dans le schéma. |
| **AUTH** | ✅ | bcrypt + session HMAC signée, testé réellement : cookie absent (401), cookie corrompu (401), cookie vide (401), inscription/connexion réelles pour 6 comptes de test cette session. |
| **AUTORISATION** | ✅ | Matrice STUDENT×SUPERVISOR testée en conditions réelles contre le serveur : 20/20 scénarios passés (rôles croisés, ids forgés, tiers non affecté, directeur non affecté). ADMIN : rôle présent dans le type système mais **aucune fonctionnalité implémentée** — rien à tester. |
| **EMAIL** | 🟡 | `NoOpEmailProvider` seul fournisseur actif, chaque tentative journalisée `not_configured`. Corrigé ce sprint : le client affiche désormais explicitement l'absence d'envoi (soumission, feedback) au lieu de rester silencieux. Aucun fournisseur réel disponible. |
| **STOCKAGE** | 🟡 | `LocalDevDocumentStorageProvider` existe (interface P17) mais **n'est câblé à aucune fonctionnalité réelle** — non testé de bout en bout dans ce sprint faute d'appelant. Aucun stockage cloud configuré. |
| **SAUVEGARDES** | 🔴 | Aucun service de sauvegarde réel — confirmé inchangé depuis P17 (voir `ACADIA_P18_BACKUP_STATUS.md`). Bloquant pour une échelle de production, pas pour une bêta privée à très petite échelle. |
| **RATE LIMITING** | ✅ | Complété et testé réellement ce sprint : login/register (préexistant), forgot-password (5/15min), reset-password (10/15min), invitations (20/h), invitations/accept (15/10min), submissions (10/10min). 429 déclenché et vérifié en conditions réelles sur forgot-password. |
| **JOURNAL D'AUDIT** | 🟡 | `USER_CREATED`, `LOGIN_FAILED`, `SUBMISSION_CREATED`, `FEEDBACK_CREATED`, `ROLE_ASSIGNED`, `CORRECTION_UPDATED`, `ACCESS_DENIED` câblés et vérifiés par requête directe en base (entrées réelles observées). `EXPORT_CREATED` volontairement non câblé (routes d'export stateless et non authentifiées — voir `ACADIA_P18_AUDIT.md` §7). Pas d'interface d'administration pour consulter ce journal. |
| **OBSERVABILITÉ** | 🟡 | Voir `ACADIA_P18_OBSERVABILITY.md`. Pages d'erreur (`error.tsx`, `global-error.tsx`, `not-found.tsx`) ajoutées ce sprint. Aucun APM/monitoring externe (non disponible). |
| **DOMAINE / HTTPS** | ⚪ | Aucun domaine possédé — voir `ACADIA_P18_DOMAIN_STATUS.md`. Non applicable tant qu'aucun hébergement réel n'est choisi. |
| **VARIABLES D'ENVIRONNEMENT** | ✅ | Balayage serveur (P17) et balayage spécifique bundle client (P18) : aucun secret exposé, un seul `NEXT_PUBLIC_*` utilisé et non sensible. |
| **OPENAI / IA** | ✅ | `OPENAI_API_KEY` réellement configurée et utilisée par les moteurs A0-A2 (préexistant, non modifié ce sprint — moteur protégé). |
| **DOCUMENTS (upload utilisateur)** | ⚪ | Aucune fonctionnalité produit n'utilise l'upload de document réel aujourd'hui — rien à tester. |
| **MIGRATIONS** | ✅ | 3 migrations réelles appliquées (`init`, `fix_assignment_constraint`, `add_submission_version_unique_constraint` — cette dernière ajoutée ce sprint suite à un bug de concurrence réel, voir Partie 11 du rapport de test). |
| **PIPELINE SCIENTIFIQUE** | ⚪ NON TESTÉ CE SPRINT | Aucune régression complète A0→export rejouée dans cette session (portée non couverte faute de temps) — voir `ACADIA_P18_TEST_REPORT.md` §13. Aucune modification n'a été apportée aux moteurs protégés. |
| **SUPERVISION** | 🟡 | Flux invitation→acceptation→soumission→validation testé réellement (auth matrix + test de concurrence). Flux complet feedback structuré→correction→V2→comparaison **non rejoué de bout en bout avec UI** ce sprint. |
| **EXPORT DOCX/PDF** | ⚪ NON TESTÉ CE SPRINT | Non re-testé sur une recherche persistée en base réelle dans cette session. |
| **RESPONSIVE** | ⚪ NON TESTÉ CE SPRINT | Aucun test de rendu à 390/768/1024/1440px effectué (nécessite un test navigateur non réalisé dans cette session). |
| **PERFORMANCE** | ⚪ NON TESTÉ FORMELLEMENT | Aucune mesure chronométrée formelle ; le build de production et les appels API testés ont répondu sans lenteur perceptible, mais ce n'est pas un audit de performance. |

## Nouveau bloquant découvert et corrigé pendant ce sprint

**Bug de concurrence réel** : deux soumissions simultanées du même étudiant pouvaient
recevoir le même numéro de version (`SubmissionStore.createSubmission()` faisait une
lecture puis une écriture non atomiques). Reproduit avec 5 requêtes parallèles réelles
(5× version 1 au lieu de 1-2-3-4-5), corrigé par une contrainte unique en base
(`@@unique([researchId, studentId, version])`, migration appliquée) et une relecture
automatique en cas de conflit (`P2002`), puis re-testé avec succès (5 requêtes
parallèles → versions 1,2,3,4,5 correctes). Détail complet dans
`ACADIA_P18_TEST_REPORT.md` §11.
