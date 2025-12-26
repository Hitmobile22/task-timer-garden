export type CalendarEventType = 'task' | 'project';

export type CalendarEventProgress = 'Not started' | 'In progress' | 'Completed' | 'Backlog';

export interface CalendarEvent {
  id: number;
  name: string;
  type: CalendarEventType;
  progress: CalendarEventProgress;
  date_started: string | null;
  date_due: string;
  isAllDay: boolean;
}

export interface Task {
  id: number;
  "Task Name": string | null;
  Progress: CalendarEventProgress | null;
  date_started: string | null;
  date_due: string | null;
}

export interface Project {
  id: number;
  "Project Name": string;
  progress: CalendarEventProgress | null;
  date_started: string | null;
  date_due: string | null;
  archived: boolean | null;
}
