-- Add progressive_mode column to recurring_project_settings
-- When enabled, completed subtasks are removed from the template so future recurring tasks won't include them
ALTER TABLE recurring_project_settings 
ADD COLUMN progressive_mode boolean DEFAULT false;