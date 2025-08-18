-- Migrate all unassigned data to user Theo (1523ecad-094b-4bfc-8ec0-fb382603ba8d)

-- Update Tasks table - assign all tasks with null user_id to Theo
UPDATE public."Tasks" 
SET user_id = '1523ecad-094b-4bfc-8ec0-fb382603ba8d'
WHERE user_id IS NULL;

-- Update Projects table - assign all projects with null user_id to Theo
UPDATE public."Projects" 
SET user_id = '1523ecad-094b-4bfc-8ec0-fb382603ba8d'
WHERE user_id IS NULL;

-- Update subtasks table - assign all subtasks with null user_id to Theo
UPDATE public.subtasks 
SET user_id = '1523ecad-094b-4bfc-8ec0-fb382603ba8d'
WHERE user_id IS NULL;

-- Update TaskLists table - assign all task lists with null user_id to Theo
UPDATE public."TaskLists" 
SET user_id = '1523ecad-094b-4bfc-8ec0-fb382603ba8d'
WHERE user_id IS NULL;

-- Update project_goals table - assign all project goals with null user_id to Theo
UPDATE public.project_goals 
SET user_id = '1523ecad-094b-4bfc-8ec0-fb382603ba8d'
WHERE user_id IS NULL;

-- Update recurring_task_generation_logs table - assign all logs with null user_id to Theo
UPDATE public.recurring_task_generation_logs 
SET user_id = '1523ecad-094b-4bfc-8ec0-fb382603ba8d'
WHERE user_id IS NULL;