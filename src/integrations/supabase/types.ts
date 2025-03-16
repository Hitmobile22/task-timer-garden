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
      Projects: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
      recurring_task_settings: {
        Row: {
          created_at: string | null
          daily_task_count: number | null
          days_of_week: string[] | null
          enabled: boolean | null
          id: number
          task_list_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          daily_task_count?: number | null
          days_of_week?: string[] | null
          enabled?: boolean | null
          id?: number
          task_list_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          daily_task_count?: number | null
          days_of_week?: string[] | null
          enabled?: boolean | null
          id?: number
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
        }
        Insert: {
          created_at?: string
          id?: never
          "Parent Task ID"?: number | null
          Progress?: Database["public"]["Enums"]["status"] | null
          "Task Name"?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          "Parent Task ID"?: number | null
          Progress?: Database["public"]["Enums"]["status"] | null
          "Task Name"?: string | null
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
        }
        Insert: {
          created_at?: string | null
          google_event_id: string
          id?: string
          last_sync_time?: string | null
          task_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          google_event_id?: string
          id?: string
          last_sync_time?: string | null
          task_id?: number | null
          updated_at?: string | null
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
          color: string | null
          created_at: string
          id: number
          last_tasks_added_at: string | null
          name: string
          order: number
          position: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: number
          last_tasks_added_at?: string | null
          name: string
          order?: number
          position?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: number
          last_tasks_added_at?: string | null
          name?: string
          order?: number
          position?: number | null
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
