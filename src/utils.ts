import type { CompletionEntry } from './types';

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function toISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return toISODate(new Date());
}

export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return 'No date';
  try {
    const d = dateStr.includes('T') ? new Date(dateStr) : parseDateOnly(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatShort(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseDateOnly(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isToday(dateStr: string): boolean {
  return dateStr === todayString();
}

export function isOverdue(dueDate: string, done: boolean): boolean {
  if (done || !dueDate) return false;
  return dueDate < todayString();
}

export function daysBetween(a: string, b: string): number {
  const da = parseDateOnly(a).getTime();
  const db = parseDateOnly(b).getTime();
  return Math.round((db - da) / 86400000);
}

/** Unique sorted date strings ascending */
export function uniqueSortedDates(dates: string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

export interface StreakInfo {
  current: number;
  longest: number;
  activeDays: number;
  loggedToday: boolean;
  lastActiveDate: string | null;
}

export function computeStreak(allDates: string[]): StreakInfo {
  const dates = uniqueSortedDates(allDates);
  if (dates.length === 0) {
    return { current: 0, longest: 0, activeDays: 0, loggedToday: false, lastActiveDate: null };
  }
  const today = todayString();
  const loggedToday = dates.includes(today);

  // longest
  let longest = 1;
  let run = 1;
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  // current streak: count back from today (or yesterday if today not logged)
  const set = new Set(dates);
  let current = 0;
  const cursor = new Date();
  if (!loggedToday) {
    // streak is still alive if yesterday was logged — start from yesterday
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = toISODate(cursor);
    if (set.has(key)) {
      current += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    current,
    longest,
    activeDays: dates.length,
    loggedToday,
    lastActiveDate: dates[dates.length - 1],
  };
}

export function last7Days(): string[] {
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(toISODate(d));
  }
  return out;
}

export interface GoalStats {
  /** linked minutes in the last 7 days */
  weekMinutes: number;
  /** linked minutes logged today */
  todayMinutes: number;
  /** total linked minutes of all time */
  totalMinutes: number;
  /** weekMinutes / weeklyTarget as 0-100, or null when no weekly target */
  progress: number | null;
  /** consecutive-day streak from linked activity */
  streak: number;
  /** yyyy-mm-dd of most recent linked activity, or null */
  lastDate: string | null;
  /** number of linked sessions of all time */
  sessions: number;
}

/**
 * Progress comes only from recorded activity linked to the goal —
 * never estimated, never inferred from other entities.
 */
export function goalStats(
  completions: CompletionEntry[],
  goalId: string,
  weeklyTargetMinutes: number,
): GoalStats {
  const linked = completions.filter((c) => c.goalId === goalId);
  const today = todayString();
  const week = new Set(last7Days());
  let weekMinutes = 0;
  let todayMinutes = 0;
  let totalMinutes = 0;
  let sessions = 0;
  for (const c of linked) {
    totalMinutes += c.minutes || 0;
    if (c.kind === 'session') sessions += 1;
    if (week.has(c.date)) weekMinutes += c.minutes || 0;
    if (c.date === today) todayMinutes += c.minutes || 0;
  }
  const dates = uniqueSortedDates(linked.map((c) => c.date));
  return {
    weekMinutes,
    todayMinutes,
    totalMinutes,
    progress:
      weeklyTargetMinutes > 0
        ? Math.min(100, Math.round((weekMinutes / weeklyTargetMinutes) * 100))
        : null,
    streak: computeStreak(dates).current,
    lastDate: dates.length > 0 ? dates[dates.length - 1] : null,
    sessions,
  };
}
