# ACADIA — Architecture produit (P13)

Ce document décrit ce que P13 a ajouté par-dessus le socle scientifique
P1-P12 (inchangé). Pour l'authentification en détail, voir
`ACADIA_P13_AUTH_ARCHITECTURE.md`. Pour l'audit qui a précédé ce sprint, voir
`ACADIA_P13_AUDIT.md`.

## Routes

| Route | Avant P13 | Après P13 |
|---|---|---|
| `/` | Texte MVP statique | Landing complète (déplacée depuis `/landing`) |
| `/landing` | La landing | Redirige vers `/` |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Liens morts | Pages réelles |
| `/dashboard/**` | Non protégé | Protégé par `proxy.ts` |
| `/dashboard/settings` | N'existait pas | Changement de mot de passe |
| `/dashboard/research-core-test`, `/research-understanding-test`, `/questionnaire-lab`, `/questionnaire/test`, `/ui` | Accessibles sans protection | 404 hors développement (`isDevEnvironment()` + `notFound()`), vérifié en mode production réel |

## Landing (`/`)

Composition : `Navbar → Hero → Partners → Stats → Features → AcadiaBrain →
ResearchJourney → Demo → ForWhom → FAQ → CTA → Footer`.

Deux sections sont nouvelles : `AcadiaBrain.tsx` (« Le cerveau ACADIA » —
distingue explicitement l'intelligence déterministe de l'IA, positionnement
« AI-assisted research environment », jamais « IA autonome ») et
`ForWhom.tsx` (« Pour qui ? » — cartes Licence/Master/Doctorat/Encadreur +
liste des champs SEG réellement supportés, jamais une prétention
multi-disciplinaire).

