# ACADIA — Rapport final P18-FINAL

Légende exacte demandée : 🟢 CONNECTÉ · 🟢 TESTÉ · 🟡 CONFIGURATION MANUELLE RESTANTE ·
🔴 BLOQUANT.

| Service | Statut |
|---|---|
| PostgreSQL | 🔴 BLOQUANT — aucune instance accessible, aucun compte disponible. Runbook prêt : `ACADIA_P18_POSTGRES_RUNBOOK.md`. |
| Storage (Cloudflare R2) | 🟡 CONFIGURATION MANUELLE RESTANTE — code réel écrit et compilé (`R2DocumentStorageProvider.ts`), jamais exécuté contre un vrai bucket (aucun compte). Voir `ACADIA_STORAGE_SETUP.md`. |
| Email (Resend) | 🟡 CONFIGURATION MANUELLE RESTANTE — code réel écrit et compilé (`ResendEmailProvider.ts`), jamais exécuté contre l'API réelle (aucun compte/clé). Voir `ACADIA_EMAIL_SETUP.md`. |
| Domain | 🔴 BLOQUANT — aucun domaine possédé. Voir `ACADIA_DOMAIN_SETUP.md`. |
| HTTPS | ⚪ Non applicable sans domaine — géré automatiquement par la plupart des hébergeurs une fois un domaine pointé. |
| OpenAI | 🟢 CONNECTÉ, 🟢 TESTÉ — clé réelle configurée, pipeline A0→A2 rejoué avec succès en P18 (appels réels). |
| Monitoring (Sentry) | 🟡 CONFIGURATION MANUELLE RESTANTE — SDK installé, `instrumentation.ts`/`instrumentation-client.ts` écrits et actifs uniquement si `SENTRY_DSN` est fourni ; aucun compte disponible pour tester réellement. Voir `ACADIA_MONITORING_SETUP.md`. |
| Backups | 🟡 CONFIGURATION MANUELLE RESTANTE — mécanisme prouvé sur SQLite (cycle backup→perte→restauration réel), service managé PostgreSQL non disponible. Voir `ACADIA_P18_BACKUP_RUNBOOK.md`. |
| Rate limiting | 🟢 CONNECTÉ, 🟢 TESTÉ pour un seul processus (mémoire process) — 🔴 BLOQUANT pour une version distribuée multi-instance (nécessite un KV managé, non introduit sans besoin réel démontré). |
| Deployment | 🔴 BLOQUANT — aucun déploiement réel exécuté (aucun hébergeur choisi/configuré). Voir `ACADIA_ENVIRONMENT_MATRIX.md` pour ce qui est prêt à être déployé dès qu'un hébergeur est choisi. |

## Ce qui a été réellement accompli ce sprint (au-delà du tableau ci-dessus)

