
export type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  date_started?: string;
  date_due?: string;
  task_list_id: number | null;
  project_id?: number | null;
  details?: Record<string, any> | null;
};

export type Subtask = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  "Parent Task ID": number;
};

export type SortField = "Task Name" | "Progress" | "date_started" | "date_due";
export type SortOrder = "asc" | "desc";
