import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { formatDate } from '../utils';
import { Badge, Card, CardHeader, EmptyState } from './ui';
import { IconTrash } from './icons';
import type { CompletionKind } from '../types';

const KIND_LABEL: Record<CompletionKind, string> = {
  task: 'Task',
  goal: 'Goal',
  'roadmap-step': 'Roadmap step',
  session: 'Session',
};

export default function History({ api }: { api: LearnFlowApi }) {
  const { state, deleteCompletion } = api;
  const [kindFilter, setKindFilter] = useState<'all' | CompletionKind>('all');

  const visible = state.completions.filter((c) => kindFilter === 'all' || c.kind === kindFilter);

  // group by date desc
  const groups = new Map<string, typeof visible>();
  for (const c of visible) {
    if (!groups.has(c.date)) groups.set(c.date, []);
    groups.get(c.date)!.push(c);
  }
  const sortedDates = Array.from(groups.keys()).sort().reverse();

  return (
    <Card>
      <CardHeader
        title="Learning history"
        subtitle={`${state.completions.length} completions logged. Every finish builds your streak.`}
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
                    <button onClick={() => deleteCompletion(c.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete entry">
                      <IconTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
