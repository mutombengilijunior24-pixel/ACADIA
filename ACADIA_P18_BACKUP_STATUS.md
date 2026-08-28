# ACADIA — Sauvegardes (P18, Partie 7 — reconduction de l'audit P17)

## Statut

**Inchangé depuis P17 : aucun service de sauvegarde réel n'est configuré.** La politique
complète reste `ACADIA_P17_BACKUP_POLICY.md` — ce document confirme, à la date de ce
sprint, qu'aucun élément de ce constat n'a changé :

- Toujours pas de PostgreSQL managé provisionné (voir `ACADIA_P18_POSTGRES_BLOCKER.md`) —
  donc toujours pas de sauvegarde automatique/point-in-time recovery possible.
- Toujours pas de stockage documentaire distant configuré (`DocumentStorageProvider`
  reste sur `LocalDevDocumentStorageProvider`, voir §4 de `ACADIA_P18_AUDIT.md`) — donc
  toujours aucune réplication de documents.
- Aucun test de restauration n'a été effectué, pour la même raison qu'en P17 : il
  n'existe aucune sauvegarde réelle à restaurer.

## Ce qui est réellement possible aujourd'hui, en développement

La seule protection actuelle est manuelle : `prisma/dev.db` (SQLite) est un fichier local
gitignoré ; une copie manuelle avant une opération risquée (migration, script de masse)
reste la seule sauvegarde disponible dans cet environnement. Ce n'est pas une politique
de production et ne doit jamais être présenté comme telle.

## Résumé honnête

**Policy prepared — backup service still not configured.** Aucune régression ni
amélioration depuis P17 : ce point reste un blocage identique pour tout verdict de
production à grande échelle, mais n'empêche pas, à lui seul, une bêta privée à très
petite échelle où la perte de données serait limitée et récupérable manuellement.
