# CR3@TIX ANALYTIX

Plateforme personnelle de Web Analytics, erreurs, Web Vitals et monitoring de santé reliée au projet Supabase existant **CR3ATIX-MAP**.

## Application publiée

- Dashboard : https://kevinlabens-del.github.io/CR3-TIX-ANALYTIX./
- Dépôt : https://github.com/kevinlabens-del/CR3-TIX-ANALYTIX.

## Architecture

`Projet → analytics.js → analytix-collect → validation → CR3ATIX-MAP`

- Le registre officiel est synchronisé automatiquement depuis `cr3atix_project_state.nodes`.
- Un projet retiré de MAP passe en `ARCHIVED` sans suppression de son historique.
- Le dashboard est privé via Supabase Auth et RLS. Les visiteurs ne créent aucun compte et ne peuvent rien lire.
- Aucune IP brute, aucun nom, aucun e-mail visiteur et aucun fingerprinting invasif ne sont stockés.
- Les événements bruts sont purgés après 45 jours, les statistiques agrégées restent disponibles.
- La vue LIVE interroge le backend toutes les 15 secondes pour économiser Realtime sur le plan gratuit.
- Le heartbeat d’engagement est limité à un envoi par minute ; `game_time` reste un événement de jeu explicite.

## Commandes locales

```bash
npm ci
npm run verify
npm run dev
```

## Intégration

Voir [docs/INTEGRATION.md](docs/INTEGRATION.md). Les identifiants publics de projet sont affichés dans chaque fiche du dashboard.
