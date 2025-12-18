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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      goal_completion_notifications: {
        Row: {
          completed_at: string
          goal_type: string
          id: number
          is_deleted: boolean
          is_redeemed: boolean
          project_goal_id: number
          project_id: number
          reward: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string
          goal_type: string
          id?: number
          is_deleted?: boolean
          is_redeemed?: boolean
          project_goal_id: number
          project_id: number
          reward?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string
          goal_type?: string
          id?: number
          is_deleted?: boolean
          is_redeemed?: boolean
          project_goal_id?: number
          project_id?: number
          reward?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_completion_notifications_project_goal_id_fkey"
            columns: ["project_goal_id"]
            isOneToOne: false
            referencedRelation: "project_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_completion_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_settings: {
        Row: {
          calendar_id: string | null
          created_at: string | null
          id: string
          last_sync_time: string | null
          refresh_token: string | null
          sync_enabled: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          last_sync_time?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          calendar_id?: string | null
          created_at?: string | null
          id?: string
          last_sync_time?: string | null
          refresh_token?: string | null
          sync_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_goals: {
        Row: {
          created_at: string
          current_count: number
          end_date: string | null
          goal_type: string
          id: number
          is_enabled: boolean
          project_id: number
          reward: string | null
          start_date: string
          task_count_goal: number
          user_id: string
        }
        Insert: {
          created_at?: string
          current_count?: number
          end_date?: string | null
          goal_type: string
          id?: number
          is_enabled?: boolean
          project_id: number
          reward?: string | null
          start_date: string
          task_count_goal?: number
          user_id: string
        }
        Update: {
          created_at?: string
          current_count?: number
          end_date?: string | null
          goal_type?: string
          id?: number
          is_enabled?: boolean
          project_id?: number
          reward?: string | null
          start_date?: string
          task_count_goal?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_notifications: {
        Row: {
          created_at: string | null
          days_remaining: number
          due_date: string
          id: number
          is_read: boolean | null
          project_id: number | null
          project_name: string
        }
        Insert: {
          created_at?: string | null
          days_remaining: number
          due_date: string
          id?: number
          is_read?: boolean | null
          project_id?: number | null
          project_name: string
        }
        Update: {
          created_at?: string | null
          days_remaining?: number
          due_date?: string
          id?: number
          is_read?: boolean | null
          project_id?: number | null
          project_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      Projects: {
        Row: {
          archived: boolean | null
          created_at: string
          date_due: string | null
          date_started: string | null
          id: number
          isRecurring: boolean | null
          position: number | null
          progress: Database["public"]["Enums"]["status"] | null
          "Project Name": string
          project_order: number | null
          recurringTaskCount: number | null
          sort_order: number
          task_list_id: number | null
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string
          date_due?: string | null
          date_started?: string | null
          id?: number
          isRecurring?: boolean | null
          position?: number | null
          progress?: Database["public"]["Enums"]["status"] | null
          "Project Name": string
          project_order?: number | null
          recurringTaskCount?: number | null
          sort_order?: number
          task_list_id?: number | null
          user_id: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string
          date_due?: string | null
          date_started?: string | null
          id?: number
          isRecurring?: boolean | null
          position?: number | null
          progress?: Database["public"]["Enums"]["status"] | null
          "Project Name"?: string
          project_order?: number | null
          recurringTaskCount?: number | null
          sort_order?: number
          task_list_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Projects_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "TaskLists"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_project_settings: {
        Row: {
          created_at: string
          days_of_week: string[]
          id: number
          project_id: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          days_of_week?: string[]
          id?: number
          project_id: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          days_of_week?: string[]
          id?: number
          project_id?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_project_settings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "Projects"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_task_generation_logs: {
        Row: {
          generation_date: string
          id: number
          project_id: number | null
          setting_id: number | null
          task_list_id: number | null
          tasks_generated: number
          user_id: string | null
        }
        Insert: {
          generation_date?: string
          id?: number
          project_id?: number | null
          setting_id?: number | null
          task_list_id?: number | null
          tasks_generated?: number
          user_id?: string | null
        }
        Update: {
          generation_date?: string
          id?: number
          project_id?: number | null
          setting_id?: number | null
          task_list_id?: number | null
          tasks_generated?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_generation_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "Projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_task_generation_logs_setting_id_fkey"
            columns: ["setting_id"]
            isOneToOne: false
            referencedRelation: "recurring_task_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_task_generation_logs_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "TaskLists"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_task_settings: {
        Row: {
          archived: boolean | null
          created_at: string | null
          daily_task_count: number | null
          days_of_week: string[] | null
          enabled: boolean | null
          id: number
          subtask_names: string[] | null
          task_list_id: number | null
          updated_at: string | null
        }
        Insert: {
          archived?: boolean | null
          created_at?: string | null
          daily_task_count?: number | null
          days_of_week?: string[] | null
          enabled?: boolean | null
          id?: number
          subtask_names?: string[] | null
          task_list_id?: number | null
          updated_at?: string | null
        }
        Update: {
          archived?: boolean | null
          created_at?: string | null
          daily_task_count?: number | null
          days_of_week?: string[] | null
          enabled?: boolean | null
          id?: number
          subtask_names?: string[] | null
          task_list_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_settings_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "TaskLists"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          id: number
          "Parent Task ID": number | null
          Progress: Database["public"]["Enums"]["status"] | null
          "Task Name": string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          "Parent Task ID"?: number | null
          Progress?: Database["public"]["Enums"]["status"] | null
          "Task Name"?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          "Parent Task ID"?: number | null
          Progress?: Database["public"]["Enums"]["status"] | null
          "Task Name"?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_Parent Task ID_fkey"
            columns: ["Parent Task ID"]
            isOneToOne: false
            referencedRelation: "Tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      synced_calendar_events: {
        Row: {
          created_at: string | null
          google_event_id: string
          id: string
          last_sync_time: string | null
          task_id: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          google_event_id: string
          id?: string
          last_sync_time?: string | null
          task_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          google_event_id?: string
          id?: string
          last_sync_time?: string | null
          task_id?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "synced_calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "Tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      TaskLists: {
        Row: {
          archived: boolean | null
          color: string | null
          created_at: string
          id: number
          last_tasks_added_at: string | null
          name: string
          order: number
          position: number | null
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          color?: string | null
          created_at?: string
          id?: number
          last_tasks_added_at?: string | null
          name: string
          order?: number
          position?: number | null
          user_id: string
        }
        Update: {
          archived?: boolean | null
          color?: string | null
          created_at?: string
          id?: number
          last_tasks_added_at?: string | null
          name?: string
          order?: number
          position?: number | null
          user_id?: string
        }
        Relationships: []
      }
      Tasks: {
        Row: {
          archived: boolean | null
          created_at: string
          date_due: string | null
          date_started: string | null
          delay_type: string | null
          delay_value: string | null
          details: Json | null
          id: number
          order: number
          position: number | null
          Progress: Database["public"]["Enums"]["status"] | null
          project_id: number | null
          sort_order: number | null
          "Task Name": string | null
          task_list_id: number | null
          user_id: string
        }
        Insert: {
          archived?: boolean | null
          created_at?: string
          date_due?: string | null
          date_started?: string | null
          delay_type?: string | null
          delay_value?: string | null
          details?: Json | null
          id?: number
          order?: number
          position?: number | null
          Progress?: Database["public"]["Enums"]["status"] | null
          project_id?: number | null
          sort_order?: number | null
          "Task Name"?: string | null
          task_list_id?: number | null
          user_id: string
        }
        Update: {
          archived?: boolean | null
          created_at?: string
          date_due?: string | null
          date_started?: string | null
          delay_type?: string | null
          delay_value?: string | null
          details?: Json | null
          id?: number
          order?: number
          position?: number | null
          Progress?: Database["public"]["Enums"]["status"] | null
          project_id?: number | null
          sort_order?: number | null
          "Task Name"?: string | null
          task_list_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "Projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Tasks_task_list_id_fkey"
            columns: ["task_list_id"]
            isOneToOne: false
            referencedRelation: "TaskLists"
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
      status: "Not started" | "In progress" | "Completed" | "Backlog"
      Status: "Not started" | "In progress" | "Completed" | "Backlog"
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
      status: ["Not started", "In progress", "Completed", "Backlog"],
      Status: ["Not started", "In progress", "Completed", "Backlog"],
    },
  },
} as const
