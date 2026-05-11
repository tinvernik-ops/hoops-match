export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      courts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          lat: number
          lng: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          lat: number
          lng: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
        }
        Relationships: []
      }
      game_players: {
        Row: {
          assists: number
          blocks: number
          game_id: string
          id: string
          points: number
          rebounds: number
          steals: number
          team: Database["public"]["Enums"]["team_side"]
          user_id: string
        }
        Insert: {
          assists?: number
          blocks?: number
          game_id: string
          id?: string
          points?: number
          rebounds?: number
          steals?: number
          team: Database["public"]["Enums"]["team_side"]
          user_id: string
        }
        Update: {
          assists?: number
          blocks?: number
          game_id?: string
          id?: string
          points?: number
          rebounds?: number
          steals?: number
          team?: Database["public"]["Enums"]["team_side"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          created_by: string
          game_type: Database["public"]["Enums"]["game_type"]
          id: string
          league_id: string
          location: string | null
          notes: string | null
          played_at: string
          team_a_score: number
          team_b_score: number
        }
        Insert: {
          created_at?: string
          created_by: string
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          league_id: string
          location?: string | null
          notes?: string | null
          played_at?: string
          team_a_score?: number
          team_b_score?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          game_type?: Database["public"]["Enums"]["game_type"]
          id?: string
          league_id?: string
          location?: string | null
          notes?: string | null
          played_at?: string
          team_a_score?: number
          team_b_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "games_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          from_id: string
          id: string
          message: string | null
          status: Database["public"]["Enums"]["invite_status"]
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["invite_status"]
          to_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_from_id_fkey"
            columns: ["from_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_to_id_fkey"
            columns: ["to_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      league_invites: {
        Row: {
          created_at: string
          from_id: string
          id: string
          league_id: string
          status: Database["public"]["Enums"]["league_invite_status"]
          to_id: string
        }
        Insert: {
          created_at?: string
          from_id: string
          id?: string
          league_id: string
          status?: Database["public"]["Enums"]["league_invite_status"]
          to_id: string
        }
        Update: {
          created_at?: string
          from_id?: string
          id?: string
          league_id?: string
          status?: Database["public"]["Enums"]["league_invite_status"]
          to_id?: string
        }
        Relationships: []
      }
      league_members: {
        Row: {
          joined_at: string
          league_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          league_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          id: string
          join_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          join_code?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          join_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          height_cm: number | null
          id: string
          lat: number | null
          lng: number | null
          location_updated_at: string | null
          phone: string
          playstyle: string | null
          preferred_game_type: string | null
          updated_at: string
          username: string
          vertical_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          height_cm?: number | null
          id: string
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          phone: string
          playstyle?: string | null
          preferred_game_type?: string | null
          updated_at?: string
          username: string
          vertical_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          height_cm?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          location_updated_at?: string | null
          phone?: string
          playstyle?: string | null
          preferred_game_type?: string | null
          updated_at?: string
          username?: string
          vertical_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          defense: number
          id: string
          offense: number
          ratee_id: string
          rater_id: string
        }
        Insert: {
          created_at?: string
          defense: number
          id?: string
          offense: number
          ratee_id: string
          rater_id: string
        }
        Update: {
          created_at?: string
          defense?: number
          id?: string
          offense?: number
          ratee_id?: string
          rater_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shooting_drills: {
        Row: {
          attempts: number
          created_at: string
          id: string
          makes: number
          user_id: string
          x: number
          y: number
          zone: string
        }
        Insert: {
          attempts: number
          created_at?: string
          id?: string
          makes: number
          user_id: string
          x: number
          y: number
          zone: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          makes?: number
          user_id?: string
          x?: number
          y?: number
          zone?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_rate: { Args: { _ratee: string; _rater: string }; Returns: boolean }
      is_league_member: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
      is_league_owner: {
        Args: { _league_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      game_type: "1v1" | "2v2" | "3v3" | "4v4" | "5v5" | "koth"
      invite_status: "pending" | "accepted" | "declined" | "cancelled"
      league_invite_status: "pending" | "accepted" | "declined"
      team_side: "A" | "B"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      game_type: ["1v1", "2v2", "3v3", "4v4", "5v5", "koth"],
      invite_status: ["pending", "accepted", "declined", "cancelled"],
      league_invite_status: ["pending", "accepted", "declined"],
      team_side: ["A", "B"],
    },
  },
} as const
