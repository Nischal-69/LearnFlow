import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { CompletionKind } from '../types';
import { formatDate, last7Days, todayString } from '../utils';
import { Badge, Card, CardHeader, EmptyState } from './ui';
import { IconFlame } from './icons';

const KIND_LABEL: Record<CompletionKind, string> = {
  task: 'Task',
  goal: 'Goal',
  'roadmap-step': 'Roadmap step',
  session: 'Session',
};

export default function Streaks({ api }: { api: LearnFlowApi }) {
  const { state, streak, deleteCompletion } = api;
  const today = todayString();
  const week = last7Days();
  const counts = week.map((d) => state.completions.filter((c) => c.date === d).length);
  const max = Math.max(1, ...counts);
  const weekMinutes = state.completions
    .filter((c) => week.includes(c.date))
    .reduce((sum, c) => sum + (c.minutes || 0), 0);

  const [kindFilter, setKindFilter] = useState<'all' | CompletionKind>('all');
  const visible = state.completions.filter((c) => kindFilter === 'all' || c.kind === kindFilter);
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
          <p className="mt-1 text-2xl font-bold text-ink">{streak.current} <span className="text-sm font-medium text-ink-muted">days</span></p>
          {!streak.loggedToday && streak.current > 0 && <Badge tone="warning">Log today to keep it</Badge>}
          {streak.loggedToday && <Badge tone="success">Logged today</Badge>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Longest streak</p>
          <p className="mt-1 text-2xl font-bold text-ink">{streak.longest} <span className="text-sm font-medium text-ink-muted">days</span></p>
          <p className="mt-1 text-xs text-ink-muted">Personal best</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Active days</p>
          <p className="mt-1 text-2xl font-bold text-ink">{streak.activeDays}</p>
          <p className="mt-1 text-xs text-ink-muted">Days with learning logged</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">This week</p>
          <p className="mt-1 text-2xl font-bold text-ink">{weekMinutes}<span className="text-sm font-medium text-ink-muted"> min</span></p>
          <p className="mt-1 text-xs text-ink-muted">{state.completions.filter((c) => week.includes(c.date)).length} activities</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Last 7 days" subtitle="Completed activities per day" />
        <div className="flex items-end gap-2 p-5">
          {week.map((d, i) => (
            <div key={d} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-24 w-full items-end rounded-md bg-surface">
                <div
                  className={`w-full rounded-md ${d === today ? 'bg-primary-600' : 'bg-primary-100'}`}
                  style={{ height: `${Math.max(6, (counts[i] / max) * 100)}%` }}
                  title={`${counts[i]} on ${d}`}
                />
              </div>
              <span className="text-[11px] text-ink-muted">
                {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="History"
          subtitle={`${state.completions.length} completions logged.`}
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
            <EmptyState title="No history yet" hint="Complete a task, goal, roadmap step, or log a session." />
          ) : (
            sortedDates.map((date) => (
              <div key={date}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{formatDate(date)}</p>
                <div className="space-y-2">
                  {groups.get(date)!.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                      <Badge tone={c.kind === 'session' ? 'primary' : 'success'}>{KIND_LABEL[c.kind]}</Badge>
                      <p className="min-w-0 flex-1 truncate text-sm text-ink">{c.title}</p>
                      {c.minutes > 0 && <span className="shrink-0 text-xs text-ink-muted">{c.minutes} min</span>}
                      <button onClick={() => deleteCompletion(c.id)} className="rounded-md p-1.5 text-sm text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete entry">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
