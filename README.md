# FIFA Score Tracker

Log 1v1 FIFA results from your phone, then argue about the head-to-head record
with evidence. Mobile-first, black-and-red, and built to sit entirely on free
tiers.

- **Frontend** — Next.js (App Router) + Tailwind CSS + shadcn/ui + lucide-react
- **Backend** — Supabase (Postgres, Auth, Row Level Security)
- **Hosting** — Vercel

There is no application server. The browser talks to Postgres through PostgREST
using the signed-in user's JWT, and the RLS policies in
`supabase/migrations/` are the authorization layer.

## Features

- Email + password auth, one-step signup with a username
- **Groups**: create a group and share its invite code or link so up to 11
  people can join directly — no adding people one at a time. Two people only
  see each other's stats, and can only log a match against each other, if
  they share a group
- Match logging with tap-friendly score steppers and a searchable team picker
  (~160 clubs and national sides across the top five leagues)
- Group leaderboard — 3 points a win, 1 a draw, tiebreak on goal difference,
  with win rate alongside it
- Head-to-head dashboard per group: record, aggregate goals, averages, recent
  meetings, and a team-based breakdown of which team you actually do well
  with against that opponent
- Scrollable match history, scoped to the group you're currently viewing

## Getting started

Requires Node 20+ and a free Supabase project. Nothing else — no Docker.

### 1. Install

```bash
npm install
```

### 2. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) and pick a region
   near you.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then
   `supabase/migrations/0002_seed_teams.sql`, then
   `supabase/migrations/0003_groups.sql`, in that order. All three are safe
   to re-run.
3. Under **Authentication → Sign In / Providers → Email**, turn off
   *Confirm email*. For a friends-only app this makes signup one step on a
   phone; leave it on if you would rather verify addresses.

### 3. Configure the environment

```bash
cp .env.local.example .env.local
```

Fill in the Project URL and the `anon` public key from **Project Settings →
API Keys**. Both are meant to be public — RLS is what protects the data.

### 4. Run it

```bash
npm run dev
```

Open <http://localhost:3000>. To try it on your actual phone, find your
machine's LAN IP (`ipconfig` on Windows) and visit
`http://<that-ip>:3000` from a device on the same Wi-Fi.

### Verifying the schema

The migrations are covered by a test suite that runs them against a real
Postgres in-process (PGlite — no Docker, no live project) and then exercises
the stats layer and every RLS policy:

```bash
npm run verify:db
```

It checks, among other things, that `winner_id` follows the score, that a
group's leaderboard points equal `3W + D`, that head-to-head totals mirror
correctly between two players within a group, that the same pair of people
sharing two different groups never has one group's stats bleed into the
other's, and that you cannot log a match against someone outside the group,
between two other people, or in someone else's name. Run it after any change
to `supabase/migrations/`.

### Regenerating database types

`types/database.types.ts` is hand-written to match the migrations. After
changing the schema, regenerate it:

```bash
npx supabase gen types typescript --project-id <your-project-ref> > types/database.types.ts
```

## Deploying

1. Push to a GitHub repo.
2. Import it into Vercel and add `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` as environment variables.
3. In Supabase under **Authentication → URL Configuration**, set the Site URL
   to your Vercel domain and add `https://<your-domain>/**` to the redirect
   allow-list.

Free Supabase projects pause after a week of inactivity and need a click in the
dashboard to wake up.

## Schema at a glance

| Table | Purpose |
| --- | --- |
| `profiles` | Public identity, 1:1 with `auth.users`. Email never leaves `auth`. |
| `groups` | One row per group. Holds the invite code members join with. |
| `group_members` | One row per (group, user), with a `role` of `owner` or `member`. |
| `teams` | Seeded reference data. |
| `matches` | One row per match, tied to exactly one `group_id`. `winner_id` is a generated column, so the recorded result can never contradict the score. |

Stats are computed in SQL, not in the browser. `player_match_results` flattens
each match into two player-perspective rows (carrying `group_id` along with
it), and the `get_group_leaderboard` / `get_h2h_stats` / `get_h2h_team_stats`
functions aggregate over it, filtered to one group at a time. There is no
global, cross-group leaderboard: `groups` and `matches` are only readable by
people who share the relevant group (see the RLS policies in
`supabase/migrations/0003_groups.sql`), so nothing about one group is visible
from another, even when the same two people belong to both.
