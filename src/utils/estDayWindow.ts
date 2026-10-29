import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const TZ = 'America/New_York';

/** Real UTC instants for the timer's "today" window (EST), with 9 PM–3 AM evening mode. */
export function estTodayWindow(now: Date = new Date()): { start: Date; end: Date; evening: boolean } {
  const est = toZonedTime(now, TZ);
  const hour = est.getHours();
  const evening = hour >= 21 || hour < 3;
  const start = new Date(est);
  const end = new Date(est);
  if (evening) {
    if (hour >= 21) { start.setHours(21, 0, 0, 0); end.setDate(end.getDate() + 1); }
    else { start.setDate(start.getDate() - 1); start.setHours(21, 0, 0, 0); }
    end.setHours(3, 0, 0, 0);
  } else {
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
  }
  return { start: fromZonedTime(start, TZ), end: fromZonedTime(end, TZ), evening };
}
