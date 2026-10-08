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
  /** yyyy-mm-dd where the longest run started, null when no activity */
  longestStart: string | null;
  /** yyyy-mm-dd where the longest run ended, null when no activity */
  longestEnd: string | null;
  activeDays: number;
  /** learning days in the current calendar month */
  monthDays: number;
  /** YYYY-MM prefix of "today" used for monthDays */
  monthKey: string;
  loggedToday: boolean;
  lastActiveDate: string | null;
  /** total learning minutes per yyyy-mm-dd (session-only) */
  minutesByDate: Record<string, number>;
  /** completed learning sessions per yyyy-mm-dd (session-only) */
  sessionsByDate: Record<string, number>;
}

function emptyStreak(today: string): StreakInfo {
  return {
    current: 0,
    longest: 0,
    longestStart: null,
    longestEnd: null,
    activeDays: 0,
    monthDays: 0,
    monthKey: today.slice(0, 7),
    loggedToday: false,
    lastActiveDate: null,
    minutesByDate: {},
    sessionsByDate: {},
  };
}

function isValidDateOnly(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  // Reject impossible calendar dates (e.g. 2026-99-99) that pass the shape check.
  const [y, m, d] = dateStr.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function computeStreak(allDates: string[]): StreakInfo {
  const today = todayString();
  const dates = uniqueSortedDates(allDates.filter(isValidDateOnly));
  if (dates.length === 0) {
    return emptyStreak(today);
  }
  const loggedToday = dates.includes(today);

  // longest run + its exact start/end dates. Earliest run wins ties
  // so the personal best is stable and never lost while history exists.
  let longest = 1;
  let longestStart = dates[0];
  let longestEnd = dates[0];
  let run = 1;
  let runStart = dates[0];
  for (let i = 1; i < dates.length; i++) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) {
      run += 1;
    } else {
      run = 1;
      runStart = dates[i];
    }
    if (run > longest) {
      longest = run;
      longestStart = runStart;
      longestEnd = dates[i];
    }
  }

  // current streak: count back from today (or yesterday if today not logged).
  // Miss a day -> gap -> current is 0. Learn today -> continues iff
  // yesterday was also a learning day, otherwise a new streak of 1.
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

  const monthKey = today.slice(0, 7);
  return {
    current,
    longest,
    longestStart,
    longestEnd,
    activeDays: dates.length,
    monthDays: dates.filter((d) => d.startsWith(monthKey)).length,
    monthKey,
    loggedToday,
    lastActiveDate: dates[dates.length - 1],
    minutesByDate: {},
    sessionsByDate: {},
  };
}

/**
 * Streak source of truth for LearnFlow.
 *
 * A learning day counts ONLY when at least one completed learning session
 * (kind === 'session') was recorded for that date. Tasks, goals, and
 * roadmap-step completions never count. Everything is derived from actual
 * completion records — nothing is estimated or faked.
 */
export function computeLearningStreak(completions: CompletionEntry[]): StreakInfo {
  const today = todayString();
  const minutesByDate: Record<string, number> = {};
  const sessionsByDate: Record<string, number> = {};
  for (const c of completions) {
    if (c.kind !== 'session') continue;
    if (!isValidDateOnly(c.date)) continue;
    if (c.date > today) continue; // ignore future-dated records
    minutesByDate[c.date] = (minutesByDate[c.date] ?? 0) + Math.max(0, c.minutes || 0);
    sessionsByDate[c.date] = (sessionsByDate[c.date] ?? 0) + 1;
  }
  const base = computeStreak(Object.keys(minutesByDate));
  return { ...base, minutesByDate, sessionsByDate };
}

/** Intensity 0-4 based on total learning minutes in a day. */
export function intensityForMinutes(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

/** Parse a YYYY-MM key into year/month numbers. */
export function parseMonthKey(monthKey: string): { year: number; month: number } {
  const [y, m] = monthKey.split('-').map(Number);
  const now = new Date();
  const year = Number.isFinite(y) ? y : now.getFullYear();
  const month = Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1;
  return { year, month };
}

/** Shift a YYYY-MM key by delta months (negative = back). */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Human label for a YYYY-MM key, e.g. "October 2026". */
export function formatMonthKey(monthKey: string): string {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
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

/** ISO week key YYYY-Www for a yyyy-mm-dd date. */
export function weekKeyFor(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  // Thursday determines the ISO week-year.
  const tmp = new Date(d);
  const day = (tmp.getDay() + 6) % 7; // Mon=0..Sun=6
  tmp.setDate(tmp.getDate() - day + 3);
  const weekYear = tmp.getFullYear();
  const jan4 = new Date(weekYear, 0, 4);
  const janDay = (jan4.getDay() + 6) % 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - janDay);
  const weekNo = Math.floor(Math.round((tmp.getTime() - week1Mon.getTime()) / 86400000) / 7) + 1;
  return `${weekYear}-W${String(weekNo).padStart(2, '0')}`;
}

export function currentWeekKey(): string {
  return weekKeyFor(todayString());
}

export function formatWeekKey(weekKey: string): string {
  const m = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!m) return weekKey;
  return `Week ${m[2]}, ${m[1]}`;
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
