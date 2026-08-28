# ACADIA — Rapport de tests P13

Méthodologie inchangée depuis les sprints précédents : navigateur Edge
headless réel piloté en Chrome DevTools Protocol brut (pas de
Playwright/Puppeteer), captures d'écran inspectées visuellement, plus une
vérification en **mode production réel** (`next build && next start`) pour
les points touchant à la sécurité (protection des pages de debug).

## Authentification — 13/13 assertions passées

Parcours complet testé en navigateur réel : inscription → session active
(`/api/auth/me`) → persistance après reload → déconnexion → redirection vers
`/login` → reconnexion → mot de passe incorrect (message clair, jamais de
500 brut) → mot de passe oublié (lien généré, disclaimer honnête « aucun
service d'email connecté ») → réinitialisation → connexion avec le nouveau
mot de passe → inscription en double (erreur claire « un compte existe déjà »).

## Isolation des données par utilisateur — vérifiée

Test à deux comptes réels dans le même navigateur : une recherche injectée
sous le compte A (clé `localStorage` `acadia-researches:<idA>`) n'apparaît
jamais sous le compte B après connexion — assertion centrale confirmée
(« Compte B NE VOIT PAS la recherche du compte A »). Les clés du compte A
restent présentes en storage (isolées, pas supprimées) après connexion du
compte B. Une assertion de test annexe a échoué à tort (elle exigeait que
*toutes* les clés `localStorage` du navigateur portent un suffixe
utilisateur, sans tenir compte de clés héritées vides créées avant P13) —
confirmé comme un artefact du script de test, pas un défaut du produit (ces
clés historiques ne sont plus jamais lues ni écrites par le code actuel).

## Protection des routes — vérifiée en mode production réel

`npm run build && npm run start` (port dédié, arrêté après test) :

- `/dashboard/**` sans session → 307 vers `/login?next=...`.
- Pages de debug (`research-core-test`, `research-understanding-test`,
  `questionnaire-lab`) → 404 **même avec une session valide**, confirmant
  que la garde `isDevEnvironment()` fonctionne indépendamment de la
  protection par `proxy.ts`.
- `/questionnaire/test`, `/ui` (hors `/dashboard`) → 404 directement.
- `/dashboard` avec une session valide → 200 (le vrai dashboard reste
  accessible).

## Export DOCX/PDF (rappel P12, non retesté en profondeur ici)

Le moteur d'export n'a pas été modifié par P13 (liste des éléments protégés
respectée) — seule l'intégration d'un `GuidanceVideo` dans `ExportOverview`
a été ajoutée, sans toucher `DocumentBuilder` ni les routes `/api/export/*`.

## Responsive

- Landing (`/`) à 1440px et 390px : capture visuelle inspectée, aucun
  débordement horizontal détecté (`scrollWidth === innerWidth` aux deux
  largeurs après correctif, voir ci-dessous).
- `/register`, `/login` à 390px : rendu correct, formulaire lisible,
  logo réel affiché.
- Dashboard à 390px : **débordement horizontal réel détecté** (`scrollWidth
  411px` pour un `innerWidth` de 390px), causé par des halos décoratifs en
  `position: absolute` débordant de plusieurs cartes premium
  (`DashboardHeader`, `AssistantWidget`, autres). Corrigé par une règle
  `overflow-x: hidden` sur `<body>` (`app/globals.css`) — revérifié après
  correctif : `scrollWidth 375px ≤ innerWidth 390px`. Non-régression
  landing/mobile revérifiée après le même correctif (toujours propre).
- Menu mobile du dashboard : ouverture du tiroir latéral testée en
  navigateur, liens (« Mes recherches ») et bouton « Déconnexion » présents
  et cliquables — auparavant le bouton hamburger n'avait aucune action.

**Non testé exhaustivement** : 1280px, 1024px, 768px n'ont pas été vérifiés
écran par écran dans ce sprint (limite de temps assumée) — seuls 1440px et
390px, les deux extrêmes, ont été couverts en profondeur.

## Non-régression scientifique (P1-P12)

Confirmé en navigateur, sur le sujet SNCC déjà utilisé dans tous les sprints
précédents : Méthodologie, Questionnaire, Dictionnaire des données, Analyse
descriptive, Analyse bivariée, Modèle économétrique, Production scientifique
(P11) et Document scientifique final (P12) sont tous toujours présents et
accessibles après les changements P13 — aucun moteur scientifique n'a été
modifié, seule l'intégration UI (`GuidanceVideo` dans deux emplacements) a
changé la surface visible.

## Build / Lint / Typecheck

- `npx tsc --noEmit` : propre après chaque bloc de modification (vérifié une
  dizaine de fois au cours du sprint, jamais d'erreur laissée en suspens).
- `npm run build` : propre, toutes les nouvelles routes enregistrées
  (`/login`, `/register`, `/forgot-password`, `/reset-password`,
  `/dashboard/settings`, 7 routes `/api/auth/*`), `ƒ Proxy (Middleware)`
  confirmé actif dans la sortie de build.
- `npm run lint` : aucun problème nouveau introduit (le nombre d'erreurs/
  avertissements préexistants, tous situés en dehors des fichiers touchés par
  P13, est resté strictement identique).

## Ce qui n'a pas été testé dans ce sprint

- Parcours de bout en bout complet (visiteur → landing → inscription →
  onboarding → Wizard → analyse → export) en un seul script continu — testé
  par blocs séparés, jamais enchaîné intégralement dans un seul scénario.
- Les 4 profils de recherche (quantitatif/qualitatif/descriptif/mixte)
  n'ont pas été rejoués spécifiquement pour P13 — ils avaient déjà été
  validés en profondeur lors des sprints P6-P12 sur les mêmes moteurs,
  inchangés ici.
- Accessibilité (contraste, navigation clavier, aria) : non auditée.
