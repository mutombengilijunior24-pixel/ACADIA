# ACADIA — Statut du service email (P18, Partie 5)

## Statut

**Aucun fournisseur d'email réel n'est configuré.** `lib/email/EmailProvider.ts` n'a
qu'une seule implémentation active, `NoOpEmailProvider` : elle n'envoie jamais rien et
journalise chaque tentative dans la table Prisma `EmailLog` avec `status:
"not_configured"`. `resolveProvider()` ne bascule vers un fournisseur réel que si
`EMAIL_PROVIDER`/`EMAIL_API_KEY` sont un jour renseignés — ce qui n'est pas le cas
aujourd'hui (confirmé par relecture de `.env.local` et `.env.example`).

## Vérification demandée par ce sprint : le texte client dit-il bien « non configuré » ?

**Avant correction (constat de l'audit) :** le serveur exposait déjà correctement
`{ email: { status: "not_configured" } }` dans les réponses de
`/api/supervision/submissions` (POST) et `/api/supervision/feedback` (POST), mais
**aucun composant client ne lisait ce champ** :

- `SupervisionContext.submitVersion()` ne retournait que `{ submission }`, en jetant
  silencieusement `email`.
- `SubmitVersionButton.tsx` affichait uniquement « Version soumise avec succès. », sans
  aucune mention du canal de notification.
- La page directeur `app/dashboard/supervisor/review/[submissionId]/page.tsx` affichait
  déjà le texte du feedback avec des boutons « Copier » / « Copier pour WhatsApp » —
  un choix de conception qui, de fait, supposait déjà l'absence d'email automatique —
  mais le titre disait « Feedback envoyé », ce qui pouvait laisser croire qu'un envoi
  électronique avait eu lieu.

Aucun de ces trois emplacements n'affirmait explicitement qu'un email avait été envoyé
(pas de mensonge actif), mais aucun n'informait non plus l'utilisateur que ce n'était
*pas* le cas — un silence qui va à l'encontre de la règle du sprint : mieux vaut afficher
« Email non configuré » que ne rien dire du tout et laisser l'utilisateur supposer.

## Correction appliquée dans ce sprint

1. `contexts/SupervisionContext.tsx` : `submitVersion()` retourne désormais aussi
   `email: { status }` reçu du serveur.
2. `components/supervision/SubmitVersionButton.tsx` : après une soumission réussie,
   si `emailStatus === "not_configured"`, affiche : *« Aucun email n'a été envoyé
   (service email non configuré) — votre directeur verra cette soumission directement
   dans son espace ACADIA. »*
3. `app/dashboard/supervisor/review/[submissionId]/page.tsx` : le titre devient
   « Feedback enregistré dans ACADIA » (au lieu de « Feedback envoyé ») et une note
   apparaît sous le texte du feedback si `sentEmailStatus === "not_configured"` :
   *« Aucun email n'a été envoyé automatiquement (service email non configuré) —
   l'étudiant verra ce feedback dans son espace ACADIA ; utilisez la copie ou WhatsApp
   ci-dessus si vous souhaitez le prévenir directement. »*

Le flux mot de passe oublié (`app/forgot-password/page.tsx`) affichait déjà, depuis P13,
un message honnête (« Aucun service d'email n'est encore connecté en version bêta —
voici directement votre lien de réinitialisation ») : aucune correction nécessaire là.
Le flux d'invitation directeur→étudiant (`app/dashboard/supervisor/page.tsx`) fonctionne
de la même manière : il génère un lien affiché directement à l'écran, jamais un message
prétendant un envoi par email.

## Ce qui reste NON CONFIGURÉ (rappel, sans invention de solution)

- Aucune variable `EMAIL_PROVIDER` / `EMAIL_API_KEY` n'existe dans l'environnement.
- Aucun compte SMTP, Resend, SendGrid, Mailgun ou équivalent n'est disponible dans ce
  contexte de développement.
- Tant qu'aucun de ces éléments n'est fourni, tout texte affirmant « email envoyé » côté
  client resterait un mensonge produit — ce document sert de référence pour éviter d'en
  réintroduire un par inadvertance dans un sprint futur.

## Impact sur le verdict GO/NO-GO

Ce point, à lui seul, n'empêche pas un déploiement en bêta privée à petite échelle
(les utilisateurs interagissent déjà directement dans l'application ; l'email n'est
qu'un canal de notification secondaire). Il empêcherait en revanche un déploiement
public à grande échelle, où l'absence de notifications email dégraderait
significativement l'expérience (utilisateurs ne revenant pas consulter l'application).
