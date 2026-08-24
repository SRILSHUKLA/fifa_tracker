-- ============================================================================
-- FIFA Score Tracker — groups
--
-- Run this after 0001_init.sql and 0002_seed_teams.sql.
--
-- Replaces the friends system with groups. Friendship was pairwise but leaked
-- like it was transitive: if A and B are friends, and B and C are friends, A
-- could still see C on the (global) leaderboard despite never having agreed
-- to that. Groups fix this by making every match, every leaderboard row, and
-- every head-to-head stat scoped to one explicit group_id — two people only
-- see each other if they actually share a group.
--
-- Design notes (same invariants as 0001_init.sql):
--   * There is no application server, so the RLS policies below ARE the
--     authorization layer.
--   * groups/group_members have no INSERT policy at all — every row is
--     created by a security definer RPC (create_group / join_group), the
--     same "trigger/RPC-only" idiom 0001 already uses for profiles. This
--     keeps group creation atomic and means a non-member never needs a
--     broad-read policy on groups just to resolve an invite code.
--   * matches.group_id is required and set once at logging time. Two people
--     can share more than one group, so inferring "which group" from the
--     pair alone would be ambiguous; tying every match to exactly one group
--     is the only design with no double-counting or leak risk.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- groups — one row per group, sharable via a single invite code
-- ---------------------------------------------------------------------------

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 2 and 40),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  invite_code text not null,
  created_at  timestamptz not null default now()
);

-- Codes are shared as plain text (typed or pasted from a link), so they are
-- compared and looked up case-insensitively.
create unique index if not exists groups_invite_code_lower_idx
  on public.groups (lower(invite_code));


-- ---------------------------------------------------------------------------
-- group_members — one row per (group, user)
-- ---------------------------------------------------------------------------

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);

-- The ~11-player cap is enforced inside join_group() below, not here: a
-- table-level constraint can't easily count sibling rows, and join_group()
-- is the only path that ever inserts a member row.


-- ---------------------------------------------------------------------------
-- matches — tie every match to exactly one group
-- ---------------------------------------------------------------------------

alter table public.matches
  add column if not exists group_id uuid references public.groups(id) on delete restrict;

-- Any match logged before groups existed has no group to belong to, and
-- there is no sensible group to backfill it into automatically. This schema
-- is pre-launch, so it is safe to drop that pre-groups history rather than
-- invent a group for it — if you have real match history you need to keep,
-- back it up before running this migration and handle the backfill by hand
-- instead of relying on this line. Guarded to only ever touch rows that
-- cannot satisfy the NOT NULL below, so this is a no-op on every later
-- (idempotent) run once group_id is already populated.
delete from public.matches where group_id is null;

alter table public.matches alter column group_id set not null;

-- on delete restrict (not cascade): a group with match history can't be
-- deleted out from under its own results. Group deletion is intentionally
-- out of scope for now — only rename / regenerate-code / remove-member /
-- leave are exposed, the same "removing a relationship keeps history"
-- philosophy the old unfriend flow used.

drop index if exists public.matches_pair_idx;
create index matches_pair_idx on public.matches (
  group_id,
  least(player_one_id, player_two_id),
  greatest(player_one_id, player_two_id),
  played_at desc
);
create index if not exists matches_group_played_idx
  on public.matches (group_id, played_at desc);


-- ---------------------------------------------------------------------------
-- Stats layer — carry group_id through the per-player-perspective view
-- ---------------------------------------------------------------------------

-- The old `leaderboard` view depends on player_match_results, and
-- inserting group_id into the column list means this cannot be a plain
-- CREATE OR REPLACE VIEW (Postgres only allows appending columns at the
-- end that way) — so leaderboard is retired first, then the view beneath
-- it is dropped and rebuilt from scratch. CASCADE is defensive: nothing
-- should still depend on player_match_results at this point, but it keeps
-- this statement robust if that ever changes.
drop view if exists public.leaderboard;
drop view if exists public.player_match_results cascade;

create view public.player_match_results
with (security_invoker = on) as
  select
    m.id                 as match_id,
    m.group_id,
    m.played_at,
    m.player_one_id      as player_id,
    m.player_two_id      as opponent_id,
    m.player_one_score   as goals_for,
    m.player_two_score   as goals_against,
    m.player_one_team_id as team_id,
    m.player_two_team_id as opponent_team_id,
    m.created_by,
    case
      when m.player_one_score > m.player_two_score then 'win'
      when m.player_one_score < m.player_two_score then 'loss'
      else 'draw'
    end as result
  from public.matches m
  union all
  select
    m.id,
    m.group_id,
    m.played_at,
    m.player_two_id,
    m.player_one_id,
    m.player_two_score,
    m.player_one_score,
    m.player_two_team_id,
    m.player_one_team_id,
    m.created_by,
    case
      when m.player_two_score > m.player_one_score then 'win'
      when m.player_two_score < m.player_one_score then 'loss'
      else 'draw'
    end
  from public.matches m;


