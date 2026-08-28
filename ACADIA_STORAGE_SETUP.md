# ACADIA — Stockage de documents : configuration Cloudflare R2 (P18-FINAL)

## Statut

**Code prêt (`lib/server/documents/R2DocumentStorageProvider.ts`), non activé.** Aucun
compte Cloudflare R2 n'est disponible dans cet environnement. L'implémentation
`LocalDevDocumentStorageProvider` reste active tant que les variables ci-dessous ne sont
pas fournies.

## Ce qui a été préparé dans ce sprint

- `lib/server/documents/R2DocumentStorageProvider.ts` : implémentation réelle de
  l'interface `DocumentStorageProvider` (upload/download/delete/getMetadata/
  getSignedUrl) via le SDK AWS S3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`),
  R2 étant compatible S3. Installée et testée pour la compilation (`tsc`/`build`
  passent), **jamais exécutée contre un vrai bucket** (aucun compte disponible).
- `resolveDocumentStorageProvider()` dans `DocumentStorageProvider.ts` bascule
  automatiquement vers R2 si et seulement si `STORAGE_PROVIDER="r2"` **et** les 4
  identifiants sont tous présents ; sinon repli silencieux sur le stockage local, avec
  un message d'avertissement serveur explicite si la configuration est incomplète.
- Aucun document n'est rendu public par défaut : `getSignedUrl()` génère une URL signée
  à expiration de 1 heure, jamais un accès public permanent.

## Étape à faire par le propriétaire du projet

1. Créer un compte Cloudflare (gratuit) : https://dash.cloudflare.com
2. Activer R2 (Storage → R2 Object Storage). **Coût** : 0,015$/Go/mois stocké, premiers
   10 Go gratuits par mois, aucun frais de sortie (egress) contrairement à S3 — avantage
   pour un usage académique à trafic modéré.
3. Créer un bucket, ex. `acadia-documents-staging`.
4. Créer un jeton API R2 (Manage R2 API Tokens) avec permissions lecture/écriture sur ce
   bucket uniquement.
5. Noter : Account ID (visible dans le tableau de bord Cloudflare), nom du bucket,
   Access Key ID, Secret Access Key.

## Variables à renseigner (jamais commitées)

```
STORAGE_PROVIDER="r2"
STORAGE_BUCKET="acadia-documents-staging"
STORAGE_R2_ACCOUNT_ID="<account id Cloudflare>"
STORAGE_ACCESS_KEY_ID="<access key R2>"
STORAGE_SECRET_ACCESS_KEY="<secret key R2>"
```

## Test à effectuer une fois configuré

1. `upload` un fichier de test → vérifier l'objet présent dans le bucket (tableau de
   bord Cloudflare).
2. `download` → contenu identique octet pour octet.
3. `getSignedUrl` → URL valide 1h, expire ensuite (tester après expiration).
4. `delete` → objet et métadonnées absents du bucket.
5. Confirmer qu'aucun objet n'est accessible sans URL signée (bucket privé par défaut —
   à vérifier dans les paramètres R2, ne jamais activer un accès public par défaut).

## Rappel important

**Ce provider n'est câblé à aucune fonctionnalité produit réelle aujourd'hui** (voir
`ACADIA_P18_FINAL_INFRA_AUDIT.md` §5) — les exports DOCX/PDF restent générés à la volée,
stateless, sans passer par ce stockage. Activer R2 rend le service disponible pour un
futur usage (upload de document par un étudiant, pièces jointes de supervision) sans
qu'aucune fonctionnalité ne l'utilise encore réellement.
