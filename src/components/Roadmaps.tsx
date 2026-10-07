import { useState } from 'react';
import type { LearnFlowApi, RoadmapStepPatch } from '../store';
import { currentRoadmapStep, nextRoadmapStep, roadmapProgress } from '../store';
import type { Roadmap, RoadmapStep, RoadmapStepStatus } from '../types';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Textarea,
  Label,
  Modal,
  ProgressBar,
} from './ui';
import { IconCheckCircle, IconLink, IconPlus, IconTrash } from './icons';

type TemplateStep = { title: string; description: string; estimatedMinutes: number };

const TEMPLATES: { title: string; description: string; steps: TemplateStep[] }[] = [
  {
    title: 'Become a Video Editor',
    description: 'From first cut to finished portfolio pieces.',
    steps: [
      { title: 'Learn Premiere Pro', description: 'Workspace, timeline, importing and exporting.', estimatedMinutes: 180 },
      { title: 'Learn basic editing', description: 'Cuts, trims, transitions and audio sync.', estimatedMinutes: 150 },
      { title: 'Learn color correction', description: 'Exposure, white balance, Lumetri basics.', estimatedMinutes: 120 },
      { title: 'Learn After Effects', description: 'Compositions, keyframes and effects.', estimatedMinutes: 180 },
      { title: 'Learn motion graphics', description: 'Titles, lower thirds and simple animations.', estimatedMinutes: 150 },
      { title: 'Complete 5 projects', description: 'Edit and publish 5 short videos for your portfolio.', estimatedMinutes: 300 },
    ],
  },
  {
    title: 'Frontend basics',
    description: 'HTML, CSS and JavaScript fundamentals.',
    steps: [
      { title: 'HTML structure & semantic tags', description: 'Page structure, forms and accessibility basics.', estimatedMinutes: 90 },
      { title: 'CSS box model & flexbox', description: 'Layout, spacing and alignment.', estimatedMinutes: 120 },
      { title: 'Responsive layout with grid', description: 'Grid areas, breakpoints and mobile-first.', estimatedMinutes: 120 },
      { title: 'JavaScript variables & functions', description: 'Syntax, scope and control flow.', estimatedMinutes: 150 },
      { title: 'DOM manipulation project', description: 'Build a small interactive page.', estimatedMinutes: 180 },
    ],
  },
  {
    title: 'Python for beginners',
    description: 'From setup to your first small project.',
    steps: [
      { title: 'Setup & hello world', description: 'Install Python and run your first script.', estimatedMinutes: 45 },
      { title: 'Variables, loops & conditions', description: 'Core syntax and flow control.', estimatedMinutes: 120 },
      { title: 'Functions & modules', description: 'Reuse code with functions and imports.', estimatedMinutes: 90 },
      { title: 'Files & lists/dicts', description: 'Work with data and files.', estimatedMinutes: 120 },
      { title: 'Mini project: to-do CLI', description: 'Ship a small console app.', estimatedMinutes: 180 },
    ],
  },
];

function formatDuration(min: number): string {
  if (!min || min <= 0) return '';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function statusMeta(s: RoadmapStepStatus): { label: string; tone: 'neutral' | 'primary' | 'success' } {
  if (s === 'completed') return { label: 'Completed', tone: 'success' };
  if (s === 'in_progress') return { label: 'In Progress', tone: 'primary' };
  return { label: 'Not Started', tone: 'neutral' };
}

function dotClass(s: RoadmapStepStatus): string {
  if (s === 'completed') return 'bg-success border-success text-white';
  if (s === 'in_progress') return 'bg-primary-600 border-primary-600 text-white';
  return 'bg-white border-slate-300 text-slate-400';
}

// ---------- Create form (kept extremely simple) ----------

function CreateRoadmapForm({ api }: { api: LearnFlowApi }) {
  const { state, addRoadmap } = api;
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [stepsText, setStepsText] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    addRoadmap(title, desc, stepsText.split('\n'));
    setTitle('');
    setDesc('');
    setStepsText('');
  }

  return (
    <Card>
      <CardHeader
        title="Learning roadmaps"
        subtitle="Name it, list the steps — one per line. Open it to add details later."
      />
      <form className="grid gap-3 p-4" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Roadmap title</Label>
            <Input
              placeholder="e.g. Become a Video Editor"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Input
              placeholder="e.g. For freelance work by spring"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label>Steps — one per line (optional)</Label>
          <Textarea
            rows={3}
            placeholder={'Learn Premiere Pro\nLearn basic editing\nLearn color correction'}
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">
            <IconPlus className="h-4 w-4" /> Create roadmap
          </Button>
          {state.roadmaps.length === 0 &&
            TEMPLATES.map((t) => (
              <Button
                key={t.title}
                variant="secondary"
                onClick={() => addRoadmap(t.title, t.description, t.steps)}
              >
                Use template: {t.title}
              </Button>
            ))}
        </div>
      </form>
    </Card>
  );
}

