
export type GoalType = 'daily' | 'weekly' | 'single_date' | 'date_period';

export interface ProjectGoal {
  id?: number;
  project_id: number;
  is_enabled: boolean;
  goal_type: GoalType;
  start_date: string | Date;
  end_date?: string | Date | null;
  task_count_goal: number;
  reward?: string | null;
  current_count: number;
  created_at?: string | Date;
}

export interface ProjectGoalProgress {
  projectId: number;
  projectName: string;
  goals: ProjectGoal[];
}
