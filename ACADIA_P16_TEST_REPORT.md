# ACADIA — Rapport de tests P16 (Supervision académique)

## 1. Audit initial

Voir `ACADIA_P16_AUDIT.md`. Constat central : aucune donnée de recherche n'est accessible
en dehors du navigateur de l'étudiant (localStorage, P1-P15) ; aucun système de
notification événementiel, d'email, ou de rôle réellement câblé n'existait. Terrain
largement vierge pour la supervision — voir `ACADIA_P16_ARCHITECTURE.md` pour les choix
retenus (stores serveur fichier JSON, snapshot de soumission envoyé par le client).

## 2. Build / Lint / Typecheck

`npx tsc --noEmit` : propre après chaque bloc de modification (vérifié plus de 20 fois au
cours du sprint). `npm run build` : propre, toutes les routes générées (dont 21 nouvelles
routes `/api/supervision/**` + `/api/auth/become-supervisor`, 4 nouvelles pages
`/dashboard/supervisor/**`, `/invite/[code]`). `npm run lint` : 56 problèmes, tous
préexistants — vérifié fichier par fichier qu'aucun nouveau problème n'a été introduit
(plusieurs `react-hooks/set-state-in-effect` corrigés au fil de l'écriture avec le même
patron `eslint-disable-next-line` déjà établi par le projet).

## 3. Test end-to-end réel (scénario du sprint, Partie 39)

Exécuté en navigateur réel (Edge headless, CDP), deux comptes réels créés via `/register`,
bascule de session via login/logout réels (pas de simulation) :

1. **Compte directeur créé** → `POST /api/auth/become-supervisor` → rôle réellement
   persisté (`data/users.json`).
