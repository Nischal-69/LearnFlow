import type { LearnFlowState, ViewKey } from './types';
import type { StreakInfo } from './utils';
import { todayString } from './utils';

export interface ReminderPreferences {
  enabled: boolean;
  dailyLearning: boolean;
  tasks: boolean;
  roadmaps: boolean;
  dailyReview: boolean;
}

export const REMINDER_PREFS_KEY = 'learnflow-reminder-prefs-v1';
export const REMINDER_DISMISS_KEY = 'learnflow-reminder-dismissed-v1';

export const DEFAULT_REMINDER_PREFS: ReminderPreferences = {
  enabled: true,
  dailyLearning: true,
  tasks: true,
  roadmaps: true,
  dailyReview: true,
};

export interface DismissedReminders {
  date: string; // yyyy-mm-dd — dismissals auto-expire the next day
  ids: string[];
}

export const EMPTY_DISMISSED: DismissedReminders = { date: todayString(), ids: [] };

export function normalizeReminderPrefs(raw: unknown): ReminderPreferences {
  const r = (raw ?? {}) as Partial<ReminderPreferences>;
  return {
    enabled: r.enabled !== false,
    dailyLearning: r.dailyLearning !== false,
    tasks: r.tasks !== false,
    roadmaps: r.roadmaps !== false,
    dailyReview: r.dailyReview !== false,
  };
}

export function normalizeDismissed(raw: unknown): DismissedReminders {
  const r = (raw ?? {}) as Partial<DismissedReminders>;
  const ids = Array.isArray(r.ids) ? r.ids.filter((x): x is string => typeof x === 'string') : [];
  const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : todayString();
  // Expire yesterday's dismissals.
  if (date !== todayString()) return { date: todayString(), ids: [] };
  return { date, ids };
}

export function withDismissed(prev: DismissedReminders, id: string): DismissedReminders {
  const today = todayString();
  const base = prev.date === today ? prev.ids : [];
  if (base.includes(id)) return { date: today, ids: base };
  return { date: today, ids: [...base, id] };
}

export type ReminderKind = 'daily' | 'streak' | 'task' | 'roadmap' | 'review';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  message: string;
  detail?: string;
  go?: ViewKey;
}

function isStepIncomplete(s: { status?: string; done?: boolean }): boolean {
  return (s.status ?? (s.done ? 'completed' : 'not_started')) !== 'completed';
}

/**
 * Build gentle, in-app reminders. Pure function — no side effects, no
 * scheduling, no browser notifications. Returns at most 3 items ordered
 * streak → daily → task → roadmap so the UI never nags.
 */
export function buildReminders(
  state: LearnFlowState,
  streak: StreakInfo,
  prefs: ReminderPreferences,
): Reminder[] {
  if (!prefs.enabled) return [];
  const out: Reminder[] = [];
  const today = todayString();

  // Streak nudge: logging today would tie or beat the personal best.
  if (prefs.dailyLearning && !streak.loggedToday && streak.longest > 1 && streak.current + 1 >= streak.longest) {
    out.push({
      id: 'streak-near-best',
      kind: 'streak',
      message: "You're one day away from your longest streak.",
      detail: `${streak.current}-day now · best ${streak.longest}`,
      go: 'streaks',
    });
  }

  // Daily learning reminder.
  if (prefs.dailyLearning && !streak.loggedToday) {
    const target = state.settings.dailyLearningTargetMinutes;
    const hasActiveGoal = state.goals.some((g) => g.status === 'active');
    if (hasActiveGoal) {
      const oldest = [...state.goals]
        .filter((g) => g.status === 'active')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      const todayMinutes = state.completions
        .filter((c) => c.date === today && c.kind === 'session')
        .reduce((a, c) => a + Math.max(0, c.minutes || 0), 0);
      out.push({
        id: 'daily-today',
        kind: 'daily',
        message: "You haven't logged learning today.",
        detail:
          target > 0
            ? `${todayMinutes}/${target} min today · Goal: ${oldest.title}`
            : oldest
              ? `Goal: ${oldest.title}`
              : undefined,
        go: 'learning',
      });
    } else {
      out.push({
        id: 'daily-today',
        kind: 'daily',
        message: 'Your learning goal is waiting for you.',
        go: 'learning',
      });
    }
  }

  // Task reminder — collapsed to a single gentle item.
  if (prefs.tasks) {
    const open = state.tasks.filter((t) => t.status !== 'completed' && !t.done);
    const overdue = open.filter((t) => t.dueDate < today);
    const dueToday = open.filter((t) => t.dueDate === today);
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })();
    const dueTomorrow = open.filter((t) => t.dueDate === tomorrow);
    if (overdue.length > 0) {
      out.push({
        id: 'tasks-due',
        kind: 'task',
        message:
          overdue.length === 1
            ? 'One task is overdue — no rush, pick it up when ready.'
            : `${overdue.length} tasks are overdue — no rush, pick one when ready.`,
        detail: overdue.slice(0, 2).map((t) => t.title).join(' · ') || undefined,
        go: 'tasks',
      });
    } else if (dueToday.length > 0) {
      out.push({
        id: 'tasks-due',
        kind: 'task',
        message:
          dueToday.length === 1
            ? 'One task is due today, whenever you’re ready.'
            : `${dueToday.length} tasks are due today, whenever you’re ready.`,
        detail: dueToday.slice(0, 2).map((t) => t.title).join(' · ') || undefined,
        go: 'tasks',
      });
    } else if (dueTomorrow.length > 0) {
      out.push({
        id: 'tasks-due',
        kind: 'task',
        message:
          dueTomorrow.length === 1
            ? 'One task is due tomorrow.'
            : `${dueTomorrow.length} tasks are due tomorrow.`,
        go: 'tasks',
      });
    }
  }

  // Roadmap reminder — point at the current step of the oldest active roadmap.
  if (prefs.roadmaps) {
    const active = [...state.roadmaps]
      .filter((r) => r.steps.some(isStepIncomplete))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (active) {
      const steps = active.steps;
      const current =
        steps.find((s) => (s.status ?? (s.done ? 'completed' : 'not_started')) === 'in_progress') ??
        steps.find(isStepIncomplete);
      if (current) {
        out.push({
          id: `roadmap-current-${active.id}`,
          kind: 'roadmap',
          message: `Your roadmap “${active.title}” is waiting — next up: ${current.title}.`,
          go: 'roadmaps',
        });
      }
    }
  }

  // Daily review reminder — gentle nudge when today has no review yet.
  if (prefs.dailyReview && !(state.dailyReviews ?? []).some((r) => r.date === today)) {
    out.push({
      id: 'review-today',
      kind: 'review',
      message: 'Take a moment to review your day.',
      detail: 'A short reflection keeps the habit going',
      go: 'dashboard',
    });
  }

  return out.slice(0, 3);
}

/** Remove reminders dismissed today (dismissals expire daily via normalizeDismissed). */
export function filterDismissed(reminders: Reminder[], dismissed: DismissedReminders): Reminder[] {
  if (dismissed.ids.length === 0) return reminders;
  const set = new Set(dismissed.ids);
  return reminders.filter((r) => !set.has(r.id));
}
