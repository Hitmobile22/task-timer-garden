
## Plan: Fix Recurring Task Toggle Disconnect and Implement Fulfillment Logic

### Background

After thorough research, I've identified two distinct issues:

**Issue 1: Potential Toggle State Disconnect**
While the "Art!" case appears to be expected behavior (tasks generated when enabled, then disabled afterward), there IS a potential source of disconnect: the system maintains **multiple settings rows** per task list, and the edge function might query stale enabled settings that weren't properly cleaned up.

**Issue 2: Fulfillment Logic (New Feature)**
Currently, task lists and their contained projects generate recurring tasks **independently**. The user wants task lists to consider tasks from their projects as "fulfilling" the list's recurring task quota.

---

### Part A: Ensure Toggle State Consistency

**Problem:** The current implementation creates a NEW row for each settings change. While it disables old enabled settings before inserting, there could be edge cases (race conditions, failed updates) where old enabled settings remain.

**Fix 1: Add Defensive Query in Edge Function**

Update `supabase/functions/check-recurring-tasks/index.ts` to explicitly only use the **most recent** enabled setting per task list, ignoring any older enabled settings.

Current behavior (line ~570-614): The function queries all enabled settings, then filters to keep only the most recent per list. This is correct but relies on `created_at` ordering. 

Proposed change: Add an explicit check to verify the setting being used is truly the most recent one for that task list, and log warnings if multiple enabled settings are found.

**Location:** Lines ~570-632 of `check-recurring-tasks/index.ts`

**Changes:**
1. After fetching enabled settings, add validation to detect and warn about multiple enabled settings per list
2. Log a warning if multiple enabled settings exist for the same list (indicates sync issue)
3. Add a cleanup step that disables any "orphaned" enabled settings (older settings that should have been disabled)

---

### Part B: Implement Fulfillment Logic for Task Lists

**Concept Clarification:**
- A task list has a recurring task goal (e.g., 3 tasks/day for Art!)
- Projects within that list may also have recurring tasks (e.g., Painting Project generates 3 tasks)
- **New behavior:** Tasks from projects within the list should count toward the list's daily goal
- If projects already generate enough tasks, no additional "list-level" tasks should spawn

**Example:**
- Art! list: 3 recurring tasks/day goal
- Painting Project (in Art!): 3 recurring tasks
- Agora Gallery (in Art!): 1 recurring task
- Total from projects: 4 tasks
- Since 4 >= 3, Art! list should NOT spawn additional list-level tasks

**Fix 2: Count Project Tasks Toward List Goal**

Update `supabase/functions/check-recurring-tasks/index.ts` to:
1. When processing a task list's recurring settings, count ALL active tasks in that list (including those from projects)
2. Only generate additional list-level tasks if the total count is below the daily goal

**Location:** Lines ~760-782 of `check-recurring-tasks/index.ts` (the task counting section)

**Current code logic:**
```
const taskCounts = await countAllTasksForDaily(supabaseClient, setting.task_list_id);
if ((taskCounts.total >= setting.daily_task_count) && !forceCheck) {
  // Skip - already has enough tasks
}
```

**Analysis:** The current `countAllTasksForDaily` function already counts ALL tasks in the list (including those from projects). Looking at lines 342-391:
- It counts active tasks with `Progress IN ('Not started', 'In progress')` for the task_list_id
- It counts completed tasks from today

This SHOULD already work. Let me verify why it didn't in this case...

**Root Cause Identified:** 
Looking at the task creation times:
- Art! list tasks: created at 16:57:46 (date_started: 2026-01-28 01:31)
- Project tasks: created at 17:43:42 (date_started: 2026-01-27 20:01)

The **Art! list tasks were created BEFORE the project tasks**. At 16:57, there were no project tasks yet, so the system correctly created list tasks. Then at 17:43, the project check ran and created project tasks.

**The Real Problem:** Task lists and projects are checked at DIFFERENT times by DIFFERENT hooks:
- `useUnifiedRecurringTasksCheck` triggers list-level task generation
- `useRecurringProjectsCheck` triggers project-level task generation

These don't coordinate with each other.

**Fix 3: Add Cross-Source Awareness**

