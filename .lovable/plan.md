# Watch Mode for Galaxy Watch 8 Classic: research first, then build

## Goal
On the Galaxy Watch 8 Classic, show a new interface built for the watch. In a desktop browser and in the phone app, nothing changes at all. Later on, show live task info on a watch face.

## Phase 0: Research (do this before building)

Known facts (still to be checked on the real watch):
- Galaxy Watch 8 Classic: Wear OS 6 with One UI 8 Watch. Round 1.34" screen, 438x438 px. Has a rotating bezel, which the watch reports as "rotary" input.
- **Watch faces cannot run this web app.** Wear OS watch faces now have to use Google's Watch Face Format. That format is a layout file with no code and no web pages. It can show data from small "complications" (data slots) that a separate watch app provides.
- So the realistic watch-face path looks like this:

```text
App data  ->  small native Wear OS app (Kotlin)  ->  complication data
                                                ->  Watch Face Format face shows:
                                                    current task, time left, phase progress
```

- The interactive watch screen (timer, completing tasks) has two options:
  - A. Wrap the web app in a Wear OS app that shows web pages (an APK installed onto the watch). Fast, and reuses this project.
  - B. Build a fully native Wear OS app. Best battery life and bezel support, but it's a separate project.

Things to confirm on the real watch before choosing:
1. Can a wrapped web-page APK be installed on the watch? (Requires developer mode and installing from a computer.)
2. Does the sign-in session survive on the watch?
3. What screen size and pixel density does the app actually see?
4. Do bezel turns reach the page as scroll or wheel events?
5. How fast does the battery drain while the timer runs?

Deliverable: a short research note with a recommendation (A now, native complications later), plus a hidden diagnostics page at `/watch-debug` that shows screen size, shape, input events and sign-in status. You'll open it on the watch to answer questions 1 to 4.

## Phase 1: Watch detection (no change for phones or desktop)
- Watch mode turns on only when the screen is small and nearly square (both sides 500px or less, ratio about 1:1), or when `?watch=1` is added to the address (for testing).
- Phones are much taller than they are wide, so they never match. Desktop never matches either.
- When it's off, the app shows exactly what it shows today. Watch mode sits alongside the existing pages and doesn't rewrite them.

## Phase 2: Watch interface (layout only, same data and logic)
Circle-friendly screens, swiped or switched with the bezel:
1. **Now**: a ring countdown around the current task name, with play/pause in the center.
2. **Subtasks**: tap to mark the current subtask done.
3. **Up next**: the next 2 or 3 tasks for today (with phase locks applied).
4. **Phase**: phase progress ring. Celebrations become a short full-screen burst. Sound follows the timer's mute setting.
5. Running out of time on a phased task shows the existing three choices as large buttons.

Out of scope on the watch: CSV upload, editing projects, calendar, task management. Those stay on the phone and desktop.

## Phase 3: Watch face (after the research confirms the path)
- A separate native Wear OS project, outside this one: a complication provider plus a Watch Face Format face.
- This project only needs a small read-only data endpoint (current task, end time, phase %). It will be planned separately once Phase 0 is done.

## Technical details
- `src/hooks/useIsWatch.ts`: checks viewport size and aspect ratio, `(shape: round)` where supported, and the `?watch=1` flag. Remembers the flag for the session.
- `src/components/watch/*`: new watch screens that reuse `usePomodoro`, `usePhaseGate` and the existing mutations, passed in as props.
- `Index.tsx` renders `<WatchApp/>` only when `useIsWatch()` is true. Otherwise it renders the current tree unchanged.
- Bezel input is handled with `wheel` events, to be confirmed in Phase 0.
- No database changes in Phases 0 to 2.
