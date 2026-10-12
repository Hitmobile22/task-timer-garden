# Phase System for Long Projects

Break a long project into numbered phases. Each phase holds tasks connected by "this unlocks that" links. The timer page shows only your current phase and the next few unlocked tasks. Finishing tasks and phases gives you visual feedback and the rewards you set. Existing projects, tasks, recurring settings, and goals stay as they are. A project without phases works exactly as it does today.

## What you will see

**Editing a project on /tasks**
- A new "Phases" section in Edit Project.
- Add phases (numbered 1, 2, 3...), each with an optional reward.
- Each task gets a phase picker and an "Unlocked after" picker that lists other tasks in the same phase.
- If you leave "Unlocked after" blank, tasks unlock in their listed order.

**Timer page (/) and the Today queue**
- For a phased project, only the unlocked tasks in the current phase appear (up to the next 3). Locked tasks stay hidden.
- A small badge shows something like "Phase 2 of 4 - 3/7 done".
- When you complete a task, the tasks it unlocks slide in with a soft pulse.
- With 1 or 2 tasks left in a phase, a gentle "almost there" glow appears on the progress badge.
- When you finish a phase, a small celebration banner shows the reward you set. The level-up sound plays only if the timer is unmuted. The next phase's first tasks then unlock.

**Timer runs out on a phased task with unfinished subtasks**
- A "Keep momentum" dialog offers three choices: "Extend 10 min", "Move behind the next task / next 2 / next 3", or "Leave as is".
- Every other case keeps the current timer behavior.

**/tasks search, lists, and normal views**
- Unchanged. Phased tasks are still regular tasks, and a small "P2" tag shows their phase.

## Upload CSV > All

Two optional columns are added at the end. Your existing CSVs still work without changes.

| Column | Applies to | Format |
|---|---|---|
| Phase | Task | A number (1, 2, 3...). Leave it blank for no phase |
| Reward | Project or Task | On a Project row: the reward for finishing the whole project. On the first task row of a phase: that phase's reward |

Within each phase, tasks unlock in the order they appear in the CSV. The preview groups tasks as Project > Phase > Tasks.

```text
Type,Name,Project,Task,List,Start Date,Due Date,Duration,Progress,Description,Phase,Reward
Project,Novel Writing,,,Art!,2026-10-15,2026-12-01,,,,,Weekend getaway
Task,Outline,Novel Writing,,,,,60,,,1,Coffee on the patio
Task,Character sheets,Novel Writing,,,,,45,,,1,
Task,Draft chapter 1,Novel Writing,,,,,90,,,2,New notebook
```

## Out of scope
- No changes to existing tables, the recurring system, or the goals and rewards system.
- Recurring projects cannot be phased in this version.

## Technical details
- New tables (with grants, row-level security limited to `user_id = auth.uid()`, and timestamps):
  - `project_phases`: id, user_id, project_id, phase_number, reward, completed_at.
  - `project_phase_tasks`: id, user_id, phase_id, task_id (unique), position, depends_on bigint[].
- A task is unlocked when it belongs to the lowest unfinished phase and all of its `depends_on` tasks are Completed. If `depends_on` is empty, the task depends on the previous task by position. Current phase = the lowest phase that still has incomplete tasks. All of this is worked out on the device in `src/utils/phaseUtils.ts`, with tests.
- New `usePhases` hook. The Today queue in `usePomodoro`/`TaskList` filters out locked phased tasks (no changes to queries for non-phased tasks).
- Unlock and celebration feedback: a Framer-style CSS keyframe pulse and a banner component. The sound goes through the existing `usePomodoroSounds`, which already respects mute.
- Momentum dialog: hooks into the timer reaching 0 in `PomodoroTimer`, only when the task is phased and has incomplete subtasks. "Move behind" reuses the existing rescheduling helpers.
- CSV: `csvFullImportUtils.ts` reads optional `phase` and `reward` columns, and `CSVUploadModal` inserts the phase rows after creating tasks.
- Project deletion in TaskView also removes that project's phase rows.
