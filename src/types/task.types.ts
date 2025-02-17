
export type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  date_started?: string;
  date_due?: string;
  task_list_id: number | null;
  archived?: boolean;
  project_id?: number | null;
  is_project?: boolean;
};

export type Project = {
  id: number;
  "Project Name": string;
  progress: "Not started" | "In progress" | "Completed" | "Backlog"; // Changed to match database column name
  date_started?: string;
  date_due?: string;
  task_list_id: number | null;
  sort_order: number;
};

export type Subtask = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  "Parent Task ID": number;
};

export type SortField = "Task Name" | "Progress" | "date_started" | "date_due";
export type SortOrder = "asc" | "desc";
