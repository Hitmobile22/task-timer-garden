-- Clean up duplicate enabled recurring task settings
-- This migration ensures only the most recent enabled setting per task_list_id is active
-- All older enabled settings for the same task list will be disabled

UPDATE recurring_task_settings
SET enabled = false, updated_at = NOW()
WHERE id IN (
  SELECT rts.id
  FROM recurring_task_settings rts
  INNER JOIN (
    SELECT task_list_id, MAX(created_at) as latest_created_at
    FROM recurring_task_settings
    WHERE enabled = true AND (archived = false OR archived IS NULL)
    GROUP BY task_list_id
  ) latest ON rts.task_list_id = latest.task_list_id
  WHERE rts.enabled = true
    AND (rts.archived = false OR rts.archived IS NULL)
    AND rts.created_at < latest.latest_created_at
);