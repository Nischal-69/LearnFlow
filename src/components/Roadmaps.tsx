import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { Button, Card, CardHeader, EmptyState, Input, Textarea, Label, ProgressBar } from './ui';
import { IconLink, IconPlus, IconTrash } from './icons';

const TEMPLATES: { title: string; description: string; steps: string[] }[] = [
  {
    title: 'Frontend basics',
    description: 'HTML, CSS and JavaScript fundamentals.',
    steps: ['HTML structure & semantic tags', 'CSS box model & flexbox', 'Responsive layout with grid', 'JavaScript variables & functions', 'DOM manipulation project'],
  },
  {
    title: 'Python for beginners',
    description: 'From setup to your first small project.',
    steps: ['Setup & hello world', 'Variables, loops & conditions', 'Functions & modules', 'Files & lists/dicts', 'Mini project: to-do CLI'],
  },
];

export default function Roadmaps({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state, addRoadmap, addRoadmapStep, toggleRoadmapStep, updateStepResource, deleteRoadmap } = api;
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [newStep, setNewStep] = useState('');

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Learning roadmaps" subtitle="Break a big topic into ordered steps. Completing a step logs it." />
        <form
          className="grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            addRoadmap(title, desc, stepsText.split('\n'));
            setTitle('');
            setDesc('');
            setStepsText('');
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Roadmap title</Label>
              <Input placeholder="e.g. Learn React" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input placeholder="e.g. For my internship prep" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Steps — one per line</Label>
            <Textarea rows={3} placeholder={'Components\nState & props\nEffects & data fetching'} value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit"><IconPlus className="h-4 w-4" /> Create roadmap</Button>
            {state.roadmaps.length === 0 && (
              <>
                {TEMPLATES.map((t) => (
                  <Button key={t.title} variant="secondary" onClick={() => addRoadmap(t.title, t.description, t.steps)}>
                    Use template: {t.title}
                  </Button>
                ))}
              </>
            )}
          </div>
        </form>
      </Card>

      {state.roadmaps.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="No roadmaps yet" hint="Create one above, or start from a template." />
        </Card>
      ) : (
        state.roadmaps
          .filter((r) => {
            const q = search.trim().toLowerCase();
            return q ? (r.title + ' ' + r.description).toLowerCase().includes(q) : true;
          })
          .map((r) => {
          const done = r.steps.filter((s) => s.done).length;
          const pct = r.steps.length === 0 ? 0 : (done / r.steps.length) * 100;
          const open = openId === r.id;
          return (
            <Card key={r.id}>
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-ink">{r.title}</h3>
                    {r.description && <p className="mt-0.5 text-sm text-ink-muted">{r.description}</p>}
                    <p className="mt-1 text-xs text-ink-muted">{done} of {r.steps.length} steps complete</p>
                  </div>
                  <button onClick={() => deleteRoadmap(r.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete roadmap">
                    <IconTrash />
                  </button>
                </div>
                <div className="mt-3"><ProgressBar value={pct} tone={pct === 100 ? 'success' : 'primary'} /></div>
                <button onClick={() => setOpenId(open ? null : r.id)} className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                  {open ? 'Hide steps' : 'View steps'}
                </button>
                {open && (
                  <div className="mt-3 space-y-2">
                    {r.steps.map((s, idx) => (
                      <div key={s.id} className="rounded-lg border border-line p-3">
                        <label className="flex cursor-pointer items-center gap-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink-secondary">
                            {idx + 1}
                          </span>
                          <input type="checkbox" checked={s.done} onChange={() => toggleRoadmapStep(r.id, s.id)} className="h-4 w-4 accent-indigo-600" />
                          <span className={`flex-1 text-sm ${s.done ? 'text-ink-muted line-through' : 'text-ink'}`}>{s.title}</span>
                        </label>
                        <div className="mt-2 flex items-center gap-2 pl-9">
                          <IconLink className="text-slate-400" />
                          <input
                            placeholder="Add a resource link or note…"
                            value={s.resource}
                            onChange={(e) => updateStepResource(r.id, s.id, e.target.value)}
                            className="w-full rounded-md border border-line px-2 py-1 text-xs text-ink focus:border-primary-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newStep.trim()) return;
                        addRoadmapStep(r.id, newStep);
                        setNewStep('');
                      }}
                    >
                      <Input placeholder="Add another step…" value={open ? newStep : ''} onChange={(e) => setNewStep(e.target.value)} />
                      <Button variant="secondary" type="submit">Add</Button>
                    </form>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
