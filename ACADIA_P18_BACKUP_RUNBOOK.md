# ACADIA — Runbook de sauvegarde (P18-FINAL)

## Statut

**Mécanisme prouvé sur SQLite de développement (P18) ; service managé PostgreSQL non
configuré (dépend de `ACADIA_P18_POSTGRES_RUNBOOK.md`, toujours bloqué).**

## Ce qui a été réellement prouvé (P18, reconduit ici)

Cycle complet exécuté avec des données réelles (fixture clairement identifiée) :
1. Backup réel (copie du fichier `prisma/dev.db`).
2. Vérification du contenu de la copie via une instance Prisma séparée.
3. Simulation de perte (suppression réelle d'un enregistrement).
4. Restauration réelle (écrasement par la sauvegarde).
5. Vérification que l'enregistrement perdu est bien de retour.

Détail complet dans `ACADIA_P18_FINAL_TEST_REPORT.md` Blocker 2.

## Procédure une fois PostgreSQL managé disponible (Neon ou Supabase)

Les deux fournisseurs recommandés dans `ACADIA_P18_POSTGRES_RUNBOOK.md` proposent des
sauvegardes automatiques natives — aucun outillage supplémentaire à construire :

- **Neon** : point-in-time recovery natif (rétention selon le plan — 24h en gratuit,
  jusqu'à 30 jours en payant). Restauration via un « branch » Neon pointé sur un instant
  passé, sans opération manuelle de dump/restore.
- **Supabase** : sauvegardes quotidiennes automatiques sur le plan Pro (rétention 7
  jours), point-in-time recovery en option payante supplémentaire.

### Test à effectuer une fois le fournisseur choisi

1. Créer un jeu de données réel (utilisateur, projet, soumission, feedback,
   notifications, audit logs) — fixture clairement identifiée.
2. Déclencher/attendre une sauvegarde automatique du fournisseur.
3. Simuler une perte (suppression volontaire d'un enregistrement sur
   l'environnement de staging, jamais en production).
4. Restaurer via l'outil du fournisseur (branch Neon / restauration Supabase).
5. Comparer avant/après : utilisateur, projet, questionnaire, dataset, supervision,
   soumissions, feedback, audit logs — tous doivent être identiques à l'état
   pré-perte.
6. Documenter le RTO (délai de restauration observé) et le RPO (perte de données
   maximale tolérée par la fréquence réelle des sauvegardes du fournisseur choisi).

## Rétention recommandée

7 jours minimum pour une bêta privée ; 30 jours une fois des utilisateurs réels actifs
et des mémoires réels en cours de rédaction (perte de plusieurs semaines de travail
académique = risque inacceptable pour un étudiant).

## Ce qui reste non fait

Aucun test réel contre un fournisseur managé (aucun compte disponible). Ce runbook
documente la procédure exacte à exécuter dès que `ACADIA_P18_POSTGRES_RUNBOOK.md` est
levé — il ne remplace pas l'exécution réelle.
