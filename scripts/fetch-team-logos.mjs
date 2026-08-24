/**
 * One-time (re-runnable) tool: looks up a crest/badge image URL for every
 * team in supabase/migrations/0002_seed_teams.sql via TheSportsDB's free
 * public API, and prints an idempotent SQL migration
 * (supabase/migrations/0004_team_logos.sql) that sets teams.logo_url.
 *
 * Not part of the app's runtime — this generates a reviewable SQL file once;
 * the app never calls TheSportsDB itself. Re-run this (e.g. after adding new
 * teams to 0002_seed_teams.sql) to regenerate the migration.
 *
 * Usage: node scripts/fetch-team-logos.mjs
 */
import { writeFileSync } from "node:fs";

// TheSportsDB's published free test key. Rate-limited (~30 req/min), hence
// the delay between calls below.
const API_BASE = "https://www.thesportsdb.com/api/v1/json/3";

// Same 165 teams as 0002_seed_teams.sql, kept in sync by hand — this script
// has no SQL parser, and the list rarely changes.
const TEAMS = [
  // Premier League
  ["Arsenal", "Premier League"], ["Aston Villa", "Premier League"],
  ["Bournemouth", "Premier League"], ["Brentford", "Premier League"],
  ["Brighton & Hove Albion", "Premier League"], ["Chelsea", "Premier League"],
  ["Crystal Palace", "Premier League"], ["Everton", "Premier League"],
  ["Fulham", "Premier League"], ["Ipswich Town", "Premier League"],
  ["Leicester City", "Premier League"], ["Liverpool", "Premier League"],
  ["Manchester City", "Premier League"], ["Manchester United", "Premier League"],
  ["Newcastle United", "Premier League"], ["Nottingham Forest", "Premier League"],
  ["Southampton", "Premier League"], ["Tottenham Hotspur", "Premier League"],
  ["West Ham United", "Premier League"], ["Wolverhampton Wanderers", "Premier League"],
  // La Liga
  ["Alaves", "La Liga"], ["Athletic Club", "La Liga"], ["Atletico Madrid", "La Liga"],
  ["Barcelona", "La Liga"], ["Celta Vigo", "La Liga"], ["Espanyol", "La Liga"],
  ["Getafe", "La Liga"], ["Girona", "La Liga"], ["Las Palmas", "La Liga"],
  ["Leganes", "La Liga"], ["Mallorca", "La Liga"], ["Osasuna", "La Liga"],
  ["Rayo Vallecano", "La Liga"], ["Real Betis", "La Liga"], ["Real Madrid", "La Liga"],
  ["Real Sociedad", "La Liga"], ["Sevilla", "La Liga"], ["Valencia", "La Liga"],
  ["Valladolid", "La Liga"], ["Villarreal", "La Liga"],
  // Bundesliga
  ["Augsburg", "Bundesliga"], ["Bayer Leverkusen", "Bundesliga"],
  ["Bayern Munich", "Bundesliga"], ["Bochum", "Bundesliga"],
  ["Borussia Dortmund", "Bundesliga"], ["Borussia Monchengladbach", "Bundesliga"],
  ["Eintracht Frankfurt", "Bundesliga"], ["Freiburg", "Bundesliga"],
  ["Heidenheim", "Bundesliga"], ["Hoffenheim", "Bundesliga"],
  ["Holstein Kiel", "Bundesliga"], ["Mainz 05", "Bundesliga"],
  ["RB Leipzig", "Bundesliga"], ["St. Pauli", "Bundesliga"],
  ["Stuttgart", "Bundesliga"], ["Union Berlin", "Bundesliga"],
  ["Werder Bremen", "Bundesliga"], ["Wolfsburg", "Bundesliga"],
  // Serie A
  ["Atalanta", "Serie A"], ["Bologna", "Serie A"], ["Cagliari", "Serie A"],
  ["Como", "Serie A"], ["Empoli", "Serie A"], ["Fiorentina", "Serie A"],
  ["Genoa", "Serie A"], ["Hellas Verona", "Serie A"], ["Inter", "Serie A"],
  ["Juventus", "Serie A"], ["Lazio", "Serie A"], ["Lecce", "Serie A"],
  ["AC Milan", "Serie A"], ["Monza", "Serie A"], ["Napoli", "Serie A"],
  ["Parma", "Serie A"], ["Roma", "Serie A"], ["Torino", "Serie A"],
  ["Udinese", "Serie A"], ["Venezia", "Serie A"],
  // Ligue 1
  ["Angers", "Ligue 1"], ["Auxerre", "Ligue 1"], ["Brest", "Ligue 1"],
  ["Le Havre", "Ligue 1"], ["Lens", "Ligue 1"], ["Lille", "Ligue 1"],
  ["Lyon", "Ligue 1"], ["Marseille", "Ligue 1"], ["Monaco", "Ligue 1"],
  ["Montpellier", "Ligue 1"], ["Nantes", "Ligue 1"], ["Nice", "Ligue 1"],
  ["Paris Saint-Germain", "Ligue 1"], ["Reims", "Ligue 1"], ["Rennes", "Ligue 1"],
  ["Saint-Etienne", "Ligue 1"], ["Strasbourg", "Ligue 1"], ["Toulouse", "Ligue 1"],
  // Rest of Europe
  ["Ajax", "Rest of Europe"], ["PSV Eindhoven", "Rest of Europe"],
  ["Feyenoord", "Rest of Europe"], ["Benfica", "Rest of Europe"],
  ["Porto", "Rest of Europe"], ["Sporting CP", "Rest of Europe"],
  ["Celtic", "Rest of Europe"], ["Rangers", "Rest of Europe"],
  ["Galatasaray", "Rest of Europe"], ["Fenerbahce", "Rest of Europe"],
  ["Besiktas", "Rest of Europe"], ["Club Brugge", "Rest of Europe"],
  ["Anderlecht", "Rest of Europe"], ["Red Bull Salzburg", "Rest of Europe"],
  ["Shakhtar Donetsk", "Rest of Europe"], ["Dynamo Kyiv", "Rest of Europe"],
  ["Slavia Prague", "Rest of Europe"], ["Sparta Prague", "Rest of Europe"],
  ["Olympiacos", "Rest of Europe"], ["Young Boys", "Rest of Europe"],
  ["Copenhagen", "Rest of Europe"], ["Malmo", "Rest of Europe"],
  // National teams
  ["Argentina", "International"], ["Australia", "International"],
  ["Austria", "International"], ["Belgium", "International"],
  ["Brazil", "International"], ["Cameroon", "International"],
  ["Canada", "International"], ["Chile", "International"],
  ["Colombia", "International"], ["Costa Rica", "International"],
  ["Croatia", "International"], ["Czechia", "International"],
  ["Denmark", "International"], ["Ecuador", "International"],
  ["Egypt", "International"], ["England", "International"],
  ["France", "International"], ["Germany", "International"],
  ["Ghana", "International"], ["Greece", "International"],
  ["Hungary", "International"], ["Iceland", "International"],
  ["Italy", "International"], ["Ivory Coast", "International"],
  ["Japan", "International"], ["Mexico", "International"],
  ["Morocco", "International"], ["Netherlands", "International"],
  ["Nigeria", "International"], ["Norway", "International"],
  ["Peru", "International"], ["Poland", "International"],
  ["Portugal", "International"], ["Republic of Ireland", "International"],
  ["Saudi Arabia", "International"], ["Scotland", "International"],
  ["Senegal", "International"], ["Serbia", "International"],
  ["South Korea", "International"], ["Spain", "International"],
  ["Sweden", "International"], ["Switzerland", "International"],
  ["Turkey", "International"], ["Ukraine", "International"],
  ["United States", "International"], ["Uruguay", "International"],
  ["Wales", "International"],
];

