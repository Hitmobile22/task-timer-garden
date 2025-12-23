-- Add sort_order column to subtasks table for preserving order
ALTER TABLE public.subtasks 
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;