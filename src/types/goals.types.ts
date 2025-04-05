
export interface Goal {
  id?: number;
  goal_type: string;
  task_count_goal: number;
  start_date: string | null;
  end_date: string | null;
  reward: string | null;
  is_enabled: boolean;
  current_count?: number;
  project_id?: number;
}

export interface RecurringSettings {
  id?: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
}