Modify the task list recurring check to be aware of project recurring settings:

**In `check-recurring-tasks/index.ts`**, before generating list-level tasks:
1. Query all recurring projects in this task list
2. Calculate expected tasks from projects for today
3. Add those to the "already fulfilled" count
4. Only generate list-level tasks to fill the gap

**New Logic (pseudo-code):**
```
// Get recurring projects in this list
const recurringProjects = await getRecurringProjectsInList(taskListId);
let expectedProjectTasks = 0;

for (const project of recurringProjects) {
  if (shouldRunToday(project)) {
    expectedProjectTasks += project.recurringTaskCount;
  }
}

// Count existing tasks
const existingTasks = await countAllTasksForDaily(taskListId);

// Calculate effective total (existing + expected from projects)
const effectiveTotal = existingTasks.total;

// If expected from projects alone meets/exceeds list goal, skip list generation
if (expectedProjectTasks >= setting.daily_task_count) {
  console.log(`Projects in list ${taskListId} will generate ${expectedProjectTasks} tasks, ` +
              `meeting list goal of ${setting.daily_task_count}. Skipping list-level generation.`);
  continue;
}

// Generate only enough list tasks to fill the gap
const tasksNeededFromList = Math.max(0, setting.daily_task_count - expectedProjectTasks - existingTasks.total);
```

---

### Implementation Details

**File 1: `supabase/functions/check-recurring-tasks/index.ts`**

1. **Add function to get recurring projects in a list** (around line 340):
```typescript
async function getRecurringProjectsInList(
  supabaseClient: any, 
  taskListId: number, 
  currentDay: string
): Promise<{projectId: number, recurringCount: number}[]> {
  const { data: projects, error } = await supabaseClient
    .from('Projects')
    .select(`
      id,
      recurringTaskCount,
      isRecurring,
      recurring_project_settings!inner(days_of_week)
    `)
    .eq('task_list_id', taskListId)
    .eq('isRecurring', true)
    .neq('progress', 'Completed');
  
  if (error) {
    console.error('Error fetching recurring projects for list:', error);
    return [];
  }
  
  const normalizedCurrentDay = normalizeDay(currentDay);
  
  return (projects || [])
    .filter(p => {
      const settings = p.recurring_project_settings?.[0];
      if (!settings?.days_of_week) return true; // All days if not specified
      const projectDays = settings.days_of_week.map(normalizeDay);
      return projectDays.includes(normalizedCurrentDay);
    })
    .map(p => ({
      projectId: p.id,
      recurringCount: p.recurringTaskCount || 1
    }));
}
```

2. **Modify the main processing loop** (around lines 760-790):
   - Before deciding how many list-level tasks to create, query recurring projects
   - Calculate expected project tasks for today
   - If projects satisfy the list goal, skip list-level generation
   - If not, only create the difference

3. **Add toggle state validation** (around lines 570-632):
   - Detect multiple enabled settings per list
   - Log warning and clean up orphaned settings

---

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/check-recurring-tasks/index.ts` | Add project awareness to fulfillment logic, add toggle validation |

---

### What This Does NOT Change

- No changes to the RecurringTasksModal UI
- No changes to project recurring task generation (check-recurring-projects)
- No changes to subtask handling or progressive mode
- No styling changes
- No changes to the client-side hooks structure

---

### Testing Plan

1. **Toggle State Test:**
   - Toggle recurring off for a list
   - Verify no tasks spawn for that list
   - Check edge function logs for any "orphaned enabled settings" warnings

2. **Fulfillment Logic Test:**
   - Set up a task list with 3 daily recurring tasks
   - Add a project in that list with 3 recurring tasks
   - Wait for the next check cycle
   - Verify only project tasks are created, not list-level tasks

3. **Partial Fulfillment Test:**
   - List goal: 3 tasks
   - Project generates: 1 task
   - Expected: 2 list-level tasks + 1 project task = 3 total

---

### Technical Notes

- The edge function already uses 3 AM EST day boundaries for counting
- Generation logs track what was created, so this change is additive
- The fix ensures backward compatibility - if no projects exist, behavior is unchanged