// TheSportsDB's own team name for a handful of entries doesn't match ours
// exactly (mostly national teams and a couple of clubs it lists under a
// longer or differently-punctuated name). Tried after a plain search finds
// nothing usable.
const ALIASES = {
  "Nottingham Forest": ["Nottm Forest", "Forest"],
  "Alaves": ["Deportivo Alaves"],
  "Athletic Club": ["Athletic Bilbao"],
  "Valladolid": ["Real Valladolid"],
  "Lille": ["Lille OSC", "LOSC Lille"],
  "Paris Saint-Germain": ["Paris SG", "PSG"],
  "Reims": ["Stade de Reims"],
  "Saint-Etienne": ["AS Saint-Etienne", "St Etienne", "Saint Etienne"],
  "Copenhagen": ["FC Copenhagen", "FC Kobenhavn"],
  "Brighton & Hove Albion": ["Brighton", "Brighton and Hove Albion"],
  "Czechia": ["Czech Republic"],
  "Republic of Ireland": ["Ireland"],
  "South Korea": ["Korea Republic", "Korea"],
  "United States": ["USA", "United States of America"],
  "Ivory Coast": ["Cote d'Ivoire", "Côte d'Ivoire"],
  "St. Pauli": ["FC St. Pauli", "St Pauli"],
  "Mainz 05": ["Mainz", "1. FSV Mainz 05"],
  "Borussia Monchengladbach": ["Borussia Monchengladbach", "Monchengladbach", "Gladbach"],
  "Inter": ["Inter Milan"],
  "AC Milan": ["Milan"],
  "Sporting CP": ["Sporting Lisbon", "Sporting CP"],
  "Red Bull Salzburg": ["RB Salzburg"],
  "PSV Eindhoven": ["PSV"],
};

