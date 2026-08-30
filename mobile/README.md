# Bragging Rights — mobile

iOS & Android app for the FIFA tracker, built with Expo (SDK 57), Expo Router,
[HeroUI Native](https://heroui.com/docs/native/getting-started) and
[Uniwind](https://uniwind.dev/) (Tailwind v4 for React Native). Talks to the
same Supabase project as the web app — all business logic still lives in
Postgres RPCs/RLS, so nothing is duplicated.

## Setup

```bash
npm install
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
npm start              # Metro bundler; press i / a for simulator/emulator
```

Other scripts: `npm run ios`, `npm run android`, `npm run lint`,
`npm run typecheck`, `npm run format`.

## Structure

```
src/
  app/                 # Expo Router screens
    (auth)/            #   login / signup (redirects signed-in users)
    (tabs)/            #   Home · Table · Groups · Leagues + log-match FAB
    history.tsx        #   personal stats + paginated match history
    match/new|edit     #   modal flows for logging & correcting results
    groups/*           #   create / join / [groupId] detail / H2H pages
    leagues/*          #   new league / league detail with fixtures
  components/          # shared UI (stat tiles, match card, pickers, tables…)
  lib/
    supabase.ts        # client with AsyncStorage session persistence
    auth.tsx           # session + profile provider
    active-group.tsx   # AsyncStorage-backed "active group" (cookie parity)
    queries/           # typed Supabase queries mirroring lib/queries in web
    hooks.ts           # TanStack Query hooks + invalidation helpers
  types/               # database.types.ts (same as web)
```

## Design notes

- Dark-only palette lifted from the web app's `globals.css` (overridden in
  `src/global.css` via HeroUI Native theme variables); Geist fonts loaded at
  startup.
- Bottom tab bar mirrors the web's: raised red FAB dead centre.
- Pickers (opponent/team/group) are bottom sheets with search — thumb-first
  replacements for the web's popovers/comboboxes.
- Winner is never decided client-side: scores post to `matches` and the DB's
  generated column decides, exactly like web.
