/**
 * Runs the FIFA Tracker migrations against a real Postgres (PGlite, PG17 WASM)
 * and exercises the stats layer, so the SQL is verified before it is pasted
 * into Supabase.
 *
 * Supabase-specific objects that PGlite does not have (the auth schema, the
 * anon/authenticated roles, auth.uid()) are stubbed first. auth.uid() is backed
 * by a session GUC so tests can "log in" as different users.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const MIGRATIONS = new URL("./migrations/", import.meta.url);

const db = new PGlite();

let failures = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        expected ${e}\n        got      ${a}`}`);
}

// --- Supabase stubs -------------------------------------------------------
await db.exec(`
  create schema if not exists auth;
  create role anon;
  create role authenticated;
  create role service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb default '{}'::jsonb
  );

  create or replace function auth.uid() returns uuid
  language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
`);
console.log("stubs      ok");

// --- The migrations under test -------------------------------------------
for (const file of ["0001_init.sql", "0002_seed_teams.sql"]) {
  await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  console.log(`${file}  ok`);
}

// Re-running must be a no-op (the user may paste them twice).
for (const file of ["0001_init.sql", "0002_seed_teams.sql"]) {
  await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
}
console.log("re-run     ok");

const login = (id) =>
  db.exec(`set request.jwt.claim.sub = '${id ?? ""}';`);

// --- Seed data ------------------------------------------------------------
const teams = await db.query(`select count(*)::int as n from public.teams`);
check("teams seeded exactly once", teams.rows[0].n, 165);

const leagues = await db.query(
  `select league, count(*)::int as n from public.teams group by league order by league`,
);
console.log("           " + leagues.rows.map((r) => `${r.league}=${r.n}`).join(", "));

// --- Signup trigger -------------------------------------------------------
const mk = async (email, username) => {
  const r = await db.query(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('username', $2::text)) returning id`,
    [email, username],
  );
  return r.rows[0].id;
};

const alice = await mk("alice@example.com", "alice");
const bob = await mk("bob@example.com", "bob");
const carol = await mk("carol@example.com", "carol");

const profiles = await db.query(
  `select username from public.profiles order by username`,
);
check(
  "handle_new_user created a profile per signup",
  profiles.rows.map((r) => r.username),
  ["alice", "bob", "carol"],
);

// Usernames are case-insensitively unique.
let dupError = null;
try {
  await mk("dup@example.com", "ALICE");
} catch (error) {
  dupError = error.message;
}
check("duplicate username rejected (case-insensitive)", dupError !== null, true);

check(
  "is_username_available says no for a taken handle",
  (await db.query(`select public.is_username_available('Alice') as a`)).rows[0].a,
  false,
);
check(
  "is_username_available says yes for a free handle",
  (await db.query(`select public.is_username_available('dave') as a`)).rows[0].a,
  true,
);

// --- Friendships ----------------------------------------------------------
await db.query(
  `insert into public.friendships (requester_id, addressee_id, status, responded_at)
   values ($1, $2, 'accepted', now())`,
  [alice, bob],
);

check(
  "are_friends is symmetric",
  [
    (await db.query(`select public.are_friends($1,$2) as f`, [alice, bob])).rows[0].f,
    (await db.query(`select public.are_friends($1,$2) as f`, [bob, alice])).rows[0].f,
  ],
  [true, true],
);
check(
  "are_friends false for strangers",
  (await db.query(`select public.are_friends($1,$2) as f`, [alice, carol])).rows[0].f,
  false,
);

// The unique-pair index blocks a mirrored duplicate request.
let pairError = null;
try {
  await db.query(
    `insert into public.friendships (requester_id, addressee_id) values ($1, $2)`,
    [bob, alice],
  );
} catch (error) {
  pairError = error.message;
}
check("reverse-direction duplicate friendship rejected", pairError !== null, true);

// --- Matches: the generated winner column ---------------------------------
const teamId = async (name) =>
  (await db.query(`select id from public.teams where name = $1`, [name])).rows[0].id;

const arsenal = await teamId("Arsenal");
const chelsea = await teamId("Chelsea");

const logMatch = (p1, p2, s1, s2, daysAgo) =>
  db.query(
    `insert into public.matches
       (player_one_id, player_two_id, player_one_score, player_two_score,
        player_one_team_id, player_two_team_id, created_by, played_at)
     values ($1,$2,$3,$4,$5,$6,$1, now() - ($7 || ' days')::interval)
     returning winner_id`,
    [p1, p2, s1, s2, arsenal, chelsea, String(daysAgo)],
  );

check("winner_id = player one on a home win", (await logMatch(alice, bob, 3, 1, 3)).rows[0].winner_id, alice);
check("winner_id = player two on an away win", (await logMatch(alice, bob, 1, 3, 2)).rows[0].winner_id, bob);
check("winner_id is null on a draw", (await logMatch(alice, bob, 2, 2, 1)).rows[0].winner_id, null);

// One more Alice win so the totals are not symmetrical.
await logMatch(bob, alice, 0, 4, 0);

let genError = null;
try {
  await db.query(
    `insert into public.matches
       (player_one_id, player_two_id, player_one_score, player_two_score, created_by, winner_id)
     values ($1,$2,1,0,$1,$1)`,
    [alice, bob],
  );
} catch (error) {
  genError = error.message;
}
check("winner_id cannot be written by hand", genError !== null, true);

let selfError = null;
try {
  await db.query(
    `insert into public.matches
       (player_one_id, player_two_id, player_one_score, player_two_score, created_by)
     values ($1,$1,1,0,$1)`,
    [alice],
  );
} catch (error) {
  selfError = error.message;
}
check("a player cannot play themselves", selfError !== null, true);

// --- Stats layer ----------------------------------------------------------
// Alice: W 3-1, L 1-3, D 2-2, W 4-0  ->  2W 1D 1L, GF 10, GA 6, 7 points
const board = await db.query(
  `select username, played::int, wins::int, draws::int, losses::int,
          goals_for::int, goals_against::int, goal_difference::int,
          points::int, win_pct
   from public.leaderboard order by points desc, goal_difference desc, username`,
);

check(
  "leaderboard: Alice's row",
  board.rows[0],
  {
    username: "alice", played: 4, wins: 2, draws: 1, losses: 1,
    goals_for: 10, goals_against: 6, goal_difference: 4, points: 7, win_pct: "50.0",
  },
);
check(
  "leaderboard: Bob's row is the mirror image",
  board.rows[1],
  {
    username: "bob", played: 4, wins: 1, draws: 1, losses: 2,
    goals_for: 6, goals_against: 10, goal_difference: -4, points: 4, win_pct: "25.0",
  },
);
check(
  "leaderboard: a player with no matches still appears on zero",
  board.rows[2],
  {
    username: "carol", played: 0, wins: 0, draws: 0, losses: 0,
    goals_for: 0, goals_against: 0, goal_difference: 0, points: 0, win_pct: null,
  },
);
check(
  "leaderboard points equal 3W + D for every row",
  board.rows.every((r) => r.points === r.wins * 3 + r.draws),
  true,
);

// --- H2H and friends RPCs (these read auth.uid()) -------------------------
await login(alice);

const h2h = await db.query(`select * from public.get_h2h_stats($1)`, [bob]);
check(
  "get_h2h_stats from Alice's side",
  {
    ...h2h.rows[0],
    played: Number(h2h.rows[0].played),
    wins: Number(h2h.rows[0].wins),
    draws: Number(h2h.rows[0].draws),
    losses: Number(h2h.rows[0].losses),
    goals_for: Number(h2h.rows[0].goals_for),
    goals_against: Number(h2h.rows[0].goals_against),
    last_played: undefined,
  },
  {
    played: 4, wins: 2, draws: 1, losses: 1,
    goals_for: 10, goals_against: 6,
    avg_goals_for: "2.50", avg_goals_against: "1.50",
    biggest_win_margin: 4, last_played: undefined,
  },
);

const friends = await db.query(`select * from public.get_friends()`);
check(
  "get_friends returns Bob with Alice's record against him",
  {
    username: friends.rows[0].username,
    played: Number(friends.rows[0].played),
    wins: Number(friends.rows[0].wins),
    draws: Number(friends.rows[0].draws),
    losses: Number(friends.rows[0].losses),
  },
  { username: "bob", played: 4, wins: 2, draws: 1, losses: 1 },
);
check("get_friends excludes non-friends", friends.rows.length, 1);

await login(bob);
const h2hBob = await db.query(`select * from public.get_h2h_stats($1)`, [alice]);
check(
  "get_h2h_stats is the mirror image from Bob's side",
  {
    wins: Number(h2hBob.rows[0].wins),
    losses: Number(h2hBob.rows[0].losses),
    goals_for: Number(h2hBob.rows[0].goals_for),
  },
  { wins: 1, losses: 2, goals_for: 6 },
);

await login(carol);
check(
  "get_h2h_stats zero-fills when they have never played",
  Number(
    (await db.query(`select played from public.get_h2h_stats($1)`, [alice]))
      .rows[0].played,
  ),
  0,
);

// --- search_users ---------------------------------------------------------
await login(alice);
const byPrefix = await db.query(`select * from public.search_users('bo')`);
check("search_users finds by username prefix", byPrefix.rows.map((r) => r.username), ["bob"]);
check("search_users reports the friendship status", byPrefix.rows[0].friendship_status, "accepted");

check(
  "search_users finds by exact email",
  (await db.query(`select username from public.search_users('CAROL@example.com')`))
    .rows.map((r) => r.username),
  ["carol"],
);
check(
  "search_users will not match a partial email",
  (await db.query(`select * from public.search_users('carol@exa')`)).rows.length,
  0,
);
check(
  "search_users excludes the caller",
  (await db.query(`select * from public.search_users('alice')`)).rows.length,
  0,
);

// --- RLS wiring -----------------------------------------------------------
const rls = await db.query(`
  select relname, relrowsecurity
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relname in ('profiles','friendships','teams','matches')
  order by relname
`);
check(
  "RLS enabled on all four tables",
  rls.rows.map((r) => `${r.relname}:${r.relrowsecurity}`),
  ["friendships:true", "matches:true", "profiles:true", "teams:true"],
);

const views = await db.query(`
  select c.relname,
         coalesce(
           (select option_value from pg_options_to_table(c.reloptions)
            where option_name = 'security_invoker'), 'unset') as security_invoker
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
  order by c.relname
`);
check(
  "both views are security_invoker (so they cannot bypass RLS)",
  views.rows.map((r) => `${r.relname}:${r.security_invoker}`),
  ["leaderboard:on", "player_match_results:on"],
);

const definers = await db.query(`
  select proname from pg_proc
  where pronamespace = 'public'::regnamespace and prosecdef
    and not exists (
      select 1 from unnest(coalesce(proconfig, '{}')) c where c like 'search_path=%'
    )
`);
check(
  "every security definer function pins search_path",
  definers.rows.map((r) => r.proname),
  [],
);

// --- RLS policies, actually enforced --------------------------------------
// Table owners bypass RLS, so these run as the `authenticated` role, which is
// the role PostgREST assumes for a signed-in user.
await db.exec(`grant usage on schema public to authenticated, anon;`);

/** Runs `sql` as `authenticated` with auth.uid() = userId; returns the error, or null. */
async function asUser(userId, sql, params = []) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userId}';`);
  try {
    await db.query(sql, params);
    return null;
  } catch (error) {
    return error.message;
  } finally {
    await db.exec(`reset role;`);
  }
}

