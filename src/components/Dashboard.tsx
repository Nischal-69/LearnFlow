import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { ViewKey } from '../types';
import { formatDate, todayString } from '../utils';
import { Button, Card, CardHeader, EmptyState, Input } from './ui';
import { IconFlame } from './icons';

export default function Dashboard({
  api,
  go,
  search,
}: {
  api: LearnFlowApi;
  go: (v: ViewKey) => void;
  search: string;
}) {
  const { state, streak, logSession, toggleTask } = api;
  const today = todayString();
  const q = search.trim().toLowerCase();

  const todaysTasks = state.tasks
    .filter((t) => !t.done && t.dueDate <= today)
    .filter((t) => (q ? t.title.toLowerCase().includes(q) : true))
    .slice(0, 5);
  const activeLearning = state.goals
    .filter((g) => !g.completed)
    .filter((g) => (q ? (g.title + ' ' + g.description).toLowerCase().includes(q) : true))
    .slice(0, 3);

  const [showLog, setShowLog] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [minutes, setMinutes] = useState('25');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-ink sm:text-2xl">Good to see you. Keep the streak alive.</h2>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Today's focus"
            subtitle="Tasks due today or overdue"
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

        <Card>
          <CardHeader
            title="Active learning"
            subtitle={`${activeLearning.length} in progress`}
            action={<button onClick={() => go('learning')} className="text-sm font-medium text-primary-600 hover:text-primary-700">View all</button>}
          />
          <div className="space-y-3 p-4">
            {activeLearning.length === 0 ? (
              <EmptyState title="No active goals" hint="Set a learning goal to give your tasks direction." />
            ) : (
              activeLearning.map((g) => (
                <div key={g.id} className="rounded-lg border border-line p-3">
                  <p className="text-sm font-medium text-ink">{g.title}</p>
                  {g.deadline && <p className="mt-0.5 text-xs text-ink-muted">Target: {formatDate(g.deadline)}</p>}
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
  );
}