/**
 * A few teams the free-tier search API cannot reliably disambiguate even
 * with aliases — it keeps returning a same-named-but-unrelated club ahead of
 * the real one because that other club happens to be the only exact-name
 * hit, and the correct club only turns up under a name variant the
 * exact-match logic in pickBest() won't credit over it. Verified by hand
 * against thesportsdb.com and takes precedence over the search logic below.
 * `null` means no confident free-tier match exists at all under any name
 * variant tried — logo_url is left unset for that team, and the app's
 * TeamBadge component falls back to initials/a shield icon.
 */
const MANUAL_OVERRIDES = {
  // Free-text search only ever finds "Athletic Club-MG", a same-named
  // Brazilian club, ahead of the real Athletic Bilbao (which the API does
  // list, but only under the name "Athletic Bilbao", not "Athletic Club").
  "Athletic Club": "https://r2.thesportsdb.com/images/media/team/badge/68w7fe1639408210.png",
  // Every hyphenated/accented spelling of "Paris Saint-Germain" either
  // returns nothing or an unrelated club; the entry only exists under the
  // unhyphenated "Paris Saint Germain".
  "Paris Saint-Germain": "https://r2.thesportsdb.com/images/media/team/badge/rwqrrq1473504808.png",
  // Not present in the free tier under any name tried (Nottingham Forest,
  // Nottm Forest, Notts Forest, NFFC, Forest FC, 1865 Forest) — every
  // search either returns nothing or an unrelated club that happens to
  // share part of the name.
  "Nottingham Forest": null,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Case- and diacritic-insensitive compare ("Alaves" === "Alavés"). */
const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

async function searchTeam(name, attempt = 1) {
  const res = await fetch(`${API_BASE}/searchteams.php?t=${encodeURIComponent(name)}`);
  if (res.status === 429) {
    if (attempt > 4) throw new Error(`Still rate-limited after ${attempt} attempts for "${name}"`);
    const wait = 5000 * attempt;
    console.log(`  (rate limited, waiting ${wait}ms...)`);
    await sleep(wait);
    return searchTeam(name, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for "${name}"`);
  const json = await res.json();
  return json.teams ?? [];
}

// Matches "Brighton WFC", "Mainz 05 Women", "Republic of Ireland U21",
// "United States U17", "Czechia Women", reserve/B sides, etc. — every one of
// these actually came back from a real search during development.
const NOT_THE_FIRST_TEAM = /\b(w|wfc|women|ladies|u-?\d{2}|youth|reserves?)\b/i;

/**
 * Picks the best soccer match. The API frequently returns several unrelated
 * clubs/national squads that share a name (women's sides, youth/age-grade
 * national squads, lower-division or foreign clubs), so this is deliberately
 * conservative:
 *   1. Soccer only, must have a badge.
 *   2. Prefer the senior men's/open first team when any such option exists
 *      — strGender is not reliably populated on youth/reserve entries, so
 *      the name itself is checked too.
 *   3. Among what's left, prefer an exact (diacritic-insensitive) name match
 *      over a partial one.
 *   4. Break remaining ties by popularity (intLoved) — the real Premier
 *      League/La Liga/etc. club is always far better known than a
 *      same-named club in an unrelated country's lower division.
 */
function pickBest(teams, wantedName) {
  let pool = teams.filter((t) => t.strSport === "Soccer" && t.strBadge);
  if (pool.length === 0) return null;

  const firstTeamOnly = pool.filter(
    (t) => t.strGender !== "Female" && !NOT_THE_FIRST_TEAM.test(t.strTeam),
  );
  if (firstTeamOnly.length > 0) pool = firstTeamOnly;

  const wanted = normalize(wantedName);
  const exact = pool.filter((t) => normalize(t.strTeam) === wanted);
  if (exact.length > 0) pool = exact;

  return [...pool].sort((a, b) => Number(b.intLoved ?? 0) - Number(a.intLoved ?? 0))[0];
}

const results = [];
const misses = [];

// The previous run tripped the ~30 req/min limit, which is a sliding
// window — give it a clear runway before starting again.
console.log("Waiting 60s for TheSportsDB's rate-limit window to clear...");
await sleep(60_000);

for (const [name, league] of TEAMS) {
  if (Object.prototype.hasOwnProperty.call(MANUAL_OVERRIDES, name)) {
    const badge = MANUAL_OVERRIDES[name];
    if (badge) {
      results.push({ name, league, badge, matchedAs: name, ambiguous: false });
      console.log(`✓ ${name} (${league}) -> (manual override)`);
    } else {
      misses.push({ name, league });
      console.log(`✗ ${name} (${league}) -> no confident free-tier match (manual override)`);
    }
    continue;
  }

  const candidates = await searchTeam(name);
  await sleep(2200);

  // Only spend extra requests on aliases when the primary search didn't
  // already produce a confident exact-name match — an ambiguous or empty
  // primary result (e.g. "Inter" alone returning some unrelated club called
  // "Intercity", or "Alaves" only returning a women's side) is exactly what
  // aliases exist to fix, so alias results are pooled in and the best match
  // is picked across everything rather than trusting the primary search's
  // first hit just because it wasn't literally empty.
  const primaryBest = pickBest(candidates, name);
  if (!primaryBest || normalize(primaryBest.strTeam) !== normalize(name)) {
    for (const alias of ALIASES[name] ?? []) {
      candidates.push(...(await searchTeam(alias)));
      await sleep(2200);
    }
  }

  const match = pickBest(candidates, name);

  if (match) {
    const ambiguous = normalize(match.strTeam) !== normalize(name);
    results.push({ name, league, badge: match.strBadge, matchedAs: match.strTeam, ambiguous });
    console.log(`${ambiguous ? "~" : "✓"} ${name} (${league}) -> ${match.strTeam}`);
  } else {
    misses.push({ name, league });
    console.log(`✗ ${name} (${league}) -> NO MATCH`);
  }
}

console.log(`\n${results.length}/${TEAMS.length} matched, ${misses.length} missed.`);
if (misses.length > 0) {
  console.log("Misses:", misses.map((m) => `${m.name} (${m.league})`).join(", "));
}
const ambiguous = results.filter((r) => r.ambiguous);
if (ambiguous.length > 0) {
  console.log(
    "Matched under a different name (review these):",
    ambiguous.map((r) => `${r.name} -> ${r.matchedAs}`).join(", "),
  );
}

const escape = (s) => s.replace(/'/g, "''");

const sql = `-- ============================================================================
-- FIFA Score Tracker — team crest/badge images
--
-- Run after 0003_groups.sql. Safe to re-run: every statement is a plain
-- UPDATE keyed on the existing (name, league) unique constraint.
--
-- URLs are hotlinked from TheSportsDB (thesportsdb.com), fetched once by
-- scripts/fetch-team-logos.mjs. Re-run that script and re-paste this file if
-- a URL ever goes stale or a new team is added to 0002_seed_teams.sql.
-- ============================================================================

alter table public.teams add column if not exists logo_url text;

${results
  .map(
    (r) =>
      `update public.teams set logo_url = '${escape(r.badge)}' where name = '${escape(r.name)}' and league = '${escape(r.league)}';`,
  )
  .join("\n")}

grant select on public.teams to authenticated;
`;

writeFileSync(new URL("../supabase/migrations/0004_team_logos.sql", import.meta.url), sql);
console.log("\nWrote supabase/migrations/0004_team_logos.sql");
