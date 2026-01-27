-- Add show_overdue_suffix column to Projects table
-- Default is false so existing projects won't get automatic (overdue) suffix
ALTER TABLE "Projects" 
ADD COLUMN show_overdue_suffix boolean DEFAULT false;