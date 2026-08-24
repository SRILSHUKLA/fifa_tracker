-- ============================================================================
-- FIFA Score Tracker — initial schema
--
-- Run this in the Supabase SQL editor before 0002_seed_teams.sql.
--
-- Design notes:
--   * There is no application server. The browser talks to Postgres through
--     PostgREST with the signed-in user's JWT, so the RLS policies at the
--     bottom of this file ARE the authorization layer.
--   * Anything derivable is derived: matches.winner_id is a generated column
--     and leaderboard points are computed in a view. Nothing is denormalized,
--     so nothing can drift out of sync.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

do $do$ begin
  create type public.friendship_status as enum ('pending', 'accepted', 'blocked');
exception
  when duplicate_object then null;
end $do$;


-- ---------------------------------------------------------------------------
-- profiles — public identity, 1:1 with auth.users
--
-- auth.users is never exposed to the client, so every public reference to a
-- person points here instead.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null
                 check (length(username) between 3 and 20
                        and username ~ '^[a-zA-Z0-9_]+$'),
  display_name text check (length(display_name) <= 40),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Usernames are case-insensitively unique: @Sril and @sril are the same handle.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));


-- Every new auth user gets a profile automatically. The username is passed
-- from the signup form via options.data; the fallback keeps the trigger safe
-- if a user is ever created from the Supabase dashboard.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'player_' || substr(new.id::text, 1, 8)
    ),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- friendships — one row per pair, in either direction
-- ---------------------------------------------------------------------------

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint no_self_friendship check (requester_id <> addressee_id)
);

-- One relationship per pair regardless of who asked first. Without this,
-- A -> B and B -> A could both sit in the table as separate pending requests.
create unique index if not exists friendships_unique_pair on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index if not exists friendships_addressee_idx
  on public.friendships (addressee_id, status);
create index if not exists friendships_requester_idx
  on public.friendships (requester_id, status);


-- ---------------------------------------------------------------------------
-- teams — seeded reference data (see 0002_seed_teams.sql)
-- ---------------------------------------------------------------------------

create table if not exists public.teams (
  id          serial primary key,
  name        text not null,
  short_name  text,
  league      text not null,
  country     text,
  is_national boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (name, league)
);

create index if not exists teams_league_idx on public.teams (league, name);


-- ---------------------------------------------------------------------------
-- matches — the core table
--
-- Convention: player_one is always the person who logged the match. There is
-- no home/away in a couch 1v1, and this maps the "Add Match" form (your score
-- / their score) straight onto the row. created_by is stored separately so
-- edit and delete rights survive if that convention ever changes.
-- ---------------------------------------------------------------------------

create table if not exists public.matches (
  id                 uuid primary key default gen_random_uuid(),

  player_one_id      uuid not null references public.profiles(id) on delete cascade,
  player_two_id      uuid not null references public.profiles(id) on delete cascade,

  player_one_score   smallint not null check (player_one_score between 0 and 99),
  player_two_score   smallint not null check (player_two_score between 0 and 99),

  player_one_team_id int references public.teams(id) on delete set null,
  player_two_team_id int references public.teams(id) on delete set null,

  -- Generated, so the recorded winner can never contradict the score.
  -- NULL means a draw.
  winner_id uuid generated always as (
    case
      when player_one_score > player_two_score then player_one_id
      when player_two_score > player_one_score then player_two_id
      else null
    end
  ) stored,

  created_by uuid not null references public.profiles(id),

  -- Separate from created_at so last night's match can be backdated.
  played_at  timestamptz not null default now(),
  notes      text check (length(notes) <= 200),
  created_at timestamptz not null default now(),

  constraint distinct_players check (player_one_id <> player_two_id)
);

create index if not exists matches_p1_idx on public.matches (player_one_id, played_at desc);
create index if not exists matches_p2_idx on public.matches (player_two_id, played_at desc);
create index if not exists matches_pair_idx on public.matches (
  least(player_one_id, player_two_id),
  greatest(player_one_id, player_two_id),
  played_at desc
);
create index if not exists matches_played_at_idx on public.matches (played_at desc);


