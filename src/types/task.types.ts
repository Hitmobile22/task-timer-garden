
import { Json } from '@/integrations/supabase/types';

export type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  date_started?: string;
  date_due?: string;
  date_created?: string; // Adding this field to match its usage in the code
  task_list_id: number | null;
  project_id?: number | null;
  details?: Json | Record<string, any> | string | null;
};

export type Subtask = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  "Parent Task ID": number;
  date_started?: string; // Adding this field to match its usage in the code
  date_created?: string; // Adding this field to match its usage in the code
};

export type SortField = "Task Name" | "Progress" | "date_started" | "date_due";
export type SortOrder = "asc" | "desc";
