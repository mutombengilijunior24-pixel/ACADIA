# ACADIA — Guide UX (P13)

## Positionnement

ACADIA n'est pas « un formulaire à remplir » — c'est un assistant scientifique
spécialisé en Sciences Économiques et de Gestion (SEG). Ne jamais laisser
penser qu'ACADIA couvre toutes les disciplines, ni qu'il est une intelligence
autonome capable de remplacer le chercheur. Positionnement à réutiliser
partout : **« AI-assisted research environment »** — le chercheur reste
décisionnaire.

## Ton et vocabulaire

Clair, rassurant, intelligent, académique, humain, premium. Jamais de jargon
informatique brut.

| Éviter | Préférer |
|---|---|
| Submit / Run / Execute / Process | Continuer / Analyser mon sujet / Construire ma méthodologie |
| Loading... | « ACADIA analyse votre sujet... » (un état d'interface réel, jamais une fausse étape) |
| 500 Internal Server Error | « ACADIA n'a pas pu terminer cette analyse. Vos données sont conservées. » |

## Règle d'or : ne jamais afficher un message qui ment sur ce qui a été fait

Un message « ACADIA a analysé... » ne doit apparaître que si une analyse a
réellement eu lieu. Un état de progression narré ne doit jamais mimer des
étapes qui ne correspondent à aucun traitement réel. Cette règle prolonge,
côté produit, la règle scientifique déjà en vigueur depuis P1 (« ne jamais
inventer un fait manquant ») — appliquée ici au contenu marketing et à
l'interface, pas seulement aux résultats de recherche.

Cas concrets corrigés pendant P13 (voir `ACADIA_P13_PRODUCT_ARCHITECTURE.md`
pour le détail) : témoignages fictifs retirés, chiffres d'usage fabriqués
remplacés par des faits vérifiables, fonctionnalités inexistantes (export
Excel, bibliographie multi-normes, paiement Mobile Money) retirées de la
landing.

## Identité visuelle

Palette existante, jamais réinventée : `acadia-blue` (#2554EB), `acadia-navy`
(#0B1B3A), blanc dominant, neutres `slate`. Logo réel :
`public/logos/Logo technologique Acadia (1).png`, exposé via
`components/shared/Logo.tsx` (hors Wizard) ou
`components/research/ResearchWizard/brand/ResearchBrand.tsx` (dans le Wizard
— les deux existent délibérément, ne pas les fusionner sans raison, ils
servent des arbres de composants différents avec des besoins de variantes
différents).

Direction : SaaS premium (clarté, typographie soignée, transitions sobres),
jamais une copie visuelle d'Apple/Linear/Notion/Stripe — une identité
académique propre à ACADIA.

## D'où vient le « WOW »

Jamais de gradients partout, d'animations inutiles, de glassmorphism
excessif. Le WOW vient de :

- **Clarté** — l'utilisateur sait toujours où il est et pourquoi.
- **Précision** — les chiffres affichés sont réels ou clairement labellisés
  comme pédagogiques/démonstratifs.
- **Cohérence** — landing, login, dashboard, Wizard, analyse, export
  partagent les mêmes tokens et les mêmes patterns de carte
  (`rounded-3xl`/`rounded-[36px]`, halos discrets, `ResearchPrimaryButton`).
- **Confiance** — chaque affirmation sur ce qu'ACADIA fait est vérifiable
  dans le code qui l'exécute réellement.

Chaque interaction doit répondre implicitement à quatre questions : *Je sais
où je suis. Je sais ce que je dois faire. Je comprends pourquoi. Je vois ce
qu'ACADIA va m'apporter.*

## Patterns de composants établis pendant P13

- **Cartes de formulaire premium** : `rounded-3xl border border-slate-200
  bg-white p-6 sm:p-8`, champs `rounded-xl border border-slate-200 px-4 py-2.5
  focus:border-acadia-blue`.
- **CTA principal** : `ResearchPrimaryButton` (dégradé
  `linear-gradient(135deg, #2554EB 0%, #0B1B3A 130%)`), déjà utilisé par le
  Wizard, désormais réutilisé par les écrans d'authentification et les
  paramètres — jamais un nouveau style de bouton primaire inventé.
  Réutilisé tel quel dans `/login`, `/register`, `/forgot-password`,
  `/reset-password`, `/dashboard/settings` (voir `AuthShell.tsx`).
- **Guidage optionnel** : `GuidanceVideo` — un badge discret
  (`rounded-full bg-acadia-blue-50 px-3 py-1.5`), jamais un blocage.
- **États vides** : un message concret + un CTA, jamais un écran blanc
  (exemple réel : « Votre première recherche commence ici. » sur le
  dashboard sans recherche).
