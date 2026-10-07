import { useMemo, useState } from 'react';
import type { LearnFlowApi, LearningSessionInput } from '../store';
import type { CompletionEntry, Goal, GoalStatus } from '../types';
import { currentWeekKey, formatDate, formatWeekKey, goalStats, todayString } from '../utils';
import { verifyGoal, type VerificationStatus } from '../verification';
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

function verificationTone(s: VerificationStatus): 'success' | 'primary' | 'neutral' {
  return s === 'Completed' ? 'success' : s === 'Still Learning' ? 'primary' : 'neutral';
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

interface LogForm {
  title: string;
  goalId: string;
  roadmapId: string;
  stepId: string;
  date: string;
  minutes: string;
  understood: string;
  struggled: string;
  next: string;
  notes: string;
  markStepComplete: boolean;
}

function blankLogForm(defaultGoalId = ''): LogForm {
  return {
    title: '',
    goalId: defaultGoalId,
    roadmapId: '',
    stepId: '',
    date: todayString(),
    minutes: '45',
    understood: '',
    struggled: '',
    next: '',
    notes: '',
    markStepComplete: false,
  };
}

function formFromSession(s: CompletionEntry): LogForm {
  return {
    title: s.title,
    goalId: s.goalId ?? '',
    roadmapId: s.roadmapId ?? '',
    stepId: s.roadmapStepId ?? '',
    date: s.date,
    minutes: String(s.minutes),
    understood: s.understood,
    struggled: s.struggled,
    next: s.next,
    notes: s.notes,
    markStepComplete: false,
  };
}

function Reflection({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink-secondary">{value}</p>
    </div>
  );
}

export default function Learning({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state, addGoal, updateGoal, deleteGoal, logLearningSession, updateLearningSession, deleteCompletion, saveWeeklyReview, deleteWeeklyReview } = api;
  const [filter, setFilter] = useState<Filter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState<GoalForm>(blankGoalForm);
  const [logOpen, setLogOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<CompletionEntry | null>(null);
  const [logForm, setLogForm] = useState<LogForm>(blankLogForm());
  const [reviewWeek, setReviewWeek] = useState(currentWeekKey());
  const [reviewLearned, setReviewLearned] = useState('');
  const [reviewMissed, setReviewMissed] = useState('');
  const [reviewFocus, setReviewFocus] = useState('');
  const [editingReviewWeek, setEditingReviewWeek] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState('');
  const q = search.trim().toLowerCase();

  const goalById = useMemo(() => new Map(state.goals.map((g) => [g.id, g])), [state.goals]);
  const roadmapById = useMemo(() => new Map(state.roadmaps.map((r) => [r.id, r])), [state.roadmaps]);

  const sessions = useMemo(
    () => state.completions.filter((c) => c.kind === 'session').sort((a, b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`)),
    [state.completions],
  );
  const today = todayString();
  const sessionsToday = sessions.filter((s) => s.date === today);
  const minutesToday = sessionsToday.reduce((a, s) => a + (s.minutes || 0), 0);

  const activeGoals = state.goals.filter((g) => g.status === 'active');
  const stepsForRoadmap = (roadmapId: string) =>
    roadmapById.get(roadmapId)?.steps ?? [];

  function openLog(goalId = '', session?: CompletionEntry) {
    if (session) {
      setEditingSession(session);
      setLogForm(formFromSession(session));
    } else {
      setEditingSession(null);
      const fallback = goalId || (activeGoals[0]?.id ?? '');
      setLogForm(blankLogForm(fallback));
    }
    setLogOpen(true);
  }

  function saveLog(e: React.FormEvent) {
    e.preventDefault();
    const minutes = Math.max(0, parseInt(logForm.minutes, 10) || 0);
    if (!logForm.title.trim() || minutes < 1) return;
    if (editingSession) {
      const patch: Partial<Omit<LearningSessionInput, 'markStepComplete'>> = {
        title: logForm.title,
        minutes,
        date: logForm.date,
        goalId: logForm.goalId || null,
        roadmapId: logForm.roadmapId || null,
        roadmapStepId: logForm.stepId || null,
        understood: logForm.understood,
        struggled: logForm.struggled,
        next: logForm.next,
        notes: logForm.notes,
      };
      // Clear stale step link when roadmap changes/unset.
      if (!logForm.roadmapId) patch.roadmapStepId = null;
      updateLearningSession(editingSession.id, patch);
    } else {
      const id = logLearningSession({
        title: logForm.title,
        minutes,
        date: logForm.date,
        goalId: logForm.goalId || null,
        roadmapId: logForm.roadmapId || null,
        roadmapStepId: logForm.stepId || null,
        understood: logForm.understood,
        struggled: logForm.struggled,
        next: logForm.next,
        notes: logForm.notes,
        markStepComplete: logForm.markStepComplete,
      });
      if (!id) return;
    }
    setLogOpen(false);
    setEditingSession(null);
  }

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

  const visibleGoals = state.goals
    .filter((g) => (filter === 'all' ? true : g.status === filter))
    .filter((g) =>
      q ? (g.title + ' ' + g.description + ' ' + g.motivation).toLowerCase().includes(q) : true,
    );

  const visibleSessions = sessions.filter((s) =>
    q
      ? `${s.title} ${s.understood} ${s.struggled} ${s.next} ${s.notes}`.toLowerCase().includes(q)
      : true,
  );

  const verifications = useMemo(
    () => visibleGoals.map((g) => ({ goal: g, v: verifyGoal(g, state.completions, state.notes, state.roadmaps) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleGoals, state.completions, state.notes, state.roadmaps],
  );

  const sortedReviews = useMemo(
    () => [...(state.weeklyReviews ?? [])].sort((a, b) => b.weekKey.localeCompare(a.weekKey)),
    [state.weeklyReviews],
  );

  function resetReviewForm() {
    setReviewWeek(currentWeekKey());
    setReviewLearned('');
    setReviewMissed('');
    setReviewFocus('');
    setEditingReviewWeek(null);
    setReviewError('');
  }

  function submitReview(e: React.FormEvent) {
    e.preventDefault();
    const ok = saveWeeklyReview({
      weekKey: reviewWeek.trim() || currentWeekKey(),
      learned: reviewLearned,
      missed: reviewMissed,
      focusNext: reviewFocus,
    });
    if (!ok) {
      setReviewError('Answer at least one question before saving.');
      return;
    }
    resetReviewForm();
  }

  function startEditReview(weekKey: string) {
    const r = (state.weeklyReviews ?? []).find((x) => x.weekKey === weekKey);
    if (!r) return;
    setReviewWeek(r.weekKey);
    setReviewLearned(r.learned);
    setReviewMissed(r.missed);
    setReviewFocus(r.focusNext);
    setEditingReviewWeek(r.weekKey);
    setReviewError('');
  }

  const logValid = logForm.title.trim().length > 0 && (parseInt(logForm.minutes, 10) || 0) >= 1;
  const selectedSteps = logForm.roadmapId ? stepsForRoadmap(logForm.roadmapId) : [];

  return (
    <>
      {/* Learning Tracker */}
      <Card>
        <CardHeader
          title="Learning Tracker"
          subtitle={
            sessionsToday.length === 0
              ? 'Nothing logged today yet — a day only counts when you record real learning.'
              : `${sessionsToday.length} session${sessionsToday.length === 1 ? '' : 's'} today · ${minutesToday} min`
          }
          action={
            <Button onClick={() => openLog()}>
              <IconFlame className="h-4 w-4" /> Log Learning
            </Button>
          }
        />
        <div className="grid gap-3 p-4 text-center sm:grid-cols-3">
          <div className="rounded-lg bg-surface p-3">
            <p className="text-lg font-bold text-ink">{sessionsToday.length}</p>
            <p className="text-xs text-ink-muted">Sessions today</p>
          </div>
          <div className="rounded-lg bg-surface p-3">
            <p className="text-lg font-bold text-ink">{minutesToday}<span className="text-xs font-medium text-ink-muted"> min</span></p>
            <p className="text-xs text-ink-muted">Minutes today</p>
          </div>
          <div className="rounded-lg bg-surface p-3">
            <p className="text-lg font-bold text-ink">{sessions.length}</p>
            <p className="text-xs text-ink-muted">Total sessions</p>
          </div>
        </div>
      </Card>

      {/* Learning log */}
      <Card>
        <CardHeader
          title="Learning log"
          subtitle="What you actually learned — with reflection, goal and roadmap links."
        />
        <div className="space-y-3 p-4">
          {visibleSessions.length === 0 ? (
            <EmptyState
              title="No learning logged yet"
              hint='Example: "Learned keyframes in After Effects" — 45 minutes.'
            />
          ) : (
            visibleSessions.slice(0, 20).map((s) => {
              const goal = s.goalId ? goalById.get(s.goalId) : undefined;
              const roadmap = s.roadmapId ? roadmapById.get(s.roadmapId) : undefined;
              const step = roadmap?.steps.find((x) => x.id === s.roadmapStepId);
              return (
                <div key={s.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{s.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <IconCalendar className="h-3.5 w-3.5" />{formatDate(s.date)}
                        </span>
                        <span>· {s.minutes} min</span>
                        {goal && <span>· {goal.title}</span>}
                        {roadmap && step && <span>· {roadmap.title} — {step.title}</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => openLog('', s)}
                      className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteCompletion(s.id)}
                      className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                      aria-label={`Delete session ${s.title}`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                  {(s.understood || s.struggled || s.next || s.notes) && (
                    <div className="mt-2 grid gap-2 border-t border-line pt-2 sm:grid-cols-2">
                      <Reflection label="Understood" value={s.understood} />
                      <Reflection label="Struggled with" value={s.struggled} />
                      <Reflection label="Learn next" value={s.next} />
                      <Reflection label="Notes" value={s.notes} />
                    </div>
                  )}
                </div>
              );
            })
          )}
          {visibleSessions.length > 20 && (
            <p className="text-center text-xs text-ink-muted">
              Showing latest 20 of {visibleSessions.length}. See Streaks → History for the full log.
            </p>
          )}
        </div>
      </Card>

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
          {visibleGoals.length === 0 ? (
            <div className="md:col-span-2">
              <EmptyState
                title="No goals here"
                hint={q ? 'No goals match your search.' : 'Example: Learn After Effects.'}
              />
            </div>
          ) : (
            visibleGoals.map((g) => {
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
                      <Button onClick={() => openLog(g.id)} className="flex-1">
                        Log Learning
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

      {/* Did You Learn? — planned vs actually recorded, per goal */}
      <Card>
        <CardHeader
          title="Did You Learn?"
          subtitle="What you planned vs what you actually recorded. Only your logged sessions, completed steps and notes count — nothing is claimed automatically."
        />
        <div className="space-y-3 p-4">
          {verifications.length === 0 ? (
            <EmptyState
              title="No goals to verify"
              hint={q ? 'No goals match your search.' : 'Create a learning goal above, then log sessions against it.'}
            />
          ) : (
            verifications.map(({ goal, v }) => (
              <div key={goal.id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{goal.title}</p>
                  <Badge tone={verificationTone(v.status)}>{v.status}</Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Planned</p>
                    <p className="mt-1 text-sm text-ink-secondary">
                      <span className="font-medium text-ink">Wanted to learn: </span>
                      {v.wantToLearn}
                    </p>
                    {v.plannedSteps.length === 0 ? (
                      <p className="mt-1 text-sm text-ink-muted">
                        No roadmap steps linked yet. Link a roadmap step when you log a session or note to measure progress.
                      </p>
                    ) : (
                      <ul className="mt-1.5 space-y-1">
                        {v.plannedSteps.slice(0, 8).map((s) => (
                          <li key={`${s.roadmapId}:${s.stepId}`} className="flex items-center gap-1.5 text-sm text-ink-secondary">
                            <span aria-hidden>{s.status === 'completed' ? '✓' : s.status === 'in_progress' ? '◐' : '○'}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {s.title} <span className="text-xs text-ink-muted">· {s.roadmapTitle}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {v.targetDate ? (
                      <p className="mt-1.5 text-xs text-ink-muted">Target date: {formatDate(v.targetDate)}</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-ink-muted">No target date set.</p>
                    )}
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Actual (recorded)</p>
                    {v.sessions.length === 0 && v.notesCount === 0 ? (
                      <p className="mt-1 text-sm text-ink-muted">Nothing recorded yet.</p>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-ink-secondary">
                          {v.sessions.length} session{v.sessions.length === 1 ? '' : 's'} · {v.completedSteps.length} completed step{v.completedSteps.length === 1 ? '' : 's'} · {v.notesCount} note{v.notesCount === 1 ? '' : 's'} · {v.minutes} min
                        </p>
                        {v.learned.length > 0 && (
                          <ul className="mt-1.5 space-y-1">
                            {v.learned.map((l, i) => (
                              <li key={`${l.date}-${i}`} className="text-sm text-ink-secondary">
                                “{l.title}” <span className="text-xs text-ink-muted">· {formatDate(l.date)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-line p-3">
                  <p className="text-sm text-ink">
                    <span className="font-medium">You planned to learn: </span>
                    <span className="text-ink-secondary">“{v.wantToLearn}”</span>
                  </p>
                  <p className="mt-1 text-sm text-ink">
                    <span className="font-medium">You actually learned: </span>
                    {v.learned.length === 0 ? (
                      <span className="text-ink-muted">Nothing recorded yet.</span>
                    ) : (
                      <span className="text-ink-secondary">“{v.learned.map((l) => l.title).join('” · “')}”</span>
                    )}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-sm text-ink">
                      <span className="font-medium">Progress: </span>
                      {v.progress === null ? (
                        <span className="text-ink-muted">— (link roadmap steps to measure)</span>
                      ) : (
                        <span className="font-semibold">{v.progress}%</span>
                      )}
                    </p>
                    {v.progress !== null && (
                      <span className="text-xs text-ink-muted">
                        {v.completedSteps.length}/{v.plannedSteps.length} steps
                      </span>
                    )}
                  </div>
                  {v.progress !== null && (
                    <div className="mt-1.5">
                      <ProgressBar value={v.progress} tone={v.progress === 100 ? 'success' : 'primary'} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Weekly review — saved into history */}
      <Card>
        <CardHeader
          title="Weekly review"
          subtitle="One review per week, saved into your history. Answer honestly — only what you recorded counts."
        />
        <div className="p-4">
          <form onSubmit={submitReview} className="grid gap-3 rounded-lg bg-surface p-3">
            <div className="grid gap-3 sm:grid-cols-[200px_1fr] sm:items-end">
              <div>
                <Label>Week</Label>
                <Input
                  type="week"
                  value={reviewWeek}
                  onChange={(e) => setReviewWeek(e.target.value)}
                />
              </div>
              {editingReviewWeek && (
                <p className="text-xs text-ink-muted">
                  Editing {formatWeekKey(editingReviewWeek)}.{' '}
                  <button type="button" onClick={resetReviewForm} className="font-medium text-primary-600 hover:underline">
                    Start new instead
                  </button>
                </p>
              )}
            </div>
            <div>
              <Label>What did I actually learn this week?</Label>
              <Textarea rows={2} placeholder="e.g. Finished flexbox basics, built a navbar" value={reviewLearned} onChange={(e) => setReviewLearned(e.target.value)} />
            </div>
            <div>
              <Label>What did I fail to complete?</Label>
              <Textarea rows={2} placeholder="e.g. Didn't finish the grid tutorial" value={reviewMissed} onChange={(e) => setReviewMissed(e.target.value)} />
            </div>
            <div>
              <Label>What should I focus on next week?</Label>
              <Textarea rows={2} placeholder="e.g. CSS grid + one small project" value={reviewFocus} onChange={(e) => setReviewFocus(e.target.value)} />
            </div>
            {reviewError && <p className="text-xs text-danger">{reviewError}</p>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingReviewWeek ? `Update ${formatWeekKey(editingReviewWeek)}` : 'Save weekly review'}
              </Button>
              {editingReviewWeek && (
                <Button variant="secondary" onClick={resetReviewForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
          <div className="mt-3 space-y-2">
            {sortedReviews.length === 0 ? (
              <EmptyState title="No reviews yet" hint="Answer the three questions above to save your first weekly review." />
            ) : (
              sortedReviews.map((r) => (
                <div key={r.weekKey} className="rounded-lg border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-ink">{formatWeekKey(r.weekKey)}</p>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => startEditReview(r.weekKey)} className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50">
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete review for ${formatWeekKey(r.weekKey)}?`)) {
                            deleteWeeklyReview(r.weekKey);
                            if (editingReviewWeek === r.weekKey) resetReviewForm();
                          }
                        }}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                        aria-label={`Delete review for ${r.weekKey}`}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                  {r.learned && <p className="mt-1 text-sm text-ink-secondary"><span className="font-medium text-ink">Learned: </span>{r.learned}</p>}
                  {r.missed && <p className="mt-1 text-sm text-ink-secondary"><span className="font-medium text-ink">Missed: </span>{r.missed}</p>}
                  {r.focusNext && <p className="mt-1 text-sm text-ink-secondary"><span className="font-medium text-ink">Next focus: </span>{r.focusNext}</p>}
                </div>
              ))
            )}
          </div>
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

      {logOpen && (
        <Modal title={editingSession ? 'Edit learning session' : 'Log Learning'} onClose={() => { setLogOpen(false); setEditingSession(null); }}>
          <form onSubmit={saveLog} className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <div>
              <Label>What did you learn?</Label>
              <Input
                autoFocus
                placeholder="e.g. Learned keyframes in After Effects"
                value={logForm.title}
                onChange={(e) => setLogForm({ ...logForm, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Learning goal (optional)</Label>
                <select
                  value={logForm.goalId}
                  onChange={(e) => setLogForm({ ...logForm, goalId: e.target.value })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                >
                  <option value="">No goal</option>
                  {state.goals.filter((g) => g.status === 'active').map((g) => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={logForm.date}
                  max={todayString()}
                  onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Roadmap (optional)</Label>
                <select
                  value={logForm.roadmapId}
                  onChange={(e) => setLogForm({ ...logForm, roadmapId: e.target.value, stepId: '', markStepComplete: false })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                >
                  <option value="">No roadmap</option>
                  {state.roadmaps.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Roadmap step</Label>
                <select
                  value={logForm.stepId}
                  disabled={!logForm.roadmapId}
                  onChange={(e) => setLogForm({ ...logForm, stepId: e.target.value, markStepComplete: false })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink disabled:opacity-50"
                >
                  <option value="">{logForm.roadmapId ? 'Pick a step (optional)' : 'Pick a roadmap first'}</option>
                  {selectedSteps.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}{s.status === 'completed' ? ' (done)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {logForm.stepId && !editingSession && (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-secondary">
                <input
                  type="checkbox"
                  checked={logForm.markStepComplete}
                  onChange={(e) => setLogForm({ ...logForm, markStepComplete: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-indigo-600"
                />
                <span>Mark this roadmap step as completed <span className="text-ink-muted">(otherwise it moves to In Progress)</span></span>
              </label>
            )}
            <div>
              <Label>Time spent (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                placeholder="45"
                value={logForm.minutes}
                onChange={(e) => setLogForm({ ...logForm, minutes: e.target.value })}
              />
            </div>
            <div>
              <Label>What I understood</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Can create basic position and scale animations"
                value={logForm.understood}
                onChange={(e) => setLogForm({ ...logForm, understood: e.target.value })}
              />
            </div>
            <div>
              <Label>What I struggled with</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Easing curves still feel confusing"
                value={logForm.struggled}
                onChange={(e) => setLogForm({ ...logForm, struggled: e.target.value })}
              />
            </div>
            <div>
              <Label>What I want to learn next</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Practice graph editor on a bouncing ball"
                value={logForm.next}
                onChange={(e) => setLogForm({ ...logForm, next: e.target.value })}
              />
            </div>
            <div>
              <Label>Optional notes</Label>
              <Textarea
                rows={2}
                placeholder="Links, ideas, reminders…"
                value={logForm.notes}
                onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
              />
            </div>
            <p className="text-xs text-ink-muted">
              Saving logs the session, updates the linked goal, advances the roadmap step, and counts toward today + streak.
            </p>
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={!logValid}>
                <IconFlame className="h-4 w-4" /> {editingSession ? 'Save changes' : 'Save learning'}
              </Button>
              <Button variant="secondary" onClick={() => { setLogOpen(false); setEditingSession(null); }}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