const INSERT_MATCH = `
  insert into public.matches
    (player_one_id, player_two_id, player_one_score, player_two_score, created_by)
  values ($1,$2,$3,$4,$5)`;

check(
  "a friend CAN log a match they played in",
  await asUser(alice, INSERT_MATCH, [alice, bob, 1, 0, alice]),
  null,
);
check(
  "logging a match between two OTHER people is blocked",
  (await asUser(alice, INSERT_MATCH, [bob, carol, 5, 0, alice])) !== null,
  true,
);
check(
  "logging a match against a NON-FRIEND is blocked",
  (await asUser(alice, INSERT_MATCH, [alice, carol, 9, 0, alice])) !== null,
  true,
);
check(
  "attributing created_by to someone else is blocked",
  (await asUser(alice, INSERT_MATCH, [alice, bob, 1, 0, bob])) !== null,
  true,
);

const someMatch = (
  await db.query(
    `select id from public.matches where created_by = $1 limit 1`,
    [alice],
  )
).rows[0].id;

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${bob}';`);
const bobDelete = await db.query(
  `delete from public.matches where id = $1 returning id`,
  [someMatch],
);
await db.exec(`reset role;`);
check("deleting someone else's match affects no rows", bobDelete.rows.length, 0);

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${carol}';`);
const carolSeesFriendships = await db.query(`select id from public.friendships`);
const carolSeesMatches = await db.query(`select id from public.matches`);
await db.exec(`reset role;`);
check(
  "friendships you are not part of are invisible",
  carolSeesFriendships.rows.length,
  0,
);
check(
  "matches ARE globally readable, which is what makes the leaderboard global",
  carolSeesMatches.rows.length > 0,
  true,
);

check(
  "sending a friend request in someone else's name is blocked",
  (await asUser(
    carol,
    `insert into public.friendships (requester_id, addressee_id) values ($1,$2)`,
    [alice, bob],
  )) !== null,
  true,
);
check(
  "sending your own friend request is allowed",
  await asUser(
    carol,
    `insert into public.friendships (requester_id, addressee_id) values ($1,$2)`,
    [carol, alice],
  ),
  null,
);

await db.exec(`set role authenticated; set request.jwt.claim.sub = '${carol}';`);
const carolEditsAlice = await db.query(
  `update public.profiles set display_name = 'hacked' where id = $1 returning id`,
  [alice],
);
await db.exec(`reset role;`);
check("editing another user's profile affects no rows", carolEditsAlice.rows.length, 0);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
