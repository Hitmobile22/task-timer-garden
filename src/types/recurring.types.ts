
// Define recurring project related types
export interface RecurringProjectSettings {
  id: number;
  project_id: number;
  days_of_week: string[];
  created_at: string;
  updated_at: string;
}

export interface RecurringProject {
  id: number;
  "Project Name": string;
  task_list_id: number | null;
  isRecurring: boolean;
  recurringTaskCount: number;
  date_started: string | null;
  date_due: string | null;
  progress: string;
  show_overdue_suffix?: boolean;
  recurring_settings?: RecurringProjectSettings[];
  [key: string]: any; // For other project properties
}

export interface ProjectForEdgeFunction {
  id: number;
  "Project Name": string;
  task_list_id: number | null;
  isRecurring: boolean;
  recurringTaskCount: number;
  date_started: string | null;
  date_due: string | null;
  progress: string;
  recurring_settings: { 
    days_of_week: string[] 
  } | null;
}

export interface GenerationLogResult {
  id: number;
  task_list_id?: number;
  project_id?: number;
  setting_id?: number;
  generation_date: string;
  tasks_generated: number;
}
