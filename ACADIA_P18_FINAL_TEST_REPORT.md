# ACADIA — Rapport de test P18-FINAL

Légende : **FAIT**, **TESTÉ** (vérifié réellement, preuve reproductible ci-dessous),
**NON TESTÉ**, **NON CONFIGURÉ**, **BLOQUÉ**, **À FAIRE**.

## Blocker 1 — PostgreSQL staging réel

**BLOQUÉ, confirmé à nouveau.** Aucune instance accessible (ni `psql`, ni `docker`,
aucun identifiant dans aucun fichier d'environnement). Voir
`ACADIA_P18_POSTGRES_BLOCKER.md` (inchangé) et `ACADIA_P18_FINAL_AUDIT.md` Constat 1.
Aucune tentative de simulation n'a été faite.

## Blocker 2 — Backup / Restore

**TESTÉ, sur SQLite de développement uniquement (jamais présenté comme un test
PostgreSQL de production).** Procédure réellement exécutée :

1. Création d'une fixture clairement identifiée (`p18test-backup-*`) : 1 utilisateur,
   1 `ResearchProject`, 1 `Notification`, 1 `AuditLog`.
2. Backup réel : copie du fichier `prisma/dev.db` vers un fichier isolé. Vérification
   par une instance Prisma séparée pointée sur la copie : **9 utilisateurs, 1 projet,
   16 notifications, 30 journaux d'audit** retrouvés, y compris la fixture.
3. Simulation de perte : suppression réelle de l'utilisateur fixture dans une copie
   « production simulée » distincte (9 → 8 utilisateurs).
4. Restauration réelle : écrasement de la copie « sinistrée » par la sauvegarde.
   Vérification : **8 → 9 utilisateurs, fixture retrouvée par son email exact.**

Toutes les données de test ont été nettoyées de la base réelle et les fichiers de
sauvegarde temporaires supprimés après le test. **Limite assumée** : ceci prouve que le
mécanisme générique « copier le fichier, le restaurer » fonctionne et préserve
l'intégrité relationnelle SQLite — ce n'est pas un test du plan de sauvegarde
point-in-time d'un fournisseur PostgreSQL managé (Neon/Supabase/RDS), qui reste à
tester le jour où Blocker 1 est levé.

## Blocker 3 — Régression scientifique complète (A0 → export)

**TESTÉ EN CONDITIONS RÉELLES, avec un résultat important trouvé et documenté.**

### Ce qui a été exécuté réellement

Scénario économique réel, non inventé (fixture déjà présente dans le code du projet
depuis plusieurs sprints — SNCC Lubumbashi, gestion, niveau Master) :

1. **`POST /api/ai/research-intelligence`** (vrai point d'entrée production, vrai appel
   OpenAI, aucune donnée simulée) → statut `needs_review`, 2 variables réelles
   opérationnalisées (« Pratiques d'évaluation du personnel », 5 dimensions, 15
   indicateurs ; « Motivation au travail des agents », 4 dimensions, 12 indicateurs),
   1 relation, 1 hypothèse (`status: "proposed"` — **jamais auto-déclarée confirmée**).
2. **Constat réel non fabriqué** : la relation A1→A2 est restée `needs_review` — le nom
   de variable proposé par A1 (« Motivation des agents ») ne correspond pas exactement
   au nom final choisi par A2 (« Motivation au travail des agents »), donc la résolution
   automatique de `to` échoue et le lien reste du texte brut plutôt qu'un id de variable.
   Le moteur se comporte **correctement** ici : il ne force pas un lien incertain (voir
   commentaire `resolveVariableMatch` dans `AIResearchAdapter.ts`) — ce n'est pas un bug
   à corriger, mais une limite de correspondance texte à connaître.
3. **`generateInstrumentFromProject`** (moteur protégé, appelé directement, non
   modifié) → 27 questions réelles, traçabilité variable→dimension→indicateur→question
   intacte à 100 % sur l'échantillon vérifié.
4. **`buildDatasetFromInstrument`** → 27 colonnes, traçabilité identique préservée.
   60 réponses synthétiques ont été injectées comme **matière première brute** (jamais
   comme résultat scientifique) pour donner une variance exploitable aux moteurs
   statistiques réels.
5. **`buildDescriptiveAnalysis`** → 27 variables analysées par le moteur réel.
6. **`buildBivariateAnalysis`** → méthode auto-sélectionnée par le moteur (Spearman),
   ρ = -0,42, p = 0,001, calculé réellement par le moteur, jamais halluciné.
7. **`buildEconometricModel`** → avec plusieurs régresseurs corrélés entre eux (tous les
   indicateurs d'une même variable), le moteur renvoie honnêtement `singular_matrix`
   plutôt que d'inventer un résultat — **comportement correct**. Avec une spécification
   à un seul régresseur principal (choix de spécification légitime), statut `ready`,
   R² = 0,196, équation réelle produite par le moteur.
8. **Interprétations économiques, discussion scientifique, structure du travail
   scientifique, validation (17 critères, tous `pass` sur ce scénario), `DocumentModel`**
   — tous construits par les moteurs réels, sans aucune donnée injectée après ce point.
9. **Test d'obsolescence** : modification du dataset (1 valeur manquante réelle, 1
   valeur invalide réelle) → le modèle économétrique recalculé passe de 60 à 58
   observations valides — confirmation que rien n'est réutilisé silencieusement après
   une modification.

### Résultat trouvé et NON corrigé (bug non sécuritaire dans un moteur protégé)

**`POST /api/export/pdf` échoue (HTTP 500, réponse vide) sur ce `DocumentModel` réel
(24 tableaux, 23 figures), alors que `POST /api/export/docx` réussit sur exactement le
même document (fichier DOCX de 19 271 octets généré avec succès).**

Bissection réelle effectuée : chaque tableau pris individuellement s'exporte sans
erreur ; le nombre total de tableaux n'est pas non plus la seule cause (des ensembles de
18 tableaux pris à d'autres positions réussissent) — la combinaison précise des 18
premiers tableaux échoue spécifiquement. Cause la plus probable : une limite de
complexité/mémoire du moteur de mise en page `@react-pdf/renderer` déclenchée par le
volume cumulé de contenu, pas un défaut d'une donnée précise. **Non corrigé** : il
s'agit d'un bug de fiabilité (pas de sécurité) dans une route du périmètre protégé
(export PDF) — la règle du sprint interdit toute modification d'un moteur protégé sans
bug de sécurité critique démontré. De plus, la route ne renvoie aucun détail d'erreur au
client (le `try/catch` du gestionnaire POST n'entoure pas l'appel à `renderToBuffer`),
ce qui est un second défaut de robustesse à corriger dans un futur sprint dédié.

**Impact produit réel** : un projet avec un questionnaire de taille modeste à moyenne
exporte correctement en PDF (confirmé par les tests d'export antérieurs des sprints
précédents avec moins de colonnes). Un projet avec un nombre important de variables/
indicateurs (donc de tableaux descriptifs, un par colonne du dataset) risque de ne plus
pouvoir exporter en PDF au-delà d'un certain volume — l'export DOCX reste, lui, une
alternative fonctionnelle démontrée sur ce même contenu.

## Blocker 4 — Responsive (390/768/1024/1440px)

**NON TESTÉ — bloqué par l'absence d'outil de navigateur dans cet environnement de
session.** Aucun outil d'automatisation de navigateur (CDP, Playwright, Puppeteer)
n'est disponible dans cette session pour effectuer un test visuel réel. Documenté
honnêtement comme limite d'outillage plutôt que simulé ou deviné.

## Blocker 5 — Performance pragmatique

**MESURÉ INFORMELLEMENT (pas d'outil de monitoring — chronométrage manuel réel).**

| Action | Temps mesuré |
|---|---|
| Login (bcrypt 12 rounds) | 882 ms |
| `GET /api/auth/me` | 37 ms |
| `GET /api/research-state` | 208 ms |
| `GET /api/supervision/notifications` | 270 ms |
| `GET /api/supervision/my-supervisor` | 190 ms |
| 5 connexions simultanées (comptes distincts) | 3532 ms total (≈706 ms/connexion, cohérent avec le coût bcrypt) |

Aucune anomalie détectée : le login est le poste le plus coûteux, ce qui est attendu et
souhaitable (bcrypt volontairement coûteux contre le brute-force). Aucune optimisation
prématurée entreprise. Génération DOCX/PDF non chronométrée séparément (le test du
Blocker 3 a porté sur la réussite/échec, pas la durée).

## Blocker 6 — Rôle étudiant / directeur

**TESTÉ (déjà couvert en profondeur par la matrice d'autorisation de
`ACADIA_P18_TEST_REPORT.md` §3, reconfirmé ici) :** inscription étudiant → rôle
`student` fixé serveur ; inscription directeur → rôle `supervisor` fixé serveur ; un
étudiant reçoit 403 sur toute route réservée directeur (canevas, profil, invitations,
feedback) ; un directeur non affecté reçoit 403 sur les données d'un étudiant qui ne lui
est pas assigné. Testé côté API réelle, jamais seulement déduit d'un masquage UI.

## Blocker 7 — Email / Storage / Domain

| Service | Statut |
|---|---|
| PostgreSQL | 🔴 BLOCKED |
| Email | 🔴 NOT CONFIGURED |
| Storage documents | 🔴 NOT CONFIGURED (interface prête, jamais câblée) |
| Domaine | 🔴 NOT CONFIGURED |
| HTTPS | ⚪ Non applicable (pas de domaine) |
| Backups | 🟡 PARTIAL (mécanisme SQLite prouvé, service managé non disponible) |
| Monitoring | 🔴 NOT CONFIGURED |

Aucun faux succès affiché pour aucun de ces services.

## Build final

`npx tsc --noEmit` : 0 erreur. `npm run lint` : 56 problèmes (identique au baseline,
aucune régression). `npm run build` : succès complet. Aucun fichier temporaire de test
laissé dans le dépôt (scripts de vérification supprimés après usage).
