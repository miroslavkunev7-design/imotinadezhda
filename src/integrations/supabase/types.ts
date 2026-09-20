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
      ad_attributions: {
        Row: {
          campaign_id: string | null
          created_at: string
          creative_id: string | null
          deal_id: string | null
          id: string
          landing_url: string | null
          lead_id: string | null
          revenue: number | null
          status: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          deal_id?: string | null
          id?: string
          landing_url?: string | null
          lead_id?: string | null
          revenue?: number | null
          status?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          creative_id?: string | null
          deal_id?: string | null
          id?: string
          landing_url?: string | null
          lead_id?: string | null
          revenue?: number | null
          status?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      ad_budgets: {
        Row: {
          actual: number
          campaign_id: string | null
          channel_code: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          period_month: string
          planned: number
          updated_at: string
        }
        Insert: {
          actual?: number
          campaign_id?: string | null
          channel_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          period_month: string
          planned?: number
          updated_at?: string
        }
        Update: {
          actual?: number
          campaign_id?: string | null
          channel_code?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          period_month?: string
          planned?: number
          updated_at?: string
        }
        Relationships: []
      }
      ad_campaigns: {
        Row: {
          ai_notes: string | null
          audience: string | null
          auto_pause_on_budget: boolean
          budget_daily: number | null
          budget_total: number
          channel_code: string
          city: string | null
          clicks: number
          created_at: string
          currency: string
          deals: number
          end_date: string | null
          id: string
          impressions: number
          leads: number
          name: string
          notes: string | null
          objective: string
          owner_id: string | null
          property_id: string | null
          revenue: number
          spent: number
          start_date: string | null
          status: string
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          ai_notes?: string | null
          audience?: string | null
          auto_pause_on_budget?: boolean
          budget_daily?: number | null
          budget_total?: number
          channel_code?: string
          city?: string | null
          clicks?: number
          created_at?: string
          currency?: string
          deals?: number
          end_date?: string | null
          id?: string
          impressions?: number
          leads?: number
          name: string
          notes?: string | null
          objective?: string
          owner_id?: string | null
          property_id?: string | null
          revenue?: number
          spent?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          ai_notes?: string | null
          audience?: string | null
          auto_pause_on_budget?: boolean
          budget_daily?: number | null
          budget_total?: number
          channel_code?: string
          city?: string | null
          clicks?: number
          created_at?: string
          currency?: string
          deals?: number
          end_date?: string | null
          id?: string
          impressions?: number
          leads?: number
          name?: string
          notes?: string | null
          objective?: string
          owner_id?: string | null
          property_id?: string | null
          revenue?: number
          spent?: number
          start_date?: string | null
          status?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      ad_channels: {
        Row: {
          code: string
          created_at: string
          default_cpc: number | null
          default_cpm: number | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          default_cpc?: number | null
          default_cpm?: number | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          default_cpc?: number | null
          default_cpm?: number | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ad_creatives: {
        Row: {
          ai_used: boolean
          body: string | null
          campaign_id: string
          clicks: number
          created_at: string
          cta: string | null
          headline: string | null
          id: string
          image_url: string | null
          impressions: number
          leads: number
          model: string | null
          status: string
          target_url: string | null
          updated_at: string
          variant: string
        }
        Insert: {
          ai_used?: boolean
          body?: string | null
          campaign_id: string
          clicks?: number
          created_at?: string
          cta?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          leads?: number
          model?: string | null
          status?: string
          target_url?: string | null
          updated_at?: string
          variant?: string
        }
        Update: {
          ai_used?: boolean
          body?: string | null
          campaign_id?: string
          clicks?: number
          created_at?: string
          cta?: string | null
          headline?: string | null
          id?: string
          image_url?: string | null
          impressions?: number
          leads?: number
          model?: string | null
          status?: string
          target_url?: string | null
          updated_at?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_events: {
        Row: {
          actor: string | null
          campaign_id: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          payload: Json
          status: string
        }
        Insert: {
          actor?: string | null
          campaign_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          payload?: Json
          status?: string
        }
        Update: {
          actor?: string | null
          campaign_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json
          status?: string
        }
        Relationships: []
      }
      ad_spend: {
        Row: {
          campaign_id: string
          clicks: number
          created_at: string
          creative_id: string | null
          day: string
          id: string
          impressions: number
          leads: number
          notes: string | null
          source: string | null
          spend: number
        }
        Insert: {
          campaign_id: string
          clicks?: number
          created_at?: string
          creative_id?: string | null
          day?: string
          id?: string
          impressions?: number
          leads?: number
          notes?: string | null
          source?: string | null
          spend?: number
        }
        Update: {
          campaign_id?: string
          clicks?: number
          created_at?: string
          creative_id?: string | null
          day?: string
          id?: string
          impressions?: number
          leads?: number
          notes?: string | null
          source?: string | null
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access_log: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          metadata: Json | null
          path: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          path: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          path?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      agency_settings: {
        Row: {
          commission_rate: number
          default_currency: string
          id: string
          rent_commission_rate: number
          singleton: boolean
          updated_at: string
          updated_by: string | null
          vat_rate: number
        }
        Insert: {
          commission_rate?: number
          default_currency?: string
          id?: string
          rent_commission_rate?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
        }
        Update: {
          commission_rate?: number
          default_currency?: string
          id?: string
          rent_commission_rate?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_properties: {
        Row: {
          address: string | null
          archived_at: string
          archived_by: string | null
          archived_year: number
          area_sqm: number | null
          bedrooms: number | null
          city_id: string | null
          contact_name: string | null
          currency: string | null
          description: string | null
          documents: Json
          drive_folder_id: string | null
          drive_folder_path: string | null
          drive_sync_status: string
          floor: number | null
          id: string
          images: Json
          is_published: boolean
          notes: string | null
          personal_description: string | null
          personal_price: number | null
          phone: string | null
          price: number | null
          property_type: string | null
          published_property_id: string | null
          quarter_id: string | null
          raw_data: Json | null
          rooms: number | null
          seller_type: string | null
          source: string | null
          source_extracted_id: string | null
          source_url: string | null
          status: string | null
          title: string
          total_floors: number | null
          updated_at: string
          year_built: number | null
        }
        Insert: {
          address?: string | null
          archived_at?: string
          archived_by?: string | null
          archived_year?: number
          area_sqm?: number | null
          bedrooms?: number | null
          city_id?: string | null
          contact_name?: string | null
          currency?: string | null
          description?: string | null
          documents?: Json
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_sync_status?: string
          floor?: number | null
          id?: string
          images?: Json
          is_published?: boolean
          notes?: string | null
          personal_description?: string | null
          personal_price?: number | null
          phone?: string | null
          price?: number | null
          property_type?: string | null
          published_property_id?: string | null
          quarter_id?: string | null
          raw_data?: Json | null
          rooms?: number | null
          seller_type?: string | null
          source?: string | null
          source_extracted_id?: string | null
          source_url?: string | null
          status?: string | null
          title: string
          total_floors?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Update: {
          address?: string | null
          archived_at?: string
          archived_by?: string | null
          archived_year?: number
          area_sqm?: number | null
          bedrooms?: number | null
          city_id?: string | null
          contact_name?: string | null
          currency?: string | null
          description?: string | null
          documents?: Json
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_sync_status?: string
          floor?: number | null
          id?: string
          images?: Json
          is_published?: boolean
          notes?: string | null
          personal_description?: string | null
          personal_price?: number | null
          phone?: string | null
          price?: number | null
          property_type?: string | null
          published_property_id?: string | null
          quarter_id?: string | null
          raw_data?: Json | null
          rooms?: number | null
          seller_type?: string | null
          source?: string | null
          source_extracted_id?: string | null
          source_url?: string | null
          status?: string | null
          title?: string
          total_floors?: number | null
          updated_at?: string
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "archived_properties_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_properties_published_property_id_fkey"
            columns: ["published_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "archived_properties_quarter_id_fkey"
            columns: ["quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: []
      }
      automation_jobs: {
        Row: {
          key: string
          last_run_at: string | null
          locked_until: string | null
          paused: boolean
          paused_at: string | null
          paused_reason: string | null
          stats: Json
          updated_at: string
        }
        Insert: {
          key: string
          last_run_at?: string | null
          locked_until?: string | null
          paused?: boolean
          paused_at?: string | null
          paused_reason?: string | null
          stats?: Json
          updated_at?: string
        }
        Update: {
          key?: string
          last_run_at?: string | null
          locked_until?: string | null
          paused?: boolean
          paused_at?: string | null
          paused_reason?: string | null
          stats?: Json
          updated_at?: string
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      bank_branch_rates: {
        Row: {
          bank: string
          city_slug: string
          created_at: string
          id: string
          rate_bg: number
          rate_foreign: number
          source: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
          valid_from: string
        }
        Insert: {
          bank: string
          city_slug: string
          created_at?: string
          id?: string
          rate_bg: number
          rate_foreign: number
          source?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          valid_from: string
        }
        Update: {
          bank?: string
          city_slug?: string
          created_at?: string
          id?: string
          rate_bg?: number
          rate_foreign?: number
          source?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
          valid_from?: string
        }
        Relationships: []
      }
      bank_branches: {
        Row: {
          bank: string
          branch_label: string | null
          city_slug: string
          color: string | null
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          updated_at: string
        }
        Insert: {
          bank: string
          branch_label?: string | null
          city_slug: string
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Update: {
          bank?: string
          branch_label?: string | null
          city_slug?: string
          color?: string | null
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bank_rate_fetch_log: {
        Row: {
          bank: string
          cities_updated: number
          error: string | null
          excerpt: string | null
          fetched_at: string
          id: string
          ok: boolean
          rate_bg: number | null
          rate_foreign: number | null
          skipped_manual: number
          url: string | null
        }
        Insert: {
          bank: string
          cities_updated?: number
          error?: string | null
          excerpt?: string | null
          fetched_at?: string
          id?: string
          ok?: boolean
          rate_bg?: number | null
          rate_foreign?: number | null
          skipped_manual?: number
          url?: string | null
        }
        Update: {
          bank?: string
          cities_updated?: number
          error?: string | null
          excerpt?: string | null
          fetched_at?: string
          id?: string
          ok?: boolean
          rate_bg?: number | null
          rate_foreign?: number | null
          skipped_manual?: number
          url?: string | null
        }
        Relationships: []
      }
      bank_rate_sources: {
        Row: {
          bank: string
          created_at: string
          enabled: boolean
          note: string | null
          updated_at: string
          url: string
        }
        Insert: {
          bank: string
          created_at?: string
          enabled?: boolean
          note?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          bank?: string
          created_at?: string
          enabled?: boolean
          note?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      bot_channels: {
        Row: {
          auto_reply: boolean
          code: string
          created_at: string
          greeting: string | null
          handoff_keywords: string[]
          id: string
          is_active: boolean
          name: string
          notes: string | null
          quiet_hours_end: number
          quiet_hours_start: number
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          auto_reply?: boolean
          code: string
          created_at?: string
          greeting?: string | null
          handoff_keywords?: string[]
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          quiet_hours_end?: number
          quiet_hours_start?: number
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          auto_reply?: boolean
          code?: string
          created_at?: string
          greeting?: string | null
          handoff_keywords?: string[]
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          quiet_hours_end?: number
          quiet_hours_start?: number
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      bot_conversations: {
        Row: {
          ai_summary: string | null
          assigned_to: string | null
          bot_messages_count: number
          channel_code: string
          client_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          display_name: string | null
          external_user_id: string | null
          handoff_at: string | null
          handoff_reason: string | null
          id: string
          intent: string | null
          language: string
          last_bot_at: string | null
          last_message_at: string | null
          lead_id: string | null
          messages_count: number
          property_id: string | null
          satisfaction: number | null
          status: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          assigned_to?: string | null
          bot_messages_count?: number
          channel_code?: string
          client_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          external_user_id?: string | null
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          intent?: string | null
          language?: string
          last_bot_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          messages_count?: number
          property_id?: string | null
          satisfaction?: number | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          assigned_to?: string | null
          bot_messages_count?: number
          channel_code?: string
          client_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          display_name?: string | null
          external_user_id?: string | null
          handoff_at?: string | null
          handoff_reason?: string | null
          id?: string
          intent?: string | null
          language?: string
          last_bot_at?: string | null
          last_message_at?: string | null
          lead_id?: string | null
          messages_count?: number
          property_id?: string | null
          satisfaction?: number | null
          status?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      bot_events: {
        Row: {
          channel_code: string | null
          conversation_id: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          payload: Json
        }
        Insert: {
          channel_code?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          payload?: Json
        }
        Update: {
          channel_code?: string | null
          conversation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json
        }
        Relationships: []
      }
      bot_knowledge: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          hits: number
          id: string
          is_active: boolean
          keywords: string[]
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          hits?: number
          id?: string
          is_active?: boolean
          keywords?: string[]
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          hits?: number
          id?: string
          is_active?: boolean
          keywords?: string[]
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      bot_messages: {
        Row: {
          ai_used: boolean
          attachments: Json
          channel_code: string
          content: string
          conversation_id: string
          created_at: string
          delivered: boolean
          direction: string
          error: string | null
          id: string
          latency_ms: number | null
          model: string | null
          role: string
          tokens: number | null
        }
        Insert: {
          ai_used?: boolean
          attachments?: Json
          channel_code?: string
          content: string
          conversation_id: string
          created_at?: string
          delivered?: boolean
          direction?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          role?: string
          tokens?: number | null
        }
        Update: {
          ai_used?: boolean
          attachments?: Json
          channel_code?: string
          content?: string
          conversation_id?: string
          created_at?: string
          delivered?: boolean
          direction?: string
          error?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          role?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "bot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      broker_tasks: {
        Row: {
          auto_action_log: Json | null
          broker_id: string
          client_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          is_completed: boolean
          reminded_at: string | null
          reminder_minutes: number
          task_type: string
          title: string
          updated_at: string
        }
        Insert: {
          auto_action_log?: Json | null
          broker_id: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          is_completed?: boolean
          reminded_at?: string | null
          reminder_minutes?: number
          task_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          auto_action_log?: Json | null
          broker_id?: string
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          is_completed?: boolean
          reminded_at?: string | null
          reminder_minutes?: number
          task_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broker_tasks_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broker_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      brokers: {
        Row: {
          bio: string | null
          clients_count: number | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          license_number: string | null
          phone: string | null
          photo_url: string | null
          properties_count: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          clients_count?: number | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          phone?: string | null
          photo_url?: string | null
          properties_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          clients_count?: number | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          license_number?: string | null
          phone?: string | null
          photo_url?: string | null
          properties_count?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      cities: {
        Row: {
          active_properties_count: number | null
          area_km2: number | null
          created_at: string
          description: string | null
          display_order: number | null
          hero_image_url: string | null
          hero_video_url: string | null
          id: string
          is_published: boolean
          lat: number | null
          lng: number | null
          name: string
          name_en: string | null
          population: number | null
          region: string | null
          slug: string
          stats: Json | null
          updated_at: string
        }
        Insert: {
          active_properties_count?: number | null
          area_km2?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          name_en?: string | null
          population?: number | null
          region?: string | null
          slug: string
          stats?: Json | null
          updated_at?: string
        }
        Update: {
          active_properties_count?: number | null
          area_km2?: number | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          hero_image_url?: string | null
          hero_video_url?: string | null
          id?: string
          is_published?: boolean
          lat?: number | null
          lng?: number | null
          name?: string
          name_en?: string | null
          population?: number | null
          region?: string | null
          slug?: string
          stats?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      city_local_taxes: {
        Row: {
          city_slug: string
          local_tax_rate: number
          note: string | null
          source: string
          updated_at: string
          updated_by: string | null
          updated_by_name: string | null
        }
        Insert: {
          city_slug: string
          local_tax_rate: number
          note?: string | null
          source?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Update: {
          city_slug?: string
          local_tax_rate?: number
          note?: string | null
          source?: string
          updated_at?: string
          updated_by?: string | null
          updated_by_name?: string | null
        }
        Relationships: []
      }
      client_documents: {
        Row: {
          client_id: string
          created_at: string
          document_type: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          notes: string | null
          uploaded_by: string | null
          version: number
        }
        Insert: {
          client_id: string
          created_at?: string
          document_type: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          document_type?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          notes?: string | null
          uploaded_by?: string | null
          version?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          area_max: number | null
          area_min: number | null
          assigned_broker_id: string | null
          budget_max: number | null
          budget_min: number | null
          client_type: string
          created_at: string
          created_by: string | null
          currency: string | null
          deal_stage: string | null
          deal_started_at: string | null
          deposit_amount: number | null
          deposit_currency: string | null
          deposit_date: string | null
          deposit_method: string | null
          deposit_note: string | null
          deposit_status: string | null
          email: string | null
          full_name: string
          id: string
          interest_note: string | null
          interest_property_id: string | null
          mortgage_data: Json
          notes: string | null
          phone: string | null
          rooms_max: number | null
          rooms_min: number | null
          search_city_id: string | null
          search_property_type: string | null
          search_quarter_id: string | null
          search_status: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_max?: number | null
          area_min?: number | null
          assigned_broker_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          client_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deal_stage?: string | null
          deal_started_at?: string | null
          deposit_amount?: number | null
          deposit_currency?: string | null
          deposit_date?: string | null
          deposit_method?: string | null
          deposit_note?: string | null
          deposit_status?: string | null
          email?: string | null
          full_name: string
          id?: string
          interest_note?: string | null
          interest_property_id?: string | null
          mortgage_data?: Json
          notes?: string | null
          phone?: string | null
          rooms_max?: number | null
          rooms_min?: number | null
          search_city_id?: string | null
          search_property_type?: string | null
          search_quarter_id?: string | null
          search_status?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_max?: number | null
          area_min?: number | null
          assigned_broker_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          client_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          deal_stage?: string | null
          deal_started_at?: string | null
          deposit_amount?: number | null
          deposit_currency?: string | null
          deposit_date?: string | null
          deposit_method?: string | null
          deposit_note?: string | null
          deposit_status?: string | null
          email?: string | null
          full_name?: string
          id?: string
          interest_note?: string | null
          interest_property_id?: string | null
          mortgage_data?: Json
          notes?: string | null
          phone?: string | null
          rooms_max?: number | null
          rooms_min?: number | null
          search_city_id?: string | null
          search_property_type?: string | null
          search_quarter_id?: string | null
          search_status?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_interest_property_id_fkey"
            columns: ["interest_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_search_city_id_fkey"
            columns: ["search_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_search_quarter_id_fkey"
            columns: ["search_quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_events: {
        Row: {
          action: string
          actor: string | null
          commission_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          message: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string | null
          commission_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          message?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string | null
          commission_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      commission_payouts: {
        Row: {
          amount: number
          broker_id: string | null
          commission_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          id: string
          method: string
          note: string | null
          paid_at: string
          period_month: string | null
          reference: string | null
          split_id: string | null
        }
        Insert: {
          amount?: number
          broker_id?: string | null
          commission_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          period_month?: string | null
          reference?: string | null
          split_id?: string | null
        }
        Update: {
          amount?: number
          broker_id?: string | null
          commission_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          period_month?: string | null
          reference?: string | null
          split_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_payouts_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_payouts_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "commission_splits"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          agency_share_percent: number
          basis: string
          broker_share_percent: number
          code: string
          created_at: string
          deal_type: string
          fixed_amount: number | null
          id: string
          is_active: boolean
          max_amount: number | null
          min_amount: number | null
          name: string
          notes: string | null
          percent: number | null
          price_from: number | null
          price_to: number | null
          priority: number
          rent_months: number | null
          updated_at: string
          vat_included: boolean
          vat_percent: number
        }
        Insert: {
          agency_share_percent?: number
          basis?: string
          broker_share_percent?: number
          code: string
          created_at?: string
          deal_type?: string
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          name: string
          notes?: string | null
          percent?: number | null
          price_from?: number | null
          price_to?: number | null
          priority?: number
          rent_months?: number | null
          updated_at?: string
          vat_included?: boolean
          vat_percent?: number
        }
        Update: {
          agency_share_percent?: number
          basis?: string
          broker_share_percent?: number
          code?: string
          created_at?: string
          deal_type?: string
          fixed_amount?: number | null
          id?: string
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number | null
          name?: string
          notes?: string | null
          percent?: number | null
          price_from?: number | null
          price_to?: number | null
          priority?: number
          rent_months?: number | null
          updated_at?: string
          vat_included?: boolean
          vat_percent?: number
        }
        Relationships: []
      }
      commission_splits: {
        Row: {
          amount: number
          broker_id: string | null
          commission_id: string | null
          created_at: string
          id: string
          name: string | null
          note: string | null
          paid_at: string | null
          role: string
          share_percent: number
          status: string
        }
        Insert: {
          amount?: number
          broker_id?: string | null
          commission_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          note?: string | null
          paid_at?: string | null
          role?: string
          share_percent?: number
          status?: string
        }
        Update: {
          amount?: number
          broker_id?: string | null
          commission_id?: string | null
          created_at?: string
          id?: string
          name?: string | null
          note?: string | null
          paid_at?: string | null
          role?: string
          share_percent?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_splits_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_splits_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          agency_amount: number
          ai_summary: string | null
          ai_updated_at: string | null
          approved_at: string | null
          approved_by: string | null
          base_amount: number
          broker_amount: number
          broker_id: string | null
          calc_note: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          deal_type: string
          gross_amount: number
          id: string
          invoice_number: string | null
          invoiced_at: string | null
          notes: string | null
          paid_amount: number
          paid_at: string | null
          payment_method: string | null
          percent: number | null
          period_month: string | null
          rule_code: string | null
          status: string
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_percent: number
        }
        Insert: {
          agency_amount?: number
          ai_summary?: string | null
          ai_updated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          broker_amount?: number
          broker_id?: string | null
          calc_note?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deal_type?: string
          gross_amount?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          percent?: number | null
          period_month?: string | null
          rule_code?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_percent?: number
        }
        Update: {
          agency_amount?: number
          ai_summary?: string | null
          ai_updated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          base_amount?: number
          broker_amount?: number
          broker_id?: string | null
          calc_note?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deal_type?: string
          gross_amount?: number
          id?: string
          invoice_number?: string | null
          invoiced_at?: string | null
          notes?: string | null
          paid_amount?: number
          paid_at?: string | null
          payment_method?: string | null
          percent?: number | null
          period_month?: string | null
          rule_code?: string | null
          status?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "commissions_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      component_presets: {
        Row: {
          component_type: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          preview_url: string | null
          props_json: Json
          updated_at: string
        }
        Insert: {
          component_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          preview_url?: string | null
          props_json?: Json
          updated_at?: string
        }
        Update: {
          component_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          preview_url?: string | null
          props_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      contact_attempts: {
        Row: {
          body: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          latency_seconds: number | null
          lead_id: string
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          latency_seconds?: number | null
          lead_id: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          latency_seconds?: number | null
          lead_id?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_attempts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_attempts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contact_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_entries: {
        Row: {
          address: string | null
          company_name: string
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          group_id: string
          id: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          company_name: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          group_id: string
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          group_id?: string
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_entries_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "contact_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_groups: {
        Row: {
          created_at: string
          display_order: number
          icon: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          is_active: boolean
          lead_type: string | null
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lead_type?: string | null
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          lead_type?: string | null
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_counters: {
        Row: {
          last_number: number
          year: number
        }
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      contract_events: {
        Row: {
          action: string
          actor: string | null
          contract_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          message: string | null
          meta: Json | null
          status: string
          template_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          contract_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          message?: string | null
          meta?: Json | null
          status?: string
          template_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          contract_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          message?: string | null
          meta?: Json | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "generated_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_queue: {
        Row: {
          attempts: number
          auto_send: boolean
          client_id: string | null
          contract_id: string | null
          created_at: string
          dedupe_key: string
          id: string
          last_error: string | null
          lead_id: string | null
          processed_at: string | null
          property_id: string | null
          requested_by: string | null
          status: string
          template_code: string | null
          template_id: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          attempts?: number
          auto_send?: boolean
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          dedupe_key: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          processed_at?: string | null
          property_id?: string | null
          requested_by?: string | null
          status?: string
          template_code?: string | null
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          attempts?: number
          auto_send?: boolean
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          dedupe_key?: string
          id?: string
          last_error?: string | null
          lead_id?: string | null
          processed_at?: string | null
          property_id?: string | null
          requested_by?: string | null
          status?: string
          template_code?: string | null
          template_id?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contract_queue_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_queue_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "generated_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          auto_trigger: string
          category: string
          code: string | null
          contract_type: string
          created_at: string
          generated_count: number
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          notes: string | null
          placeholders: Json
          requires_signature: boolean
          sort_order: number
          template_content: string
          updated_at: string
          variables: Json | null
          version: number
        }
        Insert: {
          auto_trigger?: string
          category?: string
          code?: string | null
          contract_type: string
          created_at?: string
          generated_count?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          notes?: string | null
          placeholders?: Json
          requires_signature?: boolean
          sort_order?: number
          template_content: string
          updated_at?: string
          variables?: Json | null
          version?: number
        }
        Update: {
          auto_trigger?: string
          category?: string
          code?: string | null
          contract_type?: string
          created_at?: string
          generated_count?: number
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          notes?: string | null
          placeholders?: Json
          requires_signature?: boolean
          sort_order?: number
          template_content?: string
          updated_at?: string
          variables?: Json | null
          version?: number
        }
        Relationships: []
      }
      contracts: {
        Row: {
          amount: number | null
          client_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          document_name: string | null
          document_url: string | null
          id: string
          notes: string | null
          property_id: string | null
          signed_at: string | null
          status: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          signed_at?: string | null
          status?: string
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          document_name?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          property_id?: string | null
          signed_at?: string | null
          status?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_events: {
        Row: {
          action: string
          actor: string
          copy_id: string | null
          created_at: string
          id: string
          message: string | null
          meta: Json | null
          property_id: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string
          copy_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json | null
          property_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string
          copy_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json | null
          property_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_events_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "property_copy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_queue: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          processed_at: string | null
          property_id: string
          requested_by: string | null
          status: string
          template_code: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          processed_at?: string | null
          property_id: string
          requested_by?: string | null
          status?: string
          template_code?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          processed_at?: string | null
          property_id?: string
          requested_by?: string | null
          status?: string
          template_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_templates: {
        Row: {
          channel: string
          code: string
          created_at: string
          emoji_allowed: boolean
          id: string
          include_contacts: boolean
          include_price: boolean
          instructions: string | null
          is_active: boolean
          language: string
          max_body: number
          max_title: number
          name: string
          tone: string
        }
        Insert: {
          channel?: string
          code: string
          created_at?: string
          emoji_allowed?: boolean
          id?: string
          include_contacts?: boolean
          include_price?: boolean
          instructions?: string | null
          is_active?: boolean
          language?: string
          max_body?: number
          max_title?: number
          name: string
          tone?: string
        }
        Update: {
          channel?: string
          code?: string
          created_at?: string
          emoji_allowed?: boolean
          id?: string
          include_contacts?: boolean
          include_price?: boolean
          instructions?: string | null
          is_active?: boolean
          language?: string
          max_body?: number
          max_title?: number
          name?: string
          tone?: string
        }
        Relationships: []
      }
      crm_channel_accounts: {
        Row: {
          channel: string
          created_at: string
          credentials_ciphertext: string | null
          display_name: string | null
          id: string
          identifier: string
          last_error: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          credentials_ciphertext?: string | null
          display_name?: string | null
          id?: string
          identifier: string
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          credentials_ciphertext?: string | null
          display_name?: string | null
          id?: string
          identifier?: string
          last_error?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_channel_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string | null
          created_at: string
          direction: string
          error_text: string | null
          external_id: string | null
          id: string
          sent_by: string | null
          status: string
          thread_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          direction: string
          error_text?: string | null
          external_id?: string | null
          id?: string
          sent_by?: string | null
          status?: string
          thread_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          created_at?: string
          direction?: string
          error_text?: string | null
          external_id?: string | null
          id?: string
          sent_by?: string | null
          status?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_channel_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "crm_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_custom_shapes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          keep_image: boolean
          kind: string
          mask_url: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          keep_image?: boolean
          kind?: string
          mask_url: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          keep_image?: boolean
          kind?: string
          mask_url?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_page_customizations: {
        Row: {
          created_at: string
          id: string
          page_key: string
          scope: string
          settings: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_key: string
          scope?: string
          settings?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_key?: string
          scope?: string
          settings?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      crm_threads: {
        Row: {
          account_id: string | null
          channel: string
          client_id: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          peer_id: string
          peer_name: string | null
          unread_count: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          channel: string
          client_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          peer_id: string
          peer_name?: string | null
          unread_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          peer_id?: string
          peer_name?: string | null
          unread_count?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_threads_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "crm_channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_post_queue: {
        Row: {
          created_at: string
          error: string | null
          external_url: string | null
          id: string
          property_id: string
          requested_by: string | null
          site: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          external_url?: string | null
          id?: string
          property_id: string
          requested_by?: string | null
          site: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          external_url?: string | null
          id?: string
          property_id?: string
          requested_by?: string | null
          site?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_post_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          metadata: Json
          role: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          role: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "customer_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_chats: {
        Row: {
          created_at: string
          id: string
          is_handed_off: boolean
          last_message_at: string
          page_url: string | null
          property_id: string | null
          visitor_email: string | null
          visitor_name: string | null
          visitor_phone: string | null
          visitor_token: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_handed_off?: boolean
          last_message_at?: string
          page_url?: string | null
          property_id?: string | null
          visitor_email?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
          visitor_token: string
        }
        Update: {
          created_at?: string
          id?: string
          is_handed_off?: boolean
          last_message_at?: string
          page_url?: string | null
          property_id?: string | null
          visitor_email?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
          visitor_token?: string
        }
        Relationships: []
      }
      deal_counters: {
        Row: {
          last_value: number
          year: number
        }
        Insert: {
          last_value?: number
          year: number
        }
        Update: {
          last_value?: number
          year?: number
        }
        Relationships: []
      }
      deal_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          deal_id: string | null
          duration_ms: number | null
          from_stage: string | null
          id: string
          message: string | null
          meta: Json | null
          status: string
          to_stage: string | null
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          deal_id?: string | null
          duration_ms?: number | null
          from_stage?: string | null
          id?: string
          message?: string | null
          meta?: Json | null
          status?: string
          to_stage?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          deal_id?: string | null
          duration_ms?: number | null
          from_stage?: string | null
          id?: string
          message?: string | null
          meta?: Json | null
          status?: string
          to_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_events_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_final: boolean
          is_won: boolean
          name: string
          position: number
          probability: number
          required_docs: string[]
          target_days: number
          task_templates: Json
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_final?: boolean
          is_won?: boolean
          name: string
          position?: number
          probability?: number
          required_docs?: string[]
          target_days?: number
          task_templates?: Json
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_final?: boolean
          is_won?: boolean
          name?: string
          position?: number
          probability?: number
          required_docs?: string[]
          target_days?: number
          task_templates?: Json
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          assigned_to: string | null
          auto_generated: boolean
          created_at: string
          deal_id: string
          description: string | null
          done_at: string | null
          due_at: string | null
          id: string
          sort_order: number
          stage_code: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          auto_generated?: boolean
          created_at?: string
          deal_id: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          sort_order?: number
          stage_code?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          auto_generated?: boolean
          created_at?: string
          deal_id?: string
          description?: string | null
          done_at?: string | null
          due_at?: string | null
          id?: string
          sort_order?: number
          stage_code?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          agreed_price: number | null
          ai_next_step: string | null
          ai_summary: string | null
          ai_updated_at: string | null
          broker_id: string | null
          client_id: string | null
          closed_at: string | null
          commission_amount: number | null
          commission_paid: boolean
          commission_percent: number | null
          created_at: string
          created_by: string | null
          currency: string
          deal_number: string | null
          deal_type: string
          deed_number: string | null
          deposit_amount: number | null
          deposit_paid_at: string | null
          expected_close_at: string | null
          id: string
          last_activity_at: string
          lost_reason: string | null
          mortgage_approved_at: string | null
          mortgage_bank: string | null
          mortgage_needed: boolean
          notary_at: string | null
          notary_confirmed: boolean
          notary_id: string | null
          notary_name: string | null
          notary_office: string | null
          notes: string | null
          owner_id: string | null
          preliminary_contract_at: string | null
          price: number | null
          probability: number
          property_id: string | null
          risk_level: string
          risk_note: string | null
          stage_code: string
          stage_entered_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agreed_price?: number | null
          ai_next_step?: string | null
          ai_summary?: string | null
          ai_updated_at?: string | null
          broker_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          commission_amount?: number | null
          commission_paid?: boolean
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_number?: string | null
          deal_type?: string
          deed_number?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          expected_close_at?: string | null
          id?: string
          last_activity_at?: string
          lost_reason?: string | null
          mortgage_approved_at?: string | null
          mortgage_bank?: string | null
          mortgage_needed?: boolean
          notary_at?: string | null
          notary_confirmed?: boolean
          notary_id?: string | null
          notary_name?: string | null
          notary_office?: string | null
          notes?: string | null
          owner_id?: string | null
          preliminary_contract_at?: string | null
          price?: number | null
          probability?: number
          property_id?: string | null
          risk_level?: string
          risk_note?: string | null
          stage_code?: string
          stage_entered_at?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agreed_price?: number | null
          ai_next_step?: string | null
          ai_summary?: string | null
          ai_updated_at?: string | null
          broker_id?: string | null
          client_id?: string | null
          closed_at?: string | null
          commission_amount?: number | null
          commission_paid?: boolean
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_number?: string | null
          deal_type?: string
          deed_number?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          expected_close_at?: string | null
          id?: string
          last_activity_at?: string
          lost_reason?: string | null
          mortgage_approved_at?: string | null
          mortgage_bank?: string | null
          mortgage_needed?: boolean
          notary_at?: string | null
          notary_confirmed?: boolean
          notary_id?: string | null
          notary_name?: string | null
          notary_office?: string | null
          notes?: string | null
          owner_id?: string | null
          preliminary_contract_at?: string | null
          price?: number | null
          probability?: number
          property_id?: string | null
          risk_level?: string
          risk_note?: string | null
          stage_code?: string
          stage_entered_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      design_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          layout_json: Json
          page_design_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          layout_json: Json
          page_design_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          layout_json?: Json
          page_design_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_revisions_page_design_id_fkey"
            columns: ["page_design_id"]
            isOneToOne: false
            referencedRelation: "page_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      document_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          document_id: string | null
          duration_ms: number | null
          id: string
          message: string | null
          meta: Json | null
          request_id: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string
          created_at?: string
          document_id?: string | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          meta?: Json | null
          request_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          document_id?: string | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          meta?: Json | null
          request_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      document_items: {
        Row: {
          ai_confidence: number | null
          ai_fields: Json
          ai_status: string
          ai_summary: string | null
          checksum: string | null
          client_id: string | null
          created_at: string
          doc_type: string
          expires_at: string | null
          external_source_id: string | null
          file_name: string
          file_size: number | null
          file_url: string | null
          id: string
          issued_at: string | null
          mime_type: string | null
          notes: string | null
          property_id: string | null
          rejected_reason: string | null
          requirement_code: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          source: string
          status: string
          storage_path: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          ai_confidence?: number | null
          ai_fields?: Json
          ai_status?: string
          ai_summary?: string | null
          checksum?: string | null
          client_id?: string | null
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          external_source_id?: string | null
          file_name: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          mime_type?: string | null
          notes?: string | null
          property_id?: string | null
          rejected_reason?: string | null
          requirement_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          source?: string
          status?: string
          storage_path?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          ai_confidence?: number | null
          ai_fields?: Json
          ai_status?: string
          ai_summary?: string | null
          checksum?: string | null
          client_id?: string | null
          created_at?: string
          doc_type?: string
          expires_at?: string | null
          external_source_id?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string | null
          id?: string
          issued_at?: string | null
          mime_type?: string | null
          notes?: string | null
          property_id?: string | null
          rejected_reason?: string | null
          requirement_code?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          source?: string
          status?: string
          storage_path?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_items_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          attempts: number
          client_id: string | null
          created_at: string
          created_by: string | null
          document_id: string | null
          due_at: string | null
          id: string
          last_reminder_at: string | null
          message: string | null
          next_reminder_at: string | null
          property_id: string | null
          reminders_sent: number
          requirement_code: string | null
          requirement_name: string
          scope: string
          share_token: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          due_at?: string | null
          id?: string
          last_reminder_at?: string | null
          message?: string | null
          next_reminder_at?: string | null
          property_id?: string | null
          reminders_sent?: number
          requirement_code?: string | null
          requirement_name: string
          scope?: string
          share_token?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string | null
          due_at?: string | null
          id?: string
          last_reminder_at?: string | null
          message?: string | null
          next_reminder_at?: string | null
          property_id?: string | null
          reminders_sent?: number
          requirement_code?: string | null
          requirement_name?: string
          scope?: string
          share_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "document_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          accepted_types: string
          ai_check: boolean
          category: string
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_required: boolean
          name: string
          scope: string
          sort_order: number
          valid_months: number | null
        }
        Insert: {
          accepted_types?: string
          ai_check?: boolean
          category?: string
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          name: string
          scope?: string
          sort_order?: number
          valid_months?: number | null
        }
        Update: {
          accepted_types?: string
          ai_check?: boolean
          category?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_required?: boolean
          name?: string
          scope?: string
          sort_order?: number
          valid_months?: number | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      extracted_listings: {
        Row: {
          agency_logo_detected: boolean
          agency_logo_reason: string | null
          area_sqm: number | null
          bedrooms: number | null
          city_id: string | null
          contact_name: string | null
          created_at: string
          currency: string | null
          deal_type: string
          description: string | null
          external_id: string | null
          id: string
          images: Json
          notes: string | null
          phone: string | null
          price: number | null
          property_type: string | null
          published_property_id: string | null
          quarter_id: string | null
          raw_data: Json | null
          rooms: number | null
          scraped_at: string
          seller_type: Database["public"]["Enums"]["seller_type"]
          source: Database["public"]["Enums"]["extracted_source"]
          source_url: string
          status: Database["public"]["Enums"]["extracted_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          agency_logo_detected?: boolean
          agency_logo_reason?: string | null
          area_sqm?: number | null
          bedrooms?: number | null
          city_id?: string | null
          contact_name?: string | null
          created_at?: string
          currency?: string | null
          deal_type?: string
          description?: string | null
          external_id?: string | null
          id?: string
          images?: Json
          notes?: string | null
          phone?: string | null
          price?: number | null
          property_type?: string | null
          published_property_id?: string | null
          quarter_id?: string | null
          raw_data?: Json | null
          rooms?: number | null
          scraped_at?: string
          seller_type?: Database["public"]["Enums"]["seller_type"]
          source: Database["public"]["Enums"]["extracted_source"]
          source_url: string
          status?: Database["public"]["Enums"]["extracted_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          agency_logo_detected?: boolean
          agency_logo_reason?: string | null
          area_sqm?: number | null
          bedrooms?: number | null
          city_id?: string | null
          contact_name?: string | null
          created_at?: string
          currency?: string | null
          deal_type?: string
          description?: string | null
          external_id?: string | null
          id?: string
          images?: Json
          notes?: string | null
          phone?: string | null
          price?: number | null
          property_type?: string | null
          published_property_id?: string | null
          quarter_id?: string | null
          raw_data?: Json | null
          rooms?: number | null
          scraped_at?: string
          seller_type?: Database["public"]["Enums"]["seller_type"]
          source?: Database["public"]["Enums"]["extracted_source"]
          source_url?: string
          status?: Database["public"]["Enums"]["extracted_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "extracted_listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_listings_published_property_id_fkey"
            columns: ["published_property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extracted_listings_quarter_id_fkey"
            columns: ["quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          lead_id: string
          next_run_at: string
          reason: string | null
          sequence_id: string
          status: string
          stop_reason: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          lead_id: string
          next_run_at?: string
          reason?: string | null
          sequence_id: string
          status?: string
          stop_reason?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          lead_id?: string
          next_run_at?: string
          reason?: string | null
          sequence_id?: string
          status?: string
          stop_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_messages: {
        Row: {
          ai_used: boolean
          body: string | null
          channel: string
          clicked_at: string | null
          created_at: string
          enrollment_id: string | null
          error: string | null
          id: string
          lead_id: string
          model: string | null
          opened_at: string | null
          replied_at: string | null
          scheduled_at: string
          sent_at: string | null
          sequence_id: string | null
          status: string
          step_id: string | null
          step_no: number
          subject: string | null
          token: string | null
        }
        Insert: {
          ai_used?: boolean
          body?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          enrollment_id?: string | null
          error?: string | null
          id?: string
          lead_id: string
          model?: string | null
          opened_at?: string | null
          replied_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          step_id?: string | null
          step_no?: number
          subject?: string | null
          token?: string | null
        }
        Update: {
          ai_used?: boolean
          body?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          enrollment_id?: string | null
          error?: string | null
          id?: string
          lead_id?: string
          model?: string | null
          opened_at?: string | null
          replied_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          step_id?: string | null
          step_no?: number
          subject?: string | null
          token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_messages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "followup_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_messages_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_messages_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "followup_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_sequences: {
        Row: {
          ai_personalize: boolean
          channel: string
          created_at: string
          description: string | null
          dormant_days: number
          id: string
          is_active: boolean
          lead_type: string | null
          name: string
          priority: number
          quiet_end: number
          quiet_start: number
          stop_on_reply: boolean
          target_status: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          ai_personalize?: boolean
          channel?: string
          created_at?: string
          description?: string | null
          dormant_days?: number
          id?: string
          is_active?: boolean
          lead_type?: string | null
          name: string
          priority?: number
          quiet_end?: number
          quiet_start?: number
          stop_on_reply?: boolean
          target_status?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          ai_personalize?: boolean
          channel?: string
          created_at?: string
          description?: string | null
          dormant_days?: number
          id?: string
          is_active?: boolean
          lead_type?: string | null
          name?: string
          priority?: number
          quiet_end?: number
          quiet_start?: number
          stop_on_reply?: boolean
          target_status?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      followup_steps: {
        Row: {
          body: string
          channel: string
          created_at: string
          delay_hours: number
          id: string
          is_active: boolean
          sequence_id: string
          step_no: number
          subject: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          delay_hours?: number
          id?: string
          is_active?: boolean
          sequence_id: string
          step_no: number
          subject?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          delay_hours?: number
          id?: string
          is_active?: boolean
          sequence_id?: string
          step_no?: number
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "followup_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_contracts: {
        Row: {
          ai_used: boolean
          amount: number | null
          client_id: string | null
          content: string
          contract_type: string
          created_at: string
          created_by: string | null
          currency: string | null
          decline_reason: string | null
          declined_at: string | null
          doc_number: string | null
          expires_at: string | null
          id: string
          last_error: string | null
          lead_id: string | null
          missing_fields: Json
          pdf_url: string | null
          property_id: string | null
          sent_at: string | null
          share_token: string | null
          signature_ip: string | null
          signature_name: string | null
          signed_at: string | null
          signer_email: string | null
          signer_name: string | null
          signer_phone: string | null
          source: string
          status: string
          template_id: string | null
          template_version: number | null
          title: string
          updated_at: string
          variables: Json
          viewed_at: string | null
        }
        Insert: {
          ai_used?: boolean
          amount?: number | null
          client_id?: string | null
          content: string
          contract_type: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          doc_number?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          lead_id?: string | null
          missing_fields?: Json
          pdf_url?: string | null
          property_id?: string | null
          sent_at?: string | null
          share_token?: string | null
          signature_ip?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          source?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          title: string
          updated_at?: string
          variables?: Json
          viewed_at?: string | null
        }
        Update: {
          ai_used?: boolean
          amount?: number | null
          client_id?: string | null
          content?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          doc_number?: string | null
          expires_at?: string | null
          id?: string
          last_error?: string | null
          lead_id?: string | null
          missing_fields?: Json
          pdf_url?: string | null
          property_id?: string | null
          sent_at?: string | null
          share_token?: string | null
          signature_ip?: string | null
          signature_name?: string | null
          signed_at?: string | null
          signer_email?: string | null
          signer_name?: string | null
          signer_phone?: string | null
          source?: string
          status?: string
          template_id?: string | null
          template_version?: number | null
          title?: string
          updated_at?: string
          variables?: Json
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          notes: string | null
          phone: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_briefings: {
        Row: {
          actions: Json
          actor: string | null
          created_at: string
          highlights: Json
          id: string
          metrics: Json
          period_label: string
          summary: string
        }
        Insert: {
          actions?: Json
          actor?: string | null
          created_at?: string
          highlights?: Json
          id?: string
          metrics?: Json
          period_label: string
          summary: string
        }
        Update: {
          actions?: Json
          actor?: string | null
          created_at?: string
          highlights?: Json
          id?: string
          metrics?: Json
          period_label?: string
          summary?: string
        }
        Relationships: []
      }
      kpi_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          payload: Json
          status: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          payload?: Json
          status?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json
          status?: string
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          ad_spend: number
          commission: number
          conversion: number
          cpl: number
          created_at: string
          currency: string
          deals_open: number
          deals_won: number
          id: string
          leads: number
          new_listings: number
          payload: Json
          properties_active: number
          qualified: number
          revenue: number
          roi: number
          scope: string
          scope_ref: string | null
          seller_prospects: number
          snapshot_date: string
          viewings: number
        }
        Insert: {
          ad_spend?: number
          commission?: number
          conversion?: number
          cpl?: number
          created_at?: string
          currency?: string
          deals_open?: number
          deals_won?: number
          id?: string
          leads?: number
          new_listings?: number
          payload?: Json
          properties_active?: number
          qualified?: number
          revenue?: number
          roi?: number
          scope?: string
          scope_ref?: string | null
          seller_prospects?: number
          snapshot_date: string
          viewings?: number
        }
        Update: {
          ad_spend?: number
          commission?: number
          conversion?: number
          cpl?: number
          created_at?: string
          currency?: string
          deals_open?: number
          deals_won?: number
          id?: string
          leads?: number
          new_listings?: number
          payload?: Json
          properties_active?: number
          qualified?: number
          revenue?: number
          roi?: number
          scope?: string
          scope_ref?: string | null
          seller_prospects?: number
          snapshot_date?: string
          viewings?: number
        }
        Relationships: []
      }
      kpi_targets: {
        Row: {
          created_at: string
          id: string
          label: string | null
          metric: string
          period: string
          period_start: string
          scope: string
          scope_ref: string | null
          target: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          metric: string
          period?: string
          period_start: string
          scope?: string
          scope_ref?: string | null
          target?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          metric?: string
          period?: string
          period_start?: string
          scope?: string
          scope_ref?: string | null
          target?: number
          updated_at?: string
        }
        Relationships: []
      }
      lead_events: {
        Row: {
          actor: string | null
          channel: string | null
          created_at: string
          detail: string | null
          event_type: string
          id: string
          lead_id: string
          payload: Json | null
        }
        Insert: {
          actor?: string | null
          channel?: string | null
          created_at?: string
          detail?: string | null
          event_type: string
          id?: string
          lead_id: string
          payload?: Json | null
        }
        Update: {
          actor?: string | null
          channel?: string | null
          created_at?: string
          detail?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_qualifications: {
        Row: {
          actor: string | null
          ai_raw: Json | null
          ai_summary: string | null
          area_max: number | null
          area_min: number | null
          breakdown: Json | null
          budget_max: number | null
          budget_min: number | null
          created_at: string
          currency: string | null
          desired_city: string | null
          desired_district: string | null
          desired_property_type: string | null
          financing: string | null
          grade: string | null
          id: string
          intent: string | null
          lead_id: string
          lead_type: string | null
          matched_properties: number | null
          missing_fields: string[] | null
          model: string | null
          motivation: string | null
          next_questions: string[] | null
          recommended_action: string | null
          rooms_min: number | null
          score: number
          source: string
          status: string
          timeframe: string | null
        }
        Insert: {
          actor?: string | null
          ai_raw?: Json | null
          ai_summary?: string | null
          area_max?: number | null
          area_min?: number | null
          breakdown?: Json | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          currency?: string | null
          desired_city?: string | null
          desired_district?: string | null
          desired_property_type?: string | null
          financing?: string | null
          grade?: string | null
          id?: string
          intent?: string | null
          lead_id: string
          lead_type?: string | null
          matched_properties?: number | null
          missing_fields?: string[] | null
          model?: string | null
          motivation?: string | null
          next_questions?: string[] | null
          recommended_action?: string | null
          rooms_min?: number | null
          score?: number
          source?: string
          status?: string
          timeframe?: string | null
        }
        Update: {
          actor?: string | null
          ai_raw?: Json | null
          ai_summary?: string | null
          area_max?: number | null
          area_min?: number | null
          breakdown?: Json | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          currency?: string | null
          desired_city?: string | null
          desired_district?: string | null
          desired_property_type?: string | null
          financing?: string | null
          grade?: string | null
          id?: string
          intent?: string | null
          lead_id?: string
          lead_type?: string | null
          matched_properties?: number | null
          missing_fields?: string[] | null
          model?: string | null
          motivation?: string | null
          next_questions?: string[] | null
          recommended_action?: string | null
          rooms_min?: number | null
          score?: number
          source?: string
          status?: string
          timeframe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_raw: Json | null
          ai_summary: string | null
          area_max: number | null
          area_min: number | null
          assigned_broker_id: string | null
          budget_max: number | null
          budget_min: number | null
          channel: string
          city_id: string | null
          client_id: string | null
          created_at: string
          currency: string | null
          dedupe_key: string | null
          desired_city: string | null
          desired_district: string | null
          desired_property_type: string | null
          email: string | null
          financing: string | null
          first_contact_at: string | null
          first_contact_seconds: number | null
          followup_count: number
          followup_opt_out: boolean
          full_name: string
          id: string
          intent: string | null
          landing_path: string | null
          last_activity_at: string | null
          last_followup_at: string | null
          last_match_sent_at: string | null
          last_viewing_at: string | null
          lead_type: string | null
          match_sends_count: number
          matching_opt_out: boolean
          message: string | null
          motivation: string | null
          next_viewing_at: string | null
          notes: string | null
          phone: string | null
          preferred_contact: string | null
          property_id: string | null
          qualification_grade: string | null
          qualification_score: number | null
          qualification_status: string | null
          qualified_at: string | null
          reactivated_at: string | null
          referrer: string | null
          rooms_min: number | null
          score: number
          source: string | null
          status: string
          timeframe: string | null
          updated_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          viewings_count: number
        }
        Insert: {
          ai_raw?: Json | null
          ai_summary?: string | null
          area_max?: number | null
          area_min?: number | null
          assigned_broker_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          channel?: string
          city_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          dedupe_key?: string | null
          desired_city?: string | null
          desired_district?: string | null
          desired_property_type?: string | null
          email?: string | null
          financing?: string | null
          first_contact_at?: string | null
          first_contact_seconds?: number | null
          followup_count?: number
          followup_opt_out?: boolean
          full_name: string
          id?: string
          intent?: string | null
          landing_path?: string | null
          last_activity_at?: string | null
          last_followup_at?: string | null
          last_match_sent_at?: string | null
          last_viewing_at?: string | null
          lead_type?: string | null
          match_sends_count?: number
          matching_opt_out?: boolean
          message?: string | null
          motivation?: string | null
          next_viewing_at?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          property_id?: string | null
          qualification_grade?: string | null
          qualification_score?: number | null
          qualification_status?: string | null
          qualified_at?: string | null
          reactivated_at?: string | null
          referrer?: string | null
          rooms_min?: number | null
          score?: number
          source?: string | null
          status?: string
          timeframe?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewings_count?: number
        }
        Update: {
          ai_raw?: Json | null
          ai_summary?: string | null
          area_max?: number | null
          area_min?: number | null
          assigned_broker_id?: string | null
          budget_max?: number | null
          budget_min?: number | null
          channel?: string
          city_id?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string | null
          dedupe_key?: string | null
          desired_city?: string | null
          desired_district?: string | null
          desired_property_type?: string | null
          email?: string | null
          financing?: string | null
          first_contact_at?: string | null
          first_contact_seconds?: number | null
          followup_count?: number
          followup_opt_out?: boolean
          full_name?: string
          id?: string
          intent?: string | null
          landing_path?: string | null
          last_activity_at?: string | null
          last_followup_at?: string | null
          last_match_sent_at?: string | null
          last_viewing_at?: string | null
          lead_type?: string | null
          match_sends_count?: number
          matching_opt_out?: boolean
          message?: string | null
          motivation?: string | null
          next_viewing_at?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          property_id?: string | null
          qualification_grade?: string | null
          qualification_score?: number | null
          qualification_status?: string | null
          qualified_at?: string | null
          reactivated_at?: string | null
          referrer?: string | null
          rooms_min?: number | null
          score?: number
          source?: string | null
          status?: string
          timeframe?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewings_count?: number
        }
        Relationships: []
      }
      listing_portals: {
        Row: {
          ai_copy: boolean
          auth_header: string | null
          auth_type: string
          code: string
          created_at: string
          credentials_env: string | null
          endpoint_url: string | null
          feed_format: string
          feed_token: string | null
          field_map: Json
          id: string
          is_active: boolean
          kind: string
          last_error: string | null
          last_status: string | null
          last_sync_at: string | null
          max_listings: number
          name: string
          notes: string | null
          price_markup: number
          published_count: number
          requires_approval: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          ai_copy?: boolean
          auth_header?: string | null
          auth_type?: string
          code: string
          created_at?: string
          credentials_env?: string | null
          endpoint_url?: string | null
          feed_format?: string
          feed_token?: string | null
          field_map?: Json
          id?: string
          is_active?: boolean
          kind?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          max_listings?: number
          name: string
          notes?: string | null
          price_markup?: number
          published_count?: number
          requires_approval?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          ai_copy?: boolean
          auth_header?: string | null
          auth_type?: string
          code?: string
          created_at?: string
          credentials_env?: string | null
          endpoint_url?: string | null
          feed_format?: string
          feed_token?: string | null
          field_map?: Json
          id?: string
          is_active?: boolean
          kind?: string
          last_error?: string | null
          last_status?: string | null
          last_sync_at?: string | null
          max_listings?: number
          name?: string
          notes?: string | null
          price_markup?: number
          published_count?: number
          requires_approval?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      match_sends: {
        Row: {
          ai_used: boolean
          body: string | null
          channel: string
          clicked_at: string | null
          created_at: string
          error: string | null
          id: string
          lead_id: string
          match_count: number
          model: string | null
          opened_at: string | null
          property_ids: string[]
          sent_at: string | null
          status: string
          subject: string | null
          token: string
        }
        Insert: {
          ai_used?: boolean
          body?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id: string
          match_count?: number
          model?: string | null
          opened_at?: string | null
          property_ids?: string[]
          sent_at?: string | null
          status?: string
          subject?: string | null
          token?: string
        }
        Update: {
          ai_used?: boolean
          body?: string | null
          channel?: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          lead_id?: string
          match_count?: number
          model?: string | null
          opened_at?: string | null
          property_ids?: string[]
          sent_at?: string | null
          status?: string
          subject?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      mortgage_applications: {
        Row: {
          created_at: string
          email: string | null
          employer: string | null
          files: Json
          full_name: string
          id: string
          monthly_income: number | null
          notes: string | null
          phone: string
          property_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          employer?: string | null
          files?: Json
          full_name: string
          id?: string
          monthly_income?: number | null
          notes?: string | null
          phone: string
          property_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          employer?: string | null
          files?: Json
          full_name?: string
          id?: string
          monthly_income?: number | null
          notes?: string | null
          phone?: string
          property_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_report_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          id: string
          message: string | null
          owner_id: string | null
          report_id: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          id?: string
          message?: string | null
          owner_id?: string | null
          report_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          id?: string
          message?: string | null
          owner_id?: string | null
          report_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_report_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "owner_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_report_schedules: {
        Row: {
          auto_send: boolean
          channel: string
          created_at: string
          frequency: string
          hour: number
          id: string
          is_active: boolean
          last_report_id: string | null
          last_run_at: string | null
          next_run_at: string
          notes: string | null
          owner_id: string | null
          template_code: string
          updated_at: string
        }
        Insert: {
          auto_send?: boolean
          channel?: string
          created_at?: string
          frequency?: string
          hour?: number
          id?: string
          is_active?: boolean
          last_report_id?: string | null
          last_run_at?: string | null
          next_run_at?: string
          notes?: string | null
          owner_id?: string | null
          template_code?: string
          updated_at?: string
        }
        Update: {
          auto_send?: boolean
          channel?: string
          created_at?: string
          frequency?: string
          hour?: number
          id?: string
          is_active?: boolean
          last_report_id?: string | null
          last_run_at?: string | null
          next_run_at?: string
          notes?: string | null
          owner_id?: string | null
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_report_schedules_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_report_templates: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          include_ai_summary: boolean
          include_price_advice: boolean
          is_active: boolean
          name: string
          sections: string[]
          tone: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          include_ai_summary?: boolean
          include_price_advice?: boolean
          is_active?: boolean
          name: string
          sections?: string[]
          tone?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          include_ai_summary?: boolean
          include_price_advice?: boolean
          is_active?: boolean
          name?: string
          sections?: string[]
          tone?: string
          updated_at?: string
        }
        Relationships: []
      }
      owner_reports: {
        Row: {
          ai_used: boolean
          created_at: string
          created_by: string | null
          error: string | null
          html: string | null
          id: string
          metrics: Json
          model: string | null
          open_count: number
          opened_at: string | null
          owner_email: string | null
          owner_id: string | null
          owner_name: string | null
          period_end: string
          period_start: string
          property_ids: string[]
          recipient: string | null
          recommendations: string | null
          schedule_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          summary: string | null
          template_code: string
          token: string
          updated_at: string
        }
        Insert: {
          ai_used?: boolean
          created_at?: string
          created_by?: string | null
          error?: string | null
          html?: string | null
          id?: string
          metrics?: Json
          model?: string | null
          open_count?: number
          opened_at?: string | null
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          period_end: string
          period_start: string
          property_ids?: string[]
          recipient?: string | null
          recommendations?: string | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          template_code?: string
          token?: string
          updated_at?: string
        }
        Update: {
          ai_used?: boolean
          created_at?: string
          created_by?: string | null
          error?: string | null
          html?: string | null
          id?: string
          metrics?: Json
          model?: string | null
          open_count?: number
          opened_at?: string | null
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          period_end?: string
          period_start?: string
          property_ids?: string[]
          recipient?: string | null
          recommendations?: string | null
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          template_code?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_reports_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          address: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          id: string
          id_number: string | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          id?: string
          id_number?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          id?: string
          id_number?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owners_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      page_backgrounds: {
        Row: {
          image_url: string
          page_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          image_url: string
          page_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          image_url?: string
          page_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      page_designs: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          layout_json: Json
          name: string
          page_slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          layout_json?: Json
          name?: string
          page_slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          layout_json?: Json
          name?: string
          page_slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_layout_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          page_key: string
          sections: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          page_key: string
          sections: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          page_key?: string
          sections?: Json
        }
        Relationships: []
      }
      page_layouts: {
        Row: {
          created_at: string
          page_key: string
          sections: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          page_key: string
          sections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          page_key?: string
          sections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      photo_assets: {
        Row: {
          ai_used: boolean
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          bytes: number | null
          created_at: string
          created_by: string | null
          duration_ms: number | null
          error: string | null
          height: number | null
          id: string
          issues: string[]
          kind: string
          model: string | null
          preset_code: string
          property_id: string
          provider: string | null
          quality_score: number
          result_url: string | null
          source_image_id: string | null
          source_url: string
          status: string
          storage_path: string | null
          updated_at: string
          version: number
          width: number | null
        }
        Insert: {
          ai_used?: boolean
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          height?: number | null
          id?: string
          issues?: string[]
          kind?: string
          model?: string | null
          preset_code?: string
          property_id: string
          provider?: string | null
          quality_score?: number
          result_url?: string | null
          source_image_id?: string | null
          source_url: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          version?: number
          width?: number | null
        }
        Update: {
          ai_used?: boolean
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          duration_ms?: number | null
          error?: string | null
          height?: number | null
          id?: string
          issues?: string[]
          kind?: string
          model?: string | null
          preset_code?: string
          property_id?: string
          provider?: string | null
          quality_score?: number
          result_url?: string | null
          source_image_id?: string | null
          source_url?: string
          status?: string
          storage_path?: string | null
          updated_at?: string
          version?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_assets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_assets_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "property_images"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_events: {
        Row: {
          action: string
          actor: string
          asset_id: string | null
          created_at: string
          id: string
          message: string | null
          meta: Json | null
          property_id: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string
          asset_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json | null
          property_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string
          asset_id?: string | null
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json | null
          property_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "photo_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_events_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_presets: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          keep_structure: boolean
          kind: string
          name: string
          prompt: string
          room: string | null
          size: string
          strength: number
          style: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          keep_structure?: boolean
          kind?: string
          name: string
          prompt: string
          room?: string | null
          size?: string
          strength?: number
          style?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keep_structure?: boolean
          kind?: string
          name?: string
          prompt?: string
          room?: string | null
          size?: string
          strength?: number
          style?: string | null
        }
        Relationships: []
      }
      photo_queue: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          id: string
          preset_code: string
          processed_at: string | null
          property_id: string
          requested_by: string | null
          source_image_id: string | null
          source_url: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          preset_code?: string
          processed_at?: string | null
          property_id: string
          requested_by?: string | null
          source_image_id?: string | null
          source_url: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          preset_code?: string
          processed_at?: string | null
          property_id?: string
          requested_by?: string | null
          source_image_id?: string | null
          source_url?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_queue_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_queue_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "property_images"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_listings: {
        Row: {
          ai_description: string | null
          ai_title: string | null
          ai_used: boolean
          attempts: number
          content_hash: string | null
          created_at: string
          external_id: string | null
          external_url: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          payload: Json | null
          portal_id: string
          price_at_publish: number | null
          priority: number
          property_id: string
          published_at: string | null
          removed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_description?: string | null
          ai_title?: string | null
          ai_used?: boolean
          attempts?: number
          content_hash?: string | null
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          payload?: Json | null
          portal_id: string
          price_at_publish?: number | null
          priority?: number
          property_id: string
          published_at?: string | null
          removed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_description?: string | null
          ai_title?: string | null
          ai_used?: boolean
          attempts?: number
          content_hash?: string | null
          created_at?: string
          external_id?: string | null
          external_url?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          payload?: Json | null
          portal_id?: string
          price_at_publish?: number | null
          priority?: number
          property_id?: string
          published_at?: string | null
          removed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_listings_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "listing_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_listings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_sync_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          duration_ms: number | null
          http_status: number | null
          id: string
          listing_id: string | null
          message: string | null
          payload: Json | null
          portal_id: string | null
          property_id: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          duration_ms?: number | null
          http_status?: number | null
          id?: string
          listing_id?: string | null
          message?: string | null
          payload?: Json | null
          portal_id?: string | null
          property_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          duration_ms?: number | null
          http_status?: number | null
          id?: string
          listing_id?: string | null
          message?: string | null
          payload?: Json | null
          portal_id?: string | null
          property_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sync_log_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "portal_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_sync_log_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "listing_portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_sync_log_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          crm_background_url: string | null
          crm_theme: Json
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          crm_background_url?: string | null
          crm_theme?: Json
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          crm_background_url?: string | null
          crm_theme?: Json
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          amenities: string[] | null
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          broker_id: string | null
          built_up_area_sqm: number | null
          city_id: string
          construction_type: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          floor: number | null
          has_garage: boolean | null
          heating: string | null
          id: string
          is_featured: boolean
          is_published: boolean
          land_regulation: string | null
          last_portal_sync_at: string | null
          office_class: string | null
          owner_id: string | null
          parking_spaces: number | null
          portal_published_count: number
          portals_enabled: boolean
          price: number
          property_type: Database["public"]["Enums"]["property_type"]
          quarter_id: string | null
          rooms: number | null
          status: Database["public"]["Enums"]["property_status"]
          title: string
          total_floors: number | null
          updated_at: string
          views_count: number
          village_id: string | null
          yard_sqm: number | null
          year_built: number | null
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          built_up_area_sqm?: number | null
          city_id: string
          construction_type?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          floor?: number | null
          has_garage?: boolean | null
          heating?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          land_regulation?: string | null
          last_portal_sync_at?: string | null
          office_class?: string | null
          owner_id?: string | null
          parking_spaces?: number | null
          portal_published_count?: number
          portals_enabled?: boolean
          price: number
          property_type?: Database["public"]["Enums"]["property_type"]
          quarter_id?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          total_floors?: number | null
          updated_at?: string
          views_count?: number
          village_id?: string | null
          yard_sqm?: number | null
          year_built?: number | null
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          broker_id?: string | null
          built_up_area_sqm?: number | null
          city_id?: string
          construction_type?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          floor?: number | null
          has_garage?: boolean | null
          heating?: string | null
          id?: string
          is_featured?: boolean
          is_published?: boolean
          land_regulation?: string | null
          last_portal_sync_at?: string | null
          office_class?: string | null
          owner_id?: string | null
          parking_spaces?: number | null
          portal_published_count?: number
          portals_enabled?: boolean
          price?: number
          property_type?: Database["public"]["Enums"]["property_type"]
          quarter_id?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          total_floors?: number | null
          updated_at?: string
          views_count?: number
          village_id?: string | null
          yard_sqm?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_quarter_id_fkey"
            columns: ["quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
        ]
      }
      property_copy: {
        Row: {
          ai_used: boolean
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          body: string | null
          bullets: string[]
          channel: string
          created_at: string
          created_by: string | null
          hashtags: string[]
          id: string
          issues: string[]
          language: string
          model: string | null
          prompt_hash: string | null
          property_id: string
          quality_score: number
          seo_description: string | null
          seo_keywords: string[]
          seo_score: number
          seo_title: string | null
          short_text: string | null
          slug: string | null
          status: string
          template_code: string
          title: string | null
          updated_at: string
          version: number
          word_count: number
        }
        Insert: {
          ai_used?: boolean
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          bullets?: string[]
          channel?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          issues?: string[]
          language?: string
          model?: string | null
          prompt_hash?: string | null
          property_id: string
          quality_score?: number
          seo_description?: string | null
          seo_keywords?: string[]
          seo_score?: number
          seo_title?: string | null
          short_text?: string | null
          slug?: string | null
          status?: string
          template_code?: string
          title?: string | null
          updated_at?: string
          version?: number
          word_count?: number
        }
        Update: {
          ai_used?: boolean
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string | null
          bullets?: string[]
          channel?: string
          created_at?: string
          created_by?: string | null
          hashtags?: string[]
          id?: string
          issues?: string[]
          language?: string
          model?: string | null
          prompt_hash?: string | null
          property_id?: string
          quality_score?: number
          seo_description?: string | null
          seo_keywords?: string[]
          seo_score?: number
          seo_title?: string | null
          short_text?: string | null
          slug?: string | null
          status?: string
          template_code?: string
          title?: string | null
          updated_at?: string
          version?: number
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_copy_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          doc_type: string
          file_name: string
          file_path: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          property_id: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          doc_type: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          property_id: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          doc_type?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          property_id?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_cover: boolean
          property_id: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_cover?: boolean
          property_id: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_cover?: boolean
          property_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_matches: {
        Row: {
          breakdown: Json
          client_id: string | null
          created_at: string
          feedback: string | null
          grade: string | null
          id: string
          lead_id: string | null
          match_reasons: Json | null
          mismatches: string[]
          notes: string | null
          notified: boolean
          notified_at: string | null
          property_id: string
          reasons: string[]
          responded_at: string | null
          score: number
          send_id: string | null
          sent_at: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          breakdown?: Json
          client_id?: string | null
          created_at?: string
          feedback?: string | null
          grade?: string | null
          id?: string
          lead_id?: string | null
          match_reasons?: Json | null
          mismatches?: string[]
          notes?: string | null
          notified?: boolean
          notified_at?: string | null
          property_id: string
          reasons?: string[]
          responded_at?: string | null
          score?: number
          send_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          breakdown?: Json
          client_id?: string | null
          created_at?: string
          feedback?: string | null
          grade?: string | null
          id?: string
          lead_id?: string | null
          match_reasons?: Json | null
          mismatches?: string[]
          notes?: string | null
          notified?: boolean
          notified_at?: string | null
          property_id?: string
          reasons?: string[]
          responded_at?: string | null
          score?: number
          send_id?: string | null
          sent_at?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_matches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_matches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      qualification_answers: {
        Row: {
          answers: Json
          created_at: string
          id: string
          ip: string | null
          landing_path: string | null
          lead_id: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          lead_id?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          ip?: string | null
          landing_path?: string | null
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_answers_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      quarter_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_cover: boolean
          quarter_id: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_cover?: boolean
          quarter_id: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_cover?: boolean
          quarter_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarter_images_quarter_id_fkey"
            columns: ["quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
            referencedColumns: ["id"]
          },
        ]
      }
      quarters: {
        Row: {
          avg_price_per_sqm: number | null
          city_id: string
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_published: boolean
          name: string
          properties_count: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          avg_price_per_sqm?: number | null
          city_id: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          name: string
          properties_count?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          avg_price_per_sqm?: number | null
          city_id?: string
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          name?: string
          properties_count?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarters_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_campaigns: {
        Row: {
          ai_personalize: boolean
          audience: string
          channel: string
          code: string
          created_at: string
          goal: string | null
          id: string
          inactive_days: number
          is_active: boolean
          max_steps: number
          name: string
          notes: string | null
          offer_text: string | null
          step_gap_days: number
          updated_at: string
        }
        Insert: {
          ai_personalize?: boolean
          audience?: string
          channel?: string
          code: string
          created_at?: string
          goal?: string | null
          id?: string
          inactive_days?: number
          is_active?: boolean
          max_steps?: number
          name: string
          notes?: string | null
          offer_text?: string | null
          step_gap_days?: number
          updated_at?: string
        }
        Update: {
          ai_personalize?: boolean
          audience?: string
          channel?: string
          code?: string
          created_at?: string
          goal?: string | null
          id?: string
          inactive_days?: number
          is_active?: boolean
          max_steps?: number
          name?: string
          notes?: string | null
          offer_text?: string | null
          step_gap_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      reactivation_enrollments: {
        Row: {
          ai_summary: string | null
          ai_updated_at: string | null
          attempts: number
          broker_id: string | null
          campaign_code: string
          channel: string
          client_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          inactive_days: number | null
          last_sent_at: string | null
          next_action_at: string
          opted_out_at: string | null
          revived_at: string | null
          revived_reason: string | null
          score: number
          score_reason: string | null
          status: string
          step_no: number
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          ai_updated_at?: string | null
          attempts?: number
          broker_id?: string | null
          campaign_code?: string
          channel?: string
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          inactive_days?: number | null
          last_sent_at?: string | null
          next_action_at?: string
          opted_out_at?: string | null
          revived_at?: string | null
          revived_reason?: string | null
          score?: number
          score_reason?: string | null
          status?: string
          step_no?: number
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          ai_updated_at?: string | null
          attempts?: number
          broker_id?: string | null
          campaign_code?: string
          channel?: string
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          inactive_days?: number | null
          last_sent_at?: string | null
          next_action_at?: string
          opted_out_at?: string | null
          revived_at?: string | null
          revived_reason?: string | null
          score?: number
          score_reason?: string | null
          status?: string
          step_no?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_enrollments_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactivation_enrollments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_events: {
        Row: {
          action: string
          actor: string | null
          campaign_code: string | null
          client_id: string | null
          created_at: string
          enrollment_id: string | null
          id: string
          message: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string | null
          campaign_code?: string | null
          client_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          message?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string | null
          campaign_code?: string | null
          client_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          id?: string
          message?: string | null
          status?: string
        }
        Relationships: []
      }
      reactivation_messages: {
        Row: {
          ai_used: boolean
          body: string | null
          campaign_code: string | null
          channel: string
          client_id: string | null
          created_at: string
          enrollment_id: string | null
          error: string | null
          id: string
          model: string | null
          recipient: string | null
          replied_at: string | null
          status: string
          step_no: number
          subject: string | null
          token: string
        }
        Insert: {
          ai_used?: boolean
          body?: string | null
          campaign_code?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          error?: string | null
          id?: string
          model?: string | null
          recipient?: string | null
          replied_at?: string | null
          status?: string
          step_no?: number
          subject?: string | null
          token?: string
        }
        Update: {
          ai_used?: boolean
          body?: string | null
          campaign_code?: string | null
          channel?: string
          client_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          error?: string | null
          id?: string
          model?: string | null
          recipient?: string | null
          replied_at?: string | null
          status?: string
          step_no?: number
          subject?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactivation_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactivation_messages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "reactivation_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      reactivation_templates: {
        Row: {
          body: string
          campaign_code: string
          channel: string
          created_at: string
          id: string
          is_active: boolean
          step_no: number
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          campaign_code?: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          step_no?: number
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          campaign_code?: string
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          step_no?: number
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rental_payments: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          document_mime: string | null
          document_name: string | null
          document_url: string | null
          due_date: string | null
          id: string
          notes: string | null
          paid_date: string | null
          period_month: string
          rental_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          document_mime?: string | null
          document_name?: string | null
          document_url?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          period_month: string
          rental_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          document_mime?: string | null
          document_name?: string | null
          document_url?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          paid_date?: string | null
          period_month?: string
          rental_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rental_payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          address: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deposit: number | null
          end_date: string | null
          id: string
          inventory: string | null
          landlord_client_id: string | null
          landlord_name: string | null
          landlord_phone: string | null
          management_fee: number | null
          monthly_rent: number | null
          notes: string | null
          payment_day: number | null
          property_id: string | null
          quarter_id: string | null
          start_date: string | null
          status: string
          tenant_client_id: string | null
          tenant_name: string | null
          tenant_phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit?: number | null
          end_date?: string | null
          id?: string
          inventory?: string | null
          landlord_client_id?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          management_fee?: number | null
          monthly_rent?: number | null
          notes?: string | null
          payment_day?: number | null
          property_id?: string | null
          quarter_id?: string | null
          start_date?: string | null
          status?: string
          tenant_client_id?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit?: number | null
          end_date?: string | null
          id?: string
          inventory?: string | null
          landlord_client_id?: string | null
          landlord_name?: string | null
          landlord_phone?: string | null
          management_fee?: number | null
          monthly_rent?: number | null
          notes?: string | null
          payment_day?: number | null
          property_id?: string | null
          quarter_id?: string | null
          start_date?: string | null
          status?: string
          tenant_client_id?: string | null
          tenant_name?: string | null
          tenant_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_landlord_client_id_fkey"
            columns: ["landlord_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_quarter_id_fkey"
            columns: ["quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_tenant_client_id_fkey"
            columns: ["tenant_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      review_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          deal_id: string | null
          id: string
          message: string | null
          request_id: string | null
          review_id: string | null
          status: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          message?: string | null
          request_id?: string | null
          review_id?: string | null
          status?: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          message?: string | null
          request_id?: string | null
          review_id?: string | null
          status?: string
        }
        Relationships: []
      }
      review_platforms: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          min_rating_to_redirect: number
          name: string
          notes: string | null
          priority: number
          review_url: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_rating_to_redirect?: number
          name: string
          notes?: string | null
          priority?: number
          review_url?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_rating_to_redirect?: number
          name?: string
          notes?: string | null
          priority?: number
          review_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          ai_used: boolean
          attempts: number
          body: string | null
          broker_id: string | null
          channel: string
          click_count: number
          clicked_at: string | null
          client_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          deal_id: string | null
          error: string | null
          feedback: string | null
          id: string
          model: string | null
          owner_id: string | null
          platform_code: string
          property_id: string | null
          rated_at: string | null
          rating: number | null
          scheduled_at: string
          sent_at: string | null
          sentiment: string | null
          status: string
          step_no: number
          subject: string | null
          template_code: string | null
          token: string
          updated_at: string
        }
        Insert: {
          ai_used?: boolean
          attempts?: number
          body?: string | null
          broker_id?: string | null
          channel?: string
          click_count?: number
          clicked_at?: string | null
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          error?: string | null
          feedback?: string | null
          id?: string
          model?: string | null
          owner_id?: string | null
          platform_code?: string
          property_id?: string | null
          rated_at?: string | null
          rating?: number | null
          scheduled_at?: string
          sent_at?: string | null
          sentiment?: string | null
          status?: string
          step_no?: number
          subject?: string | null
          template_code?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          ai_used?: boolean
          attempts?: number
          body?: string | null
          broker_id?: string | null
          channel?: string
          click_count?: number
          clicked_at?: string | null
          client_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          deal_id?: string | null
          error?: string | null
          feedback?: string | null
          id?: string
          model?: string | null
          owner_id?: string | null
          platform_code?: string
          property_id?: string | null
          rated_at?: string | null
          rating?: number | null
          scheduled_at?: string
          sent_at?: string | null
          sentiment?: string | null
          status?: string
          step_no?: number
          subject?: string | null
          template_code?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_requests_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      review_templates: {
        Row: {
          body: string
          channel: string
          code: string
          created_at: string
          deal_type: string | null
          id: string
          is_active: boolean
          name: string
          step_no: number
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          code: string
          created_at?: string
          deal_type?: string | null
          id?: string
          is_active?: boolean
          name: string
          step_no?: number
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          code?: string
          created_at?: string
          deal_type?: string | null
          id?: string
          is_active?: boolean
          name?: string
          step_no?: number
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          ai_reply: string | null
          ai_summary: string | null
          author_email: string | null
          author_name: string | null
          body: string | null
          broker_id: string | null
          client_id: string | null
          created_at: string
          deal_id: string | null
          external_id: string | null
          external_url: string | null
          id: string
          is_featured: boolean
          is_public: boolean
          platform_code: string
          rating: number
          reply_sent_at: string | null
          request_id: string | null
          sentiment: string | null
          source: string
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          ai_reply?: string | null
          ai_summary?: string | null
          author_email?: string | null
          author_name?: string | null
          body?: string | null
          broker_id?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          platform_code?: string
          rating?: number
          reply_sent_at?: string | null
          request_id?: string | null
          sentiment?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          ai_reply?: string | null
          ai_summary?: string | null
          author_email?: string | null
          author_name?: string | null
          body?: string | null
          broker_id?: string | null
          client_id?: string | null
          created_at?: string
          deal_id?: string | null
          external_id?: string | null
          external_url?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          platform_code?: string
          rating?: number
          reply_sent_at?: string | null
          request_id?: string | null
          sentiment?: string | null
          source?: string
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "review_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_migrations: {
        Row: {
          applied_at: string
          checksum: string | null
          version: string
        }
        Insert: {
          applied_at?: string
          checksum?: string | null
          version: string
        }
        Update: {
          applied_at?: string
          checksum?: string | null
          version?: string
        }
        Relationships: []
      }
      seller_events: {
        Row: {
          actor: string | null
          created_at: string
          event_type: string
          id: string
          message: string | null
          payload: Json
          prospect_id: string | null
          status: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          payload?: Json
          prospect_id?: string | null
          status?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          payload?: Json
          prospect_id?: string | null
          status?: string
        }
        Relationships: []
      }
      seller_outreach: {
        Row: {
          actor: string | null
          ai_used: boolean
          body: string | null
          broker_id: string | null
          channel: string
          created_at: string
          direction: string
          id: string
          outcome: string | null
          prospect_id: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
        }
        Insert: {
          actor?: string | null
          ai_used?: boolean
          body?: string | null
          broker_id?: string | null
          channel?: string
          created_at?: string
          direction?: string
          id?: string
          outcome?: string | null
          prospect_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Update: {
          actor?: string | null
          ai_used?: boolean
          body?: string | null
          broker_id?: string | null
          channel?: string
          created_at?: string
          direction?: string
          id?: string
          outcome?: string | null
          prospect_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_outreach_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_prospects: {
        Row: {
          address: string | null
          ai_pitch: string | null
          ai_reasoning: string | null
          ai_updated_at: string | null
          area: number | null
          broker_id: string | null
          build_year: number | null
          city: string | null
          client_id: string | null
          created_at: string
          currency: string
          district: string | null
          email: string | null
          estimated_price: number | null
          expected_window: string | null
          full_name: string | null
          id: string
          last_contacted_at: string | null
          next_action_at: string | null
          notes: string | null
          opted_out: boolean
          ownership_years: number | null
          phone: string | null
          probability: number | null
          property_id: string | null
          property_type: string | null
          rooms: number | null
          score: number
          source: string
          source_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          ai_pitch?: string | null
          ai_reasoning?: string | null
          ai_updated_at?: string | null
          area?: number | null
          broker_id?: string | null
          build_year?: number | null
          city?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          district?: string | null
          email?: string | null
          estimated_price?: number | null
          expected_window?: string | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          next_action_at?: string | null
          notes?: string | null
          opted_out?: boolean
          ownership_years?: number | null
          phone?: string | null
          probability?: number | null
          property_id?: string | null
          property_type?: string | null
          rooms?: number | null
          score?: number
          source?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          ai_pitch?: string | null
          ai_reasoning?: string | null
          ai_updated_at?: string | null
          area?: number | null
          broker_id?: string | null
          build_year?: number | null
          city?: string | null
          client_id?: string | null
          created_at?: string
          currency?: string
          district?: string | null
          email?: string | null
          estimated_price?: number | null
          expected_window?: string | null
          full_name?: string | null
          id?: string
          last_contacted_at?: string | null
          next_action_at?: string | null
          notes?: string | null
          opted_out?: boolean
          ownership_years?: number | null
          phone?: string | null
          probability?: number | null
          property_id?: string | null
          property_type?: string | null
          rooms?: number | null
          score?: number
          source?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      seller_signal_rules: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          updated_at: string
          weight: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          updated_at?: string
          weight?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      seller_signals: {
        Row: {
          created_at: string
          detected_at: string
          id: string
          prospect_id: string | null
          signal_code: string
          source: string | null
          value: string | null
          weight: number
        }
        Insert: {
          created_at?: string
          detected_at?: string
          id?: string
          prospect_id?: string | null
          signal_code: string
          source?: string | null
          value?: string | null
          weight?: number
        }
        Update: {
          created_at?: string
          detected_at?: string
          id?: string
          prospect_id?: string | null
          signal_code?: string
          source?: string | null
          value?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "seller_signals_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "seller_prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          priority: string
          property_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          property_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          priority?: string
          property_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string | null
        }
        Relationships: []
      }
      theme_settings: {
        Row: {
          created_at: string
          id: string
          presets: Json
          singleton: boolean
          tokens: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          presets?: Json
          singleton?: boolean
          tokens?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          presets?: Json
          singleton?: boolean
          tokens?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      viewing_availability: {
        Row: {
          agent_id: string | null
          created_at: string
          end_hour: number
          id: string
          is_active: boolean
          slot_minutes: number
          start_hour: number
          weekday: number
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          end_hour?: number
          id?: string
          is_active?: boolean
          slot_minutes?: number
          start_hour?: number
          weekday: number
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          end_hour?: number
          id?: string
          is_active?: boolean
          slot_minutes?: number
          start_hour?: number
          weekday?: number
        }
        Relationships: []
      }
      viewing_blackouts: {
        Row: {
          agent_id: string | null
          created_at: string
          ends_at: string
          id: string
          reason: string | null
          starts_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          ends_at: string
          id?: string
          reason?: string | null
          starts_at: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          reason?: string | null
          starts_at?: string
        }
        Relationships: []
      }
      viewing_reminders: {
        Row: {
          ai_used: boolean
          body: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          kind: string
          model: string | null
          recipient: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string | null
          viewing_id: string
        }
        Insert: {
          ai_used?: boolean
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          model?: string | null
          recipient?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          viewing_id: string
        }
        Update: {
          ai_used?: boolean
          body?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          model?: string | null
          recipient?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          viewing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_reminders_viewing_id_fkey"
            columns: ["viewing_id"]
            isOneToOne: false
            referencedRelation: "viewings"
            referencedColumns: ["id"]
          },
        ]
      }
      viewings: {
        Row: {
          agent_email: string | null
          agent_id: string | null
          agent_name: string | null
          agent_phone: string | null
          ai_used: boolean
          cancel_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          confirmed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          duration_min: number
          feedback: string | null
          feedback_at: string | null
          id: string
          internal_notes: string | null
          lead_id: string | null
          location: string | null
          notes: string | null
          outcome: string | null
          outcome_notes: string | null
          property_id: string | null
          rating: number | null
          reminders_sent: number
          reschedule_count: number
          rescheduled_from: string | null
          scheduled_at: string
          source: string
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          agent_email?: string | null
          agent_id?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          ai_used?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          feedback?: string | null
          feedback_at?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          property_id?: string | null
          rating?: number | null
          reminders_sent?: number
          reschedule_count?: number
          rescheduled_from?: string | null
          scheduled_at: string
          source?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          agent_email?: string | null
          agent_id?: string | null
          agent_name?: string | null
          agent_phone?: string | null
          ai_used?: boolean
          cancel_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          duration_min?: number
          feedback?: string | null
          feedback_at?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          property_id?: string | null
          rating?: number | null
          reminders_sent?: number
          reschedule_count?: number
          rescheduled_from?: string | null
          scheduled_at?: string
          source?: string
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      villages: {
        Row: {
          created_at: string
          distance_km: number | null
          id: string
          lat: number | null
          lng: number | null
          municipality_slug: string | null
          name: string
          oblast_slug: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          distance_km?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality_slug?: string | null
          name: string
          oblast_slug: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          distance_km?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          municipality_slug?: string | null
          name?: string
          oblast_slug?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      visual_board_pages: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          approved_by_name: string | null
          created_at: string
          id: string
          match_percent: number | null
          notes: string | null
          route: string
          stage_flags: Json
          updated_at: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          id?: string
          match_percent?: number | null
          notes?: string | null
          route: string
          stage_flags?: Json
          updated_at?: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          approved_by_name?: string | null
          created_at?: string
          id?: string
          match_percent?: number | null
          notes?: string | null
          route?: string
          stage_flags?: Json
          updated_at?: string
        }
        Relationships: []
      }
      visual_board_stages: {
        Row: {
          created_at: string
          created_by: string | null
          detail: string | null
          done: boolean
          done_at: string | null
          done_by_name: string | null
          id: string
          position: number
          route: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          done?: boolean
          done_at?: string | null
          done_by_name?: string | null
          id?: string
          position?: number
          route: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detail?: string | null
          done?: boolean
          done_at?: string | null
          done_by_name?: string | null
          id?: string
          position?: number
          route?: string
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_automation_job: {
        Args: { _key: string; _lease_seconds: number }
        Returns: boolean
      }
      current_broker_id: { Args: { _user_id: string }; Returns: string }
      customer_chat_append_message: {
        Args: {
          p_chat_id: string
          p_content: string
          p_role: string
          p_visitor_token: string
        }
        Returns: undefined
      }
      customer_chat_list_messages: {
        Args: { p_chat_id: string; p_limit?: number; p_visitor_token: string }
        Returns: {
          content: string
          created_at: string
          role: string
        }[]
      }
      customer_chat_open: {
        Args: {
          p_chat_id?: string
          p_page_url?: string
          p_property_id?: string
          p_visitor_email?: string
          p_visitor_name?: string
          p_visitor_phone?: string
          p_visitor_token: string
        }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      exec_sql: { Args: { query: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_crm_staff: { Args: { _user_id: string }; Returns: boolean }
      is_full_access: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_contract_number: { Args: { _prefix?: string }; Returns: string }
      next_deal_number: { Args: { _prefix?: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      visitor_prepare_customer_chat: {
        Args: {
          p_chat_id?: string
          p_message?: string
          p_page_url?: string
          p_property_id?: string
          p_visitor_email?: string
          p_visitor_name?: string
          p_visitor_phone?: string
          p_visitor_token: string
        }
        Returns: Json
      }
      visitor_save_customer_reply: {
        Args: { p_chat_id: string; p_reply: string; p_visitor_token: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "agent"
        | "user"
        | "broker"
        | "head_broker"
        | "consultant"
        | "rental_dept"
        | "boss"
        | "secretary"
      extracted_source:
        | "realistimo"
        | "imoti_bg"
        | "olx"
        | "bazar_bg"
        | "home_bg"
        | "alo_bg"
        | "facebook"
        | "other"
      extracted_status: "pending" | "approved" | "rejected" | "published"
      inquiry_status: "new" | "in_progress" | "closed"
      property_status: "sale" | "rent"
      property_type: "apartment" | "house" | "office" | "land" | "commercial"
      seller_type: "private" | "agency" | "unknown"
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
      app_role: [
        "admin",
        "agent",
        "user",
        "broker",
        "head_broker",
        "consultant",
        "rental_dept",
        "boss",
        "secretary",
      ],
      extracted_source: [
        "realistimo",
        "imoti_bg",
        "olx",
        "bazar_bg",
        "home_bg",
        "alo_bg",
        "facebook",
        "other",
      ],
      extracted_status: ["pending", "approved", "rejected", "published"],
      inquiry_status: ["new", "in_progress", "closed"],
      property_status: ["sale", "rent"],
      property_type: ["apartment", "house", "office", "land", "commercial"],
      seller_type: ["private", "agency", "unknown"],
    },
  },
} as const
