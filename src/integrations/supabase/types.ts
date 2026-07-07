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
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          prompt_type: string
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          prompt_type: string
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          prompt_type?: string
          response?: Json
        }
        Relationships: []
      }
      enem_exams: {
        Row: {
          created_at: string
          day: number
          duration_minutes: number
          id: string
          title: string
          total_questions: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          day: number
          duration_minutes?: number
          id?: string
          title: string
          total_questions?: number
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          day?: number
          duration_minutes?: number
          id?: string
          title?: string
          total_questions?: number
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      enem_questions: {
        Row: {
          alternative_introduction: string | null
          alternatives: Json
          area: string
          context: string | null
          correct_alternative: string
          created_at: string
          day: number
          discipline: string
          exam_id: string
          files: Json
          id: string
          language: string | null
          question_index: number
          year: number
        }
        Insert: {
          alternative_introduction?: string | null
          alternatives?: Json
          area: string
          context?: string | null
          correct_alternative: string
          created_at?: string
          day: number
          discipline: string
          exam_id: string
          files?: Json
          id?: string
          language?: string | null
          question_index: number
          year: number
        }
        Update: {
          alternative_introduction?: string | null
          alternatives?: Json
          area?: string
          context?: string | null
          correct_alternative?: string
          created_at?: string
          day?: number
          discipline?: string
          exam_id?: string
          files?: Json
          id?: string
          language?: string | null
          question_index?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "enem_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "enem_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_attempts: {
        Row: {
          answers: Json
          completed_at: string
          id: string
          score: number
          topic_id: string
          total: number
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string
          id?: string
          score: number
          topic_id: string
          total: number
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          id?: string
          score?: number
          topic_id?: string
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      simulado_answers: {
        Row: {
          answered_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_alternative: string | null
          session_id: string
          time_spent_seconds: number | null
          user_id: string
        }
        Insert: {
          answered_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_alternative?: string | null
          session_id: string
          time_spent_seconds?: number | null
          user_id: string
        }
        Update: {
          answered_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_alternative?: string | null
          session_id?: string
          time_spent_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulado_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "enem_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulado_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "simulado_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      simulado_sessions: {
        Row: {
          area: string | null
          correct_count: number | null
          created_at: string
          day: number | null
          duration_minutes: number
          finished_at: string | null
          id: string
          mode: string
          question_ids: string[]
          score_tri: number | null
          started_at: string
          time_spent_seconds: number | null
          total_questions: number
          updated_at: string
          user_id: string
          year: number | null
        }
        Insert: {
          area?: string | null
          correct_count?: number | null
          created_at?: string
          day?: number | null
          duration_minutes: number
          finished_at?: string | null
          id?: string
          mode: string
          question_ids?: string[]
          score_tri?: number | null
          started_at?: string
          time_spent_seconds?: number | null
          total_questions: number
          updated_at?: string
          user_id: string
          year?: number | null
        }
        Update: {
          area?: string | null
          correct_count?: number | null
          created_at?: string
          day?: number | null
          duration_minutes?: number
          finished_at?: string | null
          id?: string
          mode?: string
          question_ids?: string[]
          score_tri?: number | null
          started_at?: string
          time_spent_seconds?: number | null
          total_questions?: number
          updated_at?: string
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      study_topics: {
        Row: {
          area: string
          created_at: string
          description: string | null
          id: string
          parent_id: string | null
          slug: string
          sort_order: number
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          description?: string | null
          id?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_topics_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      study_videos: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          sort_order: number
          source: string
          suggested_at: string | null
          thumbnail_url: string | null
          title: string
          topic_id: string
          updated_at: string
          youtube_id: string
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          sort_order?: number
          source?: string
          suggested_at?: string | null
          thumbnail_url?: string | null
          title: string
          topic_id: string
          updated_at?: string
          youtube_id: string
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          sort_order?: number
          source?: string
          suggested_at?: string | null
          thumbnail_url?: string | null
          title?: string
          topic_id?: string
          updated_at?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_videos_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_essays: {
        Row: {
          created_at: string
          feedback: Json | null
          id: string
          tema: string
          texto: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback?: Json | null
          id?: string
          tema: string
          texto: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: Json | null
          id?: string
          tema?: string
          texto?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          settings: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          settings?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          settings?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_study_plan: {
        Row: {
          config: Json
          cronograma: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          cronograma?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          cronograma?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_study_videos: {
        Row: {
          created_at: string
          id: string
          title: string | null
          topic_id: string
          user_id: string
          youtube_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          topic_id: string
          user_id: string
          youtube_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          topic_id?: string
          user_id?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_study_videos_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      user_video_progress: {
        Row: {
          created_at: string
          id: string
          last_watched_at: string | null
          updated_at: string
          user_id: string
          video_id: string
          watch_seconds: number
          watched: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          last_watched_at?: string | null
          updated_at?: string
          user_id: string
          video_id: string
          watch_seconds?: number
          watched?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          last_watched_at?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
          watch_seconds?: number
          watched?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "study_videos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
