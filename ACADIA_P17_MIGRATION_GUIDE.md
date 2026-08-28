# ACADIA — Guide de migration P17

## Ce qui migre

1. `data/users.json` → table `User` (+ `PasswordResetToken`).
2. Les 10 fichiers `data/*.json` de supervision (P16) → tables Prisma correspondantes.
3. Le localStorage de chaque utilisateur authentifié (8 collections scopées par
   `userId`) → table `ResearchProject` (voir `ACADIA_P17_DATABASE_SCHEMA.md`).

## Migration des stores serveur (users + supervision)

Script `scripts/migrate-json-to-db.ts` (exécuté une fois, manuellement) :

- Mode **dry-run par défaut** (`--apply` requis pour écrire réellement) — affiche ce qui
  serait créé sans toucher la base.
- Lit chaque fichier `data/*.json` existant, insère une ligne par enregistrement dans la
  table correspondante.
- **Gestion des doublons** : une exécution répétée est idempotente — l'email (`User`), le
  code d'invitation (`SupervisorInvitation`), et l'id déjà existant (toutes les autres
  tables, id conservés identiques aux fichiers JSON d'origine) sont vérifiés avant
  insertion ; un enregistrement déjà présent est ignoré, jamais dupliqué.
- **Logs** : un résumé (créés / ignorés / erreurs) est affiché à la fin de chaque
  exécution.
- **Rollback** : les fichiers `data/*.json` d'origine ne sont **jamais supprimés** par le
  script — ils restent la sauvegarde de secours tant que la migration n'est pas confirmée
  manuellement stable. Un rollback consiste à revenir au commit précédent du code
  applicatif (qui lisait encore les fichiers JSON) ; la base nouvellement créée peut être
  vidée sans risque puisque les fichiers JSON sources n'ont pas été modifiés.

## Migration du localStorage vers la base (par utilisateur authentifié)

**Jamais migrée côté serveur en masse** : le serveur n'a structurellement aucun accès au
localStorage d'un navigateur (voir audit). La migration se fait donc **côté client, à la
connexion, uniquement pour l'utilisateur authentifié courant** :

1. Au montage de `ResearchContext` (utilisateur authentifié), le client interroge d'abord
   `GET /api/research-state`.
2. Si la base ne contient encore aucune donnée pour cet utilisateur **et** que le
   localStorage scopé (`acadia-*:{userId}`) en contient, le client envoie ces données à
   `PUT /api/research-state` **une seule fois** (marqueur `acadia-migrated:{userId}` posé
   en localStorage pour ne jamais rejouer la migration à chaque chargement).
3. **Garantie d'attribution correcte** : la route `PUT /api/research-state` associe
   systématiquement les données reçues à `session.user.id` (jamais un id envoyé par le
   client) — il est structurellement impossible de migrer les données d'un compte vers un
   autre compte, puisque seul l'utilisateur authentifié peut déclencher sa propre
   migration, vers sa propre ligne.
4. Une fois migré, le localStorage reste un cache local (write-through) — il n'est plus la
   source de vérité (voir `ACADIA_P17_PRODUCTION_ARCHITECTURE.md` §4).

## Exécuter la migration des stores serveur

```bash
# Aperçu sans écriture
npx tsx scripts/migrate-json-to-db.ts

# Application réelle
npx tsx scripts/migrate-json-to-db.ts --apply
```

## Vérification post-migration

- Comparer le nombre d'enregistrements par fichier JSON source au nombre de lignes
  correspondantes en base (affiché par le script).
- Se connecter avec un compte existant et vérifier que le profil/rôle est identique à
  avant migration.
- Vider le localStorage du navigateur, se reconnecter, vérifier que les recherches d'un
  compte de test reviennent bien depuis la base (voir `ACADIA_P17_TEST_REPORT.md`, test de
  bout en bout).