// ---------- Step edit modal ----------

function StepEditModal({
  step,
  onClose,
  onSave,
}: {
  step: RoadmapStep;
  onClose: () => void;
  onSave: (patch: RoadmapStepPatch) => void;
}) {
  const [title, setTitle] = useState(step.title);
  const [description, setDescription] = useState(step.description);
  const [estimated, setEstimated] = useState(step.estimatedMinutes > 0 ? String(step.estimatedMinutes) : '');
  const [status, setStatus] = useState<RoadmapStepStatus>(step.status);
  const [notes, setNotes] = useState(step.notes);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title,
      description,
      estimatedMinutes: Math.max(0, parseInt(estimated, 10) || 0),
      status,
      notes,
    });
    onClose();
  }

  return (
    <Modal title="Edit step" onClose={onClose}>
      <form onSubmit={save} className="grid gap-3">
        <div>
          <Label>Title</Label>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Learn Premiere Pro" />
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this step cover?"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Est. minutes (optional)</Label>
            <Input
              type="number"
              min={0}
              max={10000}
              placeholder="60"
              value={estimated}
              onChange={(e) => setEstimated(e.target.value)}
            />
          </div>
          <div>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RoadmapStepStatus)}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Personal notes, checklists, ideas…"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit" className="flex-1">
            Save changes
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Single step in the timeline ----------

