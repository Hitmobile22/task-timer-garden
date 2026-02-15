

## Plan: Delete Subtasks on Task Deletion + Delete Archived Subtasks Button

### Overview

Two changes:
1. When a user deletes a task, automatically delete its associated subtasks first
2. Add a "Delete Archived Subtasks" button visible only when viewing archived tasks

No database schema changes, no styling changes, no other feature modifications.

### Change 1: Delete subtasks when deleting a task

**File: `src/pages/TaskView.tsx`**

Update the `deleteMutation` (around line 163) to first delete subtasks before deleting the task:

```typescript
const deleteMutation = useMutation({
  mutationFn: async (taskId: number) => {
    // Delete associated subtasks first
    const { error: subtaskError } = await supabase
      .from('subtasks')
      .delete()
      .eq('Parent Task ID', taskId);
    
    if (subtaskError) throw subtaskError;

    // Then delete the task
    const { error } = await supabase
      .from('Tasks')
      .delete()
      .eq('id', taskId);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['subtasks'] });
    toast.success('Task deleted successfully');
  },
  onError: (error) => {
    toast.error('Failed to delete task');
    console.error('Delete error:', error);
  },
});
```

### Change 2: Add "Delete Archived Subtasks" button

**File: `src/components/task/TaskFilters.tsx`**

- Add a new optional prop `onDeleteArchivedSubtasks`
- Render a button (only when `showArchived` is true) next to the existing archive buttons, using the `Trash2` icon with label "Delete Archived Subtasks"

**File: `src/pages/TaskView.tsx`**

- Add a new mutation `deleteArchivedSubtasksMutation` that:
  1. Fetches all archived task IDs
  2. Deletes all subtasks where `Parent Task ID` is in that list
- Pass the handler to `TaskFilters` as `onDeleteArchivedSubtasks`

```typescript
const deleteArchivedSubtasksMutation = useMutation({
  mutationFn: async () => {
    // Get all archived task IDs
    const { data: archivedTasks, error: fetchError } = await supabase
      .from('Tasks')
      .select('id')
      .eq('archived', true);
    
    if (fetchError) throw fetchError;
    if (!archivedTasks || archivedTasks.length === 0) return;

    const archivedTaskIds = archivedTasks.map(t => t.id);
    
    // Delete subtasks in batches (Supabase .in() has limits)
    const { error } = await supabase
      .from('subtasks')
      .delete()
      .in('Parent Task ID', archivedTaskIds);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['subtasks'] });
    toast.success('Archived task subtasks deleted successfully');
  },
  onError: (error) => {
    toast.error('Failed to delete archived subtasks');
    console.error('Delete archived subtasks error:', error);
  },
});
```

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/TaskView.tsx` | Update `deleteMutation` to delete subtasks first; add `deleteArchivedSubtasksMutation`; pass handler to TaskFilters |
| `src/components/task/TaskFilters.tsx` | Add `onDeleteArchivedSubtasks` prop; render button when in archived view |

### What This Does NOT Change

- No database schema or RLS changes
- No styling changes
- No changes to archive/unarchive logic
- No changes to project, task list, or recurring task functionality

