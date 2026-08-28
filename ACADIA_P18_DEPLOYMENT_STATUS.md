# ACADIA — Statut de déploiement P18

## Services externes réellement disponibles aujourd'hui

| Service | Statut |
|---|---|
| Base de données | SQLite locale uniquement — aucun PostgreSQL managé |
| Email | Aucun (`NoOpEmailProvider`) |
| Stockage de documents cloud | Aucun (implémentation locale de développement seulement, non câblée à une fonctionnalité réelle) |
| Domaine / DNS / HTTPS | Aucun |
| Monitoring / APM | Aucun |
| Sauvegardes | Aucune |
| IA (OpenAI) | ✅ Configurée et fonctionnelle (moteurs A0-A2) |

Aucun de ces éléments n'a été simulé ou présenté comme opérationnel alors qu'il ne
l'est pas.

## Ce qui a été réellement sécurisé/corrigé dans ce sprint

1. Rate limiting complété sur 5 routes (forgot-password, reset-password, invitations,
   invitations/accept, submissions) — testé réellement (429 déclenché après le seuil).
2. Journal d'audit complété (`ROLE_ASSIGNED`, `CORRECTION_UPDATED`, `ACCESS_DENIED`) —
   vérifié par requête directe en base après une matrice de tests réels.
3. Matrice d'autorisation STUDENT×SUPERVISOR testée en conditions réelles : 20/20
   scénarios (rôles croisés, ids forgés, isolation entre utilisateurs non affectés).
4. **Bug de concurrence réel découvert et corrigé** : soumissions simultanées pouvant
   partager le même numéro de version — corrigé par contrainte unique en base +
   relecture sur conflit, re-testé avec succès.
5. Honnêteté du statut email exposée côté client (auparavant le serveur savait qu'aucun
   email n'était envoyé, mais le client ne le montrait pas).
6. Pages d'erreur applicatives ajoutées (`error.tsx`, `global-error.tsx`,
   `not-found.tsx`) — absentes auparavant.
7. Balayage de sécurité du bundle client : aucun secret exposé, confirmé.
8. Build et lint confirmés sans régression (56 problèmes de lint identiques au
   baseline, 0 erreur TypeScript, build de production réussi).

## Ce qui n'a pas été couvert par ce sprint (limites explicites de cette session)

- Test de régression scientifique complet de bout en bout (A0→export, V1→V2).
- Test d'export DOCX/PDF sur une recherche persistée en base réelle.
- Tests responsive à 390/768/1024/1440px.
- Audit de performance chronométré.
- Test de résilience « base de données indisponible » par arrêt volontaire.
- Test du `DocumentStorageProvider` (non câblé à une fonctionnalité réelle — rien à
  tester).

Ces points ne sont pas des régressions ni des inconnues inquiétantes : ce sont des
vérifications non exécutées dans ce tour de travail, à planifier avant tout
élargissement au-delà d'une bêta privée très restreinte.

## Verdict

## 🟡 GO FOR STAGING ONLY (bêta privée très restreinte, pas de mise en production)

**Justification** :

- **GO** est justifié pour un usage interne restreint (quelques comptes réels,
  encadrement direct) car : l'authentification et l'autorisation sont testées en
  conditions réelles et solides, aucune donnée fictive n'apparaît dans le produit, les
  dégradations de service externes (email, stockage, sauvegardes) sont honnêtement
  affichées plutôt que masquées, et un bug de concurrence réel a été trouvé et corrigé
  avant tout incident.
- **PAS un GO for private beta à plus grande échelle**, et encore moins pour une
  production publique, parce que : aucune base de données réellement gérée n'existe
  (SQLite fichier unique, un seul process serveur possible), aucune sauvegarde réelle
  n'existe (une perte du fichier `dev.db` serait irréversible), aucun email de
  notification ne part (dégrade l'expérience à plus grande échelle), et plusieurs
  vérifications de ce sprint (régression scientifique complète, export sur base réelle,
  responsive, performance) n'ont pas été exécutées dans cette session.

## Prochaines étapes avant un GO plus large (à ne pas entreprendre dans ce sprint)

1. Provisionner PostgreSQL (Partie 1, bloqué) et rejouer la suite de tests dessus.
2. Exécuter les Parties 13, 14, 17, 18, 19 de `ACADIA_P18_TEST_REPORT.md` (régression
   scientifique, export sur base réelle, responsive, performance).
3. Choisir et configurer un fournisseur email réel une fois disponible.
4. Mettre en place un service de sauvegarde réel avant toute donnée utilisateur réelle
   à grande échelle.

**STOP.** Ce sprint ne commence ni P19, ni Mobile Money, ni Pricing, ni Premium, ni
Marketplace, ni Admin UI, ni aucune nouvelle fonctionnalité scientifique.
