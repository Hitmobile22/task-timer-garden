-- Fix RLS violations by making user_id NOT NULL and adding proper defaults
-- This prevents the "new row violates row-level security policy" errors

-- Update Projects table to make user_id NOT NULL
ALTER TABLE public."Projects" ALTER COLUMN user_id SET NOT NULL;

-- Update project_goals table to make user_id NOT NULL  
ALTER TABLE public.project_goals ALTER COLUMN user_id SET NOT NULL;

-- Update Tasks table to make user_id NOT NULL
ALTER TABLE public."Tasks" ALTER COLUMN user_id SET NOT NULL;

-- Update TaskLists table to make user_id NOT NULL
ALTER TABLE public."TaskLists" ALTER COLUMN user_id SET NOT NULL;

-- Update subtasks table to make user_id NOT NULL
ALTER TABLE public.subtasks ALTER COLUMN user_id SET NOT NULL;