-- Add subtask_names column to recurring_project_settings table
ALTER TABLE recurring_project_settings 
ADD COLUMN subtask_names text[] DEFAULT '{}';