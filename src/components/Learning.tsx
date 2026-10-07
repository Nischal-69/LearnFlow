import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { Goal, GoalStatus } from '../types';
import { formatDate, goalStats } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, Modal, ProgressBar, Textarea } from './ui';
import { IconCalendar, IconFlame, IconPlus, IconTrash } from './icons';

type Filter = 'all' | GoalStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'paused', label: 'Paused' },
  { key: 'completed', label: 'Completed' },
];

const STATUS_LABEL: Record<GoalStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

function statusTone(s: GoalStatus): 'primary' | 'warning' | 'success' {
  return s === 'completed' ? 'success' : s === 'paused' ? 'warning' : 'primary';
}

interface GoalForm {
  title: string;
  description: string;
  motivation: string;
  deadline: string;
  daily: string;
  weekly: string;
}

function blankGoalForm(): GoalForm {
  return { title: '', description: '', motivation: '', deadline: '', daily: '30', weekly: '180' };
}

function formFromGoal(g: Goal): GoalForm {
  return {
    title: g.title,
    description: g.description,
    motivation: g.motivation,
    deadline: g.deadline,
    daily: g.dailyTargetMinutes > 0 ? String(g.dailyTargetMinutes) : '',
    weekly: g.weeklyTargetMinutes > 0 ? String(g.weeklyTargetMinutes) : '',
  };
}

