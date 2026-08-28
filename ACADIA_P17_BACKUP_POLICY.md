# ACADIA — Politique de sauvegarde P17

**Statut réel : politique préparée — aucun service de sauvegarde n'est configuré
aujourd'hui.** Ce document décrit ce qui devra être mis en place avant toute mise en
production réelle ; il ne décrit pas un système déjà opérationnel.

## Base de données

- **Développement (SQLite)** : aucune sauvegarde automatique. Le fichier
  `prisma/dev.db` est local et gitignoré — sa perte n'affecte que l'environnement de
  développement. Une copie manuelle avant une opération risquée reste la seule protection
  actuelle.
- **Production (PostgreSQL, non provisionné)** : recommandation — sauvegardes
  automatiques quotidiennes du fournisseur managé choisi (ex. Neon, Supabase, RDS — tous
  proposent des sauvegardes automatiques et un point-in-time recovery), rétention minimale
  recommandée de 7 jours pour une bêta, 30 jours une fois des utilisateurs réels actifs.

## Documents

Aucun stockage de document distant n'est configuré (`DocumentStorageProvider` reste sur
l'implémentation de développement locale — voir
`ACADIA_P17_PRODUCTION_ARCHITECTURE.md` §9). La sauvegarde des documents dépendra du
fournisseur cloud choisi (S3/R2/Supabase Storage proposent généralement une réplication
et un versionnage natifs).

## Rétention

Non définie formellement — à fixer avec l'équipe/l'institution avant toute mise en
production réelle (ex. durée de conservation des mémoires soumis après la fin d'une année
académique).

## Test de restauration

Aucun test de restauration n'a été effectué (aucune sauvegarde n'existe encore à
restaurer). À prévoir dès qu'un service de sauvegarde réel est configuré : une
restauration non testée n'est pas une garantie.

## Plan de reprise après sinistre

Non formalisé. Recommandation minimale pour la suite : documenter le délai de reprise
visé (RTO) et la perte de données maximale tolérée (RPO) une fois un hébergeur de
production choisi.

## Résumé honnête

**Policy prepared — backup service not yet configured.**
