# ACADIA — Domaine, HTTPS, DNS (P18, Partie 10)

## Statut

**Aucun nom de domaine n'est possédé ou configuré pour ACADIA.** L'application ne
tourne, dans cet environnement, qu'en développement local (`http://localhost:3000`).
Aucun accès à un registrar, un fournisseur DNS ou un service d'hébergement n'existe dans
ce contexte de travail — inventer une configuration DNS/HTTPS ici reviendrait à
halluciner un service qui n'existe pas.

## Par élément

| Élément | Statut |
|---|---|
| Nom de domaine | ⚪ Non possédé |
| DNS (A/AAAA/CNAME) | ⚪ Non applicable (pas de domaine) |
| Certificat HTTPS/TLS | ⚪ Non applicable (dev local en HTTP) |
| SPF (email) | ⚪ Non applicable (aucun fournisseur email configuré — voir `ACADIA_P18_EMAIL_STATUS.md`) |
| DKIM (email) | ⚪ Non applicable, même raison |
| DMARC (email) | ⚪ Non applicable, même raison |
| CORS | 🟡 Non configuré explicitement — l'application ne sert que ses propres routes API same-origin ; aucun appel cross-origin n'est fait par le frontend vers un autre domaine, donc aucune règle CORS n'a été nécessaire jusqu'ici |

## Ce qui devra être fait le jour où un domaine réel est disponible

1. Acheter/assigner un domaine, pointer son DNS vers l'hébergeur choisi.
2. Provisionner un certificat TLS (Let's Encrypt automatique via la plupart des
   hébergeurs modernes, ou certificat géré par le fournisseur).
3. Configurer SPF/DKIM/DMARC uniquement une fois qu'un fournisseur d'email réel
   (Partie 5) est choisi — ces enregistrements dépendent directement de ce fournisseur.
4. Revoir les en-têtes de sécurité déjà présents dans `next.config.ts`
   (`securityHeaders`) pour confirmer qu'ils restent cohérents une fois un domaine réel
   utilisé (ex. `Strict-Transport-Security`).

## Impact sur le verdict GO/NO-GO

N'empêche pas une bêta privée fonctionnant en HTTP local ou sur une plateforme
d'hébergement fournissant déjà HTTPS par défaut (Vercel, Railway...) avec un
sous-domaine généré automatiquement. Empêche en revanche toute promesse de domaine ou
d'adresse email institutionnelle propre à ACADIA tant qu'aucun domaine n'est acquis.
