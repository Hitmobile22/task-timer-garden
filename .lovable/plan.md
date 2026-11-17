# Sticky Notes Tray (Scheduler page)

## What you'll get
A horizontally scrollable tray of sticky-note cards at the bottom of the scheduler page, under Today's Tasks. It starts open and can be collapsed into a small pill. When it opens it slides and fades in gently, and the cards appear one after another.

## Look
- Paper-style notes with soft corners, a slight random tilt, a folded corner and a "pin" dot. They look different from the task rows and timer.
- Freeform notes use warm paper tones. Linked notes take their list's color as a tint, plus a small tag showing the project or task name.
- Light, dark and Night themes use their own colors, so notes glow softly on the black Night background.
- Cards are about 180px wide with readable text, and the tray is about 130px tall, so it doesn't take much space.

## Adding notes quickly
- A "+ Note" card sits first in the tray. Clicking it turns the card into an input right there. Press Enter to save and Esc to cancel.
- An optional "Link" button opens a small search box covering your active projects and open tasks, grouped by type. Use the arrow keys and Enter to pick one.
- Shortcut: type `@` in the note text to open the same search.

## Using a note
- Click a card to open a small panel with the full text and the actions: **Queue today**, Edit, Change link, Delete.
- **Queue today**:
  - Linked to a project: creates a 25-min task in that project and its list, placed in the next open slot today.
  - Linked to a task: moves that existing task into the next open slot today, if it isn't already scheduled for today.
  - Not linked: creates a 25-min task in the Default list, named after the note.
- After you queue it, the note stays pinned with a "Queued today" badge, and you can archive it. Drag cards left or right to reorder them.

## Rules kept
- Notes live in their own new table. Tasks, Projects, Lists and other existing tables are not changed.
- New tasks use the same New York time and 3 AM day boundary as the rest of the app, and they follow the existing phase rules.
- The timer, Today's Tasks, the CSV import and the voice AI are not touched.

## Technical details
- New table `sticky_notes`: id, user_id (not null), content, project_id (nullable, plain bigint), task_id (nullable, plain bigint), color, sort_order, is_archived, last_queued_at, created_at, updated_at. It has grants for authenticated and service_role, row-level security (`user_id = auth.uid()`) and an updated_at trigger.
- New `src/components/sticky/StickyTray.tsx`, `StickyCard.tsx`, `StickyQuickAdd.tsx`, `StickyLinkSearch.tsx` (using the cmdk Command component) and a `useStickyNotes` hook with React Query.
- The tray is rendered below TaskList in `src/pages/Index.tsx`. The collapsed state is saved in localStorage. Animation uses Tailwind keyframes (`sticky-in`), and new tokens go in index.css.
- The queue logic goes in `src/utils/stickyQueue.ts`, which reuses `estDayWindow` to find the next slot. It has a test for slot placement and the Default-list fallback.