`HeroFlowPreview.tsx` remplace l'ancien placeholder statique « Aperçu du
Dashboard » par une simulation animée du cheminement Sujet → Variables →
Hypothèses → Méthodologie → Données → Économétrie → Mémoire (transition
Tailwind, aucune dépendance d'animation ajoutée).

**Contenu corrigé pour exactitude** (trouvé pendant l'intégration, corrigé
sans qu'aucune consigne ne le demande explicitement — mais directement dans
l'esprit « confiance » du sprint, et revérifié par un balayage final de la
page rendue pour confirmer qu'aucune trace ne subsistait) :

- `Testimonials.tsx` attribuait de faux témoignages à des personnes fictives
  (« Junior K. », « Sarah M. », « Pr. Patrick N. ») — retiré de la
  composition de la page.
- `data/stats.ts` annonçait des chiffres d'usage fabriqués
  (« 200+ étudiants accompagnés », « 500+ documents réalisés ») pour un
  produit sans utilisateurs réels mesurés — remplacé par des faits
  vérifiables sur ce que le produit fait.
- `data/features.ts`, `data/faq.ts`, `data/workflow.ts` (carrousel
  « Comment ça marche »), `data/pricing.ts` et `journey/PremiumCard.tsx`
  décrivaient tous, indépendamment les uns des autres, des fonctionnalités
  inexistantes : export Excel, bibliographie APA/MLA/Chicago (seul Harvard
  existe), ANOVA et SPSS (jamais implémentés), QR Code, préparation à la
  soutenance avec présentation PowerPoint et prédiction des questions du
  jury, paiement Mobile Money jamais connecté. Tous réécrits pour ne décrire
  que des capacités réellement construites en P1-P12. Le paragraphe
  d'introduction de `Features.tsx` (texte libre, hors `data/features.ts`)
  reprenait la même mention de « soutenance » — corrigé séparément.
- `CTA.tsx`/`CTAButtons.tsx`/`PremiumCard.tsx` : boutons auparavant sans
  action (`<button>` sans `onClick`) désormais réellement fonctionnels
  (`/register`, `#workflow`).

## Système vidéo

`components/shared/VideoContent.tsx` — moteur de lecture partagé (poster
premium tant qu'aucune URL n'est fournie, jamais une vidéo fictive).

- `components/landing/ProductDemoVideo.tsx` — emplacement Hero/Demo, prêt à
  recevoir `/videos/acadia-introduction.mp4` (variable `DEMO_VIDEO_URL`,
  actuellement `undefined`).
- `components/shared/GuidanceVideo.tsx` — guidage in-app réutilisable
  (« Besoin d'aide ? » → modale), jamais obligatoire. Câblé dans
  `ResearchStepHeader` (prop optionnelle `guidance`, utilisée par
  `StepResearchType`) et dans `ExportOverview`. Les autres emplacements
  suggérés par le sprint (Méthodologie, Dataset, Analyse) ne sont pas encore
  câblés — le composant est prêt, l'intégration reste à étendre.

Arborescence future prévue (non créée, aucun fichier vidéo fictif) :
`/videos/{acadia-introduction,methodology,questionnaire,dataset,analysis,econometrics,export}.mp4`.

## Dashboard

`DashboardHeader.tsx`, `app/dashboard/page.tsx` : greeting et compteurs
(recherches/instruments/datasets/exports) désormais lus depuis
`ResearchContext` réel — plus aucune valeur hardcodée à cet endroit. Empty
state réel : « Votre première recherche commence ici. » quand aucune
recherche n'existe.

**Non refait dans ce sprint** (limite assumée, à traiter en suivi) :
`RecentActivity`, `ProgressChart`, `AssistantWidget`, `QuickActions`,
`ProgressGoals`, `NotificationsCenter`, `CreditsCenter`, `AcademicCalendar`
restent des composants à données mockées. Ils n'ont pas été supprimés (règle
du sprint : ne pas retirer sans preuve qu'ils sont inutiles) mais ne doivent
pas être considérés comme connectés à de vraies données.

`components/layout/{Sidebar,Navbar,MainLayout}.tsx` : liens morts corrigés
(3 des 6 items pointaient vers des routes inexistantes), utilisateur et
déconnexion réels (`useAuth()`), menu mobile fonctionnel ajouté (tiroir
latéral, auparavant un bouton sans action — le dashboard était inutilisable
en dessous de `lg:` avant ce correctif).

## Onboarding

`components/dashboard/OnboardingModal.tsx` — un seul écran de choix
(« Commencer une nouvelle recherche » / « Continuer une recherche » /
« Découvrir ACADIA »), affiché à la première visite (mémorisé par utilisateur
via `localStorage`, clé `acadia-onboarding-seen:<userId>`) ou forcé via
`?onboarding=1` (utilisé après inscription). Toujours fermable, jamais
bloquant.

## Correctif transverse : débordement horizontal mobile

Plusieurs cartes premium (`DashboardHeader`, `AssistantWidget`, etc.)
utilisent des halos décoratifs en `position: absolute` positionnés
légèrement hors de leur conteneur — un effet visuel volontaire. Aucune règle
`overflow-x` n'existait sur `<body>`, ce qui permettait un défilement
horizontal parasite sur mobile (détecté et corrigé pendant les tests P13 —
voir `ACADIA_P13_TEST_REPORT.md`). Une seule règle globale dans
`app/globals.css` corrige l'ensemble des occurrences sans toucher chaque
composant individuellement.

## Ce qui n'a pas été fait dans ce sprint

Liste honnête, pour ne pas laisser croire à une couverture plus large que
la réalité :

- Section interactive « De l'idée aux données » (survol/clic par élément).
- Section « Démonstration économétrique » avec données pédagogiques
  explicitement labellisées.
- Système de « feedback intelligent » (✓ Bonne base / ⚠ À préciser) basé sur
  les données réelles du Wizard.
- États de chargement narrés (« ACADIA analyse votre sujet... ») au-delà de
  ce qui existait déjà.
- Refonte des écrans d'erreur (pas de vérification qu'aucune erreur brute
  type 500 ne s'affiche encore quelque part).
- Audit d'accessibilité formel (contrastes, focus clavier, aria) — non
  réalisé dans ce sprint.
- Widgets du dashboard listés ci-dessus (`RecentActivity`, etc.) restent
  mockés.
- La paywall décorative de la landing (`journey/PricingModal.tsx`,
  `UnlockButton.tsx`) reste non fonctionnelle — un clic sur « Débloquer »
  ne fait rien. Signalé ici plutôt que masqué.
