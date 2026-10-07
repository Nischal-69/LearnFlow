import { useMemo, useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { CompletionKind } from '../types';
import {
  formatDate,
  formatMonthKey,
  intensityForMinutes,
  parseMonthKey,
  shiftMonthKey,
  todayString,
} from '../utils';
import { Badge, Card, CardHeader, EmptyState } from './ui';
import { IconFlame } from './icons';

const KIND_LABEL: Record<CompletionKind, string> = {
  task: 'Task',
  goal: 'Goal',
  'roadmap-step': 'Roadmap step',
  session: 'Session',
};

const INTENSITY_BG = ['#f1f5f9', '#e0e7ff', '#a5b4fc', '#6366f1', '#4338ca'];
const INTENSITY_LABEL = ['No learning', '1–29 min', '30–59 min', '60–119 min', '120+ min'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function Streaks({ api }: { api: LearnFlowApi }) {
  const { state, streak, deleteCompletion } = api;
  const goalById = new Map(state.goals.map((g) => [g.id, g.title]));
  const roadmapById = new Map(state.roadmaps.map((r) => [r.id, r]));
  const today = todayString();
  const currentMonthKey = today.slice(0, 7);

  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { year, month } = parseMonthKey(monthKey);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const canGoNext = monthKey < currentMonthKey;

  const monthCells = useMemo(() => {
    const cells: (string | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(dayKey(year, month, d));
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const monthStats = useMemo(() => {
    let days = 0;
    let minutes = 0;
    let sessions = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = dayKey(year, month, d);
      const mins = streak.minutesByDate[key] ?? 0;
      const count = streak.sessionsByDate[key] ?? 0;
      if (count > 0) days += 1;
      minutes += mins;
      sessions += count;
    }
    return { days, minutes, sessions };
  }, [streak.minutesByDate, streak.sessionsByDate, year, month, daysInMonth]);

  const sessionCount = state.completions.filter((c) => c.kind === 'session').length;

  const [kindFilter, setKindFilter] = useState<'all' | CompletionKind>('all');
  const visible = state.completions.filter(
    (c) =>
      (kindFilter === 'all' || c.kind === kindFilter) &&
      (!selectedDate || c.date === selectedDate),
  );
  const groups = new Map<string, typeof visible>();
  for (const c of visible) {
    if (!groups.has(c.date)) groups.set(c.date, []);
    groups.get(c.date)!.push(c);
  }
  const sortedDates = Array.from(groups.keys()).sort().reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-ink-muted">
            <IconFlame className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Current streak</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-ink">
            🔥 {streak.current} <span className="text-sm font-medium text-ink-muted">days</span>
          </p>
          <div className="mt-1.5">
            {!streak.loggedToday && streak.current > 0 && <Badge tone="warning">Log today to keep it</Badge>}
            {streak.loggedToday && <Badge tone="success">Logged today</Badge>}
            {!streak.loggedToday && streak.current === 0 && (
              <span className="text-xs text-ink-muted">Log a session today to start.</span>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-ink-muted">
            <IconFlame className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Longest streak</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-ink">
            🔥 {streak.longest} <span className="text-sm font-medium text-ink-muted">days</span>
          </p>
          <p className="mt-1.5 text-xs text-ink-muted">
            {streak.longestStart && streak.longestEnd
              ? `${formatDate(streak.longestStart)} → ${formatDate(streak.longestEnd)}`
              : 'Personal best — log learning to set it.'}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Total learning days</p>
          <p className="mt-1 text-2xl font-bold text-ink">{streak.activeDays}</p>
          <p className="mt-1 text-xs text-ink-muted">Days with a completed session</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">This month</p>
          <p className="mt-1 text-2xl font-bold text-ink">
            {streak.monthDays}
            <span className="text-sm font-medium text-ink-muted"> days</span>
          </p>
          <p className="mt-1 text-xs text-ink-muted">Learning days this month</p>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Learning calendar"
          subtitle="One learning day = at least one completed learning session. Color = minutes logged."
          action={
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setMonthKey((k) => shiftMonthKey(k, -1))}
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink hover:bg-surface"
                aria-label="Previous month"
              >
                ‹
              </button>
              <span className="min-w-[7rem] text-center text-sm font-medium text-ink">
                {formatMonthKey(monthKey)}
              </span>
              <button
                onClick={() => canGoNext && setMonthKey((k) => shiftMonthKey(k, 1))}
                disabled={!canGoNext}
                className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Next month"
              >
                ›
              </button>
            </div>
          }
        />
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                {w}
              </span>
            ))}
            {monthCells.map((date, i) => {
              if (!date) return <span key={`blank-${i}`} />;
              const minutes = streak.minutesByDate[date] ?? 0;
              const count = streak.sessionsByDate[date] ?? 0;
              const level = intensityForMinutes(minutes);
              const isToday = date === today;
              const isFuture = date > today;
              const isSelected = date === selectedDate;
              const dayNum = Number(date.slice(8, 10));
              const title = isFuture
                ? `${formatDate(date)} — upcoming`
                : count > 0
                  ? `${formatDate(date)} — ${count} session${count === 1 ? '' : 's'}, ${minutes} min`
                  : `${formatDate(date)} — no learning logged`;
              return (
                <button
                  key={date}
                  title={title}
                  aria-label={title}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDate((prev) => (prev === date ? null : date))}
                  className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs font-medium transition-transform hover:scale-105 ${
                    isFuture ? 'cursor-default opacity-40 hover:scale-100' : 'cursor-pointer'
                  } ${isToday ? 'ring-2 ring-primary-600 ring-offset-1' : ''} ${
                    isSelected ? 'ring-2 ring-ink ring-offset-1' : ''
                  }`}
                  style={{
                    backgroundColor: INTENSITY_BG[level],
                    color: level >= 3 ? '#ffffff' : '#0f172a',
                  }}
                >
                  <span>{dayNum}</span>
                  {!isFuture && count > 0 && (
                    <span className={`mt-0.5 text-[10px] leading-none ${level >= 3 ? 'text-indigo-100' : 'text-ink-muted'}`}>
                      {minutes}m
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">
              {monthStats.days} learning {monthStats.days === 1 ? 'day' : 'days'} · {monthStats.sessions}{' '}
              session{monthStats.sessions === 1 ? '' : 's'} · {monthStats.minutes} min in {formatMonthKey(monthKey)}
              {selectedDate && (
                <>
                  {' · '}
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="font-medium text-primary-600 hover:text-primary-700"
                  >
                    Clear {formatDate(selectedDate)} filter ×
                  </button>
                </>
              )}
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-muted">Less</span>
              {INTENSITY_BG.map((bg, level) => (
                <span
                  key={level}
                  title={INTENSITY_LABEL[level]}
                  className="h-4 w-4 rounded"
                  style={{ backgroundColor: bg, border: '1px solid #e2e8f0' }}
                />
              ))}
              <span className="text-xs text-ink-muted">More</span>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-muted">
            Levels: none · 1–29 · 30–59 · 60–119 · 120+ min per day. Tasks, goals, and roadmap steps don’t count —
            only completed learning sessions.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="History"
          subtitle={`${sessionCount} learning sessions · ${state.completions.length} total completions. Streaks use sessions only.`}
          action={
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            >
              <option value="all">All types</option>
              <option value="task">Tasks</option>
              <option value="goal">Goals</option>
              <option value="roadmap-step">Roadmap steps</option>
              <option value="session">Sessions</option>
            </select>
          }
        />
        <div className="space-y-5 p-4">
          {sortedDates.length === 0 ? (
            <EmptyState
              title={selectedDate ? `No entries on ${formatDate(selectedDate)}` : 'No history yet'}
              hint={selectedDate ? 'Clear the date filter to see everything.' : 'Log a learning session — only sessions count toward streaks.'}
            />
          ) : (
            sortedDates.map((date) => (
              <div key={date}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{formatDate(date)}</p>
                <div className="space-y-2">
                  {groups.get(date)!.map((c) => {
                    const goalTitle = c.goalId ? goalById.get(c.goalId) : undefined;
                    const roadmap = c.roadmapId ? roadmapById.get(c.roadmapId) : undefined;
                    const stepTitle = roadmap?.steps.find((s) => s.id === c.roadmapStepId)?.title;
                    const hasReflection =
                      c.kind === 'session' && (c.understood || c.struggled || c.next || c.notes);
                    return (
                      <div key={c.id} className="rounded-lg border border-line px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <Badge tone={c.kind === 'session' ? 'primary' : 'success'}>{KIND_LABEL[c.kind]}</Badge>
                          <p className="min-w-0 flex-1 truncate text-sm text-ink">{c.title}</p>
                          {c.minutes > 0 && <span className="shrink-0 text-xs text-ink-muted">{c.minutes} min</span>}
                          <button onClick={() => deleteCompletion(c.id)} className="rounded-md p-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete entry">
                            ×
                          </button>
                        </div>
                        {(goalTitle || (roadmap && stepTitle)) && (
                          <p className="mt-1 truncate text-xs text-ink-muted">
                            {[goalTitle, roadmap && stepTitle ? `${roadmap.title} — ${stepTitle}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        {hasReflection && (
                          <div className="mt-1.5 grid gap-1 border-t border-line pt-1.5 text-xs sm:grid-cols-2">
                            {c.understood && <p className="text-ink-secondary"><span className="font-medium text-ink-muted">Understood: </span>{c.understood}</p>}
                            {c.struggled && <p className="text-ink-secondary"><span className="font-medium text-ink-muted">Struggled: </span>{c.struggled}</p>}
                            {c.next && <p className="text-ink-secondary"><span className="font-medium text-ink-muted">Next: </span>{c.next}</p>}
                            {c.notes && <p className="text-ink-secondary"><span className="font-medium text-ink-muted">Notes: </span>{c.notes}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
