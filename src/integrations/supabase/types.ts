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
          drive_folder_id: string | null
          drive_folder_path: string | null
          drive_sync_status: string
          floor: number | null
          id: string
          images: Json
          notes: string | null
          phone: string | null
          price: number | null
          property_type: string | null
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
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_sync_status?: string
          floor?: number | null
          id?: string
          images?: Json
          notes?: string | null
          phone?: string | null
          price?: number | null
          property_type?: string | null
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
          drive_folder_id?: string | null
          drive_folder_path?: string | null
          drive_sync_status?: string
          floor?: number | null
          id?: string
          images?: Json
          notes?: string | null
          phone?: string | null
          price?: number | null
          property_type?: string | null
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
            foreignKeyName: "archived_properties_quarter_id_fkey"
            columns: ["quarter_id"]
            isOneToOne: false
            referencedRelation: "quarters"
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
            foreignKeyName: "broker_tasks_broker_id_fkey"
            columns: ["broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_public"
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
        }
        Relationships: [
          {
            foreignKeyName: "client_documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
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
          email: string | null
          full_name: string
          id: string
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
          email?: string | null
          full_name: string
          id?: string
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
          email?: string | null
          full_name?: string
          id?: string
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
            foreignKeyName: "clients_assigned_broker_id_fkey"
            columns: ["assigned_broker_id"]
            isOneToOne: false
            referencedRelation: "brokers_public"
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
      contract_templates: {
        Row: {
          contract_type: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          template_content: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          contract_type: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          template_content: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          contract_type?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          template_content?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
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
      generated_contracts: {
        Row: {
          client_id: string | null
          content: string
          contract_type: string
          created_at: string
          created_by: string | null
          id: string
          property_id: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          content: string
          contract_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          property_id?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          content?: string
          contract_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          property_id?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_contracts_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
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
          page_key: string
          sections: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          page_key: string
          sections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          page_key?: string
          sections?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          office_class: string | null
          owner_id: string | null
          parking_spaces: number | null
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
          office_class?: string | null
          owner_id?: string | null
          parking_spaces?: number | null
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
          office_class?: string | null
          owner_id?: string | null
          parking_spaces?: number | null
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
          client_id: string
          created_at: string
          id: string
          match_reasons: Json | null
          notes: string | null
          notified: boolean
          property_id: string
          score: number
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          match_reasons?: Json | null
          notes?: string | null
          notified?: boolean
          property_id: string
          score?: number
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          match_reasons?: Json | null
          notes?: string | null
          notified?: boolean
          property_id?: string
          score?: number
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
            foreignKeyName: "property_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
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
    }
    Views: {
      brokers_public: {
        Row: {
          bio: string | null
          clients_count: number | null
          created_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          photo_url: string | null
          properties_count: number | null
          updated_at: string | null
        }
        Insert: {
          bio?: string | null
          clients_count?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          photo_url?: string | null
          properties_count?: number | null
          updated_at?: string | null
        }
        Update: {
          bio?: string | null
          clients_count?: number | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_active?: boolean | null
          photo_url?: string | null
          properties_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
      app_role: [
        "admin",
        "agent",
        "user",
        "broker",
        "head_broker",
        "consultant",
        "rental_dept",
        "boss",
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
