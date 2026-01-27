
## Plan: Fix Project Rename Bug and Add Overdue Toggle

### Problem Summary

**Issue 1: Project rename not working**
When a user edits a project name in the ProjectModal (e.g., changing "Winkler Game (overdue)" to "Winkler FPS"), the name does not persist.

**Root Cause:** Double-update race condition. The ProjectModal saves the new name directly to the database, then calls `onUpdateProject`. The parent component (`TaskView.tsx`) receives this callback and triggers `updateProjectMutation`, which tries to extract the name using `projectData.name` - but the data uses `projectData["Project Name"]`. This causes the mutation to overwrite the newly-saved name with `undefined` or the old value.

**Issue 2: Automatic "(overdue)" suffix**
The system automatically appends `(overdue)` to project names when they're past due. Users cannot remove this or opt out, making it impossible to rename projects to remove the suffix.

---

### Part A: Fix Project Rename Bug

The fix requires removing the duplicate update. Since the `ProjectModal` already saves directly to the database (lines 438-451), the `updateProjectMutation` call in `TaskView.tsx` is redundant and causes the overwrite.

**File: `src/pages/TaskView.tsx`**

**Changes:**
1. Modify `handleProjectSubmit` to skip calling `updateProjectMutation` for existing projects, since the modal already saved the data
2. Only use the callback to refresh the local query cache

```typescript
// Current (broken):
const handleProjectSubmit = (projectData: any) => {
  console.log("Project data submitted:", projectData);
  if (projectData.id) {
    updateProjectMutation.mutate(projectData);  // ← This overwrites with wrong field
  } else {
    createProjectMutation.mutate({...});
  }
  setShowProjectModal(false);
  setEditingProject(null);
};

// Fixed:
const handleProjectSubmit = (projectData: any) => {
  console.log("Project data submitted:", projectData);
  if (projectData.id) {
    // Modal already saved to DB, just refresh queries
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  } else {
    createProjectMutation.mutate({...});
  }
  setShowProjectModal(false);
  setEditingProject(null);
};
```

---

### Part B: Add Overdue Toggle (Default OFF)

**Database Change:**
Add a new boolean column `show_overdue_suffix` to the `Projects` table with default value `false`.

```sql
ALTER TABLE "Projects" 
ADD COLUMN show_overdue_suffix boolean DEFAULT false;
```

**File: `src/hooks/recurring/useRecurringProjectsCheck.tsx`**

**Changes (lines 110-133):**
Modify the overdue logic to check the new `show_overdue_suffix` flag before adding the suffix.

```typescript
// Current:
if (!project['Project Name'].includes('(overdue)')) {
  // Always adds suffix
  await supabase.from('Projects')
    .update({ 'Project Name': `${project['Project Name']} (overdue)` })
    .eq('id', project.id);
}

// Fixed:
// Only add suffix if show_overdue_suffix is true
if (project.show_overdue_suffix && !project['Project Name'].includes('(overdue)')) {
  await supabase.from('Projects')
    .update({ 'Project Name': `${project['Project Name']} (overdue)` })
    .eq('id', project.id);
}
```

**File: `src/components/project/ProjectModal.tsx`**

**Changes:**
1. Add state for the toggle: `const [showOverdueSuffix, setShowOverdueSuffix] = useState(false);`
2. Load the value from project data in useEffect
3. Include the toggle in the Details tab UI
4. Save the value when updating/creating projects

**UI Addition (in Details tab):**
```tsx
<div className="flex items-center space-x-2">
  <Switch
    id="show-overdue-suffix"
    checked={showOverdueSuffix}
    onCheckedChange={setShowOverdueSuffix}
  />
  <Label htmlFor="show-overdue-suffix" className="text-sm">
    Add "(overdue)" to name when past due
  </Label>
</div>
```

**File: `src/hooks/recurring/useProjectsQuery.tsx`**

**Changes:**
Ensure the `show_overdue_suffix` field is included in the query select.

---

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/TaskView.tsx` | Remove duplicate update call in `handleProjectSubmit` |
| `src/components/project/ProjectModal.tsx` | Add toggle state, UI, and save logic for `show_overdue_suffix` |
| `src/hooks/recurring/useRecurringProjectsCheck.tsx` | Check `show_overdue_suffix` before adding suffix |
| `src/hooks/recurring/useProjectsQuery.tsx` | Include new field in query |
| Database migration | Add `show_overdue_suffix` column to Projects table |

---

### What This Does NOT Change

- No changes to task list recurring logic
- No styling changes beyond adding the toggle
- No changes to how subtasks work
- No changes to progressive mode
- No changes to fulfillment logic

---

### Testing Plan

1. **Rename Test:**
   - Open project modal for "Winkler Game (overdue)"
   - Change name to "Winkler FPS"
   - Save and verify the name persists

2. **Overdue Toggle OFF (default):**
   - Create a new project with a past due date
   - Verify "(overdue)" is NOT automatically added
   - Toggle should show as OFF

3. **Overdue Toggle ON:**
   - Enable the toggle on a project
   - Set a past due date
   - Trigger the recurring check
   - Verify "(overdue)" is added

4. **Manual Name Edit:**
   - User can freely edit project name to add/remove "(overdue)" text regardless of toggle state
