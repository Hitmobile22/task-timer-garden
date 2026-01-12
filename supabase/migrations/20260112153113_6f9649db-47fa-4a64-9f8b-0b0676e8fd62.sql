-- Add subtask_mode column to replace boolean progressive_mode
ALTER TABLE recurring_project_settings
ADD COLUMN subtask_mode text DEFAULT 'on_task_creation';

-- Add respawn configuration columns
ALTER TABLE recurring_project_settings
ADD COLUMN respawn_interval_value integer DEFAULT 1;

ALTER TABLE recurring_project_settings
ADD COLUMN respawn_days_of_week text[] DEFAULT '{}';

-- Add tracking column for last respawn
ALTER TABLE recurring_project_settings
ADD COLUMN last_subtask_respawn timestamp with time zone;

-- Migrate existing data from progressive_mode boolean to subtask_mode text
UPDATE recurring_project_settings
SET subtask_mode = CASE 
  WHEN progressive_mode = true THEN 'progressive'
  ELSE 'on_task_creation'
END;