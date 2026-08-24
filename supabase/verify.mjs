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
const MIGRATION_FILES = [
  "0001_init.sql",
  "0002_seed_teams.sql",
  "0003_groups.sql",
  "0004_team_logos.sql",
];

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
for (const file of MIGRATION_FILES) {
  await db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  console.log(`${file}  ok`);
}

// Re-running must be a no-op (the user may paste them twice).
for (const file of MIGRATION_FILES) {
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

// 0004_team_logos.sql sets logo_url for most (not necessarily all) teams —
// see scripts/fetch-team-logos.mjs for the handful that don't resolve
// confidently against TheSportsDB. The exact count moves whenever that
// script is re-run, so this is a floor, not an exact match.
const logos = await db.query(
  `select count(*)::int as n from public.teams where logo_url is not null`,
);
check("most teams have a logo_url", logos.rows[0].n >= 150, true);

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
const dave = await mk("dave@example.com", "dave");
const erin = await mk("erin@example.com", "erin");

const profiles = await db.query(
  `select username from public.profiles order by username`,
);
check(
  "handle_new_user created a profile per signup",
  profiles.rows.map((r) => r.username),
  ["alice", "bob", "carol", "dave", "erin"],
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
  (await db.query(`select public.is_username_available('frank') as a`)).rows[0].a,
  true,
);

// --- Groups: create + join by code -----------------------------------------
await login(alice);
const group1 = (await db.query(`select * from public.create_group($1)`, ["Squad"])).rows[0];
check("create_group returns an 8-char invite code", group1.invite_code.length, 8);

const group1Members = async () =>
  (
    await db.query(
      `select user_id, role from public.group_members where group_id = $1 order by role, user_id`,
      [group1.id],
    )
  ).rows;

check(
  "create_group seats the caller as owner",
  await group1Members(),
  [{ user_id: alice, role: "owner" }],
);

await login(bob);
await db.query(`select public.join_group($1)`, [group1.invite_code]);
check("join_group adds the caller as a member", (await group1Members()).length, 2);

// Re-joining (or a double-tap race) is a no-op, not an error.
await db.query(`select public.join_group($1)`, [group1.invite_code]);
check("re-joining the same group is a harmless no-op", (await group1Members()).length, 2);

await login(carol);
let badCodeError = null;
try {
  await db.query(`select public.join_group($1)`, ["BOGUS000"]);
} catch (error) {
  badCodeError = error.message;
}
check("joining with an invalid code is rejected", badCodeError?.includes("not valid") ?? false, true);

await db.query(`select public.join_group($1)`, [group1.invite_code]);
check("group1 now has three members", (await group1Members()).length, 3);

check(
  "are_group_members is symmetric for a real pair",
  [
    (await db.query(`select public.are_group_members($1,$2,$3) as m`, [group1.id, alice, bob])).rows[0].m,
    (await db.query(`select public.are_group_members($1,$2,$3) as m`, [group1.id, bob, alice])).rows[0].m,
  ],
  [true, true],
);
check(
  "are_group_members is false for someone who never joined",
  (await db.query(`select public.are_group_members($1,$2,$3) as m`, [group1.id, alice, dave])).rows[0].m,
  false,
);

// --- Group capacity (11 players max) ---------------------------------------
// Owner (1) + 10 joiners = 11 = the cap. An 11th joiner (12th person) is
// rejected; an already-seated member re-joining at full capacity is still a
// no-op, not an error.
await login(alice);
const capGroup = (await db.query(`select * from public.create_group($1)`, ["Capacity Test"])).rows[0];
const capJoiners = [];
for (let i = 1; i <= 10; i++) capJoiners.push(await mk(`cap${i}@example.com`, `cap${i}`));
const capBlocked = await mk("cap11@example.com", "cap11");

for (const u of capJoiners) {
  await login(u);
  await db.query(`select public.join_group($1)`, [capGroup.invite_code]);
}
const capCount = async () =>
  (await db.query(`select count(*)::int as n from public.group_members where group_id = $1`, [capGroup.id])).rows[0].n;
check("capacity group reaches the 11-member cap (owner + 10 joiners)", await capCount(), 11);

await login(capBlocked);
let fullError = null;
try {
  await db.query(`select public.join_group($1)`, [capGroup.invite_code]);
} catch (error) {
  fullError = error.message;
}
check("the 12th joiner is rejected once the group is full", fullError?.includes("full") ?? false, true);
check("the group is still at 11 after the rejected join", await capCount(), 11);

await login(capJoiners[0]);
await db.query(`select public.join_group($1)`, [capGroup.invite_code]);
check("an existing member re-joining a full group is still a no-op", await capCount(), 11);

// --- Matches: the generated winner column -----------------------------------
const teamId = async (name) =>
  (await db.query(`select id from public.teams where name = $1`, [name])).rows[0].id;

const arsenal = await teamId("Arsenal");
const chelsea = await teamId("Chelsea");
const realMadrid = await teamId("Real Madrid");
const barcelona = await teamId("Barcelona");

const logMatch = (groupId, p1, p2, s1, s2, daysAgo, t1 = arsenal, t2 = chelsea) =>
  db.query(
    `insert into public.matches
       (group_id, player_one_id, player_two_id, player_one_score, player_two_score,
        player_one_team_id, player_two_team_id, created_by, played_at)
     values ($1,$2,$3,$4,$5,$6,$7,$2, now() - ($8 || ' days')::interval)
     returning winner_id`,
    [groupId, p1, p2, s1, s2, t1, t2, String(daysAgo)],
  );

check(
  "winner_id = player one on a home win",
  (await logMatch(group1.id, alice, bob, 3, 1, 5)).rows[0].winner_id,
  alice,
);
check(
  "winner_id = player two on an away win",
  (await logMatch(group1.id, alice, bob, 1, 3, 4)).rows[0].winner_id,
  bob,
);
check("winner_id is null on a draw", (await logMatch(group1.id, alice, bob, 2, 2, 3)).rows[0].winner_id, null);

// One more Alice win so the totals are not symmetrical, this time with a
// different team pairing (feeds the team-based head-to-head checks below).
await logMatch(group1.id, alice, bob, 4, 0, 2, realMadrid, barcelona);

let genError = null;
try {
  await db.query(
    `insert into public.matches
       (group_id, player_one_id, player_two_id, player_one_score, player_two_score, created_by, winner_id)
     values ($1,$2,$3,1,0,$2,$2)`,
    [group1.id, alice, bob],
  );
} catch (error) {
  genError = error.message;
}
check("winner_id cannot be written by hand", genError !== null, true);

let selfError = null;
try {
  await db.query(
    `insert into public.matches
       (group_id, player_one_id, player_two_id, player_one_score, player_two_score, created_by)
     values ($1,$2,$2,1,0,$2)`,
    [group1.id, alice],
  );
} catch (error) {
  selfError = error.message;
}
check("a player cannot play themselves", selfError !== null, true);

// --- Group stats: leaderboard, H2H, team-based H2H --------------------------
// Alice in group1: W 3-1, L 1-3, D 2-2, W 4-0  ->  3W 1D 0L... wait: 2W 1D 1L
// (matches: 3-1 win, 1-3 loss, 2-2 draw, 4-0 win) -> 2W 1D 1L, GF 10, GA 6.
const board1 = await db.query(
  `select username, played::int, wins::int, draws::int, losses::int,
          goals_for::int, goals_against::int, goal_difference::int,
          points::int, win_pct
   from public.get_group_leaderboard($1)
   order by points desc, goal_difference desc, username`,
  [group1.id],
);

check(
  "group1 leaderboard: Alice's row",
  board1.rows[0],
  {
    username: "alice", played: 4, wins: 2, draws: 1, losses: 1,
    goals_for: 10, goals_against: 6, goal_difference: 4, points: 7, win_pct: "50.0",
  },
);
check(
  "group1 leaderboard: Bob's row is the mirror image",
  board1.rows[1],
  {
    username: "bob", played: 4, wins: 1, draws: 1, losses: 2,
    goals_for: 6, goals_against: 10, goal_difference: -4, points: 4, win_pct: "25.0",
  },
);
check(
  "group1 leaderboard: a member with no matches still appears on zero",
  board1.rows[2],
  {
    username: "carol", played: 0, wins: 0, draws: 0, losses: 0,
    goals_for: 0, goals_against: 0, goal_difference: 0, points: 0, win_pct: null,
  },
);
check(
  "group1 leaderboard points equal 3W + D for every row",
  board1.rows.every((r) => r.points === r.wins * 3 + r.draws),
  true,
);

await login(alice);
const h2h = await db.query(`select * from public.get_h2h_stats($1, $2)`, [group1.id, bob]);
check(
  "get_h2h_stats from Alice's side, scoped to group1",
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

const members1 = await db.query(`select * from public.get_group_members($1)`, [group1.id]);
check("get_group_members returns the whole roster", members1.rows.map((r) => r.username), ["alice", "bob", "carol"]);
const bobRow = members1.rows.find((r) => r.username === "bob");
check(
  "get_group_members reports Alice's record against Bob",
  { played: Number(bobRow.played), wins: Number(bobRow.wins), draws: Number(bobRow.draws), losses: Number(bobRow.losses) },
  { played: 4, wins: 2, draws: 1, losses: 1 },
);

const teamH2H = await db.query(`select * from public.get_h2h_team_stats($1, $2) order by played desc`, [group1.id, bob]);
check(
  "get_h2h_team_stats splits Alice's record vs Bob by team",
  teamH2H.rows.map((r) => ({ team: r.team_name, played: Number(r.played), wins: Number(r.wins) })),
  [
    { team: "Arsenal", played: 3, wins: 1 },
    { team: "Real Madrid", played: 1, wins: 1 },
  ],
);

const groupTeamStats = await db.query(`select * from public.get_group_team_stats($1) order by played desc`, [group1.id]);
check(
  "get_group_team_stats aggregates Alice's team record across the group",
  groupTeamStats.rows.map((r) => ({ team: r.team_name, played: Number(r.played) })),
  [
    { team: "Arsenal", played: 3 },
    { team: "Real Madrid", played: 1 },
  ],
);

await login(bob);
const h2hBob = await db.query(`select * from public.get_h2h_stats($1, $2)`, [group1.id, alice]);
check(
  "get_h2h_stats is the mirror image from Bob's side",
  {
    wins: Number(h2hBob.rows[0].wins),
    losses: Number(h2hBob.rows[0].losses),
    goals_for: Number(h2hBob.rows[0].goals_for),
  },
  { wins: 1, losses: 2, goals_for: 6 },
);

await login(dave);
check(
  "get_h2h_stats zero-fills for someone who never joined the group",
  Number((await db.query(`select played from public.get_h2h_stats($1, $2)`, [group1.id, alice])).rows[0].played),
  0,
);

// --- Multi-group isolation ---------------------------------------------------
// The same two people (alice, bob) share a second group with an entirely
// different match history. Neither group's numbers may leak into the other.
await login(dave);
const group2 = (await db.query(`select * from public.create_group($1)`, ["Other Squad"])).rows[0];
await login(alice);
await db.query(`select public.join_group($1)`, [group2.invite_code]);
await login(bob);
await db.query(`select public.join_group($1)`, [group2.invite_code]);

await logMatch(group2.id, alice, bob, 5, 0, 1);

const board2 = await db.query(
  `select username, played::int, wins::int, goals_for::int
   from public.get_group_leaderboard($1) order by username`,
  [group2.id],
);
check(
  "group2 leaderboard is independent of group1's history",
  board2.rows.filter((r) => r.username === "alice" || r.username === "bob"),
  [
    { username: "alice", played: 1, wins: 1, goals_for: 5 },
    { username: "bob", played: 1, wins: 0, goals_for: 0 },
  ],
);

await login(alice);
const h2hGroup2 = await db.query(`select played, wins from public.get_h2h_stats($1, $2)`, [group2.id, bob]);
check(
  "get_h2h_stats(group1, bob) and get_h2h_stats(group2, bob) do not bleed into each other",
  {
    group1: { played: Number(h2h.rows[0].played), wins: Number(h2h.rows[0].wins) },
    group2: { played: Number(h2hGroup2.rows[0].played), wins: Number(h2hGroup2.rows[0].wins) },
  },
  { group1: { played: 4, wins: 2 }, group2: { played: 1, wins: 1 } },
);

// --- RLS wiring -----------------------------------------------------------
const rls = await db.query(`
  select relname, relrowsecurity
  from pg_class
  where relnamespace = 'public'::regnamespace
    and relname in ('profiles','groups','group_members','teams','matches')
  order by relname
`);
check(
  "RLS enabled on every table",
  rls.rows.map((r) => `${r.relname}:${r.relrowsecurity}`),
  ["group_members:true", "groups:true", "matches:true", "profiles:true", "teams:true"],
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
  "the remaining view is security_invoker (so it cannot bypass RLS)",
  views.rows.map((r) => `${r.relname}:${r.security_invoker}`),
  ["player_match_results:on"],
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

/** Same as asUser, but returns the query's rows instead of null/error. */
async function rowsAsUser(userId, sql, params = []) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userId}';`);
  try {
    return (await db.query(sql, params)).rows;
  } finally {
    await db.exec(`reset role;`);
  }
}

const INSERT_MATCH = `
  insert into public.matches
    (group_id, player_one_id, player_two_id, player_one_score, player_two_score, created_by)
  values ($1,$2,$3,$4,$5,$6)`;

check(
  "a group member CAN log a match against a fellow member",
  await asUser(alice, INSERT_MATCH, [group1.id, alice, carol, 1, 0, alice]),
  null,
);
check(
  "logging a match between two OTHER people is blocked",
  (await asUser(alice, INSERT_MATCH, [group1.id, bob, carol, 5, 0, alice])) !== null,
  true,
);
check(
  "logging a match against someone NOT in the group is blocked",
  (await asUser(alice, INSERT_MATCH, [group1.id, alice, dave, 9, 0, alice])) !== null,
  true,
);
check(
  "attributing created_by to someone else is blocked",
  (await asUser(alice, INSERT_MATCH, [group1.id, alice, bob, 1, 0, bob])) !== null,
  true,
);
check(
  "a member of a DIFFERENT group cannot log a match in this group",
  (await asUser(dave, INSERT_MATCH, [group1.id, dave, alice, 1, 0, dave])) !== null,
  true,
);

const someMatch = (
  await db.query(`select id from public.matches where group_id = $1 and created_by = $2 limit 1`, [group1.id, alice])
).rows[0].id;
const bobDelete = await rowsAsUser(bob, `delete from public.matches where id = $1 returning id`, [someMatch]);
check("deleting someone else's match affects no rows", bobDelete.length, 0);

check(
  "a member sees their group's matches",
  (await rowsAsUser(carol, `select id from public.matches where group_id = $1`, [group1.id])).length > 0,
  true,
);
check(
  "a total outsider sees none of group1's matches",
  (await rowsAsUser(erin, `select id from public.matches where group_id = $1`, [group1.id])).length,
  0,
);
check(
  "a member of group2 (but not group1) sees none of group1's matches",
  (await rowsAsUser(dave, `select id from public.matches where group_id = $1`, [group1.id])).length,
  0,
);

check(
  "a non-member cannot see the group row itself",
  (await rowsAsUser(erin, `select id from public.groups where id = $1`, [group1.id])).length,
  0,
);
check(
  "a member can see the group row",
  (await rowsAsUser(alice, `select id from public.groups where id = $1`, [group1.id])).length,
  1,
);
check(
  "group_members cannot be inserted directly (RPC-only)",
  (await asUser(erin, `insert into public.group_members (group_id, user_id) values ($1,$2)`, [group1.id, erin])) !== null,
  true,
);

// --- Admin: rename, regenerate code, remove member, leave -------------------
check(
  "the group owner can rename the group",
  (await rowsAsUser(alice, `update public.groups set name = 'Renamed Squad' where id = $1 returning name`, [group1.id]))
    .length,
  1,
);
check(
  "a non-owner cannot rename the group",
  (await rowsAsUser(bob, `update public.groups set name = 'Hacked' where id = $1 returning name`, [group1.id])).length,
  0,
);

let regenAsNonOwner = null;
try {
  await login(bob);
  await db.query(`select public.regenerate_invite_code($1)`, [group1.id]);
} catch (error) {
  regenAsNonOwner = error.message;
}
check("a non-owner cannot regenerate the invite code", regenAsNonOwner?.includes("owner") ?? false, true);

await login(alice);
const newCode = (await db.query(`select public.regenerate_invite_code($1) as c`, [group1.id])).rows[0].c;
check("the owner regenerating the invite code changes it", newCode !== group1.invite_code, true);

check(
  "a non-owner cannot remove another member",
  (await rowsAsUser(bob, `delete from public.group_members where group_id = $1 and user_id = $2 returning user_id`, [
    group1.id,
    carol,
  ])).length,
  0,
);
check(
  "the owner can remove a non-owner member",
  (await rowsAsUser(alice, `delete from public.group_members where group_id = $1 and user_id = $2 returning user_id`, [
    group1.id,
    carol,
  ])).length,
  1,
);
check(
  "the owner cannot remove (leave) their own membership",
  (await rowsAsUser(alice, `delete from public.group_members where group_id = $1 and user_id = $2 returning user_id`, [
    group1.id,
    alice,
  ])).length,
  0,
);
check(
  "a regular member can leave voluntarily",
  (await rowsAsUser(bob, `delete from public.group_members where group_id = $1 and user_id = $2 returning user_id`, [
    group1.id,
    bob,
  ])).length,
  1,
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
