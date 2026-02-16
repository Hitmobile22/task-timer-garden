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