1. **Audit complet sans rien supposer** (`ACADIA_P18_FINAL_INFRA_AUDIT.md`) — a révélé
   deux points non documentés jusqu'ici : (a) la collecte de réponses de questionnaire
   publique repose entièrement sur le `localStorage` du navigateur du chercheur et ne
   fonctionne donc jamais pour un vrai répondant sur un autre appareil (gap réel, hors
   périmètre de ce sprint — décision du propriétaire requise avant d'être traité) ; (b)
   un fichier `questionnaire-responses.json` hérité, non gitignoré, contenant des
   données de test — corrigé (ajouté au `.gitignore`).
2. **Bug PDF corrigé (gestion propre), cause racine identifiée et documentée** — voir
   détail ci-dessous.
3. **Bug réel trouvé et corrigé dans `RevisionComparisonEngine`** : la comparaison de
   versions plantait (500) dès qu'un projet ne comportait pas encore
   `objectives`/`hypotheses`/`variables` sous forme de tableaux — corrigé par une
   protection défensive (`?? []`), cohérente avec le style déjà utilisé ailleurs dans le
   même moteur pour la méthodologie. Reproduit, corrigé, re-testé avec succès.
4. **Code réel préparé pour 3 services externes** (Resend email, Cloudflare R2 storage,
   Sentry monitoring) derrière les interfaces déjà existantes, activable sans aucun
   changement de code le jour où les comptes sont créés — 0 nouvelle vulnérabilité
   introduite par ces 3 nouvelles dépendances (confirmé par `npm audit`, les 6
   vulnérabilités « high » existantes proviennent de `prisma`/`next` et préexistaient).
5. **Sécurité re-testée en conditions réelles** (4/4 scénarios) : session absente/
   corrompue, rôle croisé STUDENT↔SUPERVISOR — tous conformes.
6. **Test E2E complet réel** (12/12 scénarios) : inscription des deux rôles → invitation
   → acceptation → soumission V1 → isolation d'un étudiant tiers → feedback structuré
   → correction générée → discussion → soumission V2 → comparaison V1/V2 → validation.
   Aucune étape simulée ou sautée.
7. `tsc`/`lint`/`build` : 0 erreur, 56 problèmes de lint (identique au baseline, aucune
   régression), build de production réussi.

## Détail du bug PDF (Partie 13)

**Cause racine identifiée avec certitude** (bissection méthodique, plusieurs
hypothèses testées et éliminées une à une — police système, pied de page dynamique,
`wrap: false` — aucune ne corrige le problème) : `@react-pdf/renderer@4.8.1` (dernière
version disponible) produit un nombre flottant invalide
(`unsupported number: -1.9695...e+21`) lors du rendu d'un document contenant
**environ 18 blocs ou plus de type tableau/figure combinés**, indépendamment de leur
contenu individuel (confirmé avec des tableaux dupliqués identiques) — une limite
numérique interne du moteur de mise en page tiers (pdfkit/Yoga), pas un défaut du
`DocumentModel` d'ACADIA ni de son contenu.

**Correction appliquée** : gestion d'erreur propre autour de `renderToBuffer` (déjà
absente auparavant — une exception y provoquait un crash 500 sans aucun message
exploitable). Le client reçoit désormais un message clair invitant à utiliser l'export
DOCX (qui, lui, réussit de façon fiable sur exactement le même contenu volumineux,
confirmé par test réel) plutôt que d'échouer silencieusement ou de planter sans
explication. `components/research/export/ExportOverview.tsx` affiche maintenant ce
message réel au lieu d'un texte générique.

**Ce qui N'A PAS été fait** : remplacer ou contourner structurellement le moteur de
rendu PDF (ex. pagination manuelle des tableaux, moteur de rendu alternatif) — cela
constituerait une refonte d'architecture d'export à part entière, hors de portée sûre
pour ce sprint, et nécessiterait une décision explicite du propriétaire avant d'être
entreprise. **Le PDF reste donc non fiable au-delà d'environ 17 tableaux/figures
combinés** — un mémoire quantitatif avec un questionnaire riche (15-20 questions ou
plus) peut atteindre ce seuil. Le DOCX reste l'export recommandé pour ces cas en
attendant une refonte dédiée.

## P18 STATUS

**READY_FOR_STAGING**

Justification : tous les éléments applicatifs testables sans service externe sont
désormais solides et vérifiés (sécurité, autorisation, isolation, pipeline
scientifique, flux de supervision complet, export DOCX fiable, gestion d'erreur
propre). Cependant, **READY_FOR_PRIVATE_BETA n'est pas atteint** car : (a) aucune base
de données réellement gérée n'existe (PostgreSQL toujours bloqué), (b) l'export PDF
reste non fiable au-delà d'un seuil de contenu qu'un projet réel dépasse facilement,
et (c) aucun des services externes préparés ce sprint (email, stockage, monitoring)
n'est réellement activé — seul le code est prêt.

## Interdictions respectées

Aucun service externe n'a été inventé ou simulé comme connecté. Aucun email n'a été
présenté comme envoyé. Aucun backup managé n'a été présenté comme configuré. Aucun
domaine n'a été inventé. Aucun PostgreSQL n'a été simulé. Aucun secret n'a été commis
dans le dépôt (nouveau : `questionnaire-responses.json` ajouté au `.gitignore`). Seule
la couche export PDF a été modifiée parmi les moteurs protégés, dans les limites
explicitement autorisées par ce sprint (gestion d'erreur, pas de logique scientifique
touchée). Aucun P19 n'a été commencé.

---

STOP.
NE PAS COMMENCER P19.
