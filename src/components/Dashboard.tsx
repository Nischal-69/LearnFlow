import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { formatDate, last7Days, todayString } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, ProgressBar } from './ui';
import { IconFlame } from './icons';

export default function Dashboard({ api, go }: { api: LearnFlowApi; go: (v: 'tasks' | 'goals' | 'roadmaps') => void }) {
  const { state, streak, logSession, toggleTask } = api;
  const today = todayString();
  const todaysTasks = state.tasks.filter((t) => !t.done && (t.dueDate === today || t.dueDate < today)).slice(0, 5);
  const activeGoals = state.goals.filter((g) => !g.completed).slice(0, 3);

  const [showLog, setShowLog] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [minutes, setMinutes] = useState('25');

  const week = last7Days();
  const counts = week.map((d) => state.completions.filter((c) => c.date === d).length);
  const max = Math.max(1, ...counts);
  const weekMinutes = state.completions
    .filter((c) => week.includes(c.date))
    .reduce((sum, c) => sum + (c.minutes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-xl border border-line bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-ink sm:text-2xl">Good to see you. Keep the streak alive.</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {streak.loggedToday
                ? `Today is logged. Current streak: ${streak.current} day${streak.current === 1 ? '' : 's'}.`
                : streak.current > 0
                  ? `One session today keeps your ${streak.current}-day streak going.`
                  : 'Log your first session today to start your streak.'}
            </p>
          </div>
          <Button onClick={() => setShowLog((v) => !v)} className="shrink-0">
            <IconFlame className="h-4 w-4" />
            {streak.loggedToday ? 'Log another session' : 'Log today’s learning'}
          </Button>
        </div>

        {showLog && (
          <form
            className="mt-4 grid gap-3 rounded-lg bg-surface p-4 sm:grid-cols-[1fr_120px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              logSession(sessionTitle || 'Learning session', Number(minutes) || 0);
              setSessionTitle('');
              setMinutes('25');
              setShowLog(false);
            }}
          >
            <Input
              placeholder="What did you learn? e.g. React hooks"
              value={sessionTitle}
              onChange={(e) => setSessionTitle(e.target.value)}
            />
            <Input
              type="number"
              min={1}
              max={600}
              placeholder="Minutes"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <Button type="submit">Save</Button>
          </form>
        )}
      </div>

      {/* Streak stats */}
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's focus */}
        <Card>
          <CardHeader
            title="Today's focus"
            subtitle={`${todaysTasks.length} task${todaysTasks.length === 1 ? '' : 's'} due`}
            action={<button onClick={() => go('tasks')} className="text-sm font-medium text-primary-600 hover:text-primary-700">View all</button>}
          />
          <div className="space-y-2 p-4">
            {todaysTasks.length === 0 ? (
              <EmptyState title="Nothing due today" hint="Add a task to plan your next learning step." />
            ) : (
              todaysTasks.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                  <span className="flex-1 text-sm text-ink">{t.title}</span>
                  <span className="text-xs text-ink-muted">{formatDate(t.dueDate)}</span>
                </label>
              ))
            )}
          </div>
        </Card>

        {/* Week + goals */}
        <div className="space-y-6">
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
              title="Active goals"
              subtitle={`${state.goals.filter((g) => !g.completed).length} in progress`}
              action={<button onClick={() => go('goals')} className="text-sm font-medium text-primary-600 hover:text-primary-700">View all</button>}
            />
            <div className="space-y-3 p-4">
              {activeGoals.length === 0 ? (
                <EmptyState title="No active goals" hint="Set a learning goal to give your tasks direction." />
              ) : (
                activeGoals.map((g) => (
                  <div key={g.id} className="rounded-lg border border-line p-3">
                    <p className="text-sm font-medium text-ink">{g.title}</p>
                    {g.deadline && <p className="mt-0.5 text-xs text-ink-muted">Target: {formatDate(g.deadline)}</p>}
                    <div className="mt-2">
                      <ProgressBar value={g.completed ? 100 : 25} />
                    </div>
                  </div>
                ))
              )}
              <Button variant="secondary" onClick={() => go('roadmaps')} className="w-full">
                Plan with a roadmap
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
