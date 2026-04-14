
-- 1. Fix recurring_task_settings: Replace overly permissive RLS policies with user-scoped ones
DROP POLICY IF EXISTS "Enable read access for all users" ON recurring_task_settings;
DROP POLICY IF EXISTS "Enable insert access for all users" ON recurring_task_settings;
DROP POLICY IF EXISTS "Enable update access for all users" ON recurring_task_settings;
DROP POLICY IF EXISTS "Enable delete access for all users" ON recurring_task_settings;

CREATE POLICY "Users can view their own recurring task settings"
  ON recurring_task_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring task settings"
  ON recurring_task_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring task settings"
  ON recurring_task_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring task settings"
  ON recurring_task_settings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Fix task-images storage: Remove overly permissive policies and add auth-restricted ones
DROP POLICY IF EXISTS "Allow public insert access to task images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update access to task images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access to task images" ON storage.objects;

CREATE POLICY "Authenticated users can update task images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'task-images');

CREATE POLICY "Authenticated users can delete task images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-images');

-- 3. Fix nullable user_id on goal_completion_notifications
-- First update any NULL rows to have a valid user_id from the related project_goal
UPDATE goal_completion_notifications gcn
SET user_id = pg.user_id
FROM project_goals pg
WHERE gcn.project_goal_id = pg.id AND gcn.user_id IS NULL;

-- Delete any remaining orphaned rows
DELETE FROM goal_completion_notifications WHERE user_id IS NULL;

ALTER TABLE goal_completion_notifications ALTER COLUMN user_id SET NOT NULL;

-- 4. Fix mutable search_path on get_user_schedule_summary
CREATE OR REPLACE FUNCTION public.get_user_schedule_summary(target_user_id uuid, target_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(task_count bigint, completed_count bigint, pending_count bigint, overdue_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT as task_count,
        COUNT(*) FILTER (WHERE "Progress" = 'Completed')::BIGINT as completed_count,
        COUNT(*) FILTER (WHERE "Progress" != 'Completed')::BIGINT as pending_count,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND "Progress" != 'Completed')::BIGINT as overdue_count
    FROM "Tasks"
    WHERE user_id = target_user_id
        AND start_date = target_date;
END;
$function$;
