-- ============================================================================
-- FIFA Score Tracker — leagues
--
-- Run after 0001_init.sql, 0002_seed_teams.sql, 0003_groups.sql,
-- 0004_team_logos.sql.
--
-- Adds structured leagues inside a group: single round robin, double round
-- robin, or round robin followed by a knockout among the top finishers.
--
-- Design notes (same invariants as 0001/0003):
--   * No application server — RLS is the authorization layer.
--   * Every write to leagues/league_fixtures goes through a security definer
--     RPC (create_league / join_league / start_league /
--     log_league_fixture_result), the same "RPC-only" idiom 0003 uses for
--     groups/group_members. There are deliberately no INSERT/UPDATE policies
--     on those tables at all.
--   * A logged fixture result is a completely normal row in public.matches
--     (same table, same group_id, same generated winner_id) — it just also
--     gets linked from league_fixtures.match_id. This means a league match
--     automatically counts toward the group's regular history/leaderboard/
--     H2H stats with zero duplicate modeling. To keep that link from being
--     silently invalidated, this file also tightens the existing matches
--     UPDATE/DELETE policies from 0003 so a league-linked match can only be
--     changed by log_league_fixture_result's own bookkeeping, never by a
--     player editing/deleting it directly. Ordinary, non-league matches are
--     completely unaffected.
--   * A participant's team is locked in for the whole league at join time
--     (not per match like the general "Log a match" flow) and is looked up
--     server-side inside log_league_fixture_result — never trusted from the
--     client, the same "derive, don't trust" philosophy as winner_id.
--   * The knockout bracket cannot be pre-generated at league start (it
--     depends on final round-robin standings), so it is generated on the fly
--     by _generate_league_knockout() the moment the last round-robin fixture
--     is logged, and advanced round by round as each knockout fixture is
--     logged, from inside log_league_fixture_result. Seeding is the literal
--     "1 v N, 2 v N-1, ..." pairing — not bracket-optimal reseeding — and
--     there is no bye support: start_league() requires at least
--     knockout_size participants outright for a round_robin_knockout league.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $do$ begin
  create type public.league_type as enum ('single_round_robin', 'double_round_robin', 'round_robin_knockout');
exception
  when duplicate_object then null;
end $do$;

do $do$ begin
  create type public.league_status as enum ('draft', 'in_progress', 'completed');
exception
  when duplicate_object then null;
end $do$;

do $do$ begin
  create type public.fixture_stage as enum ('round_robin', 'knockout');
exception
  when duplicate_object then null;
end $do$;

do $do$ begin
  create type public.fixture_status as enum ('pending', 'completed');
exception
  when duplicate_object then null;
end $do$;


-- ---------------------------------------------------------------------------
-- leagues — one row per league, scoped to a group
-- ---------------------------------------------------------------------------

