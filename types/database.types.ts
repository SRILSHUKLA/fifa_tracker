/**
 * Types for the FIFA Score Tracker schema (supabase/migrations/0001_init.sql,
 * 0003_groups.sql).
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
          created_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          short_name?: string | null;
          league: string;
          country?: string | null;
          is_national?: boolean;
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