-- ---------------------------------------------------------------------------
-- Group membership + administration RPCs
-- ---------------------------------------------------------------------------

-- Used by the matches INSERT policy so the group requirement is enforced by
-- the database, not merely hidden by the UI.
-- security definer so this can be used inside group_members' own SELECT
-- policy without recursing: a plain correlated subquery against
-- group_members from within group_members' own RLS policy would re-trigger
-- that same policy for every candidate row and recurse forever. Running the
-- membership check inside a definer function evaluates it once, with RLS
-- bypassed internally, breaking the cycle.
create or replace function public.is_group_member(p_group_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = p_user
  );
$fn$;

create or replace function public.are_group_members(p_group_id uuid, a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select public.is_group_member(p_group_id, a) and public.is_group_member(p_group_id, b);
$fn$;

create or replace function public.is_group_owner(p_group_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.groups
    where id = p_group_id and owner_id = p_user
  );
$fn$;

-- Creates the group and seats the caller as its owner in one transaction, so
-- a group is never observably created without its owner already a member.
create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  g    public.groups;
  code text;
begin
  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.groups where lower(invite_code) = lower(code));
  end loop;

  insert into public.groups (name, owner_id, invite_code)
  values (btrim(p_name), auth.uid(), code)
  returning * into g;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'owner');

  return g;
end;
$fn$;

