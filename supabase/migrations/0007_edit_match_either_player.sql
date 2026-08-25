-- ============================================================================
-- FIFA Score Tracker — either player can edit a shared match
--
-- Run after 0006_edit_match.sql.
--
-- edit_match() originally required created_by = auth.uid() — only whoever
-- happened to be the one who submitted the result. In practice either
-- player can spot a wrong score, and the history page only ever shows
-- matches the viewer took part in anyway (getMatches is always called with
-- playerId = the signed-in user), so restricting edits to the logger meant
-- the edit button silently vanished on roughly half of someone's own match
-- history for no reason they could see — a match they definitely played in,
-- just not the one they happened to submit.
--
-- This widens the permission check to either participant (player_one_id or
-- player_two_id). Everything else about edit_match's behaviour — the
-- league bookkeeping rules (bracket lock, champion recompute, blocked
-- winner-flip cascade) — is unchanged; only the `who may call this at all`
-- gate moves.
-- ============================================================================

create or replace function public.edit_match(
  p_match_id           uuid,
  p_player_one_score   smallint,
  p_player_two_score   smallint,
  p_player_one_team_id int default null,
  p_player_two_team_id int default null,
  p_played_at          timestamptz default null,
  p_notes              text default null,
  p_penalty_winner_id  uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  m               public.matches;
  f               public.league_fixtures;
  lg              public.leagues;
  old_winner      uuid;
  new_winner      uuid;
  next_status     public.fixture_status;
  bracket_exists  boolean;
  recomputed      uuid;
begin
  if p_player_one_score < 0 or p_player_one_score > 99
     or p_player_two_score < 0 or p_player_two_score > 99 then
    raise exception 'Scores must be 0-99.';
  end if;

  select * into m from public.matches where id = p_match_id;
  if m.id is null then
    raise exception 'Match not found.';
  end if;
  if auth.uid() not in (m.player_one_id, m.player_two_id) then
    raise exception 'Only the two players in this match can edit it.';
  end if;
  if p_player_one_team_id is not null and not exists (select 1 from public.teams where id = p_player_one_team_id) then
    raise exception 'Pick a valid team.';
  end if;
  if p_player_two_team_id is not null and not exists (select 1 from public.teams where id = p_player_two_team_id) then
    raise exception 'Pick a valid team.';
  end if;

  select * into f from public.league_fixtures where match_id = p_match_id;

  if f.id is not null then
    select * into lg from public.leagues where id = f.league_id for update;

    -- Winner (as a player id, not a fixture-slot position — matches.player_one_id
    -- is whoever logged the match, which need not be league_fixtures.player_one_id;
    -- see the orientation note on scoreFromPerspective in
    -- components/leagues/league-fixture-card.tsx for the client-side version of
    -- this same rule).
    old_winner := case
      when m.player_one_score > m.player_two_score then m.player_one_id
      when m.player_two_score > m.player_one_score then m.player_two_id
      else f.penalty_winner_id
    end;

    if f.stage = 'knockout' and p_player_one_score = p_player_two_score then
      if p_penalty_winner_id is null or p_penalty_winner_id not in (m.player_one_id, m.player_two_id) then
        raise exception 'This is a draw — record the penalty shootout winner.';
      end if;
    elsif p_penalty_winner_id is not null and (f.stage <> 'knockout' or p_player_one_score <> p_player_two_score) then
      raise exception 'Penalty shootout winner only applies to a drawn knockout fixture.';
    end if;

    new_winner := case
      when p_player_one_score > p_player_two_score then m.player_one_id
      when p_player_two_score > p_player_one_score then m.player_two_id
      else p_penalty_winner_id
    end;

    if f.stage = 'round_robin'
       and lg.type = 'round_robin_knockout'
       and (p_player_one_score, p_player_two_score) is distinct from (m.player_one_score, m.player_two_score)
    then
      select exists (
        select 1 from public.league_fixtures where league_id = lg.id and stage = 'knockout'
      ) into bracket_exists;

      if bracket_exists then
        raise exception 'The knockout bracket has already been seeded from this round robin, so its scores are locked.';
      end if;
    end if;

    if f.stage = 'knockout' and new_winner is distinct from old_winner and f.next_fixture_id is not null then
      select status into next_status from public.league_fixtures where id = f.next_fixture_id;
      if next_status = 'completed' then
        raise exception 'The winner of this fixture has already played in the next round — fix that result first, then edit this one.';
      end if;
    end if;
  end if;

  update public.matches
  set
    player_one_score = p_player_one_score,
    player_two_score = p_player_two_score,
    player_one_team_id = p_player_one_team_id,
    player_two_team_id = p_player_two_team_id,
    played_at = coalesce(p_played_at, played_at),
    notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_match_id;

  if f.id is null then
    return;
  end if;

  if f.stage = 'knockout' then
    update public.league_fixtures set penalty_winner_id = p_penalty_winner_id where id = f.id;

    if new_winner is distinct from old_winner then
      if f.next_fixture_id is null then
        update public.leagues set champion_id = new_winner where id = lg.id;
      else
        update public.league_fixtures
        set
          player_one_id = case when f.next_fixture_slot = 1 then new_winner else player_one_id end,
          player_two_id = case when f.next_fixture_slot = 2 then new_winner else player_two_id end
        where id = f.next_fixture_id;
      end if;
    end if;
  elsif lg.type <> 'round_robin_knockout' and lg.status = 'completed' then
    -- A plain round robin's champion is just the standings leader — cheap
    -- and always safe to recompute, no bracket to keep consistent.
    select s.id into recomputed
    from public.get_league_standings(lg.id) s
    order by s.points desc, s.goal_difference desc, s.goals_for desc, s.username asc
    limit 1;

    update public.leagues set champion_id = recomputed where id = lg.id;
  end if;
end;
$fn$;

-- Signature (arg types) is unchanged from 0006, so the existing grant still
-- applies — nothing to re-grant here.
