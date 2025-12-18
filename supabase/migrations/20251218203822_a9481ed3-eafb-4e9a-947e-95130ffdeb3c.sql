-- Add subtask_names column to recurring_task_settings table
ALTER TABLE recurring_task_settings 
ADD COLUMN subtask_names text[] DEFAULT '{}';