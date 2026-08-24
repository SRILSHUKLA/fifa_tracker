/**
 * Types for the FIFA Score Tracker schema (supabase/migrations/0001_init.sql).
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

export type FriendshipStatus = "pending" | "accepted" | "blocked";
export type MatchResult = "win" | "loss" | "draw";

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

      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: FriendshipStatus;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: FriendshipStatus;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          status?: FriendshipStatus;
          responded_at?: string | null;
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
    };

    Views: {
      player_match_results: {
        Row: {
          match_id: string;
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

      leaderboard: {
        Row: {
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
        };
        Relationships: [];
      };
    };

    Functions: {
      get_h2h_stats: {
        Args: { p_opponent: string };
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

      get_friends: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          friends_since: string;
          played: number;
          wins: number;
          draws: number;
          losses: number;
        }[];
      };

      search_users: {
        Args: { q: string };
        Returns: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          friendship_status: FriendshipStatus | "none";
          is_requester: boolean;
        }[];
      };

      are_friends: {
        Args: { a: string; b: string };
        Returns: boolean;
      };

      is_username_available: {
        Args: { u: string };
        Returns: boolean;
      };
    };

    Enums: {
      friendship_status: FriendshipStatus;
    };

    CompositeTypes: Record<string, never>;
  };
};

/* ------------------------------------------------------------------ */
/* Convenience aliases used throughout the app                         */
/* ------------------------------------------------------------------ */

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];

export type LeaderboardRow = Database["public"]["Views"]["leaderboard"]["Row"];
export type PlayerMatchResult =
  Database["public"]["Views"]["player_match_results"]["Row"];

export type H2HStats = Database["public"]["Functions"]["get_h2h_stats"]["Returns"][number];
export type FriendSummary = Database["public"]["Functions"]["get_friends"]["Returns"][number];
export type UserSearchResult = Database["public"]["Functions"]["search_users"]["Returns"][number];
