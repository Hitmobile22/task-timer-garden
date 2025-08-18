-- Phase 1: Critical Security Fixes
-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles policies
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Add user_id columns to tables that need them
ALTER TABLE public."Projects" ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public."TaskLists" ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.project_goals ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.goal_completion_notifications ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.recurring_project_settings ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.recurring_task_generation_logs ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.synced_calendar_events ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to Tasks table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Tasks' AND column_name = 'user_id') THEN
        ALTER TABLE public."Tasks" ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Enable RLS on all tables
ALTER TABLE public."Projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TaskLists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_completion_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_project_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_task_generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synced_calendar_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for Projects
CREATE POLICY "Users can view their own projects" 
ON public."Projects" FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects" 
ON public."Projects" FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects" 
ON public."Projects" FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects" 
ON public."Projects" FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for TaskLists
CREATE POLICY "Users can view their own task lists" 
ON public."TaskLists" FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task lists" 
ON public."TaskLists" FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own task lists" 
ON public."TaskLists" FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own task lists" 
ON public."TaskLists" FOR DELETE 
USING (auth.uid() = user_id);

-- Update Tasks RLS policies to use user_id
DROP POLICY IF EXISTS "Enable all operations for Tasks" ON public."Tasks";

CREATE POLICY "Users can view their own tasks" 
ON public."Tasks" FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks" 
ON public."Tasks" FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" 
ON public."Tasks" FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" 
ON public."Tasks" FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for project_goals
CREATE POLICY "Users can view their own project goals" 
ON public.project_goals FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own project goals" 
ON public.project_goals FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project goals" 
ON public.project_goals FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project goals" 
ON public.project_goals FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for goal_completion_notifications
CREATE POLICY "Users can view their own goal notifications" 
ON public.goal_completion_notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goal notifications" 
ON public.goal_completion_notifications FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goal notifications" 
ON public.goal_completion_notifications FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goal notifications" 
ON public.goal_completion_notifications FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for recurring_project_settings
CREATE POLICY "Users can view their own recurring project settings" 
ON public.recurring_project_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring project settings" 
ON public.recurring_project_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring project settings" 
ON public.recurring_project_settings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring project settings" 
ON public.recurring_project_settings FOR DELETE 
USING (auth.uid() = user_id);

-- Create RLS policies for recurring_task_generation_logs
CREATE POLICY "Users can view their own task generation logs" 
ON public.recurring_task_generation_logs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own task generation logs" 
ON public.recurring_task_generation_logs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for synced_calendar_events
CREATE POLICY "Users can view their own synced calendar events" 
ON public.synced_calendar_events FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own synced calendar events" 
ON public.synced_calendar_events FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own synced calendar events" 
ON public.synced_calendar_events FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own synced calendar events" 
ON public.synced_calendar_events FOR DELETE 
USING (auth.uid() = user_id);

-- Fix subtasks RLS policies
DROP POLICY IF EXISTS "Enable all operations for subtasks" ON public.subtasks;

-- Add user_id to subtasks table
ALTER TABLE public.subtasks ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE POLICY "Users can view their own subtasks" 
ON public.subtasks FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subtasks" 
ON public.subtasks FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subtasks" 
ON public.subtasks FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subtasks" 
ON public.subtasks FOR DELETE 
USING (auth.uid() = user_id);

-- Update google_calendar_settings RLS policies to be more restrictive
DROP POLICY IF EXISTS "Users can modify their own settings" ON public.google_calendar_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.google_calendar_settings;
DROP POLICY IF EXISTS "Users can view their own settings" ON public.google_calendar_settings;

CREATE POLICY "Users can view their own calendar settings" 
ON public.google_calendar_settings FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar settings" 
ON public.google_calendar_settings FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar settings" 
ON public.google_calendar_settings FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar settings" 
ON public.google_calendar_settings FOR DELETE 
USING (auth.uid() = user_id);

-- Fix database functions security by adding search_path
CREATE OR REPLACE FUNCTION public.increment_project_goal_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  task_project_id BIGINT;
BEGIN
  -- Only proceed if the task's Progress is being set to 'Completed'
  IF NEW."Progress" = 'Completed' AND (OLD."Progress" != 'Completed' OR OLD."Progress" IS NULL) THEN
    -- Get the project_id for this task
    SELECT project_id INTO task_project_id FROM public."Tasks" WHERE id = NEW.id;
    
    -- If the task is part of a project, update all relevant goal counters
    IF task_project_id IS NOT NULL THEN
      -- Update daily goals
      UPDATE public.project_goals
      SET current_count = current_count + 1
      WHERE project_id = task_project_id
        AND is_enabled = true
        AND goal_type = 'daily'
        AND date_trunc('day', NEW.date_started) = date_trunc('day', start_date)
        AND user_id = NEW.user_id;
      
      -- Update weekly goals
      UPDATE public.project_goals
      SET current_count = current_count + 1
      WHERE project_id = task_project_id
        AND is_enabled = true
        AND goal_type = 'weekly'
        AND date_trunc('week', NEW.date_started) = date_trunc('week', start_date)
        AND user_id = NEW.user_id;
      
      -- Update single_date goals
      UPDATE public.project_goals
      SET current_count = current_count + 1
      WHERE project_id = task_project_id
        AND is_enabled = true
        AND goal_type = 'single_date'
        AND date_trunc('day', NEW.date_started) = date_trunc('day', start_date)
        AND user_id = NEW.user_id;
      
      -- Update date_period goals
      UPDATE public.project_goals
      SET current_count = current_count + 1
      WHERE project_id = task_project_id
        AND is_enabled = true
        AND goal_type = 'date_period'
        AND NEW.date_started >= start_date
        AND (end_date IS NULL OR NEW.date_started <= end_date)
        AND user_id = NEW.user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_goal_completion_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Only create notification when the goal is newly completed
  -- (current_count now matches or exceeds task_count_goal, but didn't before)
  IF NEW.current_count >= NEW.task_count_goal AND 
     (OLD.current_count < OLD.task_count_goal OR OLD.current_count IS NULL) THEN
    
    INSERT INTO public.goal_completion_notifications (
      project_goal_id,
      project_id,
      goal_type,
      reward,
      completed_at,
      user_id
    ) VALUES (
      NEW.id,
      NEW.project_id,
      NEW.goal_type,
      NEW.reward,
      now(),
      NEW.user_id
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$function$;

-- Create trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add trigger for profile updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();