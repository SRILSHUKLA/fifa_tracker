/**
 * Types for the FIFA Score Tracker schema (supabase/migrations/0001_init.sql,
 * 0003_groups.sql, 0005_leagues.sql, 0006_edit_match.sql).
 *
 * Hand-written to match the shape `supabase gen types typescript` produces, so
 * once you have a project ref you can regenerate over the top of this file:
 *
 *   npx supabase gen types typescript --project-id <ref> > types/database.types.ts
 *
 * Note: PostgREST returns bigint and numeric as JS numbers over JSON, so the
 * aggregate columns are typed `number` here.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MatchResult = "win" | "loss" | "draw";
export type GroupRole = "owner" | "member";
export type LeagueType = "single_round_robin" | "double_round_robin" | "round_robin_knockout";
export type LeagueStatus = "draft" | "in_progress" | "completed";
export type FixtureStage = "round_robin" | "knockout";
export type FixtureStatus = "pending" | "completed";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };

      teams: {
        Row: {
          id: number;
          name: string;
          short_name: string | null;
          league: string;
          country: string | null;
          is_national: boolean;
          /** Hotlinked crest/badge image, sourced from TheSportsDB. Not every team has one. */
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          short_name?: string | null;
          league: string;
          country?: string | null;
          is_national?: boolean;
          logo_url?: string | null;
        };
        Update: never;
        Relationships: [];
      };

      matches: {
        Row: {
          id: string;
          group_id: string;
          player_one_id: string;
          player_two_id: string;
          player_one_score: number;
          player_two_score: number;
          player_one_team_id: number | null;
          player_two_team_id: number | null;
          /** Generated column. null means the match was a draw. */
          winner_id: string | null;
          created_by: string;
          played_at: string;
          notes: string | null;
          created_at: string;
        };
        /** winner_id is GENERATED ALWAYS, so it is never writable. */
        Insert: {
          id?: string;
          group_id: string;
          player_one_id: string;
          player_two_id: string;
          player_one_score: number;
          player_two_score: number;
          player_one_team_id?: number | null;
          player_two_team_id?: number | null;
          created_by: string;
          played_at?: string;
          notes?: string | null;
        };
        Update: {
          player_one_score?: number;
          player_two_score?: number;
          player_one_team_id?: number | null;
          player_two_team_id?: number | null;
          played_at?: string;
          notes?: string | null;
        };
        Relationships: [];
      };

      groups: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          invite_code: string;
          created_at: string;
        };
        /** No INSERT policy: rows are created only by create_group(). */
        Insert: never;
        /**
         * Only `name` is grantable to clients — invite_code can only change
         * via the regenerate_invite_code() RPC.
         */
        Update: {
          name?: string;
        };
        Relationships: [];
      };

      group_members: {
        Row: {
          group_id: string;
          user_id: string;
          role: GroupRole;
          joined_at: string;
        };
        /** No INSERT policy: rows are created only by create_group()/join_group(). */
        Insert: never;
        Update: never;
        Relationships: [];
      };

      leagues: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          type: LeagueType;
          status: LeagueStatus;
          /** Only set for round_robin_knockout: 2, 4, 8 or 16. */
          knockout_size: number | null;
          created_by: string;
          champion_id: string | null;
          created_at: string;
          started_at: string | null;
          completed_at: string | null;
        };
        /** No INSERT policy: rows are created only by create_league(). */
        Insert: never;
        /** No UPDATE policy: rows are only ever changed by start_league()/log_league_fixture_result(). */
        Update: never;
        Relationships: [];
      };

      league_participants: {
        Row: {
          league_id: string;
          user_id: string;
          /** Locked in for the whole league once it starts. */
          team_id: number;
          joined_at: string;
        };
        /** No INSERT policy: rows are created only by create_league()/join_league(). */
        Insert: never;
        Update: never;
        Relationships: [];
      };

      league_fixtures: {
        Row: {
          id: string;
          league_id: string;
          stage: FixtureStage;
          round: number;
          slot: number;
          /** Null for a knockout slot not yet decided by an earlier round. */
          player_one_id: string | null;
          player_two_id: string | null;
          /** Knockout bracket wiring. Null for round-robin fixtures and the final. */
          next_fixture_id: string | null;
          next_fixture_slot: number | null;
          match_id: string | null;
          status: FixtureStatus;
          /** Knockout-only: set iff the linked match was a score draw. */
          penalty_winner_id: string | null;
          created_at: string;
        };
        /** No INSERT policy: rows are created only by start_league()/_generate_league_knockout(). */
        Insert: never;
        /** No UPDATE policy: rows are only ever changed by log_league_fixture_result(). */
        Update: never;
        Relationships: [];
      };
    };

    Views: {
      player_match_results: {
        Row: {
          match_id: string;
          group_id: string;
          played_at: string;
          player_id: string;
          opponent_id: string;
          goals_for: number;
          goals_against: number;
          team_id: number | null;
          opponent_team_id: number | null;
          created_by: string;
          result: MatchResult;
        };
        Relationships: [];
      };
    };

    Functions: {
      create_group: {
        Args: { p_name: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };

      join_group: {
        Args: { p_invite_code: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };

      regenerate_invite_code: {
        Args: { p_group_id: string };
        Returns: string;
      };

      is_group_owner: {
        Args: { p_group_id: string; p_user: string };
        Returns: boolean;
      };

      is_group_member: {
        Args: { p_group_id: string; p_user: string };
        Returns: boolean;
      };

      are_group_members: {
        Args: { p_group_id: string; a: string; b: string };
        Returns: boolean;
      };

      get_group_members: {
        Args: { p_group_id: string };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          role: GroupRole;
          joined_at: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
        }[];
      };

      get_group_leaderboard: {
        Args: { p_group_id: string };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          played: number;
          wins: number;
          draws: number;
          losses: number;
          goals_for: number;
          goals_against: number;
          goal_difference: number;
          points: number;
          /** null until the player has played at least one match. */
          win_pct: number | null;
        }[];
      };

      get_h2h_stats: {
        Args: { p_group_id: string; p_opponent: string };
        Returns: {
          played: number;
          wins: number;
          draws: number;
          losses: number;
          goals_for: number;
          goals_against: number;
          avg_goals_for: number;
          avg_goals_against: number;
          biggest_win_margin: number;
          last_played: string | null;
        }[];
      };

      get_h2h_team_stats: {
        Args: { p_group_id: string; p_opponent: string };
        Returns: {
          team_id: number;
          team_name: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
          goals_for: number;
          goals_against: number;
        }[];
      };

      get_group_team_stats: {
        Args: { p_group_id: string };
        Returns: {
          team_id: number;
          team_name: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
          goals_for: number;
          goals_against: number;
        }[];
      };

      is_username_available: {
        Args: { u: string };
        Returns: boolean;
      };

      create_league: {
        Args: {
          p_group_id: string;
          p_name: string;
          p_type: LeagueType;
          p_team_id: number;
          p_knockout_size?: number | null;
        };
        Returns: Database["public"]["Tables"]["leagues"]["Row"];
      };

      join_league: {
        Args: { p_league_id: string; p_team_id: number };
        Returns: Database["public"]["Tables"]["league_participants"]["Row"];
      };

      start_league: {
        Args: { p_league_id: string };
        Returns: Database["public"]["Tables"]["leagues"]["Row"];
      };

      log_league_fixture_result: {
        Args: {
          p_fixture_id: string;
          p_my_score: number;
          p_opponent_score: number;
          p_penalty_winner_id?: string | null;
          p_played_at?: string;
          p_notes?: string | null;
        };
        Returns: {
          match_id: string;
          fixture_id: string;
          league_status: LeagueStatus;
          champion_id: string | null;
        }[];
      };

      get_league_standings: {
        Args: { p_league_id: string };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          team_id: number;
          team_name: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
          goals_for: number;
          goals_against: number;
          goal_difference: number;
          points: number;
          /** null until the player has played at least one round-robin-stage match. */
          win_pct: number | null;
        }[];
      };

      is_league_participant: {
        Args: { p_league_id: string; p_user: string };
        Returns: boolean;
      };

      can_view_league: {
        Args: { p_league_id: string; p_user: string };
        Returns: boolean;
      };

      edit_match: {
        Args: {
          p_match_id: string;
          p_player_one_score: number;
          p_player_two_score: number;
          p_player_one_team_id?: number | null;
          p_player_two_team_id?: number | null;
          p_played_at?: string | null;
          p_notes?: string | null;
          p_penalty_winner_id?: string | null;
        };
        Returns: undefined;
      };
    };

    Enums: Record<string, never>;

    CompositeTypes: Record<string, never>;
  };
};

