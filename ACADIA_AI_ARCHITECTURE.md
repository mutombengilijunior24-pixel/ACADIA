# ACADIA — Architecture IA (A1 / A2)

Produit dans le cadre de Priorité 1 / Point 1 du sprint (sécurisation de la frontière client/serveur). Décrit l'architecture **après correction**.

## Diagramme

```
CLIENT (navigateur)
  │  connaît uniquement : l'endpoint, le contrat request/response
  │
  │  fetch POST /api/ai/research-intelligence
  ↓
API ROUTE (serveur)
  app/api/ai/research-intelligence/route.ts
  │  valide l'entrée, classe les erreurs, ne laisse jamais
  │  passer un échec IA pour un succès HTTP
  ↓
ORCHESTRATEUR (serveur)
  lib/core/research/ResearchIntelligenceEngine.ts — analyzeResearch()
  │
  ├── A1 — lib/ai/openai/SubjectUnderstandingAI.ts
  ├── A2 — lib/ai/openai/VariableIntelligenceAI.ts
  │        (modèle centralisé : lib/ai/openai/config.ts → AI_MODEL)
  │
  ├── AIResearchAdapter.ts (normalisation A2 → ResearchVariable[])
  └── ResearchCore.ts (createResearchProject / updateResearchProject,
                        déterministe, aucune dépendance OpenAI)
  ↓
lib/ai/openai/client.ts → new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  ↓
OPENAI (API externe)
  ↓
ResearchIntelligenceResult (normalisé)
  ↓
API ROUTE → { success: true, data } ou { success: false, error }
  ↓
CLIENT — ResearchContext.tsx (analyzeCurrentResearch)
```

Le navigateur ne reçoit jamais : la clé API, le SDK OpenAI, les prompts système, le nom du modèle, les détails internes d'A1/A2. Vérifié par inspection du bundle de production (`.next/static/`) — voir §4.

## Fichiers concernés

| Fichier | Rôle | Modifié |
|---|---|---|
| `contexts/ResearchContext.tsx` | Appelle désormais l'API via `fetch`, n'importe plus que le *type* `ResearchIntelligenceResult` | Oui |
| `app/api/ai/research-intelligence/route.ts` | Contrat de réponse explicite, classification d'erreurs, jamais de faux succès | Oui |
| `lib/ai/openai/client.ts` | Client OpenAI serveur ; `dangerouslyAllowBrowser` retiré (n'est plus nécessaire) ; garde-fou runtime si jamais chargé côté navigateur | Oui |
| `lib/ai/openai/config.ts` | Nouveau — centralise `AI_MODEL` pour A1/A2 | Créé |
| `lib/ai/openai/SubjectUnderstandingAI.ts` (A1) | Utilise `AI_MODEL` au lieu du littéral `"gpt-5.6"` | Oui (minime) |
| `lib/ai/openai/VariableIntelligenceAI.ts` (A2) | Utilise `AI_MODEL` au lieu du littéral `"gpt-5.6"` | Oui (minime) |
| `lib/core/research/ResearchIntelligenceEngine.ts` | Orchestration A1→A2→Adapter→Core | **Non modifié** |
| `lib/core/research/AIResearchAdapter.ts` | Normalisation A2 → `ResearchVariable[]` | **Non modifié** |
| `lib/core/research/ResearchCore.ts` | A0, déterministe | **Non modifié** |

## Contrat API

`POST /api/ai/research-intelligence`

Requête : `ResearchData` (JSON, tel qu'aujourd'hui — inchangé).

Réponse succès (HTTP 200) :
```json
{ "success": true, "data": { "understanding": ..., "variableAnalysis": ..., "project": ..., "variables": ..., "warnings": [...], "status": "ready" | "needs_review" } }
```

Réponse erreur (HTTP 400 / 500 / 502) :
```json
{ "success": false, "error": { "code": "AI_VALIDATION_ERROR" | "AI_CONFIGURATION_ERROR" | "AI_PROVIDER_ERROR" | "AI_INVALID_RESPONSE" | "AI_UNKNOWN_ERROR", "message": "..." } }
```

`status: "needs_review"` reste un **succès HTTP** (200, `success:true`) — ce n'est pas un échec, seulement une analyse avec des points à confirmer. Seul `status: "failed"` (produit par l'orchestrateur en cas d'échec IA) devient une erreur HTTP (502).

Tout message d'erreur est passé dans `sanitizeMessage()` avant d'être journalisé ou renvoyé, qui retire tout fragment ressemblant à une clé (`sk-...`).

## Variables d'environnement

- `OPENAI_API_KEY` — exclusivement lue côté serveur (`lib/ai/openai/client.ts`, `lib/openai.ts`). Aucune variable `NEXT_PUBLIC_OPENAI_API_KEY` n'existe dans le projet.
- `AI_MODEL` (nouvelle, optionnelle) — surcharge le modèle utilisé par A1/A2. Non définie aujourd'hui : la valeur par défaut `"gpt-5.6"` s'applique, comportement fonctionnel inchangé.

## Vérification du bundle (preuve, pas simple déclaration)

Après `npm run build`, recherche dans `.next/static/` (tout le JavaScript envoyé au navigateur) :

| Motif recherché | Résultat |
|---|---|
| `gpt-5.6` | absent |
| `moteur scientifique A1` / `moteur A2 d'intelligence` (texte des prompts) | absent |
| `dangerouslyAllowBrowser` | absent |
| `OPENAI_API_KEY` | absent |
| `sk-placeholder` | absent |
| `new OpenAI(` | absent |
| `responses.create` / `chat.completions.create` | absent |
| `api/ai/research-intelligence` (l'appel fetch attendu) | **présent** — confirme que le client parle bien à l'API plutôt qu'au SDK |

## Limites restantes (hors périmètre de ce point)

- `app/api/test-a1-openai/route.ts`, `app/api/test-a2-openai/route.ts`, `app/api/test-research-intelligence/route.ts` restent des routes GET publiques sans authentification qui déclenchent de vrais appels OpenAI. Elles sont déjà server-only (aucun risque de fuite côté navigateur), mais restent un risque de coût/abus. Identifiées, non modifiées dans ce point (protection/retrait = décision produit distincte, hors "sécurisation de la frontière client/serveur").
- `/api/ai/generate` (modèle `"gpt-5"`) et le moteur A2 local mort (modèle `"gpt-5-mini"`) n'utilisent pas `AI_MODEL` — hors périmètre A1/A2.
- Le classement des erreurs (`classifyError`) repose sur une analyse de texte du message d'erreur (pas de codes d'erreur structurés remontés par les fonctions A1/A2 elles-mêmes) — fonctionnel mais fragile si le texte des messages venait à changer. Une évolution future pourrait faire porter le code d'erreur directement par `ResearchIntelligenceEngine.ts` plutôt que de le déduire côté route.
