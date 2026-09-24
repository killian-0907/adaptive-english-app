export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          correction_strategy: string
          created_at: string
          difficulty_level: number
          ended_at: string | null
          english_exposure_level: number
          id: string
          learning_purpose: Database["public"]["Enums"]["learning_purpose"]
          metadata: Json
          scenario_key: string | null
          sequence_no: number
          session_id: string
          started_at: string | null
          status: string
          support_strategy: Json
          target_knowledge_item_id: string | null
          target_skill: Database["public"]["Enums"]["ability_dimension"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          correction_strategy: string
          created_at?: string
          difficulty_level: number
          ended_at?: string | null
          english_exposure_level: number
          id?: string
          learning_purpose: Database["public"]["Enums"]["learning_purpose"]
          metadata?: Json
          scenario_key?: string | null
          sequence_no: number
          session_id: string
          started_at?: string | null
          status?: string
          support_strategy?: Json
          target_knowledge_item_id?: string | null
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          correction_strategy?: string
          created_at?: string
          difficulty_level?: number
          ended_at?: string | null
          english_exposure_level?: number
          id?: string
          learning_purpose?: Database["public"]["Enums"]["learning_purpose"]
          metadata?: Json
          scenario_key?: string | null
          sequence_no?: number
          session_id?: string
          started_at?: string | null
          status?: string
          support_strategy?: Json
          target_knowledge_item_id?: string | null
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "activities_target_knowledge_item_id_fkey"
            columns: ["target_knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_messages: {
        Row: {
          activity_id: string
          content_text: string
          created_at: string
          id: string
          modality: string
          role: string
          sequence_no: number
          user_id: string
          voice_interaction_id: string | null
        }
        Insert: {
          activity_id: string
          content_text: string
          created_at?: string
          id?: string
          modality: string
          role: string
          sequence_no: number
          user_id: string
          voice_interaction_id?: string | null
        }
        Update: {
          activity_id?: string
          content_text?: string
          created_at?: string
          id?: string
          modality?: string
          role?: string
          sequence_no?: number
          user_id?: string
          voice_interaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_messages_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "activity_messages_voice_owner_fk"
            columns: ["voice_interaction_id", "user_id"]
            isOneToOne: false
            referencedRelation: "voice_interactions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      ad_placement_configs: {
        Row: {
          configuration: Json
          created_at: string
          enabled: boolean
          id: string
          protected_surface: boolean
          surface_key: string
          updated_at: string
        }
        Insert: {
          configuration?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          protected_surface?: boolean
          surface_key: string
          updated_at?: string
        }
        Update: {
          configuration?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          protected_surface?: boolean
          surface_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_interactions: {
        Row: {
          activity_id: string | null
          completed_at: string | null
          created_at: string
          error_code: string | null
          estimated_cost_units: number | null
          id: string
          input_tokens: number | null
          interaction_type: string
          latency_ms: number | null
          metadata: Json
          model: string
          output_message_id: string | null
          output_tokens: number | null
          provider: string
          request_hash: string | null
          session_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_units?: number | null
          id?: string
          input_tokens?: number | null
          interaction_type: string
          latency_ms?: number | null
          metadata?: Json
          model: string
          output_message_id?: string | null
          output_tokens?: number | null
          provider: string
          request_hash?: string | null
          session_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          estimated_cost_units?: number | null
          id?: string
          input_tokens?: number | null
          interaction_type?: string
          latency_ms?: number | null
          metadata?: Json
          model?: string
          output_message_id?: string | null
          output_tokens?: number | null
          provider?: string
          request_hash?: string | null
          session_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "ai_interactions_output_message_owner_fk"
            columns: ["output_message_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activity_messages"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "ai_interactions_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      entitlement_definitions: {
        Row: {
          created_at: string
          default_value: Json
          description: string
          entitlement_key: string
          id: string
          updated_at: string
          value_type: string
        }
        Insert: {
          created_at?: string
          default_value?: Json
          description: string
          entitlement_key: string
          id?: string
          updated_at?: string
          value_type: string
        }
        Update: {
          created_at?: string
          default_value?: Json
          description?: string
          entitlement_key?: string
          id?: string
          updated_at?: string
          value_type?: string
        }
        Relationships: []
      }
      evidence_events: {
        Row: {
          activity_id: string | null
          communication_function: string | null
          created_at: string
          dedupe_key: string
          evaluator_confidence_level: number
          evidence_kind: string
          evidence_strength: Database["public"]["Enums"]["evidence_strength"]
          hints_count: number
          id: string
          independence_level: Database["public"]["Enums"]["independence_level"]
          knowledge_item_id: string | null
          listening_success: boolean | null
          metadata: Json
          modality: Database["public"]["Enums"]["knowledge_modality"] | null
          occurred_at: string
          processed_at: string | null
          processor_status: string
          processor_version: string | null
          response_quality: number | null
          response_time_ms: number | null
          result: Database["public"]["Enums"]["evidence_result"]
          retries_count: number
          scenario_success: boolean | null
          session_id: string | null
          source: Database["public"]["Enums"]["evidence_source"]
          source_interaction_id: string | null
          support_level: number
          target_skill: Database["public"]["Enums"]["ability_dimension"] | null
          transfer_success: boolean | null
          user_id: string
          voice_uncertainty: boolean | null
        }
        Insert: {
          activity_id?: string | null
          communication_function?: string | null
          created_at?: string
          dedupe_key: string
          evaluator_confidence_level?: number
          evidence_kind: string
          evidence_strength?: Database["public"]["Enums"]["evidence_strength"]
          hints_count?: number
          id?: string
          independence_level?: Database["public"]["Enums"]["independence_level"]
          knowledge_item_id?: string | null
          listening_success?: boolean | null
          metadata?: Json
          modality?: Database["public"]["Enums"]["knowledge_modality"] | null
          occurred_at?: string
          processed_at?: string | null
          processor_status?: string
          processor_version?: string | null
          response_quality?: number | null
          response_time_ms?: number | null
          result: Database["public"]["Enums"]["evidence_result"]
          retries_count?: number
          scenario_success?: boolean | null
          session_id?: string | null
          source: Database["public"]["Enums"]["evidence_source"]
          source_interaction_id?: string | null
          support_level?: number
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          transfer_success?: boolean | null
          user_id: string
          voice_uncertainty?: boolean | null
        }
        Update: {
          activity_id?: string | null
          communication_function?: string | null
          created_at?: string
          dedupe_key?: string
          evaluator_confidence_level?: number
          evidence_kind?: string
          evidence_strength?: Database["public"]["Enums"]["evidence_strength"]
          hints_count?: number
          id?: string
          independence_level?: Database["public"]["Enums"]["independence_level"]
          knowledge_item_id?: string | null
          listening_success?: boolean | null
          metadata?: Json
          modality?: Database["public"]["Enums"]["knowledge_modality"] | null
          occurred_at?: string
          processed_at?: string | null
          processor_status?: string
          processor_version?: string | null
          response_quality?: number | null
          response_time_ms?: number | null
          result?: Database["public"]["Enums"]["evidence_result"]
          retries_count?: number
          scenario_success?: boolean | null
          session_id?: string | null
          source?: Database["public"]["Enums"]["evidence_source"]
          source_interaction_id?: string | null
          support_level?: number
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          transfer_success?: boolean | null
          user_id?: string
          voice_uncertainty?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_events_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "evidence_events_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_events_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      knowledge_items: {
        Row: {
          canonical_text: string
          created_at: string
          description: string | null
          difficulty_hint: number | null
          id: string
          is_active: boolean
          item_type: Database["public"]["Enums"]["knowledge_item_type"]
          language_code: string
          metadata: Json
          normalized_key: string
          updated_at: string
        }
        Insert: {
          canonical_text: string
          created_at?: string
          description?: string | null
          difficulty_hint?: number | null
          id?: string
          is_active?: boolean
          item_type: Database["public"]["Enums"]["knowledge_item_type"]
          language_code?: string
          metadata?: Json
          normalized_key: string
          updated_at?: string
        }
        Update: {
          canonical_text?: string
          created_at?: string
          description?: string | null
          difficulty_hint?: number | null
          id?: string
          is_active?: boolean
          item_type?: Database["public"]["Enums"]["knowledge_item_type"]
          language_code?: string
          metadata?: Json
          normalized_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      learner_ability_estimates: {
        Row: {
          confidence_level: number
          created_at: string
          dimension: Database["public"]["Enums"]["ability_dimension"]
          estimate_level: number
          id: string
          last_evidence_at: string | null
          model_version: string
          trend: Database["public"]["Enums"]["trend_direction"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          dimension: Database["public"]["Enums"]["ability_dimension"]
          estimate_level?: number
          id?: string
          last_evidence_at?: string | null
          model_version?: string
          trend?: Database["public"]["Enums"]["trend_direction"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_level?: number
          created_at?: string
          dimension?: Database["public"]["Enums"]["ability_dimension"]
          estimate_level?: number
          id?: string
          last_evidence_at?: string | null
          model_version?: string
          trend?: Database["public"]["Enums"]["trend_direction"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learner_knowledge_states: {
        Row: {
          confidence_level: number
          created_at: string
          id: string
          knowledge_item_id: string
          last_evidence_at: string | null
          modality: Database["public"]["Enums"]["knowledge_modality"]
          model_version: string
          review_need: number
          state: Database["public"]["Enums"]["knowledge_state"]
          trend: Database["public"]["Enums"]["trend_direction"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          id?: string
          knowledge_item_id: string
          last_evidence_at?: string | null
          modality: Database["public"]["Enums"]["knowledge_modality"]
          model_version?: string
          review_need?: number
          state?: Database["public"]["Enums"]["knowledge_state"]
          trend?: Database["public"]["Enums"]["trend_direction"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_level?: number
          created_at?: string
          id?: string
          knowledge_item_id?: string
          last_evidence_at?: string | null
          modality?: Database["public"]["Enums"]["knowledge_modality"]
          model_version?: string
          review_need?: number
          state?: Database["public"]["Enums"]["knowledge_state"]
          trend?: Database["public"]["Enums"]["trend_direction"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_knowledge_states_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_model_change_evidence: {
        Row: {
          created_at: string
          evidence_event_id: string
          learner_model_change_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence_event_id: string
          learner_model_change_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          evidence_event_id?: string
          learner_model_change_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lmce_change_owner_fk"
            columns: ["learner_model_change_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learner_model_changes"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "lmce_evidence_owner_fk"
            columns: ["evidence_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "evidence_events"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      learner_model_changes: {
        Row: {
          change_key: string
          changed_entity_id: string | null
          changed_entity_type: string
          created_at: string
          dimension: string
          id: string
          model_version: string
          new_confidence: number | null
          new_value: Json
          previous_confidence: number | null
          previous_value: Json | null
          reason_category: string
          user_id: string
        }
        Insert: {
          change_key: string
          changed_entity_id?: string | null
          changed_entity_type: string
          created_at?: string
          dimension: string
          id?: string
          model_version?: string
          new_confidence?: number | null
          new_value: Json
          previous_confidence?: number | null
          previous_value?: Json | null
          reason_category: string
          user_id: string
        }
        Update: {
          change_key?: string
          changed_entity_id?: string | null
          changed_entity_type?: string
          created_at?: string
          dimension?: string
          id?: string
          model_version?: string
          new_confidence?: number | null
          new_value?: Json
          previous_confidence?: number | null
          previous_value?: Json | null
          reason_category?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_goals: {
        Row: {
          created_at: string
          description: string | null
          goal_type: string
          id: string
          is_active: boolean
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          goal_type: string
          id?: string
          is_active?: boolean
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          goal_type?: string
          id?: string
          is_active?: boolean
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_preferences: {
        Row: {
          confidence_level: number
          created_at: string
          id: string
          preference_type: string
          source: string
          strength: number
          target_key: string
          updated_at: string
          user_id: string
          value_text: string | null
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          id?: string
          preference_type: string
          source?: string
          strength?: number
          target_key: string
          updated_at?: string
          user_id: string
          value_text?: string | null
        }
        Update: {
          confidence_level?: number
          created_at?: string
          id?: string
          preference_type?: string
          source?: string
          strength?: number
          target_key?: string
          updated_at?: string
          user_id?: string
          value_text?: string | null
        }
        Relationships: []
      }
      learning_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          ending_state_summary: Json
          id: string
          primary_goal_id: string | null
          session_summary: Json
          started_at: string
          starting_state_summary: Json
          status: Database["public"]["Enums"]["session_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          ending_state_summary?: Json
          id?: string
          primary_goal_id?: string | null
          session_summary?: Json
          started_at?: string
          starting_state_summary?: Json
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          ending_state_summary?: Json
          id?: string
          primary_goal_id?: string | null
          session_summary?: Json
          started_at?: string
          starting_state_summary?: Json
          status?: Database["public"]["Enums"]["session_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_sessions_primary_goal_owner_fk"
            columns: ["primary_goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_goals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      method_effectiveness: {
        Row: {
          confidence_level: number
          created_at: string
          effectiveness_state: Database["public"]["Enums"]["method_effectiveness_state"]
          evidence_count: number
          id: string
          last_observed_at: string | null
          model_version: string
          target_skill: Database["public"]["Enums"]["ability_dimension"] | null
          teaching_method: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          effectiveness_state?: Database["public"]["Enums"]["method_effectiveness_state"]
          evidence_count?: number
          id?: string
          last_observed_at?: string | null
          model_version?: string
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          teaching_method: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_level?: number
          created_at?: string
          effectiveness_state?: Database["public"]["Enums"]["method_effectiveness_state"]
          evidence_count?: number
          id?: string
          last_observed_at?: string | null
          model_version?: string
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          teaching_method?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operational_events: {
        Row: {
          activity_id: string | null
          event_name: string
          id: string
          occurred_at: string
          properties: Json
          request_id: string | null
          session_id: string | null
          severity: string | null
          user_id: string | null
        }
        Insert: {
          activity_id?: string | null
          event_name: string
          id?: string
          occurred_at?: string
          properties?: Json
          request_id?: string | null
          session_id?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Update: {
          activity_id?: string | null
          event_name?: string
          id?: string
          occurred_at?: string
          properties?: Json
          request_id?: string | null
          session_id?: string | null
          severity?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_events_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "operational_events_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          created_at: string
          entitlement_definition_id: string
          plan_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          entitlement_definition_id: string
          plan_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          entitlement_definition_id?: string
          plan_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_entitlement_definition_id_fkey"
            columns: ["entitlement_definition_id"]
            isOneToOne: false
            referencedRelation: "entitlement_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean
          metadata: Json
          plan_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean
          metadata?: Json
          plan_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          plan_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          interface_language: string | null
          native_language: string | null
          onboarding_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          interface_language?: string | null
          native_language?: string | null
          onboarding_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          interface_language?: string | null
          native_language?: string | null
          onboarding_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_mistake_evidence: {
        Row: {
          created_at: string
          evidence_event_id: string
          pattern_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence_event_id: string
          pattern_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          evidence_event_id?: string
          pattern_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rme_evidence_owner_fk"
            columns: ["evidence_event_id", "user_id"]
            isOneToOne: false
            referencedRelation: "evidence_events"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "rme_pattern_owner_fk"
            columns: ["pattern_id", "user_id"]
            isOneToOne: false
            referencedRelation: "recurring_mistake_patterns"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      recurring_mistake_patterns: {
        Row: {
          confidence_level: number
          created_at: string
          first_detected_at: string
          id: string
          improvement_state: string
          knowledge_item_id: string | null
          last_observed_at: string
          mistake_category: string
          modality: Database["public"]["Enums"]["knowledge_modality"] | null
          model_version: string
          occurrence_count: number
          pattern_key: string
          severity_level: number
          status: Database["public"]["Enums"]["mistake_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence_level?: number
          created_at?: string
          first_detected_at?: string
          id?: string
          improvement_state?: string
          knowledge_item_id?: string | null
          last_observed_at?: string
          mistake_category: string
          modality?: Database["public"]["Enums"]["knowledge_modality"] | null
          model_version?: string
          occurrence_count?: number
          pattern_key: string
          severity_level?: number
          status?: Database["public"]["Enums"]["mistake_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence_level?: number
          created_at?: string
          first_detected_at?: string
          id?: string
          improvement_state?: string
          knowledge_item_id?: string | null
          last_observed_at?: string
          mistake_category?: string
          modality?: Database["public"]["Enums"]["knowledge_modality"] | null
          model_version?: string
          occurrence_count?: number
          pattern_key?: string
          severity_level?: number
          status?: Database["public"]["Enums"]["mistake_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_mistake_patterns_knowledge_item_id_fkey"
            columns: ["knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      session_states: {
        Row: {
          confidence_level: number
          ended_at: string | null
          id: string
          last_updated_at: string
          session_id: string
          source: string
          started_at: string
          state_type: string
          strength: number
          user_id: string
        }
        Insert: {
          confidence_level: number
          ended_at?: string | null
          id?: string
          last_updated_at?: string
          session_id: string
          source: string
          started_at?: string
          state_type: string
          strength: number
          user_id: string
        }
        Update: {
          confidence_level?: number
          ended_at?: string | null
          id?: string
          last_updated_at?: string
          session_id?: string
          source?: string
          started_at?: string
          state_type?: string
          strength?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_states_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_current: boolean
          plan_id: string
          provider: string | null
          provider_metadata: Json
          provider_reference: string | null
          renews_at: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_current?: boolean
          plan_id: string
          provider?: string | null
          provider_metadata?: Json
          provider_reference?: string | null
          renews_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_current?: boolean
          plan_id?: string
          provider?: string | null
          provider_metadata?: Json
          provider_reference?: string | null
          renews_at?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      teaching_decisions: {
        Row: {
          activity_id: string | null
          adaptation_triggers: Json
          correction_strategy: string
          created_at: string
          difficulty_level: number
          engine_version: string
          english_exposure_level: number
          evidence_basis: string
          evidence_to_collect: Json
          hint_strategy: Json
          id: string
          learning_objective: string
          native_support_level: number
          purpose: Database["public"]["Enums"]["learning_purpose"]
          reason_category: string
          return_to_communication_rule: string | null
          selected_method: string
          session_id: string
          target_knowledge_item_id: string | null
          target_skill: Database["public"]["Enums"]["ability_dimension"] | null
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          adaptation_triggers?: Json
          correction_strategy: string
          created_at?: string
          difficulty_level: number
          engine_version?: string
          english_exposure_level: number
          evidence_basis: string
          evidence_to_collect?: Json
          hint_strategy?: Json
          id?: string
          learning_objective: string
          native_support_level: number
          purpose: Database["public"]["Enums"]["learning_purpose"]
          reason_category: string
          return_to_communication_rule?: string | null
          selected_method: string
          session_id: string
          target_knowledge_item_id?: string | null
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          user_id: string
        }
        Update: {
          activity_id?: string | null
          adaptation_triggers?: Json
          correction_strategy?: string
          created_at?: string
          difficulty_level?: number
          engine_version?: string
          english_exposure_level?: number
          evidence_basis?: string
          evidence_to_collect?: Json
          hint_strategy?: Json
          id?: string
          learning_objective?: string
          native_support_level?: number
          purpose?: Database["public"]["Enums"]["learning_purpose"]
          reason_category?: string
          return_to_communication_rule?: string | null
          selected_method?: string
          session_id?: string
          target_knowledge_item_id?: string | null
          target_skill?: Database["public"]["Enums"]["ability_dimension"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teaching_decisions_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "teaching_decisions_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "teaching_decisions_target_knowledge_item_id_fkey"
            columns: ["target_knowledge_item_id"]
            isOneToOne: false
            referencedRelation: "knowledge_items"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_records: {
        Row: {
          activity_id: string | null
          amount: number
          created_at: string
          dedupe_key: string
          id: string
          period_end: string
          period_start: string
          resource_type: string
          session_id: string | null
          status: string
          unit: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          amount: number
          created_at?: string
          dedupe_key: string
          id?: string
          period_end: string
          period_start: string
          resource_type: string
          session_id?: string | null
          status?: string
          unit: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          amount?: number
          created_at?: string
          dedupe_key?: string
          id?: string
          period_end?: string
          period_start?: string
          resource_type?: string
          session_id?: string | null
          status?: string
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "usage_records_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_entitlement_overrides: {
        Row: {
          created_at: string
          ends_at: string | null
          entitlement_definition_id: string
          id: string
          source: string
          starts_at: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          entitlement_definition_id: string
          id?: string
          source: string
          starts_at?: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          entitlement_definition_id?: string
          id?: string
          source?: string
          starts_at?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlement_overrides_entitlement_definition_id_fkey"
            columns: ["entitlement_definition_id"]
            isOneToOne: false
            referencedRelation: "entitlement_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          activity_id: string | null
          created_at: string
          feedback_type: string
          free_text: string | null
          id: string
          session_id: string | null
          user_id: string
          value_score: number | null
          value_text: string | null
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          feedback_type: string
          free_text?: string | null
          id?: string
          session_id?: string | null
          user_id: string
          value_score?: number | null
          value_text?: string | null
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          feedback_type?: string
          free_text?: string | null
          id?: string
          session_id?: string | null
          user_id?: string
          value_score?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "user_feedback_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      voice_interactions: {
        Row: {
          activity_id: string
          attempt_no: number
          audio_deleted_at: string | null
          audio_expires_at: string | null
          audio_object_path: string | null
          completed_at: string | null
          created_at: string
          id: string
          interaction_type: Database["public"]["Enums"]["voice_interaction_type"]
          model: string | null
          processing_complete: boolean
          processing_status: string
          provider: string | null
          recognition_status: string | null
          replay_count: number
          session_id: string
          source_text: string | null
          stt_confidence: number | null
          transcript: string | null
          transcript_revealed: boolean
          translation_revealed: boolean
          user_id: string
        }
        Insert: {
          activity_id: string
          attempt_no?: number
          audio_deleted_at?: string | null
          audio_expires_at?: string | null
          audio_object_path?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interaction_type: Database["public"]["Enums"]["voice_interaction_type"]
          model?: string | null
          processing_complete?: boolean
          processing_status?: string
          provider?: string | null
          recognition_status?: string | null
          replay_count?: number
          session_id: string
          source_text?: string | null
          stt_confidence?: number | null
          transcript?: string | null
          transcript_revealed?: boolean
          translation_revealed?: boolean
          user_id: string
        }
        Update: {
          activity_id?: string
          attempt_no?: number
          audio_deleted_at?: string | null
          audio_expires_at?: string | null
          audio_object_path?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          interaction_type?: Database["public"]["Enums"]["voice_interaction_type"]
          model?: string | null
          processing_complete?: boolean
          processing_status?: string
          provider?: string | null
          recognition_status?: string | null
          replay_count?: number
          session_id?: string
          source_text?: string | null
          stt_confidence?: number | null
          transcript?: string | null
          transcript_revealed?: boolean
          translation_revealed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_interactions_activity_owner_fk"
            columns: ["activity_id", "user_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "voice_interactions_session_owner_fk"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id", "user_id"]
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
      ability_dimension:
        | "listening"
        | "spoken_expression"
        | "spoken_fluency"
        | "conversational_response"
        | "intelligibility"
        | "reading"
        | "written_expression"
        | "vocabulary"
        | "grammar"
        | "sentence_formation"
        | "practical_communication"
      evidence_result: "success" | "partial" | "failure" | "neutral"
      evidence_source:
        | "deterministic"
        | "evaluator"
        | "user_feedback"
        | "voice_processor"
        | "system"
      evidence_strength: "low" | "medium" | "high" | "very_high"
      independence_level:
        | "independent"
        | "light_support"
        | "moderate_support"
        | "heavy_support"
      knowledge_item_type:
        | "vocabulary"
        | "grammar_pattern"
        | "sentence_pattern"
        | "expression"
        | "communication_behavior"
      knowledge_modality:
        | "reading_recognition"
        | "listening_recognition"
        | "written_production"
        | "spoken_production"
        | "real_life_use"
      knowledge_state:
        | "unknown"
        | "emerging"
        | "recognized"
        | "supported"
        | "independent"
        | "strong"
      learning_purpose:
        | "weakness_repair"
        | "review"
        | "progression"
        | "transfer"
        | "communication"
        | "consolidation"
      method_effectiveness_state:
        | "insufficient_evidence"
        | "promising"
        | "repeatedly_helpful"
        | "mixed"
        | "not_currently_showing_benefit"
      mistake_status:
        | "candidate"
        | "likely"
        | "established"
        | "improving"
        | "resolved_monitor"
      session_status: "active" | "completed" | "interrupted" | "abandoned"
      subscription_status:
        | "free"
        | "trial"
        | "active"
        | "canceled"
        | "expired"
        | "payment_issue"
      trend_direction: "unknown" | "declining" | "stable" | "improving"
      voice_interaction_type:
        | "stt"
        | "tts"
        | "listening_attempt"
        | "spoken_response"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ability_dimension: [
        "listening",
        "spoken_expression",
        "spoken_fluency",
        "conversational_response",
        "intelligibility",
        "reading",
        "written_expression",
        "vocabulary",
        "grammar",
        "sentence_formation",
        "practical_communication",
      ],
      evidence_result: ["success", "partial", "failure", "neutral"],
      evidence_source: [
        "deterministic",
        "evaluator",
        "user_feedback",
        "voice_processor",
        "system",
      ],
      evidence_strength: ["low", "medium", "high", "very_high"],
      independence_level: [
        "independent",
        "light_support",
        "moderate_support",
        "heavy_support",
      ],
      knowledge_item_type: [
        "vocabulary",
        "grammar_pattern",
        "sentence_pattern",
        "expression",
        "communication_behavior",
      ],
      knowledge_modality: [
        "reading_recognition",
        "listening_recognition",
        "written_production",
        "spoken_production",
        "real_life_use",
      ],
      knowledge_state: [
        "unknown",
        "emerging",
        "recognized",
        "supported",
        "independent",
        "strong",
      ],
      learning_purpose: [
        "weakness_repair",
        "review",
        "progression",
        "transfer",
        "communication",
        "consolidation",
      ],
      method_effectiveness_state: [
        "insufficient_evidence",
        "promising",
        "repeatedly_helpful",
        "mixed",
        "not_currently_showing_benefit",
      ],
      mistake_status: [
        "candidate",
        "likely",
        "established",
        "improving",
        "resolved_monitor",
      ],
      session_status: ["active", "completed", "interrupted", "abandoned"],
      subscription_status: [
        "free",
        "trial",
        "active",
        "canceled",
        "expired",
        "payment_issue",
      ],
      trend_direction: ["unknown", "declining", "stable", "improving"],
      voice_interaction_type: [
        "stt",
        "tts",
        "listening_attempt",
        "spoken_response",
      ],
    },
  },
} as const

