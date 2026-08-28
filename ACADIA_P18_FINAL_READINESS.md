# ACADIA — Matrice de préparation à la production (P18-FINAL)

| Domaine | Statut | Preuve | Blocker |
|---|---|---|---|
| Auth | ✅ | 401 réel sur cookie absent/corrompu/vide ; login testé (882ms, bcrypt 12 rounds) | — |
| Authorization | ✅ | 20/20 scénarios réels (P18 précédent) + reconfirmation rôle (Blocker 6) | — |
| Student isolation | ✅ | Étudiant tiers non affecté → 403 sur soumission d'un autre étudiant (testé réellement) | — |
| Supervisor isolation | ✅ | Directeur tiers non affecté → 403 sur soumission/validation d'un autre directeur (testé réellement) | — |
| PostgreSQL | 🔴 | Aucune instance accessible (psql/docker absents, aucun identifiant) | Blocker 1 |
| Persistence | ✅ | SQLite + Prisma, transactions ACID, migrations appliquées (3, dont une ajoutée ce sprint) | — |
| Backups | 🟡 | Cycle backup→perte simulée→restauration réussi sur SQLite dev ; aucun service managé | Blocker 1, 2 |
| Storage | 🔴 | `DocumentStorageProvider` existe, jamais câblé à une fonctionnalité réelle | — |
| Email | 🔴 | `NoOpEmailProvider` seul actif ; statut désormais affiché honnêtement côté client | — |
| Rate limiting | ✅ | 5 routes complétées et testées réellement (429 déclenché) | — |
| Audit logs | ✅ | `ROLE_ASSIGNED`/`CORRECTION_UPDATED`/`ACCESS_DENIED` câblés et vérifiés en base ; `EXPORT_CREATED` volontairement non câblé (justifié) | — |
| Scientific pipeline (A0→A2) | ✅ | Appel réel `/api/ai/research-intelligence`, variables/dimensions/indicateurs réels, hypothèse jamais auto-confirmée | — |
| Questionnaire | ✅ | `generateInstrumentFromProject` réel : 27 questions, traçabilité 100 % préservée | — |
| Dataset | ✅ | `buildDatasetFromInstrument` réel : 27 colonnes, traçabilité préservée, obsolescence propagée après modification | — |
| Statistics (descriptive/bivariée) | ✅ | Moteurs réels exécutés : ρ = -0,42, p = 0,001 (Spearman réel) | — |
| Econometrics | ✅ | Modèle réel R² = 0,196 ; détection correcte de `singular_matrix` en cas de multicolinéarité | — |
| Scientific work | ✅ | `buildScientificWork`/`validateScientificWork` réels : 17/17 critères `pass` sur ce scénario | — |
| DOCX | ✅ | Export réel réussi (19 271 octets) sur le document complet | — |
| PDF | 🔴 | **Échec réel démontré** (HTTP 500) sur le même document à partir de ~18 tableaux combinés ; DOCX réussit sur le même contenu | Blocker 3 (nouveau, documenté, non corrigé — moteur protégé, bug non sécuritaire) |
| Responsive | ⚪ | Non testé — aucun outil de navigateur disponible dans cette session | Blocker 4 |
| Performance | 🟡 | Mesures informelles seulement (pas de monitoring) ; aucune anomalie détectée | — |

## Nouveau blocage identifié par ce sprint

**Export PDF non fiable au-delà d'un certain volume de contenu** (tableaux
descriptifs), alors que l'export DOCX reste fonctionnel sur le même contenu. Ce
blocage n'existait pas dans les rapports P18 précédents car aucun test d'export n'avait
été rejoué sur un document aussi riche (24 tableaux, 23 figures) — la régression
scientifique complète de ce sprint l'a révélé. Documenté, non corrigé (moteur protégé,
bug non sécuritaire).
