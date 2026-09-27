# Full CSV Import (Upload CSV > All tab)

Replace the "Full import ... coming soon" placeholder with a working importer that creates Projects, Tasks, and Subtasks from one CSV. No database table or structure changes — it only writes to the existing Projects, Tasks, and subtasks tables, and the Projects/Events tab stays as it is.

## How the CSV works

Each row is one item. A `Type` column says what the row is, and rows are linked to their parent by name.

| Column | Required | Applies to | Format / default |
|---|---|---|---|
| Type | Yes | all | `Project`, `Task`, or `Subtask` (any capitalization) |
| Name | Yes | all | The item's name |
| Project | Task rows (optional) | Task | Name of a Project row in the same file. Leave it blank to create a standalone task |
| Task | Subtask rows | Subtask | Name of a Task row in the file. If two tasks share a name, the subtask attaches to the nearest task above it |
| List | No | Project, Task | Existing list name. Defaults to the project's list, then "Default", then your first list |
| Start Date | No | Project, Task | `YYYY-MM-DD`, `MM/DD/YYYY`, or with a time, e.g. `2026-10-01 09:00`. Defaults: project uses today; task uses the previous task's end time, or the project's start |
| Due Date | No | Project, Task | Same formats. Default: project uses today + 2 days; task uses start + Duration |
| Duration | No | Task | Minutes (e.g. `25`). Default is 25. Used only when Due Date is blank |
| Progress | No | all | `Not started`, `In progress`, `Completed`, `Backlog`. Default is `Not started` |
| Description | No | Project, Task | Plain text on one line. Wrap it in quotes if it contains commas |

Rows can appear in any order. The importer links them by name, not by position.

Example:
```text
Type,Name,Project,Task,List,Start Date,Due Date,Duration,Progress,Description
Project,Website Launch,,,Work,2026-10-01,2026-10-15,,,Launch the new site
Task,Design mockups,Website Launch,,,2026-10-01 09:00,,60,,Homepage and about page
Subtask,Homepage,,Design mockups,,,,,,
Subtask,About page,,Design mockups,,,,,,
Task,Build pages,Website Launch,,,2026-10-03 09:00,,90,,
Subtask,Header,,Build pages,,,,,,
```

## What the All tab will show
1. Brief "How to use" steps and a column list, styled like the Projects/Events tab.
2. A "Download Example CSV" button.
3. A drag-and-drop or click area to upload the file.
4. A preview grouped as Project > Tasks > Subtasks, with counts, errors, and warnings. Examples: a missing Name, an unknown Type, a subtask whose task is missing, or an unknown list falling back to the default.
5. The Import button changes to say "Import X projects, Y tasks, Z subtasks".

## Import order
1. Create projects. Keep a lookup from each project name to its new ID.
2. Create tasks with `project_id` and `task_list_id` set. Keep a lookup from each task row to its new ID.
3. Create subtasks in bulk with `Parent Task ID` and `sort_order` set to their CSV order.
4. Refresh the project, task, and subtask views so the new items appear right away.
5. If one row fails, it is counted and reported, and the other rows continue.

## Out of scope
- Creating new lists. An unknown list falls back to an existing list, with a warning.
- Recurring and progressive settings. You can still set these in Edit Project after importing, or through the Projects/Events tab.
- Any database schema changes.

## Technical details
- New file `src/utils/csvFullImportUtils.ts`: row parsing, validation, datetime parsing with `date-fns-tz` (America/New_York), sequential task timing, building the hierarchy, and generating the example CSV. It reuses `parseCSV`, `resolveTaskListId`, and the progress normalization from `csvImportUtils.ts`.
- Edit `src/components/task/CSVUploadModal.tsx`: add separate state for the All tab and its UI. Enable the Import button based on the active tab. Descriptions keep the existing TipTap `{ description: doc }` shape in `details`.
- Tasks are inserted with `Progress`, `date_started`, `date_due`, `project_id`, `task_list_id`, `details`, and `user_id`. Subtasks are inserted with `"Task Name"`, `"Parent Task ID"`, `Progress`, `sort_order`, and `user_id`. All of these columns already exist.
- Also fix the CSV parser so quoted descriptions that span multiple lines don't break it.
