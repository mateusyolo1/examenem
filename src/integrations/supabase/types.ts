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
      channel_subject_signal: {
        Row: {
          channel_name: string
          created_at: string
          hits: number
          id: string
          last_hit_at: string | null
          last_miss_at: string | null
          misses: number
          subject: string
          updated_at: string
        }
        Insert: {
          channel_name: string
          created_at?: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          last_miss_at?: string | null
          misses?: number
          subject: string
          updated_at?: string
        }
        Update: {
          channel_name?: string
          created_at?: string
          hits?: number
          id?: string
          last_hit_at?: string | null
          last_miss_at?: string | null
          misses?: number
          subject?: string
          updated_at?: string
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
      flashcard_reviews: {
        Row: {
          flashcard_id: string
          id: string
          next_review_at: string
          quality: number
          reviewed_at: string
          user_id: string
        }
        Insert: {
          flashcard_id: string
          id?: string
          next_review_at?: string
          quality: number
          reviewed_at?: string
          user_id: string
        }
        Update: {
          flashcard_id?: string
          id?: string
          next_review_at?: string
          quality?: number
          reviewed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_reviews_flashcard_id_fkey"
            columns: ["flashcard_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          created_at: string
          front: string
          id: string
          source: string
          topic_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          id?: string
          source?: string
          topic_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          id?: string
          source?: string
          topic_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_telemetry: {
        Row: {
          activity_kind: string
          activity_ref: string | null
          created_at: string
          duration_min: number | null
          effort: string | null
          id: string
          score: number | null
          topic_area: string | null
          topic_slug: string | null
          user_id: string
        }
        Insert: {
          activity_kind: string
          activity_ref?: string | null
          created_at?: string
          duration_min?: number | null
          effort?: string | null
          id?: string
          score?: number | null
          topic_area?: string | null
          topic_slug?: string | null
          user_id: string
        }
        Update: {
          activity_kind?: string
          activity_ref?: string | null
          created_at?: string
          duration_min?: number | null
          effort?: string | null
          id?: string
          score?: number | null
          topic_area?: string | null
          topic_slug?: string | null
          user_id?: string
        }
        Relationships: []
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
      lesson_essay_attempts: {
        Row: {
          created_at: string
          essay_text: string
          feedback: Json | null
          id: string
          score: number | null
          task: Json
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          essay_text: string
          feedback?: Json | null
          id?: string
          score?: number | null
          task: Json
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          essay_text?: string
          feedback?: Json | null
          id?: string
          score?: number | null
          task?: Json
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_essay_attempts_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          author: string | null
          chunk_count: number
          created_at: string
          error_message: string | null
          id: string
          page_count: number | null
          status: string
          storage_path: string | null
          subject: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          chunk_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          page_count?: number | null
          status?: string
          storage_path?: string | null
          subject?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          chunk_count?: number
          created_at?: string
          error_message?: string | null
          id?: string
          page_count?: number | null
          status?: string
          storage_path?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_embeddings: {
        Row: {
          book_id: string
          chunk_index: number
          content: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          user_id: string
        }
        Insert: {
          book_id: string
          chunk_index: number
          content: string
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json
          user_id: string
        }
        Update: {
          book_id?: string
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_embeddings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "library_books"
            referencedColumns: ["id"]
          },
        ]
      }
      lousa_questions: {
        Row: {
          activity_id: string
          correct: boolean | null
          created_at: string
          enunciado: string
          feedback: string | null
          gabarito: string
          id: string
          order_index: number
          topico: string | null
          updated_at: string
          user_answer: string | null
          user_id: string
        }
        Insert: {
          activity_id: string
          correct?: boolean | null
          created_at?: string
          enunciado: string
          feedback?: string | null
          gabarito: string
          id?: string
          order_index: number
          topico?: string | null
          updated_at?: string
          user_answer?: string | null
          user_id: string
        }
        Update: {
          activity_id?: string
          correct?: boolean | null
          created_at?: string
          enunciado?: string
          feedback?: string | null
          gabarito?: string
          id?: string
          order_index?: number
          topico?: string | null
          updated_at?: string
          user_answer?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lousa_questions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "study_plan_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      lousa_sessions: {
        Row: {
          content: Json
          context_snapshot: Json | null
          created_at: string
          homework_activity_id: string | null
          id: string
          materia: string
          status: string
          tema: string
          topic_area: string | null
          topic_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: Json
          context_snapshot?: Json | null
          created_at?: string
          homework_activity_id?: string | null
          id?: string
          materia: string
          status?: string
          tema: string
          topic_area?: string | null
          topic_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          context_snapshot?: Json | null
          created_at?: string
          homework_activity_id?: string | null
          id?: string
          materia?: string
          status?: string
          tema?: string
          topic_area?: string | null
          topic_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lousa_sessions_homework_activity_id_fkey"
            columns: ["homework_activity_id"]
            isOneToOne: false
            referencedRelation: "study_plan_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_learning_events: {
        Row: {
          created_at: string
          id: string
          resources: Json
          sub_concept: string
          sub_concept_term: string | null
          timestamp_sec: number
          topic_id: string
          user_id: string
          youtube_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resources?: Json
          sub_concept: string
          sub_concept_term?: string | null
          timestamp_sec: number
          topic_id: string
          user_id: string
          youtube_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resources?: Json
          sub_concept?: string
          sub_concept_term?: string | null
          timestamp_sec?: number
          topic_id?: string
          user_id?: string
          youtube_id?: string
        }
        Relationships: []
      }
      mind_maps: {
        Row: {
          created_at: string
          edges: Json
          id: string
          nodes: Json
          title: string
          topic_slug: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json
          id?: string
          nodes?: Json
          title: string
          topic_slug?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          edges?: Json
          id?: string
          nodes?: Json
          title?: string
          topic_slug?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      study_drafts: {
        Row: {
          attachments: Json
          content: string
          created_at: string
          id: string
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attachments?: Json
          content?: string
          created_at?: string
          id?: string
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plan_activities: {
        Row: {
          created_at: string
          day_id: string
          generated_at: string | null
          id: string
          kind: string
          order_index: number
          passed: boolean | null
          payload: Json
          score: number | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_id: string
          generated_at?: string | null
          id?: string
          kind: string
          order_index: number
          passed?: boolean | null
          payload?: Json
          score?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_id?: string
          generated_at?: string | null
          id?: string
          kind?: string
          order_index?: number
          passed?: boolean | null
          payload?: Json
          score?: number | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_activities_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "study_plan_days"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_days: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          kind: string
          plan_date: string
          status: string
          unlocked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          plan_date: string
          status?: string
          unlocked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          plan_date?: string
          status?: string
          unlocked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_summaries: {
        Row: {
          content: string
          created_at: string
          id: string
          scope: string
          scope_ref: string | null
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          scope: string
          scope_ref?: string | null
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          scope?: string
          scope_ref?: string | null
          title?: string
          user_id?: string
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
          lexicon_score: number | null
          pedagogical_intent: string | null
          relevance_confidence: number | null
          relevance_reason: string | null
          sort_order: number
          source: string
          subject_detected: string | null
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
          lexicon_score?: number | null
          pedagogical_intent?: string | null
          relevance_confidence?: number | null
          relevance_reason?: string | null
          sort_order?: number
          source?: string
          subject_detected?: string | null
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
          lexicon_score?: number | null
          pedagogical_intent?: string | null
          relevance_confidence?: number | null
          relevance_reason?: string | null
          sort_order?: number
          source?: string
          subject_detected?: string | null
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      topic_mastery: {
        Row: {
          area: string
          attempts: number
          created_at: string
          id: string
          last_score: number
          last_seen_at: string
          level_reached: number
          mastered: boolean
          next_review_at: string
          topic_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area: string
          attempts?: number
          created_at?: string
          id?: string
          last_score: number
          last_seen_at?: string
          level_reached?: number
          mastered?: boolean
          next_review_at?: string
          topic_slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area?: string
          attempts?: number
          created_at?: string
          id?: string
          last_score?: number
          last_seen_at?: string
          level_reached?: number
          mastered?: boolean
          next_review_at?: string
          topic_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_hints_seen: {
        Row: {
          hint_key: string
          seen_at: string
          user_id: string
        }
        Insert: {
          hint_key: string
          seen_at?: string
          user_id: string
        }
        Update: {
          hint_key?: string
          seen_at?: string
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
      user_pressure_level: {
        Row: {
          last_result: number | null
          level: number
          updated_at: string
          user_id: string
          wins_streak: number
        }
        Insert: {
          last_result?: number | null
          level?: number
          updated_at?: string
          user_id: string
          wins_streak?: number
        }
        Update: {
          last_result?: number | null
          level?: number
          updated_at?: string
          user_id?: string
          wins_streak?: number
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
      user_study_settings: {
        Row: {
          hours_per_day: number
          lousa_pass_threshold: number
          rag_book_ids: string[]
          stage_level: number
          stage_started_at: string
          stage_week: number
          target_score: number
          updated_at: string
          user_id: string
          weekly_pattern: Json
        }
        Insert: {
          hours_per_day?: number
          lousa_pass_threshold?: number
          rag_book_ids?: string[]
          stage_level?: number
          stage_started_at?: string
          stage_week?: number
          target_score?: number
          updated_at?: string
          user_id: string
          weekly_pattern?: Json
        }
        Update: {
          hours_per_day?: number
          lousa_pass_threshold?: number
          rag_book_ids?: string[]
          stage_level?: number
          stage_started_at?: string
          stage_week?: number
          target_score?: number
          updated_at?: string
          user_id?: string
          weekly_pattern?: Json
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
      user_video_suggestion_history: {
        Row: {
          channel_name: string | null
          dismissed_at: string | null
          duration_seconds: number | null
          id: string
          suggested_at: string
          title: string | null
          topic_id: string
          user_id: string
          youtube_id: string
        }
        Insert: {
          channel_name?: string | null
          dismissed_at?: string | null
          duration_seconds?: number | null
          id?: string
          suggested_at?: string
          title?: string | null
          topic_id: string
          user_id: string
          youtube_id: string
        }
        Update: {
          channel_name?: string | null
          dismissed_at?: string | null
          duration_seconds?: number | null
          id?: string
          suggested_at?: string
          title?: string | null
          topic_id?: string
          user_id?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_video_suggestion_history_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "study_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      video_notes: {
        Row: {
          ai_explanation: string
          created_at: string
          id: string
          style: string
          timestamp_seconds: number
          updated_at: string
          user_id: string
          user_note: string
          video_id: string
          youtube_id: string
        }
        Insert: {
          ai_explanation?: string
          created_at?: string
          id?: string
          style?: string
          timestamp_seconds?: number
          updated_at?: string
          user_id: string
          user_note?: string
          video_id: string
          youtube_id: string
        }
        Update: {
          ai_explanation?: string
          created_at?: string
          id?: string
          style?: string
          timestamp_seconds?: number
          updated_at?: string
          user_id?: string
          user_note?: string
          video_id?: string
          youtube_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_notes_video_id_fkey"
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
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      match_library_chunks: {
        Args: {
          active_book_ids: string[]
          match_count?: number
          query_embedding: string
          target_user_id: string
        }
        Returns: {
          book_id: string
          chunk_index: number
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
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
