# Deployment plan

Written for the next Claude Code session to execute when the user asks to
deploy this app. Read this whole file before doing anything — steps are
ordered and later ones assume earlier ones are done. Do not skip the
verification steps; several of them exist because a specific mistake was
already made once while building this feature (see the notes inline).

**Do not start deploying just because this file exists.** Deploying is an
outward-facing, hard-to-reverse action (it publishes the app and changes the
user's real Supabase project and, later, a live domain). Confirm with the
user that they want to proceed before running Step 3 onward, per your
standing safety rules — reading and summarizing this plan does not count as
that confirmation.

## Where things stand (as of writing)

- Repo: `SRILSHUKLA/fifa_tracker` on GitHub, remote `origin`.
- App: Next.js 16 (App Router) + Supabase (Postgres/Auth/RLS). No app
  server — the browser talks to Postgres via PostgREST, so **there is no
  backend to deploy separately**; deploying the Next.js app to Vercel is the
  entire deployment.
- Branch `main` is the default branch and has NOT yet received the groups
  feature. All of that work is on `feature/groups`
  (`origin/feature/groups`), one commit ahead of `main`: "Replace friends
  system with groups".
- **There were uncommitted changes on `feature/groups`** as of this plan
  being written — a bugfix for a duplicate-React-key console error in
  `getMyGroups` (it was missing a `.eq("user_id", userId)` filter, so RLS
  returned one row per fellow group member instead of one row per group).
  Check `git status` first: if these are still uncommitted, commit them
  before doing anything else. If a later session already committed them,
  this note is stale — trust `git log`, not this paragraph.
- The user has already run `0001_init.sql`, `0002_seed_teams.sql`, and
  `0003_groups.sql` against their **live** Supabase project by hand by
  pasting them into the SQL editor (there is no automated migration runner
  against the live project — see "Database" below for why, and how to
  confirm the live schema is actually current before deploying app code
  that expects it).
- No `.vercel/` directory in the repo and no Vercel project is known to
  exist yet for this app. Treat this as a first-time deployment unless you
  find evidence otherwise (ask the user, or check for an existing project
  at vercel.com if you have browser access).

## Step 1 — Verify the working tree and get everything on `main`

```bash
git status --short
git log --oneline -5
```

1. If there are uncommitted changes, read them, make sure they look
   intentional (not half-finished work), and commit them on
   `feature/groups` with a clear message. Do not deploy with uncommitted
   changes.
2. Merge `feature/groups` into `main` and push:

   ```bash
   git checkout main
   git pull origin main
   git merge feature/groups
   git push origin main
   ```

   If `push` is rejected by branch protection, open a PR instead (`gh pr
   create` if the `gh` CLI is available and authenticated, otherwise give
   the user the compare URL —
   `https://github.com/SRILSHUKLA/fifa_tracker/compare/main...feature/groups`
   — and ask them to merge it, since you cannot approve/merge a protected
   branch yourself).
3. Confirm the merge is what you expect: `git log --oneline -5` on `main`
   should show the groups-feature commit(s) at the top.

## Step 2 — Confirm the build is actually green on `main`

Do not trust that it was green on the feature branch — verify again on
`main` after the merge, since a merge can silently break things a
fast-forward wouldn't.

```bash
npm install
npm run verify:db
npx tsc --noEmit
npm run lint
npm run build
```

All four must succeed with no errors before continuing. `verify:db` runs the
full migration set against an in-memory Postgres (PGlite) and checks ~47
RLS/stats assertions — if this fails, the problem is in
`supabase/migrations/`, not in Vercel, and must be fixed before deploying.

## Step 3 — Confirm the *live* Supabase project's schema matches `main`

**Why this matters and can't be skipped:** this repo has no application
server and no automated migration-deploy pipeline — `supabase/verify.mjs`
only proves the SQL is correct in isolation (PGlite), not that it has
actually been pasted into the live project. The app was already broken once
during development because a migration assumed a clean database but the
live project had leftover test data (`matches` rows with no `group_id`);
see the `delete from public.matches where group_id is null;` line in
`supabase/migrations/0003_groups.sql` for the fix that was needed. Confirm
the live schema is current before pointing a deployed app at it.

1. Ask the user for their Supabase project ref/URL if you don't already
   know it (it's in `.env.local`, `NEXT_PUBLIC_SUPABASE_URL` — do not print
   the anon key or paste it anywhere other than Vercel's own env var UI).
2. In the Supabase SQL editor for that project, run:

   ```sql
   select routine_name from information_schema.routines
   where routine_schema = 'public'
     and routine_name in ('create_group', 'join_group', 'get_group_leaderboard')
   order by routine_name;
   ```

   All three should come back. If any are missing, the live project does
   not have `0003_groups.sql` applied yet — tell the user and have them
   paste `supabase/migrations/0001_init.sql`, then `0002_seed_teams.sql`,
   then `0003_groups.sql` into the SQL editor, in that order, before you go
   any further. All three files are idempotent (safe to re-run) if some
   already ran.
3. Also sanity-check there's no lingering `friendships` table or `leaderboard`
   view (both should have been dropped by `0003_groups.sql`):

   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' and table_name = 'friendships';
   select table_name from information_schema.views
   where table_schema = 'public' and table_name = 'leaderboard';
   ```

   Both queries should return zero rows. If they don't, `0003_groups.sql`
   did not fully apply — do not proceed until this is clean, since the app
   code no longer knows how to talk to the old friends schema at all.

## Step 4 — Supabase Auth settings for the production domain

You will not have the final Vercel URL until after Step 5, so this step
has two halves: gather the info now, apply it after.

1. Decide the production URL. If the user has a custom domain, use that;
   otherwise it will be `https://<project-name>.vercel.app` and you'll only
   know the exact value once Vercel creates the project in Step 5.
2. **After** you know the URL, in the Supabase dashboard under
   **Authentication → URL Configuration**:
   - Set **Site URL** to the production URL.
   - Add `https://<production-domain>/**` to the **Redirect URLs**
     allow-list (keep any existing `http://localhost:3000/**` entry too, so
     local dev keeps working).
   This step needs a human or browser access to the Supabase dashboard —
   if you have the Browser tool, you can navigate there and describe what
   to click, but do not enter or approve anything without the user present,
   since this is an account settings change.

## Step 5 — Deploy to Vercel

Check first whether a Vercel project already exists for this repo (ask the
user, or check the Vercel dashboard if you have browser access). Then:

### If no Vercel project exists yet (first deploy)

This requires the user's own Vercel account and cannot be fully automated
by Claude — connecting a GitHub repo to Vercel and setting environment
variables happens through Vercel's dashboard (or `vercel login`, which is
an interactive OAuth flow you cannot complete on the user's behalf). Guide
the user through it rather than attempting it yourself:

1. Have the user go to [vercel.com/new](https://vercel.com/new), import
   `SRILSHUKLA/fifa_tracker`, and set the production branch to `main`
   (Vercel defaults to this — just confirm it).
2. Before the first deploy, they add two environment variables (from
   `.env.local` — the same public, RLS-protected values already in the
   repo's `.env.local.example`, just with real values):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the publishable/anon key — never the
     `service_role` key)
   Framework preset should auto-detect as Next.js; no build command
   overrides are needed (`next build` / `next start` are the defaults and
   match this repo's `package.json` scripts).
3. Trigger the deploy (Vercel does this automatically on import, and on
   every push to `main` after that).
4. Once deployed, note the assigned `https://<project-name>.vercel.app` URL
   and go back and finish Step 4.

### If a Vercel project already exists and is connected to `main`

Nothing to do here — the `git push origin main` in Step 1 already triggered
a deploy. Just wait for it and move to Step 6. If you have the `vercel` CLI
available and linked (`.vercel/` directory present), `npx vercel ls` or
`npx vercel inspect <deployment-url>` can confirm status without needing
browser access; otherwise ask the user to check the Vercel dashboard, or
use the Browser tool to check it yourself if available.

## Step 6 — Post-deploy smoke test

Do this for real, against the deployed URL, not localhost. If you have
browser access, drive it yourself and report back with what you saw
(screenshots help); otherwise walk the user through it.

1. Open the production URL signed out — it should redirect to `/login`
   (confirms `proxy.ts`'s auth gate is working in production, not just
   dev).
2. Sign up a fresh test account (or sign in with an existing one).
3. Create a group, confirm the invite code/link appears.
4. In a second browser session (or ask the user to do this from their
   phone), open the invite link and join.
5. Log a match between the two accounts, confirm it shows up on:
   - The group's leaderboard (`/leaderboard`, with the new group active)
   - The group detail page's recent matches
   - `/history`
6. Confirm a **third** account that is not in that group cannot see any of
   it — this is the entire point of the groups feature (see the git log
   message on the groups commit for the leakage bug it fixes) and is worth
   explicitly re-checking in production, not just trusting `verify:db`.
7. Check the Vercel deployment's function logs (or `npx vercel logs`) for
   any server errors during the above — RLS denials should surface as
   friendly toasts in the UI, not 500s; a 500 means something is
   misconfigured (usually the env vars from Step 5, or a Step 3 schema
   mismatch).

## Step 7 — If something goes wrong

- **Vercel deploy fails at build**: re-run `npm run build` locally on the
  exact commit that failed (`git checkout <sha>`) — Vercel's build
  environment should match what Step 2 already verified, so a local repro
  is the fastest way to see the real error.
- **App loads but every page errors**: almost always Step 3 or Step 5's env
  vars — recheck the live schema has `0003_groups.sql`, and that
  `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel match
  the same project you verified in Step 3 (a stale or wrong project ref
  here is a common mistake).
- **Rollback**: Vercel keeps every previous deployment; use the dashboard's
  "Promote to Production" on the last-known-good deployment, or `npx vercel
  rollback` if the CLI is linked. This does not touch the Supabase schema —
  a schema rollback (re-adding `friendships`, dropping `groups`) is not
  scripted anywhere and would need to be written by hand if it's ever
  actually needed; flag this to the user rather than improvising destructive
  SQL under pressure.

## Known gaps to mention to the user (not blockers, but not done)

- No group deletion or ownership-transfer flow yet (documented as
  intentionally out of scope in `supabase/migrations/0003_groups.sql`'s
  comments — a group with match history can't be deleted because
  `matches.group_id` is `ON DELETE RESTRICT`).
- `types/database.types.ts` is hand-written, not generated from the live
  project. If the user ever runs
  `npx supabase gen types typescript --project-id <ref>`, diff the result
  against the current file before overwriting it — the hand-written
  version has comments explaining several non-obvious choices (e.g. why
  `groups.Insert` is `never`) that a raw codegen output won't preserve.
- Free-tier Supabase projects pause after a week of inactivity and need a
  manual click in the dashboard to wake up — worth knowing if a deploy
  "works" but the app hangs on every request.
