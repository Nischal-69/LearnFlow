import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { formatDate } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Textarea, Label } from './ui';
import { IconPlus, IconTrash } from './icons';

export default function Goals({ api }: { api: LearnFlowApi }) {
  const { state, addGoal, toggleGoal, deleteGoal } = api;
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [deadline, setDeadline] = useState('');

  return (
    <Card>
      <CardHeader title="Learning goals" subtitle="Bigger outcomes you are working toward." />
      <form
        className="grid gap-3 border-b border-line p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          addGoal(title, desc, deadline);
          setTitle('');
          setDesc('');
          setDeadline('');
        }}
      >
        <div className="sm:col-span-1">
          <Label>Goal title</Label>
          <Input placeholder="e.g. Learn JavaScript basics" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="sm:col-span-1">
          <Label>Target date (optional)</Label>
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Label>Why does it matter? (optional)</Label>
          <Textarea rows={2} placeholder="e.g. To build my first portfolio site" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit"><IconPlus className="h-4 w-4" /> Add goal</Button>
        </div>
      </form>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {state.goals.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState title="No goals yet" hint="Example: Finish HTML & CSS in 3 weeks." />
          </div>
        ) : (
          state.goals.map((g) => (
            <div key={g.id} className="flex flex-col rounded-lg border border-line p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-sm font-semibold ${g.completed ? 'text-ink-muted line-through' : 'text-ink'}`}>{g.title}</p>
                  {g.description && <p className="mt-1 text-sm text-ink-muted">{g.description}</p>}
                  {g.deadline && <p className="mt-1 text-xs text-ink-muted">Target: {formatDate(g.deadline)}</p>}
                </div>
                {g.completed ? <Badge tone="success">Completed</Badge> : <Badge tone="primary">Active</Badge>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => toggleGoal(g.id)} className="flex-1">
                  {g.completed ? 'Reopen' : 'Mark complete'}
                </Button>
                <button onClick={() => deleteGoal(g.id)} className="rounded-lg border border-line p-2 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete goal">
                  <IconTrash />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
