# Copy subtasks from an existing task into recurring settings

## What you'll see
In Edit Project, after turning on **Recurring Tasks**, a new **"Copy subtasks from task"** dropdown appears above the "Add Subtask" button in the Subtasks section.

- The dropdown lists this project's tasks that have subtasks, e.g. "Task Y (3 subtasks)" and "Task Z (3 subtasks)". Archived tasks are left out, and tasks with the same name are shown only once.
- Picking a task fills the recurring subtask list with that task's subtasks in their saved order (A, B, C).
- If the list already has subtasks, you choose **Replace** or **Add to end**. Adding skips duplicate names.
- After that, the list works the same as it does now. You can edit, remove, or add items, and Subtask Mode and saving behave as before.
- If none of the project's tasks have subtasks, the dropdown says "No tasks with subtasks" and is disabled.

This works for any project, including ones uploaded through Upload CSV > All.

## What stays the same
- No changes to the database. It reads existing tasks and subtasks and saves to the same recurring subtask list used today.
- The recurring engine, progressive mode, presets, CSV import, and phase system are not touched.

## Technical details
- File: `src/components/project/ProjectModal.tsx` only.
- When the modal opens for an existing project, fetch `Tasks` (id, "Task Name") where `project_id = project.id` and `archived = false`, then `subtasks` filtered by `.in('Parent Task ID', taskIds)` and ordered by `sort_order` to get around the 1000-row limit. Group them by parent and keep only tasks with at least one subtask.
- Add a shadcn `Select` that writes into the existing `subtaskNames` state. Replace/Append uses a small inline choice that appears only when `subtaskNames` has items.
- Hide the dropdown for new projects, since they have no tasks yet.
