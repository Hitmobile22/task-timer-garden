import { Json } from '@/integrations/supabase/types';

export type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  date_started?: string;
  date_due?: string;
  task_list_id: number | null;
  project_id?: number | null;
  details?: Json | Record<string, any> | string | null;
  IsTimeBlock?: "Yes" | "No";
  archived?: boolean;
};

export type Subtask = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  "Parent Task ID": number;
};

export type SortField = "Task Name" | "Progress" | "date_started" | "date_due";
export type SortOrder = "asc" | "desc";

export type GoalType = "daily" | "weekly" | "single_date" | "date_period";

export type ProjectGoal = {
  id: number;
  project_id: number;
  task_count_goal: number;
  current_count: number;
  goal_type: GoalType;
  start_date: string;
  end_date?: string | null;
  reward?: string | null;
  is_enabled: boolean;
  created_at: string;
};
