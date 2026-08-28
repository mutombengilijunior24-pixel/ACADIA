# ACADIA — Référentiel méthodologique (Sciences économiques et de gestion)

## ⚠️ Statut de la source

Le document de référence cité — *« Méthodes de recherche en sciences économiques et de gestion »*, Pascal Sem Mbimbi et Annie Cornet — **n'est pas présent dans le dépôt** (recherche effectuée : aucun PDF, aucun fichier texte, aucune mention du nom des auteurs ou du titre trouvés dans `c:\Users\Bibin\Downloads\ACADIA_VIBE_CODING_HANDOFF\acadia`).

Conformément à la consigne du sprint, **son contenu n'a pas été inventé**. Tout ce qui suit dans ce document est formalisé **exclusivement à partir des éléments que l'utilisateur a lui-même transmis dans le prompt du sprint** (le squelette de chaîne scientifique, la structure IRMRD, la formule d'échantillonnage, la distinction tri à plat/tri croisé/analyses multivariées). Ce n'est donc qu'un **socle partiel**, pas une extraction fidèle et complète de l'ouvrage.

**Action requise avant d'aller plus loin sur ce document** : déposer le PDF (ou son export texte) dans `docs/reference/` — par exemple `docs/reference/sem-mbimbi-cornet-methodes-recherche-seg.pdf`. Une fois le fichier présent, ce document devra être repris pour en extraire fidèlement : les définitions précises de chaque concept, les critères de validité/fiabilité mentionnés par les auteurs, les exemples originaux, les nuances méthodologiques propres à l'ouvrage (elles ne peuvent pas être déduites du seul sommaire donné dans le prompt).

---

## 1. Chaîne scientifique de référence

Telle que transmise dans le prompt, à utiliser comme colonne vertébrale du moteur de validation de cohérence (voir Bloc 14 du sprint / `ACADIA_ECONOMETRIC_SPEC.md` §5) :

```
PHÉNOMÈNE OBSERVÉ
  ↓
PROBLÈME
  ↓
QUESTION DE RECHERCHE
  ↓
EXPLORATION
  ↓
REVUE DE LITTÉRATURE
  ↓
PROBLÉMATIQUE
  ↓
HYPOTHÈSES
  ↓
MODÈLE THÉORIQUE / MODÈLE D'ANALYSE
  ↓
VARIABLES
  ↓
INDICATEURS
  ↓
MÉTHODOLOGIE
  ↓
COLLECTE DES DONNÉES
  ↓
PRÉPARATION DES DONNÉES
  ↓
ANALYSE
  ↓
INTERPRÉTATION
  ↓
DISCUSSION
  ↓
CONCLUSION
```

### Forme exploitable par le logiciel

Chaque maillon devient un **nœud typé** avec un statut (`draft | proposed | accepted | rejected`, cohérent avec `ProposalStatus` déjà défini dans `ResearchTypes.ts`) et des **liens explicites** vers le(s) maillon(s) précédent(s)/suivant(s) qu'il doit rester cohérent avec. C'est cette table de dépendances — pas le texte du schéma — qui doit être encodée :

| Nœud | Doit être cohérent avec | Type ACADIA existant/à créer |
|---|---|---|
| Phénomène observé | Domaine, sujet | `ResearchData.title/domain` (existant) |
| Problème | Phénomène observé | `ResearchProject.problem` (existant) |
| Question de recherche | Problème | *(à créer — actuellement absorbé dans `problem`)* |
| Exploration / Revue de littérature | Question de recherche | *(hors périmètre logiciel — traçabilité de sources uniquement, jamais génération)* |
| Problématique | Question, revue de littérature | `ResearchProject.problem` (existant) |
| Hypothèses | Problématique, modèle théorique | `ResearchHypothesis` (existant, non câblé) |
| Modèle théorique / modèle d'analyse | Hypothèses | *(à créer — voir `ACADIA_ECONOMETRIC_SPEC.md`)* |
| Variables | Modèle théorique, hypothèses | `ResearchVariable` (existant, rôles `independent/dependent/mediating/moderating/control/descriptive` déjà typés) |
| Indicateurs | Variables (via dimensions) | `ResearchIndicator`, `ResearchDimension` (existants) |
| Méthodologie | Type de recherche, variables | `ResearchMethodology` (existant) |
| Collecte des données | Méthodologie, population | `ResearchProject.methodology.techniques/instruments` (existant) |
| Préparation des données | Collecte | *(à créer — `Dataset`, voir spec économétrique)* |
| Analyse | Préparation des données, hypothèses | *(à créer — `Model`, `Test`, `Result`)* |
| Interprétation | Analyse, hypothèses | *(à créer — `Result.interpretation`)* |
| Discussion | Interprétation, littérature | *(à créer — `Discussion`)* |
| Conclusion | Discussion, objectifs | *(à créer)* |

## 2. Structure de restitution : IRMRD

```
Introduction
Revue de littérature
Méthodologie
Résultats
Discussion
```

ACADIA doit organiser la restitution finale d'un projet selon cette structure plutôt que comme une liste de « chapitres » indépendants — chaque section du IRMRD doit pouvoir être tracée jusqu'aux nœuds de la chaîne scientifique du §1 (ex. la section « Méthodologie » du IRMRD est alimentée par les nœuds Méthodologie + Collecte + Préparation des données).

## 3. Distinction quantitatif / qualitatif / mixte

Élément explicitement transmis : l'application doit **savoir distinguer** ces trois approches et **expliquer pourquoi** une approche est cohérente avec un sujet donné — jamais l'assigner par défaut. Cette logique doit être portée par le futur moteur de validation (Bloc 14), pas par un choix arbitraire de l'utilisateur non vérifié.

Pour le qualitatif, le prompt rappelle explicitement de préserver la logique de **saturation** (théorique, empirique) comme critère d'arrêt de collecte, distincte du calcul d'échantillon probabiliste du quantitatif.

## 4. Échantillonnage (quantitatif)

Formule transmise :

```
n = (t² × p × q) / e²
```

où `t` = coefficient lié au niveau de confiance, `p`/`q` = proportions (p + q = 1, p = 0,5 par défaut si inconnu), `e` = marge d'erreur.

Méthodes probabilistes mentionnées explicitement : **aléatoire simple**, **stratifié**. `lib/core/methodology/SamplingEngine.ts` implémente aujourd'hui la formule de Yamane (`n = N / (1 + N·e²)`, cas population finie connue) — **à vérifier/compléter** pour couvrir également la formule `t²pq/e²` (cas population infinie/inconnue) et exposer explicitement la méthode choisie (aléatoire simple vs stratifié) plutôt que de la sous-entendre.

## 5. Progression de l'analyse quantitative

Paliers explicitement transmis, à respecter dans cet ordre (ne jamais sauter à un palier supérieur sans que les conditions du palier précédent soient réunies) :

1. Statistiques descriptives (effectif, fréquence, pourcentage, moyenne, médiane, min, max, écart-type)
2. Tri à plat
3. Tri croisé
4. Relations entre variables
5. Analyses multivariées
6. Régression / économétrie — **uniquement si les conditions statistiques sont réunies**, jamais par défaut parce que le chercheur a choisi « quantitatif ».

## 6. Ce qui manque et nécessite le document source

- Les définitions précises données par les auteurs pour chaque maillon de la chaîne (ex. distinction exacte problème/problématique selon Sem Mbimbi & Cornet).
- Les critères de qualité méthodologique propres à l'ouvrage (validité interne/externe, fiabilité, etc.).
- Les exemples et cas illustratifs originaux (aucun exemple du livre n'a été réutilisé ici — les exemples présents dans `ACADIA_ECONOMETRIC_SPEC.md` sont ceux fournis par l'utilisateur dans le prompt, pas extraits du livre).
- Toute nuance sur les méthodes d'échantillonnage non probabilistes ou sur des tests spécifiques non cités dans le prompt.

Tant que le PDF n'est pas fourni, le moteur de validation méthodologique (Bloc 14) doit être construit **uniquement** sur les règles formalisées ci-dessus, explicitement marquées comme partielles dans le code (commentaire renvoyant à ce document) pour ne pas laisser croire à une couverture complète du référentiel.