-- Zero-friction join by code. security definer so a non-member can resolve a
-- code without groups needing a broad-read policy.
create or replace function public.join_group(p_invite_code text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  g            public.groups;
  member_count int;
begin
  select * into g from public.groups where lower(invite_code) = lower(btrim(p_invite_code));
  if g.id is null then
    raise exception 'That invite code is not valid.';
  end if;

  select count(*) into member_count from public.group_members where group_id = g.id;
  if member_count >= 11 and not exists (
    select 1 from public.group_members where group_id = g.id and user_id = auth.uid()
  ) then
    raise exception 'This group is full (11 players max).';
  end if;

  -- Re-joining (or a double-tap race) is a harmless no-op, not an error —
  -- same idea as the friend-request unique-violation swallowed client-side
  -- by the old sendFriendRequest().
  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return g;
end;
$fn$;

create or replace function public.regenerate_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  code text;
begin
  if not public.is_group_owner(p_group_id, auth.uid()) then
    raise exception 'Only the group owner can do that.';
  end if;

  loop
    code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    exit when not exists (select 1 from public.groups where lower(invite_code) = lower(code));
  end loop;

  update public.groups set invite_code = code where id = p_group_id;
  return code;
end;
$fn$;


-- ---------------------------------------------------------------------------
-- Group stats RPCs
-- ---------------------------------------------------------------------------

-- Roster + each member's record against the caller, within this group.
-- Replaces get_friends(). security invoker: relies on the RLS already on
-- group_members/player_match_results to keep this member-only.
create or replace function public.get_group_members(p_group_id uuid)
returns table (
  id           uuid,
  username     text,
  display_name text,
  avatar_url   text,
  role         text,
  joined_at    timestamptz,
  played       bigint,
  wins         bigint,
  draws        bigint,
  losses       bigint
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
    gm.role,
    gm.joined_at,
    count(r.match_id)::bigint,
    (count(*) filter (where r.result = 'win'))::bigint,
    (count(*) filter (where r.result = 'draw'))::bigint,
    (count(*) filter (where r.result = 'loss'))::bigint
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.player_match_results r
    on r.player_id = auth.uid()
   and r.opponent_id = gm.user_id
   and r.group_id = p_group_id
  where gm.group_id = p_group_id
  group by p.id, p.username, p.display_name, p.avatar_url, gm.role, gm.joined_at
  order by p.username;
$fn$;

-- Group leaderboard, replaces the global `leaderboard` view. Left-joined from
-- membership (not from matches), so a member with zero games still appears.
create or replace function public.get_group_leaderboard(p_group_id uuid)
returns table (
  id              uuid,
  username        text,
  display_name    text,
  avatar_url      text,
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
    count(r.match_id)                                    as played,
    count(*) filter (where r.result = 'win')              as wins,
    count(*) filter (where r.result = 'draw')             as draws,
    count(*) filter (where r.result = 'loss')             as losses,
    coalesce(sum(r.goals_for), 0)                         as goals_for,
    coalesce(sum(r.goals_against), 0)                     as goals_against,
    coalesce(sum(r.goals_for) - sum(r.goals_against), 0)  as goal_difference,
    count(*) filter (where r.result = 'win') * 3
      + count(*) filter (where r.result = 'draw')         as points,
    round(
      count(*) filter (where r.result = 'win')::numeric
        / nullif(count(r.match_id), 0) * 100
    , 1)                                                  as win_pct
  from public.group_members gm
  join public.profiles p on p.id = gm.user_id
  left join public.player_match_results r
    on r.player_id = gm.user_id and r.group_id = p_group_id
  where gm.group_id = p_group_id
  group by p.id, p.username, p.display_name, p.avatar_url;
$fn$;

-- Head-to-head, now scoped to one group (breaking signature change: gains a
-- leading p_group_id argument).
create or replace function public.get_h2h_stats(p_group_id uuid, p_opponent uuid)
returns table (
  played             bigint,
  wins               bigint,
  draws              bigint,
  losses             bigint,
  goals_for          bigint,
  goals_against      bigint,
  avg_goals_for      numeric,
  avg_goals_against  numeric,
  biggest_win_margin int,
  last_played        timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select
    count(*)::bigint,
    (count(*) filter (where r.result = 'win'))::bigint,
    (count(*) filter (where r.result = 'draw'))::bigint,
    (count(*) filter (where r.result = 'loss'))::bigint,
    coalesce(sum(r.goals_for), 0)::bigint,
    coalesce(sum(r.goals_against), 0)::bigint,
    round(coalesce(avg(r.goals_for), 0), 2)::numeric,
    round(coalesce(avg(r.goals_against), 0), 2)::numeric,
    coalesce(max(r.goals_for - r.goals_against), 0)::int,
    max(r.played_at)
  from public.player_match_results r
  where r.player_id = auth.uid()
    and r.opponent_id = p_opponent
    and r.group_id = p_group_id;
$fn$;

-- Team-based head-to-head: which team(s) the caller picks against one
-- opponent within this group, and the record with each.
create or replace function public.get_h2h_team_stats(p_group_id uuid, p_opponent uuid)
returns table (
  team_id       int,
  team_name     text,
  played        bigint,
  wins          bigint,
  draws         bigint,
  losses        bigint,
  goals_for     bigint,
  goals_against bigint
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select
    r.team_id,
    t.name,
    count(*)::bigint,
    (count(*) filter (where r.result = 'win'))::bigint,
    (count(*) filter (where r.result = 'draw'))::bigint,
    (count(*) filter (where r.result = 'loss'))::bigint,
    coalesce(sum(r.goals_for), 0)::bigint,
    coalesce(sum(r.goals_against), 0)::bigint
  from public.player_match_results r
  join public.teams t on t.id = r.team_id
  where r.player_id = auth.uid()
    and r.opponent_id = p_opponent
    and r.group_id = p_group_id
  group by r.team_id, t.name
  order by count(*) desc;
$fn$;

-- Group-wide (not opponent-specific) team record — "which team do I actually
-- play well" within this group.
create or replace function public.get_group_team_stats(p_group_id uuid)
returns table (
  team_id       int,
  team_name     text,
  played        bigint,
  wins          bigint,
  draws         bigint,
  losses        bigint,
  goals_for     bigint,
  goals_against bigint
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  select
    r.team_id,
    t.name,
    count(*)::bigint,
    (count(*) filter (where r.result = 'win'))::bigint,
    (count(*) filter (where r.result = 'draw'))::bigint,
    (count(*) filter (where r.result = 'loss'))::bigint,
    coalesce(sum(r.goals_for), 0)::bigint,
    coalesce(sum(r.goals_against), 0)::bigint
  from public.player_match_results r
  join public.teams t on t.id = r.team_id
  where r.player_id = auth.uid()
    and r.group_id = p_group_id
  group by r.team_id, t.name
  order by count(*) desc;
$fn$;


-- ---------------------------------------------------------------------------
-- Retire the friends system
-- ---------------------------------------------------------------------------

-- Policies referencing are_friends() must drop before the function does.
drop policy if exists "participants log their own matches" on public.matches;
drop policy if exists "matches readable by authenticated" on public.matches;
drop policy if exists "logger edits their match" on public.matches;
drop policy if exists "logger deletes their match" on public.matches;

drop function if exists public.are_friends(uuid, uuid);
drop function if exists public.get_friends();
drop function if exists public.search_users(text); -- friend-search only; is_username_available stays

-- The old single-argument get_h2h_stats(uuid) is superseded by the
-- group-scoped get_h2h_stats(uuid, uuid) created above. Different argument
-- lists mean Postgres treats them as separate overloads rather than one
-- replacing the other, so the old, unscoped signature must be dropped
-- explicitly — otherwise it would keep working and silently bypass group
-- scoping entirely, the exact leakage this migration exists to close.
drop function if exists public.get_h2h_stats(uuid);

drop table if exists public.friendships; -- cascades its own policies/indexes
drop type if exists public.friendship_status;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- groups ----------------------------------------------------------------
-- Readable only by members: unlike profiles, a group is not public identity,
-- it is the thing that scopes stats, so it must not leak to non-members.
-- Discoverable only through join_group()'s controlled invite-code lookup.
drop policy if exists "members read their groups" on public.groups;
create policy "members read their groups"
  on public.groups for select to authenticated
  using (public.is_group_member(groups.id, (select auth.uid())));

-- No INSERT policy: rows are created only by create_group(), which is
-- security definer and therefore bypasses RLS.

drop policy if exists "owner renames their group" on public.groups;
create policy "owner renames their group"
  on public.groups for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- No DELETE policy: group deletion is out of scope while matches.group_id is
-- ON DELETE RESTRICT (see the matches section above).

-- group_members ---------------------------------------------------------
-- Must go through is_group_member() rather than a raw correlated subquery
-- against this same table — a self-referencing subquery here would re-fire
-- this exact policy for every row it examines and recurse forever.
drop policy if exists "members read their group roster" on public.group_members;
create policy "members read their group roster"
  on public.group_members for select to authenticated
  using (public.is_group_member(group_members.group_id, (select auth.uid())));

-- No INSERT policy: rows are created only by create_group()/join_group().

-- Either you are leaving your own non-owner membership, or the owner is
-- removing someone else's non-owner membership. The owner's own row can
-- never be deleted through this policy (no "delete the group" path yet).
drop policy if exists "leave or owner removes a member" on public.group_members;
create policy "leave or owner removes a member"
  on public.group_members for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (role <> 'owner' and public.is_group_owner(group_id, (select auth.uid())))
  );

-- matches -----------------------------------------------------------------
-- Replaces the old "readable by everyone / must be friends" policies: now
-- scoped to "must share the match's group".
drop policy if exists "group members read their group's matches" on public.matches;
create policy "group members read their group's matches"
  on public.matches for select to authenticated
  using (public.is_group_member(matches.group_id, (select auth.uid())));

drop policy if exists "group members log matches within their group" on public.matches;
create policy "group members log matches within their group"
  on public.matches for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select auth.uid()) in (player_one_id, player_two_id)
    and public.are_group_members(group_id, player_one_id, player_two_id)
  );

drop policy if exists "logger edits their match" on public.matches;
create policy "logger edits their match"
  on public.matches for update to authenticated
  using (created_by = (select auth.uid()))
  with check (
    created_by = (select auth.uid())
    and (select auth.uid()) in (player_one_id, player_two_id)
  );

drop policy if exists "logger deletes their match" on public.matches;
create policy "logger deletes their match"
  on public.matches for delete to authenticated
  using (created_by = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- Grants (explicit, so PostgREST exposes these regardless of default privs)
-- ---------------------------------------------------------------------------

grant select      on public.groups        to authenticated;
-- Column-level: invite_code can only change via regenerate_invite_code(), so
-- a raw PostgREST PATCH cannot set it directly.
grant update (name) on public.groups      to authenticated;
grant select, delete on public.group_members to authenticated;

grant execute on function public.create_group(text)                  to authenticated;
grant execute on function public.join_group(text)                    to authenticated;
grant execute on function public.regenerate_invite_code(uuid)        to authenticated;
grant execute on function public.is_group_owner(uuid, uuid)          to authenticated;
grant execute on function public.is_group_member(uuid, uuid)         to authenticated;
grant execute on function public.are_group_members(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_group_members(uuid)             to authenticated;
grant execute on function public.get_group_leaderboard(uuid)         to authenticated;
grant execute on function public.get_h2h_stats(uuid, uuid)           to authenticated;
grant execute on function public.get_h2h_team_stats(uuid, uuid)      to authenticated;
grant execute on function public.get_group_team_stats(uuid)          to authenticated;
