

## Progress Pulse -- Time Block Reward System

### Overview

A new type of time block ("Progress Pulse") where users assign tasks/subtasks via buttons on each task/subtask item. The time block's own background in the Today's Tasks list acts as the progress bar, with a gradual color and speed transition from slow-pulsing green (0%) through faster-pulsing orange (partial) to a glowing purple (100% unlocked). Items are added via an "Add to Pulse" button on tasks and subtasks -- no drag-and-drop.

---

### Database

**New table: `progress_pulse_items`**

| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK, auto) | |
| pulse_task_id | bigint | References the Pulse time block in Tasks |
| item_name | text | Name-based matching for recurring subtask compatibility |
| item_type | text | `'subtask'` or `'task'` |
| is_completed | boolean | Default false |
| user_id | uuid | For RLS |
| created_at | timestamptz | Default now() |

Standard user_id-based RLS policies for SELECT, INSERT, UPDATE, DELETE.

---

### How It Works

1. **Creating a Pulse time block**: In the existing Time Block modal (`TaskForm.tsx`), add a third type: `'pulse'`. Creates a task with `details: { isTimeBlock: true, isProgressPulse: true }`.

2. **Adding items**: Tasks and subtasks get a new small button (e.g., a `Target` icon) that appears only when an active (unlocked) Progress Pulse exists in today's tasks. Clicking it inserts a row into `progress_pulse_items` with the item's name.

3. **Locking the pulse**: A "Lock" button on the pulse time block finalizes the item list. Sets `details.isLocked: true`. After locking, the "Add to Pulse" buttons disappear from tasks/subtasks.

4. **Completion tracking**: When a task or subtask is marked complete (in `TaskList.tsx` `updateTaskProgress` and `usePomodoro.tsx` `completeSubtask`), check `progress_pulse_items` for a matching `item_name` and set `is_completed = true`. Name-based matching ensures recurring subtasks from different parent tasks all count.

5. **Visual progress -- gradual color and speed transition**: The time block item's background acts as the progress bar. Fill percentage = `(completed items / total items) * 100`. The color and animation speed interpolate continuously based on progress:

   - **0% complete**: Pure green gradient (`#22c55e` to `#16a34a`), slow pulse (`animation-duration: 3s`)
   - **Between 0% and 100%**: The color gradually shifts from green toward orange, and the pulse speed gradually increases. At each completion step:
     - **Color**: Interpolate hue from green (HSL ~142) toward orange (HSL ~25). For example, at 50% progress the color is roughly a yellow-green; at 80% it is a warm amber-orange.
     - **Speed**: Interpolate `animation-duration` from `3s` (at 0%) down to `1s` (at ~99%). Computed as `3 - (progress * 2)` seconds, clamped to a minimum of `1s`.
   - **100% complete**: Stable glowing purple gradient (`#8b5cf6` to `#7c3aed`), no pulse, subtle box-shadow glow effect.

   This is implemented via inline styles on the time block element, computing `hsl()` color values and `animation-duration` dynamically from the progress ratio in the React component.

---

### CSS Animations (added to `src/index.css`)

```text
@keyframes pulse-progress {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes glow-purple {
  0%, 100% { box-shadow: 0 0 15px rgba(139, 92, 246, 0.5); }
  50% { box-shadow: 0 0 25px rgba(139, 92, 246, 0.7); }
}
```

The `pulse-progress` animation is applied with a dynamic `animation-duration` via inline style. At 100%, the element switches to the `glow-purple` animation with a fixed 2s duration.

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useProgressPulse.tsx` | Hook: fetch active pulse, items, compute progress, add/remove items, lock, update completion |

### Files to Modify

| File | Change |
|------|--------|
| `src/utils/taskUtils.ts` | Add `isProgressPulse(task)` helper |
| `src/components/TaskForm.tsx` | Add `'pulse'` to TimeBlockType; save with `isProgressPulse: true` in details |
| `src/components/TaskList.tsx` | (1) Render pulse time blocks with progress-bar background using interpolated green-to-orange color and speed. (2) Add "Add to Pulse" button on task items and subtask items. (3) Show lock button on pulse item. (4) After completing task/subtask, update matching `progress_pulse_items`. |
| `src/hooks/usePomodoro.tsx` | After `completeSubtask`, check and update matching `progress_pulse_items` |
| `src/index.css` | Add `pulse-progress` and `glow-purple` keyframe animations |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

### Implementation Order

1. Database migration (create `progress_pulse_items` table + RLS)
2. `taskUtils.ts` -- add `isProgressPulse` helper
3. `useProgressPulse.tsx` -- hook for fetching pulse data, adding items, locking, computing progress with interpolated color/speed values
4. `TaskForm.tsx` -- add pulse type to time block creation modal
5. `index.css` -- add `pulse-progress` and `glow-purple` keyframe animations
6. `TaskList.tsx` -- render pulse time block with interpolated progress background, add "Add to Pulse" buttons on tasks/subtasks, wire completion to pulse updates
7. `usePomodoro.tsx` -- add pulse completion check in `completeSubtask`

### What This Does NOT Change

- Existing time block behavior (single/weekly) untouched
- Regular task/subtask completion flow unchanged (just an additional query after)
- No changes to drag-and-drop for task reordering
- Pomodoro timer, project goals, calendar, recurring task logic -- all unchanged
- No styling changes to existing components

