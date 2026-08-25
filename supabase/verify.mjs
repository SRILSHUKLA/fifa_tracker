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
  "0005_leagues.sql",
  "0006_edit_match.sql",
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
     returning id, winner_id`,
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
    and relname in ('profiles','groups','group_members','teams','matches',
                     'leagues','league_participants','league_fixtures')
  order by relname
`);
check(
  "RLS enabled on every table",
  rls.rows.map((r) => `${r.relname}:${r.relrowsecurity}`),
  [
    "group_members:true",
    "groups:true",
    "league_fixtures:true",
    "league_participants:true",
    "leagues:true",
    "matches:true",
    "profiles:true",
    "teams:true",
  ],
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

// --- Leagues -----------------------------------------------------------
// Fresh group and fresh users, entirely separate from group1/group2, so
// nothing here depends on (or is disturbed by) the membership churn the
// groups admin section above already did to group1.
const frank = await mk("frank@example.com", "frank");
const grace = await mk("grace@example.com", "grace");
const heidi = await mk("heidi@example.com", "heidi");
const ivan = await mk("ivan@example.com", "ivan");
const judy = await mk("judy@example.com", "judy"); // group member, never joins a league

await login(frank);
const leagueGroup = (await db.query(`select * from public.create_group($1)`, ["League HQ"])).rows[0];

for (const u of [grace, heidi, ivan, judy]) {
  await login(u);
  await db.query(`select public.join_group($1)`, [leagueGroup.invite_code]);
}

const leagueParticipants = async (leagueId) =>
  (
    await db.query(
      `select user_id, team_id from public.league_participants where league_id = $1 order by user_id`,
      [leagueId],
    )
  ).rows;

const fixturesOf = async (leagueId, stage = "round_robin") =>
  (
    await db.query(
      `select id, round, slot, player_one_id, player_two_id, status, match_id,
              next_fixture_id, next_fixture_slot
       from public.league_fixtures
       where league_id = $1 and stage = $2
       order by round, slot`,
      [leagueId, stage],
    )
  ).rows;

/** Logs the fixture between userA and userB, with userA's score = scoreA,
 * as whichever of the two actually calls it (loggerUser). */
async function logFixture(leagueId, stage, userA, userB, scoreA, scoreB, loggerUser, extra = {}) {
  const fixtures = await fixturesOf(leagueId, stage);
  const f = fixtures.find(
    (x) => [x.player_one_id, x.player_two_id].includes(userA) && [x.player_one_id, x.player_two_id].includes(userB),
  );
  if (!f) throw new Error(`fixture not found for ${userA} v ${userB}`);
  await login(loggerUser);
  const myScore = loggerUser === userA ? scoreA : scoreB;
  const oppScore = loggerUser === userA ? scoreB : scoreA;
  const result = (
    await db.query(`select * from public.log_league_fixture_result($1,$2,$3,$4,$5,$6)`, [
      f.id,
      myScore,
      oppScore,
      extra.penaltyWinnerId ?? null,
      extra.playedAt ?? null,
      extra.notes ?? null,
    ])
  ).rows[0];
  return { fixture: f, result };
}

// --- create_league: membership required, auto-joins the creator ------------
await login(dave); // a real user, but not a member of leagueGroup
let createAsOutsider = null;
try {
  await db.query(`select * from public.create_league($1,$2,$3,$4)`, [
    leagueGroup.id,
    "Outsider League",
    "single_round_robin",
    arsenal,
  ]);
} catch (error) {
  createAsOutsider = error.message;
}
check("create_league rejects a non-group-member", createAsOutsider?.includes("member") ?? false, true);

await login(frank);
const srrLeague = (
  await db.query(`select * from public.create_league($1,$2,$3,$4)`, [
    leagueGroup.id,
    "Single RR",
    "single_round_robin",
    arsenal,
  ])
).rows[0];
check("create_league returns a draft league", srrLeague.status, "draft");
check("create_league auto-joins the creator with their chosen team", await leagueParticipants(srrLeague.id), [
  { user_id: frank, team_id: arsenal },
]);

// --- join_league -------------------------------------------------------------
await login(dave);
let joinAsOutsider = null;
try {
  await db.query(`select public.join_league($1,$2)`, [srrLeague.id, chelsea]);
} catch (error) {
  joinAsOutsider = error.message;
}
check("join_league rejects a non-group-member", joinAsOutsider?.includes("member") ?? false, true);

await login(grace);
await db.query(`select public.join_league($1,$2)`, [srrLeague.id, chelsea]);
await login(heidi);
await db.query(`select public.join_league($1,$2)`, [srrLeague.id, realMadrid]);
await login(ivan);
await db.query(`select public.join_league($1,$2)`, [srrLeague.id, barcelona]);
check("join_league adds every joiner", (await leagueParticipants(srrLeague.id)).length, 4);

await login(grace);
await db.query(`select public.join_league($1,$2)`, [srrLeague.id, barcelona]); // change of mind
check(
  "re-joining pre-start with a different team upserts, not duplicates",
  (await leagueParticipants(srrLeague.id)).find((p) => p.user_id === grace)?.team_id,
  barcelona,
);
await db.query(`select public.join_league($1,$2)`, [srrLeague.id, chelsea]); // back to the team used below
check("still 4 participants after the double-tap", (await leagueParticipants(srrLeague.id)).length, 4);

// --- start_league --------------------------------------------------------------
await login(grace);
let startAsNonCreator = null;
try {
  await db.query(`select * from public.start_league($1)`, [srrLeague.id]);
} catch (error) {
  startAsNonCreator = error.message;
}
check("start_league rejects a non-creator", startAsNonCreator?.includes("creator") ?? false, true);

await login(frank);
const startedSrr = (await db.query(`select * from public.start_league($1)`, [srrLeague.id])).rows[0];
check("start_league moves status to in_progress", startedSrr.status, "in_progress");

await login(judy); // a real leagueGroup member, but never joined this league
let joinAfterStart = null;
try {
  await db.query(`select public.join_league($1,$2)`, [srrLeague.id, arsenal]);
} catch (error) {
  joinAfterStart = error.message;
}
check("joining an already-started league is rejected", joinAfterStart?.includes("no longer open") ?? false, true);

// round_robin_knockout: too few participants to start ------------------------
await login(frank);
const rrkLeague = (
  await db.query(`select * from public.create_league($1,$2,$3,$4,$5)`, [
    leagueGroup.id,
    "RRK",
    "round_robin_knockout",
    arsenal,
    4,
  ])
).rows[0];
await login(grace);
await db.query(`select public.join_league($1,$2)`, [rrkLeague.id, chelsea]);

await login(frank);
let startTooFew = null;
try {
  await db.query(`select * from public.start_league($1)`, [rrkLeague.id]);
} catch (error) {
  startTooFew = error.message;
}
check(
  "starting a knockout league with fewer than knockout_size participants is rejected",
  startTooFew?.includes("4") ?? false,
  true,
);

await login(heidi);
await db.query(`select public.join_league($1,$2)`, [rrkLeague.id, realMadrid]);
await login(ivan);
await db.query(`select public.join_league($1,$2)`, [rrkLeague.id, barcelona]);

await login(frank);
const startedRrk = (await db.query(`select * from public.start_league($1)`, [rrkLeague.id])).rows[0];
check("start_league succeeds once knockout_size participants have joined", startedRrk.status, "in_progress");

// --- double_round_robin: fixture-count generation ----------------------------
await login(frank);
const drrLeague = (
  await db.query(`select * from public.create_league($1,$2,$3,$4)`, [
    leagueGroup.id,
    "Double RR",
    "double_round_robin",
    arsenal,
  ])
).rows[0];
await login(grace);
await db.query(`select public.join_league($1,$2)`, [drrLeague.id, chelsea]);
await login(heidi);
await db.query(`select public.join_league($1,$2)`, [drrLeague.id, realMadrid]);
await login(ivan);
await db.query(`select public.join_league($1,$2)`, [drrLeague.id, barcelona]);
await login(frank);
await db.query(`select public.start_league($1)`, [drrLeague.id]);

const fixtureCounts = async (leagueId) =>
  (
    await db.query(
      `select stage, round, count(*)::int as n
       from public.league_fixtures where league_id = $1
       group by stage, round order by stage, round`,
      [leagueId],
    )
  ).rows;

check("single_round_robin generates 6 fixtures, all round 1", await fixtureCounts(srrLeague.id), [
  { stage: "round_robin", round: 1, n: 6 },
]);
check("double_round_robin generates 12 fixtures across two rounds", await fixtureCounts(drrLeague.id), [
  { stage: "round_robin", round: 1, n: 6 },
  { stage: "round_robin", round: 2, n: 6 },
]);
check(
  "round_robin_knockout generates 6 round-robin fixtures and 0 knockout fixtures at start",
  await fixtureCounts(rrkLeague.id),
  [{ stage: "round_robin", round: 1, n: 6 }],
);

// --- Logging crosses over into matches / the group's regular leaderboard ----
const { result: fgResult } = await logFixture(srrLeague.id, "round_robin", frank, grace, 2, 0, frank);
check(
  "log_league_fixture_result returns a real match id and the current league state",
  {
    hasMatch: fgResult.match_id != null,
    fixture_id: fgResult.fixture_id,
    league_status: fgResult.league_status,
    champion_id: fgResult.champion_id,
  },
  {
    hasMatch: true,
    fixture_id: (await fixturesOf(srrLeague.id)).find(
      (f) => [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(grace),
    ).id,
    league_status: "in_progress",
    champion_id: null,
  },
);

const fgMatch = (
  await db.query(`select group_id, player_one_score, player_two_score from public.matches where id = $1`, [
    fgResult.match_id,
  ])
).rows[0];
check("the logged fixture result is a normal matches row scoped to the league's group", fgMatch.group_id, leagueGroup.id);

const boardAfterOneMatch = await db.query(
  `select username, played::int, wins::int from public.get_group_leaderboard($1)
   where username in ('frank','grace') order by username`,
  [leagueGroup.id],
);
check("the league match shows up in the group's regular leaderboard", boardAfterOneMatch.rows, [
  { username: "frank", played: 1, wins: 1 },
  { username: "grace", played: 1, wins: 0 },
]);

// Double-logging the same fixture is rejected.
let doubleLog = null;
try {
  await db.query(`select * from public.log_league_fixture_result($1,$2,$3)`, [
    (await fixturesOf(srrLeague.id)).find(
      (f) => [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(grace),
    ).id,
    5,
    0,
  ]);
} catch (error) {
  doubleLog = error.message;
}
check("logging the same fixture twice is rejected", doubleLog?.includes("already logged") ?? false, true);

// A group member who is not one of the fixture's two players cannot log it.
const heidiIvanFixture = (await fixturesOf(srrLeague.id)).find(
  (f) => [f.player_one_id, f.player_two_id].includes(heidi) && [f.player_one_id, f.player_two_id].includes(ivan),
);
await login(judy);
let outsiderLog = null;
try {
  await db.query(`select * from public.log_league_fixture_result($1,$2,$3)`, [heidiIvanFixture.id, 1, 0]);
} catch (error) {
  outsiderLog = error.message;
}
check(
  "a group member who isn't part of the fixture cannot log it",
  outsiderLog?.includes("Only the two players") ?? false,
  true,
);

// A round-robin draw with a penalty winner supplied is rejected; the same
// fixture logged as a plain draw (no penalty winner) succeeds normally —
// also the "either fixture player can log it" case, logged by heidi, not
// the fixture's other side.
let penaltyOnRoundRobinDraw = null;
try {
  const fhFixture = (await fixturesOf(srrLeague.id)).find(
    (f) => [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(heidi),
  );
  await login(heidi);
  await db.query(`select * from public.log_league_fixture_result($1,$2,$3,$4)`, [fhFixture.id, 1, 1, heidi]);
} catch (error) {
  penaltyOnRoundRobinDraw = error.message;
}
check(
  "a penalty winner supplied for a round-robin draw is rejected",
  penaltyOnRoundRobinDraw?.includes("only applies") ?? false,
  true,
);
await logFixture(srrLeague.id, "round_robin", frank, heidi, 1, 1, heidi);
check(
  "the non-initiating side of a fixture can log it, and a round-robin draw needs no penalty winner",
  (
    await db.query(
      `select status from public.league_fixtures where id = $1`,
      [
        (await fixturesOf(srrLeague.id)).find(
          (f) => [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(heidi),
        ).id,
      ],
    )
  ).rows[0].status,
  "completed",
);

// Finish the round robin with a designed-tied-on-points result so the
// standings math and the goal-difference tiebreak are both exercised:
// heidi and frank finish level on 7 points, heidi ahead on goal difference.
await logFixture(srrLeague.id, "round_robin", frank, ivan, 2, 0, frank);
await logFixture(srrLeague.id, "round_robin", grace, heidi, 0, 2, heidi);
await logFixture(srrLeague.id, "round_robin", grace, ivan, 2, 0, grace);
const { result: hiResult } = await logFixture(srrLeague.id, "round_robin", heidi, ivan, 3, 0, heidi);

const standings = await db.query(
  `select username, team_id, played::int, wins::int, draws::int, losses::int,
          goals_for::int, goals_against::int, goal_difference::int, points::int
   from public.get_league_standings($1)
   order by points desc, goal_difference desc, username`,
  [srrLeague.id],
);
check(
  "get_league_standings computes the round-robin table correctly",
  standings.rows,
  [
    { username: "heidi", team_id: realMadrid, played: 3, wins: 2, draws: 1, losses: 0, goals_for: 6, goals_against: 1, goal_difference: 5, points: 7 },
    { username: "frank", team_id: arsenal,    played: 3, wins: 2, draws: 1, losses: 0, goals_for: 5, goals_against: 1, goal_difference: 4, points: 7 },
    { username: "grace", team_id: chelsea,    played: 3, wins: 1, draws: 0, losses: 2, goals_for: 2, goals_against: 4, goal_difference: -2, points: 3 },
    { username: "ivan",  team_id: barcelona,  played: 3, wins: 0, draws: 0, losses: 3, goals_for: 0, goals_against: 7, goal_difference: -7, points: 0 },
  ],
);

check(
  "the round robin completes and crowns the goal-difference tiebreak winner as champion",
  { league_status: hiResult.league_status, champion_id: hiResult.champion_id },
  { league_status: "completed", champion_id: heidi },
);

// --- Spectator visibility ----------------------------------------------------
check(
  "a group member who never joined the league can still read its fixtures",
  (await rowsAsUser(judy, `select id from public.league_fixtures where league_id = $1`, [srrLeague.id])).length > 0,
  true,
);
check(
  "get_league_standings is visible to a spectator group member",
  (await rowsAsUser(judy, `select id from public.get_league_standings($1)`, [srrLeague.id])).length,
  4,
);
check(
  "get_group_leaderboard (pre-existing RPC) is callable as the authenticated role — regression guard for the player_match_results grant this migration repairs",
  (await rowsAsUser(judy, `select username from public.get_group_leaderboard($1)`, [leagueGroup.id])).length > 0,
  true,
);
check(
  "a total outsider sees none of the league's fixtures",
  (await rowsAsUser(erin, `select id from public.league_fixtures where league_id = $1`, [srrLeague.id])).length,
  0,
);
check(
  "a total outsider sees none of the league row itself",
  (await rowsAsUser(erin, `select id from public.leagues where id = $1`, [srrLeague.id])).length,
  0,
);

// --- Multi-league isolation ---------------------------------------------------
const srrFixtureIds = new Set((await fixturesOf(srrLeague.id)).map((f) => f.id));
const drrFixtureIds = new Set((await fixturesOf(drrLeague.id)).map((f) => f.id));
check(
  "fixtures from two leagues in the same group never overlap",
  [...srrFixtureIds].some((id) => drrFixtureIds.has(id)),
  false,
);
check(
  "a league's standings only cover its own participants",
  (await db.query(`select count(*)::int as n from public.get_league_standings($1)`, [drrLeague.id])).rows[0].n,
  4,
);

// --- round_robin_knockout: bracket generation, advancement, penalty shootout,
// and champion crowning -------------------------------------------------------
// Decisive (no-draw) round robin so seeding is unambiguous: frank 1st, grace
// 2nd, heidi 3rd, ivan 4th.
await logFixture(rrkLeague.id, "round_robin", frank, grace, 3, 0, frank);
await logFixture(rrkLeague.id, "round_robin", frank, heidi, 3, 0, frank);
await logFixture(rrkLeague.id, "round_robin", frank, ivan, 3, 0, frank);
await logFixture(rrkLeague.id, "round_robin", grace, heidi, 2, 0, grace);
await logFixture(rrkLeague.id, "round_robin", grace, ivan, 2, 0, grace);
const { result: lastRrkGroupResult } = await logFixture(rrkLeague.id, "round_robin", heidi, ivan, 2, 0, heidi);
check(
  "the league is still in_progress once the round robin is done — the knockout bracket has its own rounds left",
  lastRrkGroupResult.league_status,
  "in_progress",
);

const knockoutFixtures = await fixturesOf(rrkLeague.id, "knockout");
check("bracket generation creates exactly 3 knockout fixtures for a 4-team bracket", knockoutFixtures.length, 3);

const semis = knockoutFixtures.filter((f) => f.round === 1);
const final = knockoutFixtures.find((f) => f.round === 2);
check("round 1 has 2 seeded semifinals and round 2 is the unfilled final", {
  semiCount: semis.length,
  semisSeeded: semis.every((f) => f.player_one_id != null && f.player_two_id != null),
  finalEmpty: final != null && final.player_one_id == null && final.player_two_id == null,
}, { semiCount: 2, semisSeeded: true, finalEmpty: true });

const seed1v4 = semis.find(
  (f) => [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(ivan),
);
const seed2v3 = semis.find(
  (f) => [f.player_one_id, f.player_two_id].includes(grace) && [f.player_one_id, f.player_two_id].includes(heidi),
);
check("the bracket seeds 1st v 4th and 2nd v 3rd", { seed1v4: seed1v4 != null, seed2v3: seed2v3 != null }, {
  seed1v4: true,
  seed2v3: true,
});
check(
  "both semifinals wire into the final via next_fixture_id, at distinct slots",
  {
    sameFinal: seed1v4.next_fixture_id === final.id && seed2v3.next_fixture_id === final.id,
    distinctSlots: seed1v4.next_fixture_slot !== seed2v3.next_fixture_slot,
  },
  { sameFinal: true, distinctSlots: true },
);

// Semifinal 1 (frank v ivan): a draw without a penalty winner is rejected...
let noPenaltyOnKnockoutDraw = null;
try {
  await login(frank);
  await db.query(`select * from public.log_league_fixture_result($1,$2,$3)`, [seed1v4.id, 1, 1]);
} catch (error) {
  noPenaltyOnKnockoutDraw = error.message;
}
check(
  "a drawn knockout fixture without a penalty winner is rejected",
  noPenaltyOnKnockoutDraw?.includes("penalty shootout") ?? false,
  true,
);
// ...but succeeds once a penalty winner is supplied, and that's who advances.
await logFixture(rrkLeague.id, "knockout", frank, ivan, 1, 1, frank, { penaltyWinnerId: frank });

const finalAfterSemi1 = (
  await db.query(`select player_one_id, player_two_id from public.league_fixtures where id = $1`, [final.id])
).rows[0];
check(
  "the penalty-shootout winner fills the correct final slot; the other stays open",
  {
    filledSlot: seed1v4.next_fixture_slot === 1 ? finalAfterSemi1.player_one_id : finalAfterSemi1.player_two_id,
    openSlot: seed1v4.next_fixture_slot === 1 ? finalAfterSemi1.player_two_id : finalAfterSemi1.player_one_id,
  },
  { filledSlot: frank, openSlot: null },
);

// Semifinal 2 (grace v heidi): supplying a penalty winner for a non-draw is
// rejected...
let penaltyOnDecisiveKnockout = null;
try {
  await login(grace);
  await db.query(`select * from public.log_league_fixture_result($1,$2,$3,$4)`, [seed2v3.id, 2, 1, grace]);
} catch (error) {
  penaltyOnDecisiveKnockout = error.message;
}
check(
  "a penalty winner supplied for a decisive knockout fixture is rejected",
  penaltyOnDecisiveKnockout?.includes("only applies") ?? false,
  true,
);
// ...a plain decisive result succeeds, filling the other final slot.
const { result: semi2Result } = await logFixture(rrkLeague.id, "knockout", grace, heidi, 2, 1, grace);
check("the league is still in_progress with the final still to play", semi2Result.league_status, "in_progress");

const finalAfterSemi2 = (
  await db.query(`select player_one_id, player_two_id from public.league_fixtures where id = $1`, [final.id])
).rows[0];
check(
  "both final slots are filled once both semifinals are logged",
  [finalAfterSemi2.player_one_id, finalAfterSemi2.player_two_id].sort(),
  [frank, grace].sort(),
);

// Final: frank v grace.
const { result: finalResult } = await logFixture(rrkLeague.id, "knockout", frank, grace, 2, 0, frank);
check(
  "logging the final crowns the champion and completes the league",
  { league_status: finalResult.league_status, champion_id: finalResult.champion_id },
  { league_status: "completed", champion_id: frank },
);

// --- Match-edit lock -----------------------------------------------------
await login(frank);
check(
  "a league-linked match cannot be deleted directly by its creator",
  (await rowsAsUser(frank, `delete from public.matches where id = $1 returning id`, [fgResult.match_id])).length,
  0,
);
check(
  "a league-linked match cannot be edited directly by its creator",
  (
    await rowsAsUser(frank, `update public.matches set notes = 'nope' where id = $1 returning id`, [fgResult.match_id])
  ).length,
  0,
);
check(
  "an ordinary, non-league match can still be edited/deleted by its creator",
  (await rowsAsUser(alice, `delete from public.matches where id = $1 returning id`, [someMatch])).length,
  1,
);

// --- edit_match --------------------------------------------------------------
/** p_player_one_team_id/p_player_two_team_id/p_played_at/p_penalty_winner_id
 * default to null (keep no team / keep current date) unless passed. */
function editMatch(matchId, s1, s2, t1 = null, t2 = null, penaltyWinnerId = null) {
  return db.query(`select public.edit_match($1,$2,$3,$4,$5,$6,$7,$8)`, [
    matchId, s1, s2, t1, t2, null, null, penaltyWinnerId,
  ]);
}

// Regular (non-league) match: anyone can correct their own logged score.
const editableMatch = (await logMatch(group1.id, alice, carol, 2, 2, 10)).rows[0];

await login(alice);
await editMatch(editableMatch.id, 4, 1);
const editedResult = (
  await db.query(
    `select goals_for::int, goals_against::int, result
     from public.player_match_results where match_id = $1 and player_id = $2`,
    [editableMatch.id, alice],
  )
).rows[0];
check(
  "edit_match corrects a regular match's score, reflected immediately in player_match_results",
  editedResult,
  { goals_for: 4, goals_against: 1, result: "win" },
);

let editByNonCreator = null;
try {
  await login(carol); // carol played in it, but alice (not carol) logged it
  await db.query(`select public.edit_match($1,$2,$3)`, [editableMatch.id, 9, 9]);
} catch (error) {
  editByNonCreator = error.message;
}
check(
  "only the original logger can edit a regular match",
  editByNonCreator?.includes("logged this match") ?? false,
  true,
);

// League round robin, still in progress (no bracket to protect): a
// correction just flows straight into live standings.
await logFixture(drrLeague.id, "round_robin", frank, grace, 1, 0, frank);
const drrFixture = (await fixturesOf(drrLeague.id)).find(
  (f) => f.round === 1 && [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(grace),
);
await login(frank);
await editMatch(drrFixture.match_id, 3, 0);
const drrStandingsAfterEdit = await db.query(
  `select goals_for::int, played::int from public.get_league_standings($1) where username = 'frank'`,
  [drrLeague.id],
);
check(
  "editing a round-robin score while the league is still in progress updates standings live",
  drrStandingsAfterEdit.rows[0],
  { goals_for: 3, played: 1 },
);

let leagueEditByNonCreator = null;
try {
  await login(grace);
  await db.query(`select public.edit_match($1,$2,$3)`, [drrFixture.match_id, 5, 5]);
} catch (error) {
  leagueEditByNonCreator = error.message;
}
check(
  "only the original logger can edit a league match either",
  leagueEditByNonCreator?.includes("logged this match") ?? false,
  true,
);

// round_robin_knockout: once the bracket has been seeded from the round
// robin, its scores are locked — but team-only corrections still pass.
const rrkFgFixture = (await fixturesOf(rrkLeague.id, "round_robin")).find(
  (f) => [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(grace),
);
await login(frank);
let lockedRRedit = null;
try {
  await editMatch(rrkFgFixture.match_id, 3, 1);
} catch (error) {
  lockedRRedit = error.message;
}
check(
  "a round-robin score is locked once its knockout bracket has been seeded",
  lockedRRedit?.includes("locked") ?? false,
  true,
);
await editMatch(rrkFgFixture.match_id, 3, 0, chelsea, arsenal); // same score, different teams
const teamOnlyEdit = (
  await db.query(`select player_one_team_id, player_two_team_id from public.matches where id = $1`, [rrkFgFixture.match_id])
).rows[0];
check(
  "a team-only correction on a locked round-robin fixture still succeeds",
  teamOnlyEdit,
  { player_one_team_id: chelsea, player_two_team_id: arsenal },
);

// Plain round robin, already completed: correcting a score recomputes the
// champion from the new standings, no bracket involved.
const srrFhFixture = (await fixturesOf(srrLeague.id)).find(
  (f) => [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(heidi),
);
await login(heidi); // heidi logged the original frank-heidi draw
await editMatch(srrFhFixture.match_id, 1, 3); // heidi=1, frank=3 -> frank now wins
const standingsAfterSrrEdit = await db.query(
  `select username, points::int, goal_difference::int
   from public.get_league_standings($1) order by points desc, goal_difference desc, username`,
  [srrLeague.id],
);
check("editing a completed round robin's score updates its standings", standingsAfterSrrEdit.rows, [
  { username: "frank", points: 9, goal_difference: 6 },
  { username: "heidi", points: 6, goal_difference: 3 },
  { username: "grace", points: 3, goal_difference: -2 },
  { username: "ivan", points: 0, goal_difference: -7 },
]);
const srrChampionAfterEdit = (
  await db.query(`select champion_id from public.leagues where id = $1`, [srrLeague.id])
).rows[0].champion_id;
check(
  "the champion is recomputed once a round-robin correction changes the standings leader",
  srrChampionAfterEdit,
  frank,
);

// Knockout, already completed: a same-winner correction is always fine,
// even once the next round was already played...
const semi1Fixture = (await fixturesOf(rrkLeague.id, "knockout")).find(
  (f) => f.round === 1 && [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(ivan),
);
await login(frank); // frank logged the semifinal (and the final)
await editMatch(semi1Fixture.match_id, 3, 1); // decisive now, still frank — no flip
const semi1RowAfterSameWinnerEdit = (
  await db.query(`select penalty_winner_id from public.league_fixtures where id = $1`, [semi1Fixture.id])
).rows[0];
check(
  "a same-winner correction succeeds even though the next round was already played, and clears the now-unneeded penalty winner",
  semi1RowAfterSameWinnerEdit.penalty_winner_id,
  null,
);
check(
  "the champion is unaffected since the semifinal winner never actually changed",
  (await db.query(`select champion_id from public.leagues where id = $1`, [rrkLeague.id])).rows[0].champion_id,
  frank,
);

// ...but flipping who won is blocked once they've already played on in the
// next round — no silent cascade into someone else's already-logged match.
let blockedFlip = null;
try {
  await editMatch(semi1Fixture.match_id, 0, 2); // frank=0, ivan=2 -> would flip to ivan
} catch (error) {
  blockedFlip = error.message;
}
check(
  "flipping a knockout winner is blocked once they've already played in the next round",
  blockedFlip?.includes("already played in the next round") ?? false,
  true,
);
const semi1AfterBlockedAttempt = (
  await db.query(`select player_one_score, player_two_score from public.matches where id = $1`, [semi1Fixture.match_id])
).rows[0];
check("the blocked edit left the match untouched", semi1AfterBlockedAttempt, {
  player_one_score: 3,
  player_two_score: 1,
});

// Editing the final itself has nothing downstream to protect, so flipping
// its winner always just re-crowns the champion.
const finalFixture = (await fixturesOf(rrkLeague.id, "knockout")).find((f) => f.round === 2);
await editMatch(finalFixture.match_id, 1, 2); // frank=1, grace=2 -> grace wins instead
check(
  "editing the final's score re-crowns the champion",
  (await db.query(`select champion_id from public.leagues where id = $1`, [rrkLeague.id])).rows[0].champion_id,
  grace,
);

// Knockout, next round still pending: flipping the winner safely re-wires
// the pending fixture's slot instead of being blocked.
await login(frank);
const rrk2League = (
  await db.query(`select * from public.create_league($1,$2,$3,$4,$5)`, [
    leagueGroup.id, "RRK2", "round_robin_knockout", arsenal, 4,
  ])
).rows[0];
await login(grace);
await db.query(`select public.join_league($1,$2)`, [rrk2League.id, chelsea]);
await login(heidi);
await db.query(`select public.join_league($1,$2)`, [rrk2League.id, realMadrid]);
await login(ivan);
await db.query(`select public.join_league($1,$2)`, [rrk2League.id, barcelona]);
await login(frank);
await db.query(`select public.start_league($1)`, [rrk2League.id]);

await logFixture(rrk2League.id, "round_robin", frank, grace, 3, 0, frank);
await logFixture(rrk2League.id, "round_robin", frank, heidi, 3, 0, frank);
await logFixture(rrk2League.id, "round_robin", frank, ivan, 3, 0, frank);
await logFixture(rrk2League.id, "round_robin", grace, heidi, 2, 0, grace);
await logFixture(rrk2League.id, "round_robin", grace, ivan, 2, 0, grace);
await logFixture(rrk2League.id, "round_robin", heidi, ivan, 2, 0, heidi);

const rrk2Semi1Seed = (await fixturesOf(rrk2League.id, "knockout")).find(
  (f) => f.round === 1 && [f.player_one_id, f.player_two_id].includes(frank) && [f.player_one_id, f.player_two_id].includes(ivan),
);
const rrk2FinalId = (await fixturesOf(rrk2League.id, "knockout")).find((f) => f.round === 2).id;

// Log semifinal 1 only — semifinal 2 and the final stay pending.
await logFixture(rrk2League.id, "knockout", frank, ivan, 2, 0, frank);
const rrk2Semi1 = (await fixturesOf(rrk2League.id, "knockout")).find((f) => f.id === rrk2Semi1Seed.id);
const slotOf = (finalRow) => (rrk2Semi1.next_fixture_slot === 1 ? finalRow.player_one_id : finalRow.player_two_id);

check(
  "the final's slot is filled with the semifinal winner immediately after logging",
  slotOf((await fixturesOf(rrk2League.id, "knockout")).find((f) => f.id === rrk2FinalId)),
  frank,
);

await login(frank);
await editMatch(rrk2Semi1.match_id, 0, 2); // frank=0, ivan=2 -> ivan now wins
check(
  "flipping a knockout winner re-wires the still-pending next fixture's slot",
  slotOf((await fixturesOf(rrk2League.id, "knockout")).find((f) => f.id === rrk2FinalId)),
  ivan,
);

let editDrawNoPenalty = null;
try {
  await editMatch(rrk2Semi1.match_id, 1, 1);
} catch (error) {
  editDrawNoPenalty = error.message;
}
check(
  "editing a knockout fixture to a draw without a penalty winner is rejected",
  editDrawNoPenalty?.includes("penalty shootout") ?? false,
  true,
);
check(
  "the rejected edit left the next fixture's slot unchanged",
  slotOf((await fixturesOf(rrk2League.id, "knockout")).find((f) => f.id === rrk2FinalId)),
  ivan,
);

await editMatch(rrk2Semi1.match_id, 2, 2, null, null, frank); // draw, frank wins on pens
check(
  "a penalty-shootout correction re-wires the next fixture to the new winner",
  slotOf((await fixturesOf(rrk2League.id, "knockout")).find((f) => f.id === rrk2FinalId)),
  frank,
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