/* ------------------------------------------------------------------ */
/* Convenience aliases used throughout the app                         */
/* ------------------------------------------------------------------ */

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];

export type PlayerMatchResult =
  Database["public"]["Views"]["player_match_results"]["Row"];

export type GroupMemberSummary =
  Database["public"]["Functions"]["get_group_members"]["Returns"][number];
export type GroupLeaderboardRow =
  Database["public"]["Functions"]["get_group_leaderboard"]["Returns"][number];
export type H2HStats = Database["public"]["Functions"]["get_h2h_stats"]["Returns"][number];
export type H2HTeamStat =
  Database["public"]["Functions"]["get_h2h_team_stats"]["Returns"][number];
export type GroupTeamStat =
  Database["public"]["Functions"]["get_group_team_stats"]["Returns"][number];

export type League = Database["public"]["Tables"]["leagues"]["Row"];
export type LeagueParticipant = Database["public"]["Tables"]["league_participants"]["Row"];
export type LeagueFixture = Database["public"]["Tables"]["league_fixtures"]["Row"];
export type LeagueStandingRow =
  Database["public"]["Functions"]["get_league_standings"]["Returns"][number];
export type LeagueFixtureResult =
  Database["public"]["Functions"]["log_league_fixture_result"]["Returns"][number];