export default function Learning({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state, addGoal, updateGoal, deleteGoal, logSession } = api;
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>(blankGoalForm);
  const [sessionGoal, setSessionGoal] = useState<Goal | null>(null);
  const [sessionTitle, setSessionTitle] = useState('');
  const [sessionMinutes, setSessionMinutes] = useState('25');
  const q = search.trim().toLowerCase();

  function openCreate() {
    setEditing(null);
    setForm(blankGoalForm());
    setModalOpen(true);
  }

  function openEdit(g: Goal) {
    setEditing(g);
    setForm(formFromGoal(g));
    setModalOpen(true);
  }

  function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const input = {
      title: form.title,
      description: form.description,
      motivation: form.motivation,
      deadline: form.deadline,
      dailyTargetMinutes: Math.max(0, parseInt(form.daily, 10) || 0),
      weeklyTargetMinutes: Math.max(0, parseInt(form.weekly, 10) || 0),
    };
    if (editing) updateGoal(editing.id, input);
    else addGoal(input);
    setModalOpen(false);
  }

  function saveSession(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionGoal) return;
    logSession(sessionTitle || sessionGoal.title, Number(sessionMinutes) || 0, undefined, sessionGoal.id);
    setSessionGoal(null);
    setSessionTitle('');
    setSessionMinutes('25');
  }

  const visible = state.goals
    .filter((g) => (filter === 'all' ? true : g.status === filter))
    .filter((g) =>
      q ? (g.title + ' ' + g.description + ' ' + g.motivation).toLowerCase().includes(q) : true,
    );

  return (
    <>
      <Card>
        <CardHeader
          title="Learning goals"
          subtitle="Tell LearnFlow what you want to learn. Progress moves only when you log sessions."
          action={
            <Button onClick={openCreate}>
              <IconPlus className="h-4 w-4" /> New Goal
            </Button>
          }
        />
        <div className="border-b border-line p-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                  filter === f.key
                    ? 'bg-ink text-white'
                    : 'bg-slate-100 text-ink-secondary hover:bg-slate-200'
                }`}
              >
                {f.label} ({f.key === 'all' ? state.goals.length : state.goals.filter((g) => g.status === f.key).length})
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {visible.length === 0 ? (
            <div className="md:col-span-2">
              <EmptyState
                title="No goals here"
                hint={q ? 'No goals match your search.' : 'Example: Learn After Effects.'}
              />
            </div>
          ) : (
            visible.map((g) => {
              const stats = goalStats(state.completions, g.id, g.weeklyTargetMinutes);
              const dimmed = g.status !== 'active';
              return (
                <div key={g.id} className={`flex flex-col rounded-lg border border-line p-4 ${dimmed ? 'opacity-75' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${g.status === 'completed' ? 'text-ink-muted line-through' : 'text-ink'}`}>
                      {g.title}
                    </p>
                    <Badge tone={statusTone(g.status)}>{STATUS_LABEL[g.status]}</Badge>
                  </div>
                  {g.description && <p className="mt-1 text-sm text-ink-muted">{g.description}</p>}
                  {g.motivation && (
                    <p className="mt-1 text-sm text-ink-secondary">
                      <span className="font-medium">Why: </span>{g.motivation}
                    </p>
                  )}

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-ink-muted">
                      <span>
                        {stats.progress === null
                          ? `${stats.weekMinutes} min this week`
                          : `${stats.weekMinutes}/${g.weeklyTargetMinutes} min this week`}
                      </span>
                      <span className="font-semibold text-ink">
                        {stats.progress === null ? `${stats.totalMinutes} min total` : `${stats.progress}%`}
                      </span>
                    </div>
                    {stats.progress !== null && (
                      <ProgressBar value={stats.progress} tone={stats.progress === 100 ? 'success' : 'primary'} />
                    )}
                    {g.dailyTargetMinutes > 0 && (
                      <p className="text-xs text-ink-muted">
                        Today: {stats.todayMinutes}/{g.dailyTargetMinutes} min
                      </p>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span className="inline-flex items-center gap-1">
                      <IconFlame className="h-3.5 w-3.5 text-orange-500" />
                      {stats.streak} day streak
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconCalendar className="h-3.5 w-3.5" />
                      {stats.lastDate ? `Last: ${formatDate(stats.lastDate)}` : 'Not started'}
                    </span>
                    {g.deadline && <span>Target: {formatDate(g.deadline)}</span>}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {g.status === 'active' && (
                      <Button onClick={() => { setSessionGoal(g); setSessionTitle(''); setSessionMinutes('25'); }} className="flex-1">
                        Start Learning
                      </Button>
                    )}
                    {g.status === 'active' && (
                      <Button variant="secondary" onClick={() => updateGoal(g.id, { status: 'paused' })}>
                        Pause
                      </Button>
                    )}
                    {g.status === 'paused' && (
                      <Button variant="secondary" onClick={() => updateGoal(g.id, { status: 'active' })}>
                        Resume
                      </Button>
                    )}
                    {g.status !== 'completed' ? (
                      <Button variant="secondary" onClick={() => updateGoal(g.id, { status: 'completed' })}>
                        Complete
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => updateGoal(g.id, { status: 'active' })}>
                        Reopen
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      onClick={() => openEdit(g)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteGoal(g.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                      aria-label="Delete goal"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {modalOpen && (
        <Modal title={editing ? 'Edit goal' : 'New learning goal'} onClose={() => setModalOpen(false)}>
          <form onSubmit={saveGoal} className="grid gap-3">
            <div>
              <Label>Goal name</Label>
              <Input
                autoFocus
                placeholder="e.g. Learn After Effects"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                rows={2}
                placeholder="What does this goal cover?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Why I want to learn this (optional)</Label>
              <Textarea
                rows={2}
                placeholder="e.g. To edit videos for my channel"
                value={form.motivation}
                onChange={(e) => setForm({ ...form, motivation: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Target date</Label>
                <Input
                  type="date"
                  value={form.deadline}
                  onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                />
              </div>
              <div>
                <Label>Daily min.</Label>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  placeholder="30"
                  value={form.daily}
                  onChange={(e) => setForm({ ...form, daily: e.target.value })}
                />
              </div>
              <div>
                <Label>Weekly min.</Label>
                <Input
                  type="number"
                  min={0}
                  max={10080}
                  placeholder="180"
                  value={form.weekly}
                  onChange={(e) => setForm({ ...form, weekly: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">
                {editing ? 'Save changes' : 'Create goal'}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {sessionGoal && (
        <Modal title={`Learn: ${sessionGoal.title}`} onClose={() => setSessionGoal(null)}>
          <form onSubmit={saveSession} className="grid gap-3">
            <div>
              <Label>What did you learn?</Label>
              <Input
                autoFocus
                placeholder="e.g. Keyframes and easing"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
              />
            </div>
            <div>
              <Label>Minutes</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={sessionMinutes}
                onChange={(e) => setSessionMinutes(e.target.value)}
              />
            </div>
            <p className="text-xs text-ink-muted">
              This session counts toward {sessionGoal.title} and updates its progress.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">
                <IconFlame className="h-4 w-4" /> Log session
              </Button>
              <Button variant="secondary" onClick={() => setSessionGoal(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