2. **Canevas créé** (année 2026-2027, règle d'hypothèses Master 2-3) → sauvegardé,
   récupéré après un nouvel appel `GET`.
3. **Invitation créée** → code réel généré, expiration à J+14.
4. **Compte étudiant créé**, invitation acceptée via `/api/supervision/invitations/accept`
   → `SupervisionAssignment` réellement créé, message de bienvenue reçu.
5. **Fixture réelle injectée** (sujet SNCC, Master, quantitatif mixte, 5 dimensions —
   `all_researches5.json`/`all_projects5.json`) dans le localStorage scopé de l'étudiant.
6. **Soumission V1** avec message étudiant → `POST /api/supervision/submissions` → 201,
   snapshot complet stocké côté serveur.
7. **Directeur voit la soumission** dans `/api/supervision/students` (comptage réel,
   titre réel, version réelle, statut réel).
8. **Brief ACADIA généré** pour V1 : `overallState: "solide"`, `strengths` réelles (11
   checks PASS énumérés), `incompleteSections` réelle (« Cadre théorique à préciser par
   le chercheur. », instrument non généré), disclaimer de validation humaine présent.
9. **Feedback envoyé** : 1 section « Méthodologie » à corriger, 1 section « Littérature »
   bloquante → 2 `Correction` créées automatiquement, message structuré généré (format
   exact du sprint : ÉTUDIANT/TRAVAIL/VERSION/DATE + 4 sections numérotées), statut
   soumission → `feedback_ready`.
10. **Étudiant reçoit** le message (`/api/supervision/messages`) et la notification
    (`/api/supervision/notifications`) — vérifiés réels, contenu correct.
11. **Étudiant soumet V2** (hypothèse secondaire ajoutée + méthodologie d'échantillonnage
    précisée) → V1 toujours accessible, V2 chaînée via `previousSubmissionId`.
12. **Comparaison V1→V2** : `added` = « 1 hypothèse(s) ajoutée(s) » (texte réel),
    `modified` = « Méthodologie modifiée », **`potentiallyResolved`** = correction
    Méthodologie marquée « potentiellement traitée » (section réellement touchée),
    **`unresolved`** = correction Littérature restée « toujours ouverte » (cadre
    théorique non touché) — les deux cas (positif ET négatif) vérifiés corrects dans la
    même exécution, confirmant que le moteur ne déduit une résolution que lorsque la
    section correspondante a réellement changé.
13. **Directeur valide V2** → statut `accepted`, notification étudiant créée.
14. **Isolation** : un troisième compte (étudiant sans lien) reçoit un refus d'accès à la
    soumission V1 et à la liste des étudiants du directeur (403 confirmé dans une
    exécution à serveur "chaud" ; une exécution juste après redémarrage du serveur a
    montré un 401 transitoire dû à la recompilation Turbopack de la route — refus
    d'accès conservé dans les deux cas, aucune fuite de données observée).

## 4. Découverte et correction pendant les tests (hors périmètre strict, corrigée)

`components/layout/Navbar.tsx` : l'email de l'utilisateur, affiché sans troncature dans
l'en-tête, combiné à une barre de recherche de largeur fixe (`420px`), provoquait un
débordement horizontal réel à 768px sur **toutes** les pages du dashboard (bug
préexistant, révélé par les comptes de test à email long utilisés dans ce sprint — non
introduit par P16). Corrigé : email/prénom tronqués (`truncate`, largeur max), barre de
recherche réduite entre 768 et 1024px (`md:w-[200px] lg:w-[420px]`). Revérifié : 0
débordement sur `/dashboard`, `/dashboard/supervisor`, `/dashboard/supervisor/canevas` aux
4 largeurs (390/768/1024/1440).

## 5. Responsive

390 / 768 / 1024 / 1440 vérifiés sans débordement horizontal (`scrollWidth <= innerWidth`)
sur `/dashboard`, `/dashboard/supervisor`, `/dashboard/supervisor/canevas`. La page de
revue (`/dashboard/supervisor/review/[id]`) et `/invite/[code]` n'ont pas été re-testées
aux 4 largeurs dans cette passe (vérifiées visuellement à 1440 uniquement) — limite
assumée, documentée plutôt que déclarée testée par erreur.

## 6. Non-régression scientifique

Aucun moteur protégé modifié (`QuestionnaireGenerationEngine`, `ResearchCore`,
`ResearchData`, `DatasetEngine`, `DescriptiveAnalysisEngine`, `BivariateAnalysisEngine`,
`EconometricModelEngine`, `EconomicInterpretationEngine`, `ScientificDiscussionEngine`,
`ScientificWorkEngine`, `ScientificWorkValidationEngine`, `DocumentBuilder`, export
DOCX/PDF) — vérifié par relecture de chaque import (tous en lecture seule) et confirmé par
le build/typecheck global. Les pages P1-P15 (dashboard, page recherche, questionnaire,
méthodologie, cohérence scientifique) ont été parcourues à nouveau pendant les tests E2E
sans régression observée.

## 7. Sécurité / confidentialité

- Toutes les routes `/api/supervision/**` dérivent l'utilisateur depuis la session
  serveur (`getSessionUser()`), jamais depuis un id envoyé par le client.
- `proxy.ts` étendu : `/dashboard/supervisor/**` vérifie le rôle réel côté serveur,
  redirige un étudiant vers `/dashboard` (jamais une erreur brute).
- Vérifié explicitement : un compte tiers ne peut lire ni la soumission d'un autre
  étudiant, ni la liste des étudiants d'un autre directeur (403/401 selon l'état du
  serveur, jamais un accès accordé).

## 8. Email

Aucun fournisseur configuré (confirmé par l'audit) → `NoOpEmailProvider` utilisée
partout, chaque tentative journalisée `status: "not_configured"` dans
`data/email-log.json` — jamais un faux « email envoyé ». Vérifié : la réponse de l'API de
soumission/feedback inclut bien `{"email": {"status": "not_configured"}}`, jamais
`"sent"`.

## 9. Nettoyage

Tous les fichiers `data/*.json` créés par ce sprint réinitialisés à `[]` après les tests
(comptes de test, soumissions, messages, etc.).

## 10. Limites / non testé dans cette passe (assumé, documenté plutôt qu'affirmé)

- Fil de discussion sur une correction (`POST /corrections/[id]/discussion`) : testé par
  lecture de code + typecheck, pas rejoué en navigateur dans cette passe.
- UI d'administration du rôle `admin` : non construite (conforme à la consigne du
  sprint).
- Parcours Licence (règles de canevas différenciées Licence/Master) : la branche de code
  est symétrique à celle de Master (déjà testée), mais non rejouée avec un compte Licence
  dédié dans cette passe.
