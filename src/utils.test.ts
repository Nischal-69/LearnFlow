import { describe, expect, it } from 'vitest';
import type { CompletionEntry } from './types';
import {
  computeLearningStreak,
  computeStreak,
  goalStats,
  toISODate,
} from './utils';

function dayShift(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toISODate(d);
}

function session(date: string, minutes = 25, extra: Partial<CompletionEntry> = {}): CompletionEntry {
  return {
    id: `log_${date}_${Math.random().toString(36).slice(2, 8)}`,
    date,
    kind: 'session',
    title: 'Test session',
    minutes,
    goalId: null,
    roadmapId: null,
    roadmapStepId: null,
    understood: '',
    struggled: '',
    next: '',
    notes: '',
    createdAt: new Date().toISOString(),
    ...extra,
  };
}

describe('computeStreak', () => {
  it('returns an empty streak for no dates', () => {
    const s = computeStreak([]);
    expect(s).toMatchObject({ current: 0, longest: 0, loggedToday: false, activeDays: 0 });
    expect(s.longestStart).toBeNull();
    expect(s.longestEnd).toBeNull();
  });

  it('case 1: learn today → streak = 1', () => {
    const s = computeStreak([dayShift(0)]);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
    expect(s.loggedToday).toBe(true);
  });

  it('case 2: learn today + yesterday → streak = 2', () => {
    const s = computeStreak([dayShift(-1), dayShift(0)]);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(2);
  });

  it('case 3: miss a day → current streak resets', () => {
    // Active 3 and 2 days ago, gap yesterday, active today.
    const s = computeStreak([dayShift(-3), dayShift(-2), dayShift(0)]);
    expect(s.current).toBe(1);
    expect(s.longest).toBe(2);
  });

  it('case 4: continue an existing streak → increments', () => {
    const before = computeStreak([dayShift(-2), dayShift(-1)]);
    expect(before.current).toBe(2);
    const after = computeStreak([dayShift(-2), dayShift(-1), dayShift(0)]);
    expect(after.current).toBe(3);
    expect(after.longest).toBe(3);
  });

  it('case 5: longer historical streak → longest updates with exact bounds', () => {
    const dates = [dayShift(-40), dayShift(-39), dayShift(-38), dayShift(-37), dayShift(-36), dayShift(0)];
    const s = computeStreak(dates);
    expect(s.longest).toBe(5);
    expect(s.longestStart).toBe(dayShift(-40));
    expect(s.longestEnd).toBe(dayShift(-36));
  });

  it('case 6: shorter current streak → longest remains unchanged', () => {
    const dates = [dayShift(-30), dayShift(-29), dayShift(-28), dayShift(-27), dayShift(-26), dayShift(-1), dayShift(0)];
    const s = computeStreak(dates);
    expect(s.current).toBe(2);
    expect(s.longest).toBe(5);
    expect(s.longestStart).toBe(dayShift(-30));
  });

  it('earliest run wins longest ties (stable personal best)', () => {
    const s = computeStreak([dayShift(-10), dayShift(-9), dayShift(-2), dayShift(-1)]);
    expect(s.longest).toBe(2);
    expect(s.longestStart).toBe(dayShift(-10));
  });

  it('deduplicates repeated dates and ignores invalid ones', () => {
    const today = dayShift(0);
    const s = computeStreak([today, today, 'not-a-date', '2026-99-99']);
    expect(s.activeDays).toBe(1);
    expect(s.current).toBe(1);
  });
});

describe('computeLearningStreak', () => {
  it('counts only session kinds', () => {
    const today = dayShift(0);
    const completions: CompletionEntry[] = [
      { ...session(today), kind: 'task', minutes: 0 },
      { ...session(today), kind: 'goal', minutes: 0 },
      { ...session(today), kind: 'roadmap-step', minutes: 0 },
    ];
    const s = computeLearningStreak(completions);
    expect(s.current).toBe(0);
    expect(s.activeDays).toBe(0);
    expect(s.loggedToday).toBe(false);
  });

  it('aggregates minutes and session counts per day', () => {
    const today = dayShift(0);
    const s = computeLearningStreak([session(today, 20), session(today, 45)]);
    expect(s.current).toBe(1);
    expect(s.minutesByDate[today]).toBe(65);
    expect(s.sessionsByDate[today]).toBe(2);
  });

  it('ignores future-dated sessions', () => {
    const s = computeLearningStreak([session(dayShift(1), 60)]);
    expect(s.current).toBe(0);
    expect(s.activeDays).toBe(0);
  });

  it('builds multi-day streaks from sessions across days', () => {
    const s = computeLearningStreak([session(dayShift(-2)), session(dayShift(-1)), session(dayShift(0))]);
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
  });
});

describe('goalStats', () => {
  it('derives progress only from linked activity', () => {
    const today = dayShift(0);
    const completions = [
      session(today, 60, { goalId: 'g1' }),
      session(dayShift(-1), 60, { goalId: 'g1' }),
      session(today, 30, { goalId: 'g2' }),
    ];
    const stats = goalStats(completions, 'g1', 120);
    expect(stats.todayMinutes).toBe(60);
    expect(stats.weekMinutes).toBe(120);
    expect(stats.progress).toBe(100);
    expect(stats.sessions).toBe(2);
  });
});
