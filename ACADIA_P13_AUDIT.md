# ACADIA — Audit P13 (avant développement)

Ce document précède tout développement du sprint P13, conformément à la règle
« NE COMMENCE PAS immédiatement à modifier des centaines de fichiers ». Il
inventorie ce qui existe réellement dans le dépôt (lu fichier par fichier),
pas des suppositions.

## 1. Ce qui existe déjà

**Landing** — une landing complète existe déjà à `/landing` (pas `/`) :
`Navbar, Hero, Partners, Stats, Features, Testimonials, journey/ResearchJourney
(+ JourneyHeader/JourneyProgress/JourneyCarousel/JourneyCard/PremiumCard/
PricingModal/PaymentBadge/UnlockButton/FeaturePreview), Demo, faq/FAQ,
cta/CTA, footer/Footer`. Qualité visuelle globalement premium (cartes
rounded-3xl, gradients, halos, hover). `journey/` couvre déjà une bonne partie
de la section « Comment ça marche ? » demandée au point 6 du sprint, avec en
prime un concept de paywall « pay-per-step » (`PricingModal`/`UnlockButton`)
entièrement décoratif (aucun appel API). `Demo.tsx` a déjà un placeholder
vidéo (bouton play + texte « Placeholder »).

**Design System** — Tailwind v4 CSS-first (`app/globals.css`, `@theme`),
tokens `acadia-blue`/`acadia-navy` (+ variantes light/dark/50/100) déjà
définis et confirmés comme source de vérité. Un kit `components/ui/`
générique existe (Button/Card/Badge/Input/Modal/Loader) mais n'utilise PAS
les tokens acadia-*. Le kit réellement « on-brand » est
`components/research/ResearchWizard/brand/` (ResearchBrand, ResearchPrimaryButton,
ResearchStepHeader, ResearchOptionCard, ResearchSummaryCard, ResearchTextArea,
ResearchInsight) — c'est la référence à réutiliser en priorité.

**Logo** — un seul asset réel : `public/logos/Logo technologique Acadia (1).png`,
utilisé correctement par `ResearchBrand.tsx`. Ailleurs (Navbar landing,
Sidebar dashboard, Footer) le chemin est cassé (`/images/acadia-logo.png`
inexistant) ou remplacé par une icône `GraduationCap` générique.

**Dashboard** — coquille premium (`DashboardHeader`, `StatsCard`,
`RecentActivity`, `ProgressChart`, etc.) mais **entièrement peuplée de
données fictives**, jamais connectée à `ResearchContext`. `/dashboard/research`
est un stub « en construction » — le vrai contenu vit sous
`/dashboard/research/new` (Wizard) et `/dashboard/research/[id]` (espace de
travail complet P1-P12, déjà connecté aux vraies données).

**Wizard** — le plus abouti fonctionnellement et visuellement : 15 étapes,
vraie barre de progression avec catégories, `LiveSummary` connecté en temps
réel à `ResearchContext`. Déjà proche de l'esprit « expérience guidée »
demandé au point 15 — à enrichir, pas à reconstruire.

**Contexts** — `ResearchContext` (7 clés localStorage) monté uniquement dans
`app/dashboard/layout.tsx`, pas dans `app/layout.tsx` racine. Un second
`ProjectContext` (données mock, sans persistance) coexiste en parallèle —
incohérence à noter, pas nécessairement à corriger dans ce sprint (P13 ne
doit pas réécrire ResearchCore/ResearchData).

**Authentification** — confirmée **totalement absente** : aucune lib
(NextAuth/bcrypt/JWT/session), aucun `middleware.ts`, `/login` et `/register`
sont déjà des liens morts sur la landing actuelle.

**OpenAI** — clé lue uniquement côté serveur (`lib/openai.ts` + routes
`app/api/ai/*`), jamais exposée au client. Point d'attention réel :
`dangerouslyAllowBrowser: true` sur l'instance OpenAI (inutile côté serveur,
risque si le fichier était un jour importé côté client — à corriger).
`app/api/ai/research-intelligence/route.ts` est la route la plus mature
(codes d'erreur typés, redaction des clés dans les messages d'erreur). Les
routes `test-*` sont déjà protégées par `lib/api/devOnlyRoute.ts` (404 hors
développement).