-- ---------------------------------------------------------------------------
-- Stats layer
-- ---------------------------------------------------------------------------

-- The view everything else is built on: each match becomes two rows, one per
-- player's point of view. Every stat in the app is then a plain aggregate over
-- this, instead of shipping the match table to a phone to compute a win rate.
--
-- security_invoker = on is essential. Without it a view runs with its OWNER's
-- privileges and silently bypasses RLS on public.matches.
create or replace view public.player_match_results
with (security_invoker = on) as
  select
    m.id                 as match_id,
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


-- Global leaderboard: 3 points for a win, 1 for a draw. Players with no
-- matches yet are still listed (left join) so a new signup can see themselves.
-- The client orders by points desc, goal_difference desc, goals_for desc.
create or replace view public.leaderboard
with (security_invoker = on) as
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    count(r.match_id)                                        as played,
    count(*) filter (where r.result = 'win')                 as wins,
    count(*) filter (where r.result = 'draw')                as draws,
    count(*) filter (where r.result = 'loss')                as losses,
    coalesce(sum(r.goals_for), 0)                            as goals_for,
    coalesce(sum(r.goals_against), 0)                        as goals_against,
    coalesce(sum(r.goals_for) - sum(r.goals_against), 0)     as goal_difference,
    count(*) filter (where r.result = 'win') * 3
      + count(*) filter (where r.result = 'draw')            as points,
    round(
      count(*) filter (where r.result = 'win')::numeric
        / nullif(count(r.match_id), 0) * 100
    , 1)                                                     as win_pct
  from public.profiles p
  left join public.player_match_results r on r.player_id = p.id
  group by p.id, p.username, p.display_name, p.avatar_url;


-- Everything the H2H dashboard needs, in one round trip.
create or replace function public.get_h2h_stats(p_opponent uuid)
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
    and r.opponent_id = p_opponent;
$fn$;


-- Accepted friends in both directions, each with the current user's record
-- against them. Powers both the friends list and the opponent picker.
create or replace function public.get_friends()
returns table (
  id            uuid,
  username      text,
  display_name  text,
  avatar_url    text,
  friends_since timestamptz,
  played        bigint,
  wins          bigint,
  draws         bigint,
  losses        bigint
)
language sql
stable
security invoker
set search_path = ''
as $fn$
  with friends as (
    select
      case when f.requester_id = auth.uid() then f.addressee_id
           else f.requester_id end           as friend_id,
      coalesce(f.responded_at, f.created_at) as since
    from public.friendships f
    where f.status = 'accepted'
      and auth.uid() in (f.requester_id, f.addressee_id)
  )
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    fr.since,
    count(r.match_id)::bigint,
    (count(*) filter (where r.result = 'win'))::bigint,
    (count(*) filter (where r.result = 'draw'))::bigint,
    (count(*) filter (where r.result = 'loss'))::bigint
  from friends fr
  join public.profiles p on p.id = fr.friend_id
  left join public.player_match_results r
    on r.player_id = auth.uid()
   and r.opponent_id = fr.friend_id
  group by p.id, p.username, p.display_name, p.avatar_url, fr.since
  order by count(r.match_id) desc, p.username;
$fn$;


