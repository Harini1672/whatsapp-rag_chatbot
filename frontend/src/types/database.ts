export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      chatbots: {
        Row: {
          id: string
          org_id: string
          name: string
          personality: string
          welcome_message: string
          language: string
          tone: string
          response_mode: 'text' | 'audio' | 'text_to_audio' | 'audio_to_audio'
          max_response_length: number
          human_support_enabled: boolean
          confidence_threshold: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['chatbots']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['chatbots']['Insert']>
      }
      whatsapp_connections: {
        Row: {
          id: string
          chatbot_id: string
          org_id: string
          session_id: string
          api_key: string
          phone_number: string
          status: 'connected' | 'disconnected' | 'pending'
          webhook_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['whatsapp_connections']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['whatsapp_connections']['Insert']>
      }
      documents: {
        Row: {
          id: string
          org_id: string
          chatbot_id: string
          name: string
          file_path: string
          file_type: string
          file_size: number
          status: 'pending' | 'processing' | 'indexed' | 'error'
          chunk_count: number
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }
      conversations: {
        Row: {
          id: string
          org_id: string
          chatbot_id: string
          user_phone: string
          status: 'active' | 'human_takeover' | 'resolved'
          message_count: number
          last_message_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          org_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          message_type: 'text' | 'audio'
          source_documents: Json | null
          confidence_score: number | null
          wa_message_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }
      support_requests: {
        Row: {
          id: string
          conversation_id: string
          org_id: string
          user_phone: string
          reason: string
          status: 'pending' | 'in_progress' | 'resolved'
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['support_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['support_requests']['Insert']>
      }
      feedback: {
        Row: {
          id: string
          message_id: string
          conversation_id: string
          org_id: string
          rating: 'positive' | 'negative'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['feedback']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['feedback']['Insert']>
      }
      analytics_events: {
        Row: {
          id: string
          org_id: string
          chatbot_id: string
          event_type: string
          metadata: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['analytics_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['analytics_events']['Insert']>
      }
    }
  }
}

// Convenience types
export type Organization = Database['public']['Tables']['organizations']['Row']
export type Chatbot = Database['public']['Tables']['chatbots']['Row']
export type WhatsAppConnection = Database['public']['Tables']['whatsapp_connections']['Row']
export type Document = Database['public']['Tables']['documents']['Row']
export type Conversation = Database['public']['Tables']['conversations']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type SupportRequest = Database['public']['Tables']['support_requests']['Row']
export type Feedback = Database['public']['Tables']['feedback']['Row']