**Pages de debug** — 5 pages confirmées non liées depuis aucune navigation :
`research-core-test`, `research-understanding-test`, `questionnaire-lab`,
`questionnaire/test`, `/ui`. Déjà « invisibles » en pratique, mais pas
protégées pour la production.

**Navigation** — `components/layout/Sidebar.tsx` : 4 des 6 liens sont morts
(`/dashboard/ai`, `/dashboard/questionnaire`, `/dashboard/responses`,
`/dashboard/settings` n'existent pas). Sidebar masquée sous `lg:` sans aucun
remplacement mobile — **le dashboard est actuellement inutilisable au
clavier tactile en dessous de 1024px** (aucun menu mobile fonctionnel nulle
part dans le dashboard).

## 2. Ce qui peut être réutilisé tel quel

- Le kit `ResearchWizard/brand/*` comme base du design system premium.
- Toute la structure landing existante (Navbar/Hero/.../Footer) comme
  squelette — copie et branchement à corriger, pas la structure.
- Le Wizard (15 étapes + ProgressBar + LiveSummary) — enrichi, pas reconstruit.
- L'espace de travail `/dashboard/research/[id]` (P1-P12) — inchangé.
- `lib/api/devOnlyRoute.ts` — pattern à réutiliser pour toute nouvelle route
  interne.

## 3. Ce qui doit être refactorisé

- La landing doit devenir la route `/` (actuellement un texte MVP minimal) ;
  `/landing` doit rediriger vers `/` pour ne pas casser un lien existant.
- Le logo doit être unifié partout via un vrai composant `Logo` (le fichier
  `components/shared/Logo.tsx` existe mais est vide).
- La Sidebar doit avoir un vrai menu mobile, et ses liens morts doivent
  pointer vers de vraies routes ou être retirés.
- `lib/openai.ts` : retirer `dangerouslyAllowBrowser: true`.
- Le dashboard doit lire les vraies données de `ResearchContext` au lieu de
  valeurs hardcodées (au minimum pour la carte de progression principale).

## 4. Ce qui doit être supprimé (ou neutralisé)

- Les fichiers orphelins `components/landing/{CTA,FAQ,Footer,Modules,
  PricingCard,StatCard}.tsx` (non importés par `app/landing/page.tsx`,
  remplacés par les versions en sous-dossiers) — à confirmer inutilisés
  ailleurs avant suppression.
- Rien d'autre : les pages de debug restent utiles au développement (règle
  explicite du sprint) — elles seront protégées, pas supprimées.

## 5. Ce qui doit être créé

- `/login`, `/register`, `/forgot-password` + architecture d'authentification
  minimale (voir décision ci-dessous).
- `middleware.ts` de protection des routes `/dashboard/**`.
- Landing : repositionnement copy SEG, section « Cerveau ACADIA »,
  section interactive « De l'idée aux données », section « Démonstration
  économétrique » (données explicitement pédagogiques), section « Pour qui ? ».
- `ProductDemoVideo` (landing) et `GuidanceVideo` (in-app) — composants
  réutilisables, aucun fichier vidéo fictif.
- Onboarding première connexion (3 étapes max, jamais bloquant).
- États vides, erreurs et loading premium réutilisables.
- Documentation P13 (`ACADIA_P13_PRODUCT_ARCHITECTURE.md`,
  `ACADIA_P13_UX_GUIDELINES.md`, `ACADIA_P13_AUTH_ARCHITECTURE.md`,
  `ACADIA_P13_TEST_REPORT.md`).

## 6. Risques

- **Authentification** : c'est le risque majeur du sprint. Le modèle de
  données actuel est *entièrement* client (localStorage, 7 clés,
  `ResearchContext`). Une isolation « vraie » par compte (données
  consultables depuis un autre appareil) impliquerait de migrer chaque
  opération CRUD de `ResearchContext` vers une API serveur + base de
  données — un chantier à part entière, hors du périmètre raisonnable de ce
  seul sprint sans le dénaturer. Décision nécessaire avant de coder (voir
  message séparé).
- Landing en deux endroits (`/` et `/landing`) : redirection à ajouter pour
  ne pas laisser un lien mort.
- `ProjectContext` (mock) vs `ResearchContext` (réel) : ne pas les fusionner
  dans ce sprint sauf si un problème concret apparaît pendant l'intégration
  (règle explicite : ne pas toucher sans raison réelle).