-- Find people to add. Username is a prefix match; email must match exactly so
-- that nobody can enumerate addresses. security definer is required to read
-- auth.users, and set search_path = '' closes the search-path hijack that the
-- Supabase linter flags on definer functions.
create or replace function public.search_users(q text)
returns table (
  id                uuid,
  username          text,
  display_name      text,
  avatar_url        text,
  friendship_status text,
  is_requester      boolean
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(f.status::text, 'none'),
    coalesce(f.requester_id = auth.uid(), false)
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.friendships f
    on least(f.requester_id, f.addressee_id)    = least(p.id, auth.uid())
   and greatest(f.requester_id, f.addressee_id) = greatest(p.id, auth.uid())
  where p.id <> auth.uid()
    and length(btrim(q)) >= 2
    and (
      p.username ilike btrim(q) || '%'
      or lower(u.email) = lower(btrim(q))
    )
  order by p.username
  limit 20;
$fn$;


-- Lets the signup form check a handle before submitting. Without this the
-- unique index would only fire inside handle_new_user, and auth.signUp would
-- surface it as an opaque "Database error saving new user". Callable by anon
-- because the signup form is, by definition, not signed in yet. Usernames are
-- public handles, so this exposes nothing that the app does not already show.
create or replace function public.is_username_available(u text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select not exists (
    select 1 from public.profiles p
    where lower(p.username) = lower(btrim(u))
  );
$fn$;


-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Used by the matches INSERT policy so the friend requirement is enforced by
-- the database, not merely hidden by the UI. security definer so the check
-- works even though the caller cannot see other people's friendship rows.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and least(f.requester_id, f.addressee_id)    = least(a, b)
      and greatest(f.requester_id, f.addressee_id) = greatest(a, b)
  );
$fn$;


alter table public.profiles    enable row level security;
alter table public.friendships enable row level security;
alter table public.teams       enable row level security;
alter table public.matches     enable row level security;

-- profiles ------------------------------------------------------------------
-- Readable by all signed-in users: the global leaderboard and user search both
-- need to resolve names for people you are not friends with. Only public
-- identity lives here; email stays in auth.users.
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No INSERT policy: rows are created only by the handle_new_user trigger,
-- which is security definer and therefore bypasses RLS.

-- friendships ---------------------------------------------------------------
drop policy if exists "users see own friendships" on public.friendships;
create policy "users see own friendships"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

drop policy if exists "users send requests as themselves" on public.friendships;
create policy "users send requests as themselves"
  on public.friendships for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'pending');

-- Only the person who received the request can accept or decline it.
drop policy if exists "addressee responds to requests" on public.friendships;
create policy "addressee responds to requests"
  on public.friendships for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()));

drop policy if exists "either party removes friendship" on public.friendships;
create policy "either party removes friendship"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

-- teams ---------------------------------------------------------------------
drop policy if exists "teams readable by authenticated" on public.teams;
create policy "teams readable by authenticated"
  on public.teams for select to authenticated
  using (true);

-- No write policies: teams are reference data, seeded by migration only.

-- matches -------------------------------------------------------------------
-- Deliberately readable by every signed-in user, which is what makes the
-- global leaderboard actually global. Writes stay locked to participants.
-- To make results private to the two players instead, narrow this to
--   (select auth.uid()) in (player_one_id, player_two_id)
-- and move the leaderboard behind a security definer RPC.
drop policy if exists "matches readable by authenticated" on public.matches;
create policy "matches readable by authenticated"
  on public.matches for select to authenticated
  using (true);

drop policy if exists "participants log their own matches" on public.matches;
create policy "participants log their own matches"
  on public.matches for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (select auth.uid()) in (player_one_id, player_two_id)
    and public.are_friends(player_one_id, player_two_id)
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

grant select                         on public.profiles             to authenticated;
grant update                         on public.profiles             to authenticated;
grant select, insert, update, delete on public.friendships          to authenticated;
grant select                         on public.teams                to authenticated;
grant select, insert, update, delete on public.matches              to authenticated;
grant select                         on public.player_match_results to authenticated;
grant select                         on public.leaderboard          to authenticated;

grant execute on function public.get_h2h_stats(uuid)     to authenticated;
grant execute on function public.get_friends()           to authenticated;
grant execute on function public.search_users(text)      to authenticated;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- Clients never insert teams, so make sure a leaked anon key cannot burn ids.
revoke all on sequence public.teams_id_seq from anon, authenticated;
