## Ce que change cette demande

<!-- Le comportement avant, le comportement après. Pas la liste des fichiers. -->

## Pourquoi

<!-- Le besoin, le défaut constaté, ou le critère du PRD concerné. -->

## Vérifications

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] `npm run db:verify` — obligatoire si une migration est touchée
- [ ] Contrôle à l'écran, sur un build de production (`npm run build && npm run start`)

## Preuve

<!-- Capture, sortie de commande, ou mesure. Une demande sans preuve se relit mal. -->

## Base de données

- [ ] Aucune migration
- [ ] Migration ajoutée (`supabase/migrations/000N_*.sql`) — rejouable sur une base vierge
