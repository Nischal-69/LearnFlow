import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { Task, TaskPriority, TaskStatus } from '../types';
import { formatDate, isOverdue, todayString } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, Modal, Textarea } from './ui';
import { IconPlus, IconTrash } from './icons';

type Filter = 'all' | 'today' | 'upcoming' | 'completed' | 'high';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'high', label: 'High Priority' },
];

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

function priorityTone(p: TaskPriority): 'danger' | 'warning' | 'neutral' {
  return p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'neutral';
}

function statusTone(s: TaskStatus): 'success' | 'primary' | 'neutral' {
  return s === 'completed' ? 'success' : s === 'in_progress' ? 'primary' : 'neutral';
}

function statusLabel(s: TaskStatus): string {
  return s === 'in_progress' ? 'In Progress' : s === 'completed' ? 'Completed' : 'Todo';
}

interface FormState {
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  category: string;
  estimated: string;
  status: TaskStatus;
}

function blankForm(priority: TaskPriority = 'medium'): FormState {
  return {
    title: '',
    description: '',
    dueDate: todayString(),
    priority,
    category: '',
    estimated: '',
    status: 'todo',
  };
}

function formFromTask(t: Task): FormState {
  return {
    title: t.title,
    description: t.description,
    dueDate: t.dueDate,
    priority: t.priority,
    category: t.category,
    estimated: t.estimatedMinutes > 0 ? String(t.estimatedMinutes) : '',
    status: t.status,
  };
}

export default function Tasks({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state, addTask, updateTask, toggleTask, deleteTask } = api;
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<FormState>(() => blankForm(state.settings.defaultTaskPriority));
  const q = search.trim().toLowerCase();

  const categories = Array.from(
    new Set(state.tasks.map((t) => t.category.trim()).filter(Boolean)),
  ).sort();

  function openCreate() {
    setEditing(null);
    setForm(blankForm(state.settings.defaultTaskPriority));
    setModalOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm(formFromTask(t));
    setModalOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const input = {
      title: form.title,
      description: form.description,
      dueDate: form.dueDate || todayString(),
      priority: form.priority,
      category: form.category,
      estimatedMinutes: Math.max(0, parseInt(form.estimated, 10) || 0),
    };
    if (editing) {
      updateTask(editing.id, { ...input, status: form.status });
    } else {
      addTask(input);
    }
    setModalOpen(false);
  }

  function counts(f: Filter): number {
    return state.tasks.filter((t) => matchFilter(t, f)).length;
  }

  function matchFilter(t: Task, f: Filter): boolean {
    switch (f) {
      case 'today':
        return t.status !== 'completed' && t.dueDate <= todayString();
      case 'upcoming':
        return t.status !== 'completed' && t.dueDate > todayString();
      case 'completed':
        return t.status === 'completed';
      case 'high':
        return t.priority === 'high' && t.status !== 'completed';
      default:
        return true;
    }
  }

  const visible = state.tasks
    .filter((t) => matchFilter(t, filter))
    .filter((t) =>
      q ? (t.title + ' ' + t.description + ' ' + t.category).toLowerCase().includes(q) : true,
    )
    .sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (b.status === 'completed' && a.status !== 'completed') return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  return (
    <>
      <Card>
        <CardHeader
          title="Tasks"
          subtitle="Small steps, done daily. Completing a task logs it to your history."
          action={
            <Button onClick={openCreate}>
              <IconPlus className="h-4 w-4" /> Create Task
            </Button>
          }
        />
        <div className="border-b border-line p-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  filter === f.key
                    ? 'bg-ink text-white'
                    : 'bg-slate-100 text-ink-secondary hover:bg-slate-200'
                }`}
              >
                {f.label} ({counts(f.key)})
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2 p-4">
          {visible.length === 0 ? (
            <EmptyState
              title="No tasks here"
              hint={
                q
                  ? 'No tasks match your search.'
                  : filter === 'completed'
                    ? 'Completed tasks will appear here.'
                    : 'Create your first task to get started.'
              }
            />
          ) : (
            visible.map((t) => {
              const completed = t.status === 'completed';
              return (
                <div key={t.id} className="rounded-lg border border-line px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={() => toggleTask(t.id)}
                      className="h-4 w-4 shrink-0 rounded accent-indigo-600"
                      aria-label={`Mark ${t.title} done`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${completed ? 'text-ink-muted line-through' : 'text-ink'}`}>
                        {t.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                        <span>{formatDate(t.dueDate)}</span>
                        {t.estimatedMinutes > 0 && <span>· ~{t.estimatedMinutes} min</span>}
                        {t.category && <span>· {t.category}</span>}
                        {t.doneAt && completed && <span>· done {formatDate(t.doneAt)}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => openEdit(t)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteTask(t.id)}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                      aria-label="Delete task"
                    >
                      <IconTrash />
                    </button>
                  </div>
                  {t.description && (
                    <p className="mt-1.5 line-clamp-2 pl-7 text-sm text-ink-secondary">{t.description}</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7">
                    <Badge tone={priorityTone(t.priority)}>{t.priority}</Badge>
                    <Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge>
                    {isOverdue(t.dueDate, completed) && <Badge tone="warning">Overdue</Badge>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {modalOpen && (
        <Modal title={editing ? 'Edit task' : 'Create task'} onClose={() => setModalOpen(false)}>
          <form onSubmit={save} className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input
                autoFocus
                placeholder="e.g. Read about flexbox"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                rows={2}
                placeholder="What exactly needs doing?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Est. minutes (optional)</Label>
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  placeholder="30"
                  value={form.estimated}
                  onChange={(e) => setForm({ ...form, estimated: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Priority</Label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm({ ...form, priority: p })}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium capitalize ${
                      form.priority === p
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-line text-ink-secondary hover:bg-surface'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category (optional)</Label>
                <Input
                  placeholder="e.g. Study"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  list="task-categories"
                />
                <datalist id="task-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as TaskStatus })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                >
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1">
                {editing ? 'Save changes' : 'Create task'}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
