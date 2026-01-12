-- Add completed_at column to subtasks table
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create index for efficient queries on completed_at
CREATE INDEX IF NOT EXISTS idx_subtasks_completed_at ON public.subtasks(completed_at);

-- Create composite index for the suppression query pattern
CREATE INDEX IF NOT EXISTS idx_subtasks_parent_task_name_completed ON public.subtasks("Parent Task ID", "Task Name", completed_at);

-- Create trigger function to auto-manage completed_at
CREATE OR REPLACE FUNCTION public.manage_subtask_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when Progress changes to 'Completed'
  IF NEW."Progress" = 'Completed' AND (OLD."Progress" IS NULL OR OLD."Progress" != 'Completed') THEN
    NEW.completed_at = now();
  -- Clear completed_at when Progress changes away from 'Completed'
  ELSIF NEW."Progress" != 'Completed' AND OLD."Progress" = 'Completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on subtasks table
DROP TRIGGER IF EXISTS trigger_manage_subtask_completed_at ON public.subtasks;
CREATE TRIGGER trigger_manage_subtask_completed_at
  BEFORE UPDATE ON public.subtasks
  FOR EACH ROW
  EXECUTE FUNCTION public.manage_subtask_completed_at();