create table if not exists public.leagues (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete restrict,
  name          text not null check (length(btrim(name)) between 2 and 40),
  type          public.league_type not null,
  status        public.league_status not null default 'draft',
  -- Only meaningful for round_robin_knockout. Fixed choices (not derived
  -- from participant count, which isn't known at creation time) keep the
  -- check constraint and the setup UI simple; start_league() below is what
  -- actually validates it against the final participant count.
  knockout_size smallint check (knockout_size in (2, 4, 8, 16)),
  created_by    uuid not null references public.profiles(id) on delete cascade,
  champion_id   uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  constraint knockout_size_matches_type check (
    (type = 'round_robin_knockout' and knockout_size is not null)
    or (type <> 'round_robin_knockout' and knockout_size is null)
  )
);

create index if not exists leagues_group_idx on public.leagues (group_id, status);


-- ---------------------------------------------------------------------------
-- league_participants — one row per (league, user), team locked at join time
-- ---------------------------------------------------------------------------

create table if not exists public.league_participants (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  team_id   int not null references public.teams(id),
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_participants_user_idx on public.league_participants (user_id);


-- ---------------------------------------------------------------------------
-- league_fixtures — one row per pairing; also the knockout bracket's wiring
-- ---------------------------------------------------------------------------

create table if not exists public.league_fixtures (
  id                uuid primary key default gen_random_uuid(),
  league_id         uuid not null references public.leagues(id) on delete cascade,
  stage             public.fixture_stage not null,
  -- round_robin: 1 (single/knockout's group stage) or 1|2 (double).
  -- knockout: 1 = first bracket round ... rounds = the final.
  round             smallint not null,
  -- Position within (league_id, stage, round). Display/ordering only.
  slot              int not null,
  -- Null for a knockout slot that hasn't been decided yet (filled in by
  -- log_league_fixture_result as the previous round completes).
  player_one_id     uuid references public.profiles(id) on delete set null,
  player_two_id     uuid references public.profiles(id) on delete set null,
  -- Knockout bracket wiring: which later fixture the winner advances into,
  -- and which of that fixture's two slots they land in. Null for
  -- round-robin fixtures and for the final (nothing to advance to).
  next_fixture_id   uuid references public.league_fixtures(id) on delete set null,
  next_fixture_slot smallint check (next_fixture_slot in (1, 2)),
  match_id          uuid references public.matches(id) on delete set null,
  status            public.fixture_status not null default 'pending',
  -- Knockout-only: set iff the linked match was a score draw.
  penalty_winner_id uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint distinct_fixture_players check (
    player_one_id is null or player_two_id is null or player_one_id <> player_two_id
  )
);

create index if not exists league_fixtures_league_idx on public.league_fixtures (league_id, stage, status);
create index if not exists league_fixtures_round_idx on public.league_fixtures (league_id, stage, round, slot);
create unique index if not exists league_fixtures_match_id_key
  on public.league_fixtures (match_id) where match_id is not null;


-- ---------------------------------------------------------------------------
-- Helper predicates — same "avoid RLS self-recursion" idiom as
-- is_group_member/is_group_owner in 0003_groups.sql.
-- ---------------------------------------------------------------------------

create or replace function public.is_league_participant(p_league_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.league_participants
    where league_id = p_league_id and user_id = p_user
  );
$fn$;

-- Spectator model: any member of the league's group can see it, participant
-- or not — matches this app's existing "matches readable by the whole
-- group" philosophy and the spec ("other members of the group will be able
-- to see the league in the group page").
create or replace function public.can_view_league(p_league_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select public.is_group_member(l.group_id, p_user)
  from public.leagues l
  where l.id = p_league_id;
$fn$;


-- ---------------------------------------------------------------------------
-- create_league — creates the league and seats the creator as its first
-- participant (with their chosen team) in one transaction, so a league is
-- never observably created without its creator already in it.
-- ---------------------------------------------------------------------------

create or replace function public.create_league(
  p_group_id      uuid,
  p_name          text,
  p_type          public.league_type,
  p_team_id       int,
  p_knockout_size smallint default null
) returns public.leagues
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  lg public.leagues;
begin
  if not public.is_group_member(p_group_id, auth.uid()) then
    raise exception 'You must be a member of this group.';
  end if;

  if p_type = 'round_robin_knockout' then
    if p_knockout_size is null or p_knockout_size not in (2, 4, 8, 16) then
      raise exception 'Choose a knockout size of 2, 4, 8 or 16.';
    end if;
  elsif p_knockout_size is not null then
    raise exception 'Knockout size only applies to round robin + knockout leagues.';
  end if;

  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Pick a valid team.';
  end if;

  insert into public.leagues (group_id, name, type, knockout_size, created_by)
  values (p_group_id, btrim(p_name), p_type, p_knockout_size, auth.uid())
  returning * into lg;

  insert into public.league_participants (league_id, user_id, team_id)
  values (lg.id, auth.uid(), p_team_id);

  return lg;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- join_league — zero-friction join, upserts the team choice so changing
-- your mind pre-start (or a double-tap) is a harmless no-op, same idiom as
-- join_group's "on conflict do nothing".
-- ---------------------------------------------------------------------------

create or replace function public.join_league(p_league_id uuid, p_team_id int)
returns public.league_participants
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  lg          public.leagues;
  participant public.league_participants;
begin
  select * into lg from public.leagues where id = p_league_id;
  if lg.id is null then
    raise exception 'League not found.';
  end if;
  if not public.is_group_member(lg.group_id, auth.uid()) then
    raise exception 'You must be a member of this group.';
  end if;
  if lg.status <> 'draft' then
    raise exception 'This league is no longer open for joining.';
  end if;
  if not exists (select 1 from public.teams where id = p_team_id) then
    raise exception 'Pick a valid team.';
  end if;

  insert into public.league_participants (league_id, user_id, team_id)
  values (p_league_id, auth.uid(), p_team_id)
  on conflict (league_id, user_id) do update set team_id = excluded.team_id
  returning * into participant;

  return participant;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- start_league — locks the roster and generates every round-robin-phase
-- fixture instantly: every unique pair once (single round robin, and the
-- group stage of round_robin_knockout) or twice (double round robin).
-- Knockout-phase fixtures are not generated here — see
-- _generate_league_knockout below.
-- ---------------------------------------------------------------------------

create or replace function public.start_league(p_league_id uuid)
returns public.leagues
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  lg  public.leagues;
  ids uuid[];
  n   int;
begin
  select * into lg from public.leagues where id = p_league_id for update;
  if lg.id is null then
    raise exception 'League not found.';
  end if;
  if lg.created_by <> auth.uid() then
    raise exception 'Only the league creator can start it.';
  end if;
  if lg.status <> 'draft' then
    raise exception 'This league has already started.';
  end if;

  select array_agg(user_id order by joined_at) into ids
  from public.league_participants
  where league_id = p_league_id;

  n := coalesce(array_length(ids, 1), 0);

  if lg.type = 'round_robin_knockout' then
    if n < lg.knockout_size then
      raise exception 'Need at least % participants for a knockout size of %.', lg.knockout_size, lg.knockout_size;
    end if;
  elsif n < 2 then
    raise exception 'Need at least 2 participants to start a league.';
  end if;

  insert into public.league_fixtures (league_id, stage, round, slot, player_one_id, player_two_id)
  select
    p_league_id,
    'round_robin',
    rnd.round,
    row_number() over (partition by rnd.round order by pair.a, pair.b),
    pair.a,
    pair.b
  from (
    select ids[i] as a, ids[j] as b
    from generate_subscripts(ids, 1) i
    cross join generate_subscripts(ids, 1) j
    where i < j
  ) pair
  cross join (
    select 1 as round
    union all
    select 2 where lg.type = 'double_round_robin'
  ) rnd;

  update public.leagues
  set status = 'in_progress', started_at = now()
  where id = p_league_id
  returning * into lg;

  return lg;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- get_league_standings — round-robin-stage-only table (knockout results
-- never affect standings). Same shape/tiebreak fields as
-- get_group_leaderboard, plus the participant's locked-in league team.
-- ---------------------------------------------------------------------------

create or replace function public.get_league_standings(p_league_id uuid)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  avatar_url      text,
  team_id         int,
  team_name       text,
  played          bigint,
  wins            bigint,
  draws           bigint,
  losses          bigint,
  goals_for       bigint,
  goals_against   bigint,
  goal_difference bigint,
  points          bigint,
  win_pct         numeric
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    t.id,
    t.name,
    count(r.match_id)                                     as played,
    count(*) filter (where r.result = 'win')               as wins,
    count(*) filter (where r.result = 'draw')              as draws,
    count(*) filter (where r.result = 'loss')              as losses,
    coalesce(sum(r.goals_for), 0)                          as goals_for,
    coalesce(sum(r.goals_against), 0)                      as goals_against,
    coalesce(sum(r.goals_for) - sum(r.goals_against), 0)   as goal_difference,
    count(*) filter (where r.result = 'win') * 3
      + count(*) filter (where r.result = 'draw')          as points,
    round(
      count(*) filter (where r.result = 'win')::numeric
        / nullif(count(r.match_id), 0) * 100
    , 1)                                                   as win_pct
  from public.league_participants lp
  join public.profiles p on p.id = lp.user_id
  join public.teams t on t.id = lp.team_id
  left join public.league_fixtures lf
    on lf.league_id = p_league_id
   and lf.stage = 'round_robin'
   and lf.status = 'completed'
   and lp.user_id in (lf.player_one_id, lf.player_two_id)
  left join public.player_match_results r
    on r.match_id = lf.match_id and r.player_id = lp.user_id
  where lp.league_id = p_league_id
  group by p.id, p.username, p.display_name, p.avatar_url, t.id, t.name;
$fn$;


-- ---------------------------------------------------------------------------
-- _generate_league_knockout — internal only (no grant to authenticated).
-- Seeds the top knockout_size finishers from the round-robin phase and
-- builds the single-elimination bracket, final round first (so every
-- earlier round's next_fixture_id can reference an already-inserted row).
-- Only the first round gets real players; later rounds start as empty
-- shells that log_league_fixture_result fills in as earlier rounds finish.
-- ---------------------------------------------------------------------------

create or replace function public._generate_league_knockout(p_league_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  lg         public.leagues;
  n          int;
  rounds     int;
  seeds      uuid[];
  k          int;
  fixture_ct int;
  i          int;
  prev_ids   uuid[];
  this_ids   uuid[];
  new_id     uuid;
  final_id   uuid;
begin
  select * into lg from public.leagues where id = p_league_id;
  n := lg.knockout_size;

  rounds := case n
    when 2 then 1
    when 4 then 2
    when 8 then 3
    when 16 then 4
  end;

  with ranked as (
    select
      s.id,
      row_number() over (
        order by s.points desc, s.goal_difference desc, s.goals_for desc, s.username asc
      ) as rnk
    from public.get_league_standings(p_league_id) s
  )
  select array_agg(id order by rnk) into seeds
  from ranked
  where rnk <= n;

  -- knockout_size = 2: the only knockout fixture *is* the final, with real
  -- players from the start.
  if rounds = 1 then
    insert into public.league_fixtures (league_id, stage, round, slot, player_one_id, player_two_id)
    values (p_league_id, 'knockout', 1, 1, seeds[1], seeds[2]);
    return;
  end if;

  insert into public.league_fixtures (league_id, stage, round, slot)
  values (p_league_id, 'knockout', rounds, 1)
  returning id into final_id;

  prev_ids := array[final_id];

  for k in reverse (rounds - 1) .. 1 loop
    fixture_ct := n / (2 ^ k)::int;
    this_ids := array[]::uuid[];

    for i in 1 .. fixture_ct loop
      if k = 1 then
        insert into public.league_fixtures
          (league_id, stage, round, slot, player_one_id, player_two_id, next_fixture_id, next_fixture_slot)
        values
          (p_league_id, 'knockout', k, i, seeds[i], seeds[n + 1 - i],
           prev_ids[((i - 1) / 2) + 1], ((i - 1) % 2) + 1)
        returning id into new_id;
      else
        insert into public.league_fixtures
          (league_id, stage, round, slot, next_fixture_id, next_fixture_slot)
        values
          (p_league_id, 'knockout', k, i, prev_ids[((i - 1) / 2) + 1], ((i - 1) % 2) + 1)
        returning id into new_id;
      end if;

      this_ids := this_ids || new_id;
    end loop;

    prev_ids := this_ids;
  end loop;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- log_league_fixture_result — the core transactional RPC. Inserts the real
-- matches row, links the fixture, and (when this completion finishes the
-- round-robin phase or a knockout round) advances the bracket or crowns the
-- champion, all atomically. `select ... for update` on the league row
-- serializes concurrent completions of the same league, which is what makes
-- "was this the last pending fixture" and "which bracket slot does the
-- winner fill" race-safe.
-- ---------------------------------------------------------------------------

create or replace function public.log_league_fixture_result(
  p_fixture_id        uuid,
  p_my_score           smallint,
  p_opponent_score     smallint,
  p_penalty_winner_id  uuid default null,
  p_played_at          timestamptz default now(),
  p_notes              text default null
) returns table (
  match_id       uuid,
  fixture_id     uuid,
  league_status  public.league_status,
  champion_id    uuid
)
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  f          public.league_fixtures;
  lg         public.leagues;
  me         uuid := auth.uid();
  opp        uuid;
  my_team    int;
  opp_team   int;
  new_match  uuid;
  winner     uuid;
  pending_rr int;
  updated    int;
begin
  if p_my_score < 0 or p_my_score > 99 or p_opponent_score < 0 or p_opponent_score > 99 then
    raise exception 'Scores must be 0-99.';
  end if;

  select * into f from public.league_fixtures where id = p_fixture_id;
  if f.id is null then
    raise exception 'Fixture not found.';
  end if;

  select * into lg from public.leagues where id = f.league_id for update;

  if lg.status <> 'in_progress' then
    raise exception 'This league is not currently accepting results.';
  end if;
  if me is null or me not in (f.player_one_id, f.player_two_id) then
    raise exception 'Only the two players in this fixture can log its result.';
  end if;
  if f.status <> 'pending' then
    raise exception 'This result was already logged.';
  end if;

  opp := case when f.player_one_id = me then f.player_two_id else f.player_one_id end;

  select team_id into my_team  from public.league_participants where league_id = lg.id and user_id = me;
  select team_id into opp_team from public.league_participants where league_id = lg.id and user_id = opp;

  if f.stage = 'knockout' and p_my_score = p_opponent_score then
    if p_penalty_winner_id is null or p_penalty_winner_id not in (me, opp) then
      raise exception 'This was a draw — record the penalty shootout winner.';
    end if;
  elsif p_penalty_winner_id is not null then
    raise exception 'Penalty shootout winner only applies to a drawn knockout fixture.';
  end if;

  insert into public.matches
    (group_id, player_one_id, player_two_id, player_one_score, player_two_score,
     player_one_team_id, player_two_team_id, created_by, played_at, notes)
  values
    (lg.group_id, me, opp, p_my_score, p_opponent_score, my_team, opp_team, me,
     coalesce(p_played_at, now()), nullif(btrim(coalesce(p_notes, '')), ''))
  returning id into new_match;

  update public.league_fixtures
  set status = 'completed', match_id = new_match, penalty_winner_id = p_penalty_winner_id
  where id = f.id and status = 'pending';
  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'This result was already logged.';
  end if;

  winner := case
    when p_my_score > p_opponent_score then me
    when p_opponent_score > p_my_score then opp
    else p_penalty_winner_id
  end;

  if f.stage = 'round_robin' then
    select count(*) into pending_rr
    from public.league_fixtures
    where league_id = lg.id and stage = 'round_robin' and status = 'pending';

    if pending_rr = 0 then
      if lg.type = 'round_robin_knockout' then
        perform public._generate_league_knockout(lg.id);
      else
        -- Plain round robin: crown the champion now, same tiebreak the
        -- client applies in lib/queries/groups.ts#getGroupLeaderboard.
        select s.id into winner
        from public.get_league_standings(lg.id) s
        order by s.points desc, s.goal_difference desc, s.goals_for desc, s.username asc
        limit 1;

        update public.leagues
        set status = 'completed', champion_id = winner, completed_at = now()
        where id = lg.id;
      end if;
    end if;
  else
    if f.next_fixture_id is null then
      update public.leagues
      set status = 'completed', champion_id = winner, completed_at = now()
      where id = lg.id;
    else
      update public.league_fixtures
      set
        player_one_id = case when f.next_fixture_slot = 1 then winner else player_one_id end,
        player_two_id = case when f.next_fixture_slot = 2 then winner else player_two_id end
      where id = f.next_fixture_id;
    end if;
  end if;

  return query
    select new_match, f.id, l2.status, l2.champion_id
    from public.leagues l2
    where l2.id = lg.id;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.leagues             enable row level security;
alter table public.league_participants enable row level security;
alter table public.league_fixtures     enable row level security;

-- leagues ---------------------------------------------------------------
drop policy if exists "group members read their leagues" on public.leagues;
create policy "group members read their leagues"
  on public.leagues for select to authenticated
  using (public.is_group_member(leagues.group_id, (select auth.uid())));

-- No INSERT/UPDATE/DELETE policy: create_league()/start_league()/
-- log_league_fixture_result() are the only write paths, all security
-- definer.

-- league_participants -----------------------------------------------------
drop policy if exists "group members read league participants" on public.league_participants;
create policy "group members read league participants"
  on public.league_participants for select to authenticated
  using (public.can_view_league(league_participants.league_id, (select auth.uid())));

-- Lets someone back out before fixtures exist. Once a league is
-- in_progress, a participant's fixtures already reference them, so leaving
-- is not offered (no "leave an active league" flow in v1).
drop policy if exists "leave a league before it starts" on public.league_participants;
create policy "leave a league before it starts"
  on public.league_participants for delete to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.leagues l
      where l.id = league_participants.league_id and l.status = 'draft'
    )
  );

-- No INSERT/UPDATE policy: create_league()/join_league() are the only
-- write paths.

-- league_fixtures -----------------------------------------------------------
drop policy if exists "group members read league fixtures" on public.league_fixtures;
create policy "group members read league fixtures"
  on public.league_fixtures for select to authenticated
  using (public.can_view_league(league_fixtures.league_id, (select auth.uid())));

-- No INSERT/UPDATE/DELETE policy at all: start_league()/
-- log_league_fixture_result()/_generate_league_knockout() are the only
-- write paths.

-- matches ---------------------------------------------------------------
-- Re-declares 0003's update/delete policies with an added guard: once a
-- matches row is linked from league_fixtures.match_id, its creator can no
-- longer edit/delete it directly — only log_league_fixture_result's own
-- bookkeeping touches it from then on. Ordinary, non-league matches are
-- completely unaffected.
drop policy if exists "logger edits their match" on public.matches;
create policy "logger edits their match"
  on public.matches for update to authenticated
  using (
    created_by = (select auth.uid())
    and not exists (select 1 from public.league_fixtures lf where lf.match_id = matches.id)
  )
  with check (
    created_by = (select auth.uid())
    and (select auth.uid()) in (player_one_id, player_two_id)
  );

drop policy if exists "logger deletes their match" on public.matches;
create policy "logger deletes their match"
  on public.matches for delete to authenticated
  using (
    created_by = (select auth.uid())
    and not exists (select 1 from public.league_fixtures lf where lf.match_id = matches.id)
  );


-- ---------------------------------------------------------------------------
-- Grants (explicit, so PostgREST exposes these regardless of default privs)
-- ---------------------------------------------------------------------------

grant select on public.leagues              to authenticated;
grant select on public.league_participants  to authenticated;
grant delete on public.league_participants  to authenticated;
grant select on public.league_fixtures      to authenticated;

-- Repairs a gap in 0003_groups.sql: it dropped and recreated
-- player_match_results (needed to add group_id to the column list) but its
-- own GRANTS section never re-granted `select ... to authenticated` on the
-- new view object, only on groups/group_members. Since every stats RPC in
-- this app (get_group_leaderboard, get_h2h_stats, get_league_standings,
-- etc.) is `security invoker` and PostgREST always calls RPCs as the
-- `authenticated` role, a missing grant here would make those calls fail
-- for real signed-in users, not just this migration's new
-- get_league_standings. Re-stated here (idempotent) since it's a direct
-- dependency of get_league_standings and this file is what's actually
-- getting re-pasted into the live project next.
grant select on public.player_match_results to authenticated;

grant execute on function public.create_league(uuid, text, public.league_type, int, smallint) to authenticated;
grant execute on function public.join_league(uuid, int)                                        to authenticated;
grant execute on function public.start_league(uuid)                                            to authenticated;
grant execute on function public.log_league_fixture_result(uuid, smallint, smallint, uuid, timestamptz, text) to authenticated;
grant execute on function public.get_league_standings(uuid)                                    to authenticated;
grant execute on function public.is_league_participant(uuid, uuid)                             to authenticated;
grant execute on function public.can_view_league(uuid, uuid)                                   to authenticated;

-- _generate_league_knockout is deliberately NOT granted — it is only ever
-- called from inside log_league_fixture_result, never directly by a client.
