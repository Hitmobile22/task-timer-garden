

## Plan: Consolidated Native Notification for Project Reminders

### Overview

Instead of firing one native notification per project, create a single summary notification that groups all due-soon projects by days remaining, with friendly messaging. This runs after the existing `checkProjectsDueSoon` logic inserts new rows into the database.

### Dependencies to Install

- `@capacitor/core` -- needed for `Capacitor.isNativePlatform()`
- `@capacitor/local-notifications` -- for scheduling local device notifications

### New File: `src/lib/nativeNotifications.ts`

A utility module that:
1. Detects native vs. browser using `Capacitor.isNativePlatform()`
2. Requests notification permissions on app start
3. Builds a **single consolidated notification** from all unread project notifications, grouped by `days_remaining`

The key function `scheduleProjectRemindersSummary` will:
- Accept the full array of unread `ProjectNotification[]`
- Group them by `days_remaining`
- Build a body like:

```
Hey! You have some upcoming project due dates:

Project A - DUE TOMORROW
Project B & Project C - Due in 2 days
Project D - Due in 5 days
```

- Schedule one local notification with a fixed ID (so it replaces any previous summary rather than stacking)

```typescript
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export async function initNativeNotifications() {
  if (!isNativePlatform()) return;
  const result = await LocalNotifications.requestPermissions();
  if (result.display !== 'granted') {
    console.warn('Notification permission not granted');
  }
}

export async function scheduleProjectRemindersSummary(
  notifications: { project_name: string; days_remaining: number }[]
) {
  if (!isNativePlatform() || notifications.length === 0) return;

  // Group by days_remaining
  const grouped: Record<number, string[]> = {};
  for (const n of notifications) {
    if (!grouped[n.days_remaining]) grouped[n.days_remaining] = [];
    grouped[n.days_remaining].push(n.project_name);
  }

  // Build body lines, sorted by urgency
  const lines: string[] = [];
  for (const days of Object.keys(grouped).map(Number).sort((a, b) => a - b)) {
    const names = grouped[days];
    const nameStr = names.length <= 2
      ? names.join(' & ')
      : names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];

    if (days === 0) lines.push(`${nameStr} - DUE TODAY`);
    else if (days === 1) lines.push(`${nameStr} - DUE TOMORROW`);
    else lines.push(`${nameStr} - Due in ${days} days`);
  }

  const body = 'Hey! You have some upcoming project due dates:\n\n' + lines.join('\n');

  // Use a fixed ID (99999) so it replaces the previous summary
  await LocalNotifications.schedule({
    notifications: [{
      title: 'Project Reminders',
      body,
      id: 99999,
      schedule: { at: new Date(Date.now() + 1000) },
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#3B82F6',
    }],
  });
}
```

### Changes to `src/hooks/useProjectNotifications.tsx`

After the `checkProjectsDueSoon` function successfully creates new notifications (line ~131, after `queryClient.invalidateQueries`), add a call to build and fire the consolidated notification using **all** current unread notifications (not just newly created ones):

```typescript
import { isNativePlatform, scheduleProjectRemindersSummary } from '@/lib/nativeNotifications';

// After inserting new notifications and invalidating queries:
if (isNativePlatform()) {
  // Fetch all current unread notifications for the summary
  const { data: allUnread } = await supabase
    .from('project_notifications')
    .select('project_name, days_remaining')
    .eq('is_read', false)
    .eq('user_id', user.id);

  if (allUnread && allUnread.length > 0) {
    await scheduleProjectRemindersSummary(allUnread);
  }
}
```

This ensures the phone notification always shows a complete picture of all pending reminders, not just the ones generated in this cycle.

### Changes to `src/App.tsx`

Add a `useEffect` to request notification permissions on startup:

```typescript
import { useEffect } from 'react';
import { initNativeNotifications } from '@/lib/nativeNotifications';

// Inside App component, before the return:
useEffect(() => {
  initNativeNotifications();
}, []);
```

### After Building

Run your usual sequence:
```
npm run build
npx cap sync android
npx cap copy android
npx cap open android
```

The `cap sync` step will register the Local Notifications plugin in the Android project automatically.

### Files Summary

| File | Action |
|------|--------|
| `package.json` | Add `@capacitor/core` and `@capacitor/local-notifications` |
| `src/lib/nativeNotifications.ts` | New file -- native notification utility with consolidated summary |
| `src/hooks/useProjectNotifications.tsx` | Fire consolidated native notification after creating reminders |
| `src/App.tsx` | Call `initNativeNotifications()` on startup |

### What This Does NOT Change

- No database or schema changes
- No styling changes
- The in-app notification bell continues to work exactly as before
- No changes to recurring tasks, subtasks, or any other feature
- In a regular browser, all native notification calls are silently skipped
- Designed to easily add other notification categories later (the summary format is extensible)
