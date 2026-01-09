-- Add user_id column to project_notifications table
ALTER TABLE public.project_notifications 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing notifications to get user_id from the associated project
UPDATE public.project_notifications pn
SET user_id = p.user_id
FROM public."Projects" p
WHERE pn.project_id = p.id;

-- Make user_id NOT NULL after populating existing data
ALTER TABLE public.project_notifications 
ALTER COLUMN user_id SET NOT NULL;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view project notifications" ON public.project_notifications;
DROP POLICY IF EXISTS "Anyone can insert project notifications" ON public.project_notifications;
DROP POLICY IF EXISTS "Anyone can update project notifications" ON public.project_notifications;
DROP POLICY IF EXISTS "Anyone can delete project notifications" ON public.project_notifications;

-- Create user-scoped RLS policies
CREATE POLICY "Users can view their own project notifications"
ON public.project_notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own project notifications"
ON public.project_notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project notifications"
ON public.project_notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project notifications"
ON public.project_notifications
FOR DELETE
USING (auth.uid() = user_id);