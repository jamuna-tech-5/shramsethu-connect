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
      admin_actions: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          note: string | null
          target_document_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          note?: string | null
          target_document_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          note?: string | null
          target_document_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          kind: Database["public"]["Enums"]["doc_kind"]
          mime_type: string | null
          rejection_reason: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["doc_status"]
          storage_path: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind: Database["public"]["Enums"]["doc_kind"]
          mime_type?: string | null
          rejection_reason?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["doc_kind"]
          mime_type?: string | null
          rejection_reason?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["doc_status"]
          storage_path?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string
          relation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gigscore_snapshots: {
        Row: {
          breakdown: Json
          computed_at: string
          id: string
          score: number
          user_id: string
        }
        Insert: {
          breakdown?: Json
          computed_at?: string
          id?: string
          score: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          computed_at?: string
          id?: string
          score?: number
          user_id?: string
        }
        Relationships: []
      }
      income_sources: {
        Row: {
          created_at: string
          external_ref: string | null
          id: string
          kind: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_ref?: string | null
          id?: string
          kind: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_ref?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      insurance_policies: {
        Row: {
          cover_amount: number | null
          created_at: string
          ends_on: string | null
          id: string
          policy_number: string | null
          policy_type: string | null
          premium_amount: number | null
          premium_frequency: string | null
          provider: string
          starts_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_amount?: number | null
          created_at?: string
          ends_on?: string | null
          id?: string
          policy_number?: string | null
          policy_type?: string | null
          premium_amount?: number | null
          premium_frequency?: string | null
          provider: string
          starts_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_amount?: number | null
          created_at?: string
          ends_on?: string | null
          id?: string
          policy_number?: string | null
          policy_type?: string | null
          premium_amount?: number | null
          premium_frequency?: string | null
          provider?: string
          starts_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_applications: {
        Row: {
          amount: number
          created_at: string
          decided_amount: number | null
          gigscore_at_apply: number | null
          id: string
          monthly_income_at_apply: number | null
          notes: string | null
          purpose: string | null
          status: Database["public"]["Enums"]["application_status"]
          tenure_months: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          decided_amount?: number | null
          gigscore_at_apply?: number | null
          id?: string
          monthly_income_at_apply?: number | null
          notes?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tenure_months?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          decided_amount?: number | null
          gigscore_at_apply?: number | null
          id?: string
          monthly_income_at_apply?: number | null
          notes?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          tenure_months?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      location_pings: {
        Row: {
          accuracy: number | null
          captured_at: string
          id: string
          lat: number
          lng: number
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          captured_at?: string
          id?: string
          lat: number
          lng: number
          user_id: string
        }
        Update: {
          accuracy?: number | null
          captured_at?: string
          id?: string
          lat?: number
          lng?: number
          user_id?: string
        }
        Relationships: []
      }
      location_shares: {
        Row: {
          active: boolean
          ended_at: string | null
          id: string
          latest_lat: number | null
          latest_lng: number | null
          message: string | null
          mode: string
          recipient_id: string
          sender_id: string
          started_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          ended_at?: string | null
          id?: string
          latest_lat?: number | null
          latest_lng?: number | null
          message?: string | null
          mode: string
          recipient_id: string
          sender_id: string
          started_at?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          ended_at?: string | null
          id?: string
          latest_lat?: number | null
          latest_lng?: number | null
          message?: string | null
          mode?: string
          recipient_id?: string
          sender_id?: string
          started_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notif_kind"]
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notif_kind"]
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notif_kind"]
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          blocked: boolean
          category: Database["public"]["Enums"]["work_category"] | null
          created_at: string
          email: string | null
          emergency_name: string | null
          emergency_phone: string | null
          experience: string | null
          full_name: string | null
          id: string
          id_doc_name: string | null
          languages: string | null
          location: string | null
          onboarded: boolean
          phone: string | null
          photo_url: string | null
          skills: string | null
          status: Database["public"]["Enums"]["worker_status"]
          updated_at: string
          work_type: string | null
        }
        Insert: {
          blocked?: boolean
          category?: Database["public"]["Enums"]["work_category"] | null
          created_at?: string
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          experience?: string | null
          full_name?: string | null
          id: string
          id_doc_name?: string | null
          languages?: string | null
          location?: string | null
          onboarded?: boolean
          phone?: string | null
          photo_url?: string | null
          skills?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          updated_at?: string
          work_type?: string | null
        }
        Update: {
          blocked?: boolean
          category?: Database["public"]["Enums"]["work_category"] | null
          created_at?: string
          email?: string | null
          emergency_name?: string | null
          emergency_phone?: string | null
          experience?: string | null
          full_name?: string | null
          id?: string
          id_doc_name?: string | null
          languages?: string | null
          location?: string | null
          onboarded?: boolean
          phone?: string | null
          photo_url?: string | null
          skills?: string | null
          status?: Database["public"]["Enums"]["worker_status"]
          updated_at?: string
          work_type?: string | null
        }
        Relationships: []
      }
      savings_goals: {
        Row: {
          created_at: string
          id: string
          name: string
          saved_amount: number
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          saved_amount?: number
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          saved_amount?: number
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheme_applications: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          notes: string | null
          scheme_id: string
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          scheme_id: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          notes?: string | null
          scheme_id?: string
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheme_applications_scheme_id_fkey"
            columns: ["scheme_id"]
            isOneToOne: false
            referencedRelation: "schemes"
            referencedColumns: ["id"]
          },
        ]
      }
      schemes: {
        Row: {
          active: boolean
          authority: string | null
          benefits: string | null
          category: string | null
          code: string
          created_at: string
          eligibility: string | null
          id: string
          name: string
          summary: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          active?: boolean
          authority?: string | null
          benefits?: string | null
          category?: string | null
          code: string
          created_at?: string
          eligibility?: string | null
          id?: string
          name: string
          summary?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          active?: boolean
          authority?: string | null
          benefits?: string | null
          category?: string | null
          code?: string
          created_at?: string
          eligibility?: string | null
          id?: string
          name?: string
          summary?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      sos_events: {
        Row: {
          id: string
          lat: number | null
          lng: number | null
          message: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["sos_status"]
          triggered_at: string
          user_id: string
        }
        Insert: {
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["sos_status"]
          triggered_at?: string
          user_id: string
        }
        Update: {
          id?: string
          lat?: number | null
          lng?: number | null
          message?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["sos_status"]
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          id: string
          note: string | null
          occurred_on: string
          source: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          source?: string | null
          type: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          id?: string
          note?: string | null
          occurred_on?: string
          source?: string | null
          type?: Database["public"]["Enums"]["txn_type"]
          updated_at?: string
          user_id?: string
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
      user_settings: {
        Row: {
          created_at: string
          dark_mode: boolean
          language: string
          location_sharing: boolean
          notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dark_mode?: boolean
          language?: string
          location_sharing?: boolean
          notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dark_mode?: boolean
          language?: string
          location_sharing?: boolean
          notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_history: {
        Row: {
          category: Database["public"]["Enums"]["work_category"] | null
          created_at: string
          earnings: number | null
          employer: string | null
          ended_on: string | null
          id: string
          notes: string | null
          on_time: boolean | null
          started_on: string | null
          title: string
          updated_at: string
          user_id: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["work_category"] | null
          created_at?: string
          earnings?: number | null
          employer?: string | null
          ended_on?: string | null
          id?: string
          notes?: string | null
          on_time?: boolean | null
          started_on?: string | null
          title: string
          updated_at?: string
          user_id: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["work_category"] | null
          created_at?: string
          earnings?: number | null
          employer?: string | null
          ended_on?: string | null
          id?: string
          notes?: string | null
          on_time?: boolean | null
          started_on?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_review_document: {
        Args: { _decision: string; _doc_id: string; _note?: string }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recompute_gigscore: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      application_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
      doc_kind: "aadhaar" | "pan" | "license" | "other" | "bank" | "identity"
      doc_status: "not_uploaded" | "pending" | "verified" | "rejected"
      notif_kind: "info" | "success" | "warning" | "alert"
      sos_status: "active" | "resolved" | "cancelled"
      txn_type: "income" | "expense"
      work_category:
        | "Delivery Partner"
        | "Driver"
        | "Construction Worker"
        | "Freelancer"
        | "Daily Wage Worker"
        | "Other"
      worker_status: "online" | "offline" | "on_duty" | "available"
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
      app_role: ["admin", "moderator", "user"],
      application_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
      ],
      doc_kind: ["aadhaar", "pan", "license", "other", "bank", "identity"],
      doc_status: ["not_uploaded", "pending", "verified", "rejected"],
      notif_kind: ["info", "success", "warning", "alert"],
      sos_status: ["active", "resolved", "cancelled"],
      txn_type: ["income", "expense"],
      work_category: [
        "Delivery Partner",
        "Driver",
        "Construction Worker",
        "Freelancer",
        "Daily Wage Worker",
        "Other",
      ],
      worker_status: ["online", "offline", "on_duty", "available"],
    },
  },
} as const
