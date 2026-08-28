# ACADIA — Guide de la supervision académique (P16)

## Pour un directeur de recherche

### 1. Activer votre espace directeur

Depuis **Paramètres → Rôle**, cliquez sur « Devenir directeur de recherche ». Aucune
vérification institutionnelle n'existe aujourd'hui : c'est une déclaration volontaire. Un
lien « Espace directeur » apparaît alors dans le menu.

### 2. Configurer votre canevas

Depuis **Espace directeur → Canevas académique**, définissez l'année académique, la
faculté/le département, les types de travaux encadrés, et la liste des étapes que vous
attendez de vos étudiants. Créer un nouveau canevas pour une nouvelle année académique
**ne supprime jamais** les canevas des années précédentes — ils restent consultables,
un seul est actif à la fois.

### 3. Inviter un étudiant

Depuis le tableau de bord de l'espace directeur, cliquez sur « Inviter un étudiant » :
un lien à usage unique est généré (expire après 14 jours). Partagez-le à votre étudiant
par le canal de votre choix (ACADIA n'envoie pas cet e-mail automatiquement tant qu'aucun
fournisseur d'email n'est configuré — voir `ACADIA_P16_EMAIL_ARCHITECTURE.md`).

### 4. Examiner une soumission

Quand un étudiant soumet une version, elle apparaît dans votre liste avec son statut réel.
Cliquez sur « Examiner » pour ouvrir la page de revue : résumé ACADIA (analyse préparatoire,
jamais une validation), comparaison avec la version précédente si elle existe, corrections
déjà ouvertes, contenu complet de la version actuelle.

### 5. Envoyer un feedback

Cochez chaque section (Sujet, Problématique, Objectifs, Hypothèses, Littérature,
Méthodologie, Questionnaire, Données, Analyse, Résultats, Discussion, Conclusion) comme
« OK », « À corriger » ou « Bloquant », ajoutez un commentaire si besoin, rédigez
l'évaluation générale, puis « Envoyer le feedback ». Chaque section marquée « à corriger »
ou « bloquant » devient automatiquement une correction suivie individuellement. Le texte
complet peut être copié (bouton « Copier le feedback ») ou partagé via WhatsApp (lien
`wa.me` standard, pas d'envoi automatique).

### 6. Valider ou redemander une correction

Une fois satisfait, cliquez sur « Valider cette version ». Sinon, « Demander une révision » —
l'étudiant en est notifié dans les deux cas.

## Pour un étudiant

### 1. Rejoindre l'espace de votre directeur

Ouvrez le lien d'invitation reçu de votre directeur (`/invite/<code>`), connectez-vous ou
créez votre compte, puis acceptez. Votre directeur apparaît alors dans la section
« Mon encadrement » de votre tableau de bord.

### 2. Soumettre une version

Depuis la page de votre recherche, cliquez sur « Soumettre au directeur ». Un message
optionnel peut accompagner votre soumission. Chaque soumission crée une nouvelle version —
aucune ancienne version n'est jamais écrasée.

### 3. Recevoir un feedback

Le feedback de votre directeur apparaît dans vos messages ACADIA et dans la section
« Mon encadrement ». Les corrections demandées y sont listées individuellement.

### 4. Soumettre une nouvelle version

Après correction, soumettez à nouveau — votre directeur retrouve automatiquement
l'historique complet et une comparaison avec la version précédente.

## Limites assumées

- Aucune vérification qu'un compte « directeur » correspond à un vrai enseignant.
- Aucun email réel n'est envoyé (voir `ACADIA_P16_EMAIL_ARCHITECTURE.md`).
- La comparaison de versions ne couvre que les champs réellement diffés (problématique,
  objectifs, hypothèses, variables/indicateurs, méthodologie de premier niveau,
  questionnaire, cadre théorique) — une correction sur une section non couverte (ex.
  « Discussion », « Conclusion ») reste toujours affichée comme non résolue, jamais
  déduite à tort.
