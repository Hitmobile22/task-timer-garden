# Smarter search on /tasks

## What you'll see
- As you type, the page instantly reorganizes itself (visual only, nothing saved):
  - Lists, projects and tasks with no match are hidden.
  - The best-matching list goes to the top, the best-matching project goes to the top of its list, and the best-matching tasks go to the top of each project.
  - Lists, projects, and tasks containing a match open automatically, so you don't have to click anything open.
  - The matching words are highlighted in the names.
- Matches include task names, project names, list names and subtask names. If a project or list name matches, all of its content is shown. If a subtask matches, its parent task opens and shows it.
- Clear the search box and everything goes back to how it was, including what was open or closed before you started searching.
- The status filter (Not started, In progress, etc.) and the "Group by" option still work alongside search.

## How "best match" is ranked
1. Exact name match
2. Name starts with the search text
3. A word in the name starts with the search text
4. Search text appears anywhere in the name
5. All search words appear somewhere in the name, in any order (so "paint acct" finds "PaintHitter Acct")

A project or list ranks by its own name or its best-matching task/subtask, whichever is higher. Ties keep the current order.

## What won't change
- No database changes, and nothing saved: order and open/closed state while searching apply only on screen.
- Editing, dragging, deleting, archiving, recurring settings, and the normal (empty-search) display stay the same.

## Technical details
- New pure helper `src/utils/taskSearchUtils.ts`: `scoreMatch(name, query)` returning 0–5 per the tiers above, plus a highlight helper.
- `src/pages/TaskView.tsx`:
  - Use a debounced (~150ms) copy of `searchQuery` when building results.
  - When the query is non-empty, compute a `searchResult` memo: per-task score (max of task name, its subtasks', its project name, its list name), per-project and per-list score; filter out zero-scored items and sort descending (stable sort keeps the original order for ties).
  - Project tasks currently render from the unfiltered `tasks` array; while searching, use the filtered/ranked project tasks instead. With an empty query, rendering uses exactly the current code path.
  - Derived "effective" open state while searching: `effectiveCollapsedLists = []` for matched lists, `effectiveExpanded = expandedTasks ∪ matched project ids ∪ ids of tasks with matching subtasks`. The real `collapsedLists`/`expandedTasks` state is never overwritten, so clearing the search restores the previous view. Manual toggles during search still work and update the real state.
  - Pass a `highlightQuery` prop through `TaskListComponent` → `TaskItem` → `TaskNameCell` / `SubtaskItem` (optional prop; no effect when empty).
  - Show a small "No matches" message when nothing scores.
- Applies in "By Project" and "By List" grouping; "By Date" gets ranked ordering of the flat list.
