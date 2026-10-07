import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { formatDate, isOverdue, todayString } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input } from './ui';
import { IconPlus, IconTrash } from './icons';

export default function Tasks({ api }: { api: LearnFlowApi }) {
  const { state, addTask, toggleTask, deleteTask } = api;
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayString());
  const [filter, setFilter] = useState<'all' | 'today' | 'done'>('all');

  const visible = state.tasks.filter((t) => {
    if (filter === 'today') return !t.done && t.dueDate <= todayString();
    if (filter === 'done') return t.done;
    return true;
  });

  return (
    <Card>
      <CardHeader title="Tasks" subtitle="Small steps, done daily. Completing a task logs it to your history." />
      <div className="border-b border-line p-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            addTask(title, due);
            setTitle('');
          }}
        >
          <Input placeholder="Add a learning task… e.g. Read about flexbox" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex gap-2">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-40" />
            <Button type="submit"><IconPlus className="h-4 w-4" /> Add</Button>
          </div>
        </form>
        <div className="mt-3 flex gap-2">
          {(['all', 'today', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${filter === f ? 'bg-ink text-white' : 'bg-slate-100 text-ink-secondary hover:bg-slate-200'}`}
            >
              {f === 'today' ? 'Due today' : f}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 p-4">
        {visible.length === 0 ? (
          <EmptyState title="No tasks here" hint="Add your first task above to get started." />
        ) : (
          visible.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => toggleTask(t.id)}
                className="h-4 w-4 shrink-0 rounded accent-indigo-600"
                aria-label={`Mark ${t.title} done`}
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${t.done ? 'text-ink-muted line-through' : 'text-ink'}`}>{t.title}</p>
                <p className="text-xs text-ink-muted">{formatDate(t.dueDate)}</p>
              </div>
              {isOverdue(t.dueDate, t.done) && <Badge tone="warning">Overdue</Badge>}
              {t.done && <Badge tone="success">Done</Badge>}
              <button onClick={() => deleteTask(t.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete task">
                <IconTrash />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