function StepItem({
  api,
  roadmapId,
  step,
  index,
  isFirst,
  isLast,
  expanded,
  onToggleExpand,
}: {
  api: LearnFlowApi;
  roadmapId: string;
  step: RoadmapStep;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const {
    toggleRoadmapStep,
    setRoadmapStepStatus,
    updateRoadmapStep,
    deleteRoadmapStep,
    moveRoadmapStep,
    addStepResource,
    removeStepResource,
  } = api;
  const [editOpen, setEditOpen] = useState(false);
  const [resLabel, setResLabel] = useState('');
  const [resUrl, setResUrl] = useState('');
  const [notesDraft, setNotesDraft] = useState(step.notes);
  const [notesSaved, setNotesSaved] = useState(false);
  const meta = statusMeta(step.status);
  const completed = step.status === 'completed';
  const dur = formatDuration(step.estimatedMinutes);

  // Keep draft in sync when step changes from elsewhere (e.g. edit modal).
  const draftKey = `${step.id}:${step.notes}`;
  const [lastKey, setLastKey] = useState(draftKey);
  if (lastKey !== draftKey) {
    setLastKey(draftKey);
    setNotesDraft(step.notes);
  }

  function saveNotes() {
    updateRoadmapStep(roadmapId, step.id, { notes: notesDraft });
    setNotesSaved(true);
    window.setTimeout(() => setNotesSaved(false), 1500);
  }

  return (
    <li className="relative flex gap-3 pb-2 last:pb-0">
      {/* rail */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => toggleRoadmapStep(roadmapId, step.id)}
          aria-label={completed ? `Reopen ${step.title}` : `Mark ${step.title} complete`}
          title={completed ? 'Reopen' : 'Mark complete'}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${dotClass(step.status)}`}
        >
          {completed ? '✓' : index + 1}
        </button>
        {!isLast && <span className="mt-1 w-0.5 flex-1 bg-slate-200" aria-hidden />}
      </div>

      {/* card */}
      <div className={`mb-2 flex-1 rounded-lg border p-3 ${completed ? 'border-line bg-surface' : 'border-line bg-white'}`}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <button onClick={onToggleExpand} className="block w-full text-left">
              <span className={`text-sm font-medium ${completed ? 'text-ink-muted line-through' : 'text-ink'}`}>
                {step.title}
              </span>
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              {dur && <span className="text-xs text-ink-muted">~{dur}</span>}
              {step.resources.length > 0 && (
                <span className="text-xs text-ink-muted">
                  · {step.resources.length} resource{step.resources.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {step.description && (
              <p className="mt-1.5 line-clamp-2 text-sm text-ink-secondary">{step.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => moveRoadmapStep(roadmapId, step.id, 'up')}
              disabled={isFirst}
              className="rounded-md px-1.5 py-1 text-sm text-ink-secondary hover:bg-surface disabled:opacity-30"
              aria-label={`Move ${step.title} up`}
              title="Move up"
            >
              ↑
            </button>
            <button
              onClick={() => moveRoadmapStep(roadmapId, step.id, 'down')}
              disabled={isLast}
              className="rounded-md px-1.5 py-1 text-sm text-ink-secondary hover:bg-surface disabled:opacity-30"
              aria-label={`Move ${step.title} down`}
              title="Move down"
            >
              ↓
            </button>
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
            >
              Edit
            </button>
            <button
              onClick={() => deleteRoadmapStep(roadmapId, step.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
              aria-label={`Delete ${step.title}`}
            >
              <IconTrash />
            </button>
          </div>
        </div>

        {/* quick status actions */}
        <div className="mt-2 flex flex-wrap gap-2">
          {step.status === 'not_started' && (
            <>
              <button
                onClick={() => setRoadmapStepStatus(roadmapId, step.id, 'in_progress')}
                className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface"
              >
                Start
              </button>
              <button
                onClick={() => setRoadmapStepStatus(roadmapId, step.id, 'completed')}
                className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700"
              >
                Mark done
              </button>
            </>
          )}
          {step.status === 'in_progress' && (
            <button
              onClick={() => setRoadmapStepStatus(roadmapId, step.id, 'completed')}
              className="rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700"
            >
              Mark done
            </button>
          )}
          {step.status === 'completed' && (
            <button
              onClick={() => setRoadmapStepStatus(roadmapId, step.id, 'in_progress')}
              className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface"
            >
              Reopen
            </button>
          )}
          <button
            onClick={onToggleExpand}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface"
          >
            {expanded ? 'Hide details' : 'Details'}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3 border-t border-line pt-3">
            {step.description && (
              <p className="text-sm text-ink-secondary">{step.description}</p>
            )}
            {step.resources.length > 0 && (
              <ul className="space-y-1.5">
                {step.resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 text-sm">
                    <IconLink className="shrink-0 text-slate-400" />
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-primary-600 hover:underline"
                      >
                        {r.label || r.url}
                      </a>
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-ink-secondary">{r.label}</span>
                    )}
                    <button
                      onClick={() => removeStepResource(roadmapId, step.id, r.id)}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-danger"
                      aria-label={`Remove resource ${r.label}`}
                    >
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                if (!resLabel.trim() && !resUrl.trim()) return;
                addStepResource(roadmapId, step.id, resLabel, resUrl);
                setResLabel('');
                setResUrl('');
              }}
            >
              <Input
                placeholder="Resource label (e.g. Tutorial)"
                value={resLabel}
                onChange={(e) => setResLabel(e.target.value)}
              />
              <Input
                placeholder="https://… (optional)"
                value={resUrl}
                onChange={(e) => setResUrl(e.target.value)}
              />
              <Button variant="secondary" type="submit">
                Add resource
              </Button>
            </form>
            <div>
              <Label>Notes</Label>
              <Textarea
                rows={2}
                placeholder="Add notes for this step…"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => {
                  if (notesDraft !== step.notes) saveNotes();
                }}
              />
              <div className="mt-1.5 flex items-center gap-2">
                <Button variant="secondary" onClick={saveNotes}>
                  Save notes
                </Button>
                {notesSaved && <span className="text-xs text-success">Saved</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      {editOpen && (
        <StepEditModal
          step={step}
          onClose={() => setEditOpen(false)}
          onSave={(patch) => updateRoadmapStep(roadmapId, step.id, patch)}
        />
      )}
    </li>
  );
}

// ---------- One roadmap card ----------

function RoadmapCard({
  api,
  roadmap,
  open,
  onToggle,
}: {
  api: LearnFlowApi;
  roadmap: Roadmap;
  open: boolean;
  onToggle: () => void;
}) {
  const { deleteRoadmap, updateRoadmap, addRoadmapStep, setRoadmapStepStatus } = api;
  const [newStep, setNewStep] = useState('');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [editingRoadmap, setEditingRoadmap] = useState(false);
  const [editTitle, setEditTitle] = useState(roadmap.title);
  const [editDesc, setEditDesc] = useState(roadmap.description);

  const { done, total, pct } = roadmapProgress(roadmap);
  const current = currentRoadmapStep(roadmap);
  const next = nextRoadmapStep(roadmap);
  const totalMinutes = roadmap.steps.reduce((a, s) => a + (s.estimatedMinutes || 0), 0);
  const completedSteps = roadmap.steps.filter((s) => s.status === 'completed');

  function submitStep(e: React.FormEvent) {
    e.preventDefault();
    if (!newStep.trim()) return;
    addRoadmapStep(roadmap.id, newStep);
    setNewStep('');
  }

  return (
    <Card>
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editingRoadmap ? (
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  updateRoadmap(roadmap.id, { title: editTitle, description: editDesc });
                  setEditingRoadmap(false);
                }}
              >
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Roadmap title" />
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description (optional)" />
                <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                  <Button variant="secondary" onClick={() => setEditingRoadmap(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <h3 className="truncate text-base font-semibold text-ink">{roadmap.title}</h3>
                {roadmap.description && <p className="mt-0.5 text-sm text-ink-muted">{roadmap.description}</p>}
                <p className="mt-1 text-xs text-ink-muted">
                  {done} of {total} steps complete
                  {totalMinutes > 0 && ` · ~${formatDuration(totalMinutes)} total`}
                  {pct === 100 && total > 0 && ' · Finished'}
                </p>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!editingRoadmap && (
              <button
                onClick={() => {
                  setEditTitle(roadmap.title);
                  setEditDesc(roadmap.description);
                  setEditingRoadmap(true);
                }}
                className="rounded-md px-2 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50"
              >
                Edit
              </button>
            )}
            <button
              onClick={() => deleteRoadmap(roadmap.id)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
              aria-label={`Delete roadmap ${roadmap.title}`}
            >
              <IconTrash />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <ProgressBar value={pct} tone={pct === 100 ? 'success' : 'primary'} />
        </div>

        <button
          onClick={onToggle}
          className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          {open ? 'Hide steps' : `View steps (${total})`}
        </button>

        {open && (
          <div className="mt-3 space-y-4">
            {total === 0 ? (
              <EmptyState title="No steps yet" hint="Add your first step below to get started." />
            ) : (
              <>
                {pct === 100 ? (
                  <div className="rounded-lg border border-success bg-success-bg p-3 text-sm text-success">
                    Roadmap complete — nice work. Reopen a step if you want to revisit it.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-lg bg-surface p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Completed ({completedSteps.length})
                      </p>
                      {completedSteps.length === 0 ? (
                        <p className="mt-1 text-sm text-ink-muted">Nothing done yet.</p>
                      ) : (
                        <ul className="mt-1 space-y-1">
                          {completedSteps.slice(-3).map((s) => (
                            <li key={s.id} className="flex items-center gap-1.5 text-sm text-ink-muted">
                              <IconCheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                              <span className="truncate line-through">{s.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="rounded-lg border border-primary-500 bg-primary-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                        Current step
                      </p>
                      {current ? (
                        <>
                          <p className="mt-1 text-sm font-medium text-ink">{current.title}</p>
                          <button
                            onClick={() => setRoadmapStepStatus(roadmap.id, current.id, 'completed')}
                            className="mt-2 rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700"
                          >
                            Mark done
                          </button>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-ink-muted">—</p>
                      )}
                    </div>
                    <div className="rounded-lg border border-line bg-white p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                        Next step
                      </p>
                      {next ? (
                        <p className="mt-1 text-sm text-ink-secondary">{next.title}</p>
                      ) : (
                        <p className="mt-1 text-sm text-ink-muted">
                          {current ? 'This is the last step.' : '—'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <ol>
                  {roadmap.steps.map((s, idx) => (
                    <StepItem
                      key={s.id}
                      api={api}
                      roadmapId={roadmap.id}
                      step={s}
                      index={idx}
                      isFirst={idx === 0}
                      isLast={idx === roadmap.steps.length - 1}
                      expanded={expandedStepId === s.id}
                      onToggleExpand={() => setExpandedStepId((v) => (v === s.id ? null : s.id))}
                    />
                  ))}
                </ol>
              </>
            )}

            <form className="flex gap-2" onSubmit={submitStep}>
              <Input
                placeholder="Add another step… (Enter to add)"
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
              />
              <Button variant="secondary" type="submit">
                Add
              </Button>
            </form>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function Roadmaps({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state } = api;
  const [openId, setOpenId] = useState<string | null>(null);
  const q = search.trim().toLowerCase();
  const visible = state.roadmaps.filter((r) =>
    q ? `${r.title} ${r.description}`.toLowerCase().includes(q) : true,
  );

  return (
    <div className="space-y-4">
      <CreateRoadmapForm api={api} />

      {state.roadmaps.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="No roadmaps yet" hint="Create one above, or start from a template." />
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-4">
          <EmptyState title="No matches" hint="No roadmaps match your search." />
        </Card>
      ) : (
        visible.map((r) => (
          <RoadmapCard
            key={r.id}
            api={api}
            roadmap={r}
            open={openId === r.id}
            onToggle={() => setOpenId((v) => (v === r.id ? null : r.id))}
          />
        ))
      )}
    </div>
  );
}
