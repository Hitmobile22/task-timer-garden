-- Add subtask mode columns to recurring_task_settings (matching recurring_project_settings)
ALTER TABLE recurring_task_settings
ADD COLUMN IF NOT EXISTS subtask_mode text DEFAULT 'on_task_creation';

ALTER TABLE recurring_task_settings
ADD COLUMN IF NOT EXISTS respawn_interval_value integer DEFAULT 1;

ALTER TABLE recurring_task_settings
ADD COLUMN IF NOT EXISTS respawn_days_of_week text[] DEFAULT '{}';

ALTER TABLE recurring_task_settings
ADD COLUMN IF NOT EXISTS last_subtask_respawn timestamp with time zone;

ALTER TABLE recurring_task_settings
ADD COLUMN IF NOT EXISTS user_id uuid;