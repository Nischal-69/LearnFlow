import { useMemo } from 'react';
import type {
  CompletionEntry,
  CompletionKind,
  Goal,
  GoalStatus,
  LearnFlowState,
  Roadmap,
  RoadmapStep,
  RoadmapStepStatus,
  Task,
  TaskStatus,
} from './types';
import { useLocalStorage } from './hooks';
import { computeLearningStreak, todayString, uid } from './utils';

export const STORAGE_KEY = 'learnflow-state-v1';

const seedState: LearnFlowState = {
  tasks: [],
  goals: [],
  roadmaps: [],
  folders: [
    { id: 'folder_getting_started', name: 'Getting started', createdAt: new Date().toISOString() },
  ],
  notes: [],
  completions: [],
};

export interface TaskInput {
  title: string;
  description: string;
  dueDate: string;
  priority: Task['priority'];
  category: string;
  estimatedMinutes: number;
}

export interface GoalInput {
  title: string;
  description: string;
  motivation: string;
  deadline: string;
  dailyTargetMinutes: number;
  weeklyTargetMinutes: number;
}

/** Fill defaults for goals saved before the full goals system existed. */
function normalizeGoal(raw: Goal): Goal {
  const status: GoalStatus =
    raw.status ?? ((raw as unknown as { completed?: boolean }).completed ? 'completed' : 'active');
  const completed = status === 'completed';
  return {
    ...raw,
    motivation: raw.motivation ?? '',
    deadline: raw.deadline ?? '',
    dailyTargetMinutes: raw.dailyTargetMinutes ?? 0,
    weeklyTargetMinutes: raw.weeklyTargetMinutes ?? 0,
    status,
    completedAt: completed ? (raw.completedAt ?? raw.createdAt) : null,
  };
}

/** Fill defaults for history entries saved before the Learning Tracker existed. */
function normalizeCompletion(raw: CompletionEntry): CompletionEntry {
  const r = raw as Partial<CompletionEntry>;
  return {
    id: r.id ?? uid('log'),
    date: r.date ?? todayString(),
    kind: r.kind ?? 'session',
    title: r.title ?? '',
    minutes: Math.max(0, Math.floor(r.minutes ?? 0) || 0),
    goalId: r.goalId ?? null,
    roadmapId: r.roadmapId ?? null,
    roadmapStepId: r.roadmapStepId ?? null,
    understood: r.understood ?? '',
    struggled: r.struggled ?? '',
    next: (r as { next?: string }).next ?? '',
    notes: (r as { notes?: string }).notes ?? '',
    createdAt: r.createdAt ?? new Date().toISOString(),
  };
}

/** Fill defaults for tasks saved before the full task system existed. */
function normalizeTask(raw: Task): Task {
  const status: TaskStatus = raw.status ?? (raw.done ? 'completed' : 'todo');
  const done = status === 'completed';
  return {
    ...raw,
    description: raw.description ?? '',
    priority: raw.priority ?? 'medium',
    category: raw.category ?? '',
    estimatedMinutes: raw.estimatedMinutes ?? 0,
    status,
    done,
    doneAt: done ? (raw.doneAt ?? raw.createdAt) : null,
  };
}

/** Apply a status transition. Completing stamps doneAt; reopening clears it. */
function applyStatus(t: Task, status: TaskStatus): { task: Task; didComplete: boolean } {
  const wasCompleted = t.status === 'completed';
  const nowCompleted = status === 'completed';
  return {
    task: {
      ...t,
      status,
      done: nowCompleted,
      doneAt: nowCompleted ? (wasCompleted ? t.doneAt : new Date().toISOString()) : null,
    },
    didComplete: nowCompleted && !wasCompleted,
  };
}

function looksLikeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('www.');
}

function toDisplayUrl(value: string): string {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return v;
}

/** Migrate steps saved before the rich roadmap model existed. */
export function normalizeRoadmapStep(raw: RoadmapStep): RoadmapStep {
  const r = raw as RoadmapStep & { done?: boolean; resource?: string };
  const status: RoadmapStepStatus =
    r.status ?? (r.done ? 'completed' : 'not_started');
  let resources = Array.isArray(r.resources) ? r.resources : [];
  let notes = r.notes ?? '';
  const legacyResource = (r.resource ?? '').trim();
  if (legacyResource && resources.length === 0) {
    if (looksLikeUrl(legacyResource)) {
      resources = [{ id: uid('res'), label: legacyResource, url: toDisplayUrl(legacyResource) }];
    } else if (!notes) {
      notes = legacyResource;
    } else {
      resources = [{ id: uid('res'), label: legacyResource, url: '' }];
    }
  }
  return {
    id: r.id,
    title: r.title ?? '',
    description: (r as { description?: string }).description ?? '',
    estimatedMinutes: Math.max(0, Math.floor((r as { estimatedMinutes?: number }).estimatedMinutes ?? 0) || 0),
    resources,
    status,
    notes,
    done: status === 'completed',
  };
}

function normalizeRoadmap(raw: Roadmap): Roadmap {
  return {
    ...raw,
    description: (raw as { description?: string }).description ?? '',
    steps: Array.isArray(raw.steps) ? raw.steps.map(normalizeRoadmapStep) : [],
  };
}

export interface RoadmapStepPatch {
  title?: string;
  description?: string;
  estimatedMinutes?: number;
  status?: RoadmapStepStatus;
  notes?: string;
}

export type RoadmapStepSeed = string | { title: string; description?: string; estimatedMinutes?: number };

export interface LearningSessionInput {
  title: string;
  minutes: number;
  date?: string;
  goalId?: string | null;
  roadmapId?: string | null;
  roadmapStepId?: string | null;
  understood?: string;
  struggled?: string;
  next?: string;
  notes?: string;
  /** when a roadmap step is linked, also mark it completed */
  markStepComplete?: boolean;
}

function makeStep(
  title: string,
  extra?: { description?: string; estimatedMinutes?: number },
): RoadmapStep {
  return {
    id: uid('step'),
    title: title.trim(),
    description: (extra?.description ?? '').trim(),
    estimatedMinutes: Math.max(0, Math.floor(extra?.estimatedMinutes ?? 0) || 0),
    resources: [],
    status: 'not_started',
    notes: '',
    done: false,
  };
}

/** First in_progress, else first not_started. Null when everything completed. */
export function currentRoadmapStep(roadmap: Roadmap): RoadmapStep | null {
  const steps = roadmap.steps.map(normalizeRoadmapStep);
  return steps.find((s) => s.status === 'in_progress') ?? steps.find((s) => s.status !== 'completed') ?? null;
}

/** Step immediately after the current one. Null when current is last or none. */
export function nextRoadmapStep(roadmap: Roadmap): RoadmapStep | null {
  const steps = roadmap.steps.map(normalizeRoadmapStep);
  const current = currentRoadmapStep(roadmap);
  if (!current) return null;
  const idx = steps.findIndex((s) => s.id === current.id);
  return idx >= 0 && idx + 1 < steps.length ? steps[idx + 1] : null;
}

export function roadmapProgress(roadmap: Roadmap): { done: number; total: number; pct: number } {
  const steps = roadmap.steps.map(normalizeRoadmapStep);
  const done = steps.filter((s) => s.status === 'completed').length;
  const total = steps.length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function useLearnFlow() {
  const [stored, setStored] = useLocalStorage<LearnFlowState>(STORAGE_KEY, seedState);

  // Migrate tasks/goals/roadmaps/history saved by older versions to the full shapes.
  const state: LearnFlowState = useMemo(
    () => ({
      ...stored,
      tasks: stored.tasks.map(normalizeTask),
      goals: stored.goals.map(normalizeGoal),
      roadmaps: (stored.roadmaps ?? []).map(normalizeRoadmap),
      completions: (stored.completions ?? []).map(normalizeCompletion),
    }),
    [stored],
  );
  const setState = setStored;

  // Streak source of truth: session-only learning days derived from
  // actual completion records. Tasks/goals/roadmap-steps never count.
  const streak = useMemo(() => computeLearningStreak(state.completions), [state.completions]);

  function logCompletion(
    entry: Partial<CompletionEntry> & { kind: CompletionKind; title: string },
  ) {
    const full: CompletionEntry = normalizeCompletion({
      ...entry,
      id: uid('log'),
      date: entry.date ?? todayString(),
      createdAt: new Date().toISOString(),
    } as CompletionEntry);
    setState((s) => ({ ...s, completions: [full, ...s.completions] }));
    return full.id;
  }

  // ---- Tasks ----
  function addTask(input: TaskInput) {
    const now = new Date().toISOString();
    const task: Task = {
      id: uid('task'),
      title: input.title.trim(),
      description: input.description.trim(),
      dueDate: input.dueDate || todayString(),
      priority: input.priority,
      category: input.category.trim(),
      estimatedMinutes: Math.max(0, Math.floor(input.estimatedMinutes) || 0),
      status: 'todo',
      done: false,
      doneAt: null,
      createdAt: now,
    };
    setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
  }

  /** Edit any task field. Moving to completed stamps doneAt + logs history. */
  function updateTask(id: string, patch: Partial<TaskInput> & { status?: TaskStatus }) {
    let completedTitle = '';
    let didComplete = false;
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((raw) => {
        if (raw.id !== id) return raw;
        const next: Task = {
          ...normalizeTask(raw),
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate || todayString() } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.category !== undefined ? { category: patch.category.trim() } : {}),
          ...(patch.estimatedMinutes !== undefined
            ? { estimatedMinutes: Math.max(0, Math.floor(patch.estimatedMinutes) || 0) }
            : {}),
        };
        if (patch.status !== undefined && patch.status !== next.status) {
          const applied = applyStatus(next, patch.status);
          if (applied.didComplete) {
            didComplete = true;
            completedTitle = applied.task.title;
          }
          return applied.task;
        }
        return next;
      }),
    }));
    if (didComplete) logCompletion({ kind: 'task', title: completedTitle, minutes: 0 });
  }

  function setTaskStatus(id: string, status: TaskStatus) {
    updateTask(id, { status });
  }

  function setTaskPriority(id: string, priority: Task['priority']) {
    updateTask(id, { priority });
  }

  function toggleTask(id: string) {
    let completedTitle = '';
    let didComplete = false;
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((raw) => {
        const t = normalizeTask(raw);
        if (t.id !== id) return t;
        const done = !t.done;
        if (done) {
          didComplete = true;
          completedTitle = t.title;
        }
        return {
          ...t,
          status: done ? ('completed' as TaskStatus) : ('todo' as TaskStatus),
          done,
          doneAt: done ? new Date().toISOString() : null,
        };
      }),
    }));
    if (didComplete) logCompletion({ kind: 'task', title: completedTitle, minutes: 0 });
  }

  function deleteTask(id: string) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }

  // ---- Goals ----
  function addGoal(input: GoalInput) {
    const now = new Date().toISOString();
    const goal: Goal = {
      id: uid('goal'),
      title: input.title.trim(),
      description: input.description.trim(),
      motivation: input.motivation.trim(),
      deadline: input.deadline,
      dailyTargetMinutes: Math.max(0, Math.floor(input.dailyTargetMinutes) || 0),
      weeklyTargetMinutes: Math.max(0, Math.floor(input.weeklyTargetMinutes) || 0),
      status: 'active',
      completedAt: null,
      createdAt: now,
    };
    setState((s) => ({ ...s, goals: [goal, ...s.goals] }));
  }

  /** Edit any goal field. Status transitions stamp/clear completedAt and log completion. */
  function updateGoal(id: string, patch: Partial<GoalInput> & { status?: GoalStatus }) {
    let completedTitle = '';
    let completedGoalId = '';
    let didComplete = false;
    setState((s) => ({
      ...s,
      goals: s.goals.map((raw) => {
        if (raw.id !== id) return raw;
        const next: Goal = {
          ...normalizeGoal(raw),
          ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
          ...(patch.description !== undefined ? { description: patch.description } : {}),
          ...(patch.motivation !== undefined ? { motivation: patch.motivation.trim() } : {}),
          ...(patch.deadline !== undefined ? { deadline: patch.deadline } : {}),
          ...(patch.dailyTargetMinutes !== undefined
            ? { dailyTargetMinutes: Math.max(0, Math.floor(patch.dailyTargetMinutes) || 0) }
            : {}),
          ...(patch.weeklyTargetMinutes !== undefined
            ? { weeklyTargetMinutes: Math.max(0, Math.floor(patch.weeklyTargetMinutes) || 0) }
            : {}),
        };
        if (patch.status !== undefined && patch.status !== next.status) {
          const wasCompleted = next.status === 'completed';
          const nowCompleted = patch.status === 'completed';
          if (nowCompleted && !wasCompleted) {
            didComplete = true;
            completedTitle = next.title;
            completedGoalId = next.id;
          }
          return {
            ...next,
            status: patch.status,
            completedAt: nowCompleted
              ? wasCompleted
                ? next.completedAt
                : new Date().toISOString()
              : null,
          };
        }
        return next;
      }),
    }));
    if (didComplete)
      logCompletion({ kind: 'goal', title: completedTitle, minutes: 0, goalId: completedGoalId });
  }

  function setGoalStatus(id: string, status: GoalStatus) {
    updateGoal(id, { status });
  }

  function deleteGoal(id: string) {
    setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) }));
  }

  // ---- Roadmaps ----
  function addRoadmap(title: string, description: string, stepTitles: RoadmapStepSeed[]) {
    if (!title.trim()) return;
    setState((s) => ({
      ...s,
      roadmaps: [
        {
          id: uid('roadmap'),
          title: title.trim(),
          description: description.trim(),
          createdAt: new Date().toISOString(),
          steps: stepTitles
            .map((t) =>
              typeof t === 'string'
                ? t.trim()
                  ? makeStep(t)
                  : null
                : t.title.trim()
                  ? makeStep(t.title, { description: t.description, estimatedMinutes: t.estimatedMinutes })
                  : null,
            )
            .filter((x): x is RoadmapStep => x !== null),
        },
        ...s.roadmaps,
      ],
    }));
  }

  function updateRoadmap(id: string, patch: { title?: string; description?: string }) {
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== id
          ? r
          : {
              ...r,
              ...(patch.title !== undefined ? { title: patch.title.trim() || r.title } : {}),
              ...(patch.description !== undefined ? { description: patch.description } : {}),
            },
      ),
    }));
  }

  function addRoadmapStep(
    roadmapId: string,
    title: string,
    extra?: { description?: string; estimatedMinutes?: number },
  ) {
    if (!title.trim()) return;
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== roadmapId ? r : { ...r, steps: [...r.steps.map(normalizeRoadmapStep), makeStep(title, extra)] },
      ),
    }));
  }

  function updateRoadmapStep(roadmapId: string, stepId: string, patch: RoadmapStepPatch) {
    let completedTitle = '';
    let roadmapTitle = '';
    let didComplete = false;
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) => {
        if (r.id !== roadmapId) return r;
        roadmapTitle = r.title;
        return {
          ...r,
          steps: r.steps.map(normalizeRoadmapStep).map((st) => {
            if (st.id !== stepId) return st;
            const next: RoadmapStep = {
              ...st,
              ...(patch.title !== undefined ? { title: patch.title.trim() || st.title } : {}),
              ...(patch.description !== undefined ? { description: patch.description } : {}),
              ...(patch.estimatedMinutes !== undefined
                ? { estimatedMinutes: Math.max(0, Math.floor(patch.estimatedMinutes) || 0) }
                : {}),
              ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
              ...(patch.status !== undefined ? { status: patch.status } : {}),
            };
            next.done = next.status === 'completed';
            if (next.status === 'completed' && st.status !== 'completed') {
              didComplete = true;
              completedTitle = next.title;
            }
            return next;
          }),
        };
      }),
    }));
    if (didComplete)
      logCompletion({ kind: 'roadmap-step', title: `${roadmapTitle} — ${completedTitle}`, minutes: 0 });
  }

  function setRoadmapStepStatus(roadmapId: string, stepId: string, status: RoadmapStepStatus) {
    updateRoadmapStep(roadmapId, stepId, { status });
  }

  function toggleRoadmapStep(roadmapId: string, stepId: string) {
    let target: RoadmapStepStatus = 'completed';
    for (const r of state.roadmaps) {
      if (r.id !== roadmapId) continue;
      const st = r.steps.map(normalizeRoadmapStep).find((x) => x.id === stepId);
      if (st) target = st.status === 'completed' ? 'not_started' : 'completed';
    }
    updateRoadmapStep(roadmapId, stepId, { status: target });
  }

  function deleteRoadmapStep(roadmapId: string, stepId: string) {
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== roadmapId
          ? r
          : { ...r, steps: r.steps.map(normalizeRoadmapStep).filter((st) => st.id !== stepId) },
      ),
    }));
  }

  function moveRoadmapStep(roadmapId: string, stepId: string, dir: 'up' | 'down') {
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) => {
        if (r.id !== roadmapId) return r;
        const steps = r.steps.map(normalizeRoadmapStep);
        const idx = steps.findIndex((st) => st.id === stepId);
        if (idx < 0) return r;
        const j = dir === 'up' ? idx - 1 : idx + 1;
        if (j < 0 || j >= steps.length) return r;
        const next = [...steps];
        [next[idx], next[j]] = [next[j], next[idx]];
        return { ...r, steps: next };
      }),
    }));
  }

  function addStepResource(roadmapId: string, stepId: string, label: string, url: string) {
    const l = label.trim() || url.trim();
    const u = url.trim() ? toDisplayUrl(url.trim()) : '';
    if (!l && !u) return;
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== roadmapId
          ? r
          : {
              ...r,
              steps: r.steps.map(normalizeRoadmapStep).map((st) =>
                st.id !== stepId
                  ? st
                  : { ...st, resources: [...st.resources, { id: uid('res'), label: l || u, url: u }] },
              ),
            },
      ),
    }));
  }

  function removeStepResource(roadmapId: string, stepId: string, resourceId: string) {
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== roadmapId
          ? r
          : {
              ...r,
              steps: r.steps.map(normalizeRoadmapStep).map((st) =>
                st.id !== stepId
                  ? st
                  : { ...st, resources: st.resources.filter((x) => x.id !== resourceId) },
              ),
            },
      ),
    }));
  }

  function updateStepResource(roadmapId: string, stepId: string, resource: string) {
    // Legacy single-field shim: URL → first resource, plain text → notes.
    const value = resource.trim();
    if (!value) {
      setState((s) => ({
        ...s,
        roadmaps: s.roadmaps.map((r) =>
          r.id !== roadmapId
            ? r
            : {
                ...r,
                steps: r.steps.map(normalizeRoadmapStep).map((st) =>
                  st.id !== stepId ? st : { ...st, resources: [], resource: '' } as RoadmapStep,
                ),
              },
        ),
      }));
      return;
    }
    if (looksLikeUrl(value)) {
      setState((s) => ({
        ...s,
        roadmaps: s.roadmaps.map((r) =>
          r.id !== roadmapId
            ? r
            : {
                ...r,
                steps: r.steps.map(normalizeRoadmapStep).map((st) => {
                  if (st.id !== stepId) return st;
                  const first = st.resources[0];
                  return {
                    ...st,
                    resources: first
                      ? [{ ...first, label: value, url: toDisplayUrl(value) }]
                      : [{ id: uid('res'), label: value, url: toDisplayUrl(value) }],
                  };
                }),
              },
        ),
      }));
    } else {
      updateRoadmapStep(roadmapId, stepId, { notes: value });
    }
  }

  function deleteRoadmap(id: string) {
    setState((s) => ({ ...s, roadmaps: s.roadmaps.filter((r) => r.id !== id) }));
  }

  // ---- Library ----
  function addFolder(name: string) {
    setState((s) => ({
      ...s,
      folders: [...s.folders, { id: uid('folder'), name: name.trim(), createdAt: new Date().toISOString() }],
    }));
  }

  function deleteFolder(id: string) {
    setState((s) => ({
      ...s,
      folders: s.folders.filter((f) => f.id !== id),
      notes: s.notes.filter((n) => n.folderId !== id),
    }));
  }

  function addNote(folderId: string, title: string, url: string, content: string) {
    const now = new Date().toISOString();
    setState((s) => ({
      ...s,
      notes: [
        { id: uid('note'), folderId, title: title.trim(), url: url.trim(), content, createdAt: now, updatedAt: now },
        ...s.notes,
      ],
    }));
  }

  function updateNote(id: string, patch: { title: string; url: string; content: string }) {
    setState((s) => ({
      ...s,
      notes: s.notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n,
      ),
    }));
  }

  function deleteNote(id: string) {
    setState((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
  }

  // ---- Sessions / Learning Tracker ----
  function logSession(title: string, minutes: number, date?: string, goalId?: string) {
    logCompletion({
      kind: 'session',
      title: title.trim() || 'Learning session',
      minutes: Math.max(0, Math.floor(minutes) || 0),
      date,
      goalId: goalId ?? null,
    });
  }

  /**
   * Record actual learning. A day only counts via this (or other completions) —
   * streaks/goals/today-status all derive from saved history, never estimates.
   * Optionally advances the linked roadmap step: not_started → in_progress
   * automatically, → completed when markStepComplete is set.
   */
  function logLearningSession(input: LearningSessionInput): string | null {
    const title = input.title.trim();
    const minutes = Math.max(0, Math.floor(input.minutes) || 0);
    if (!title || minutes <= 0) return null;
    const today = todayString();
    let date = (input.date || today).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
    if (date > today) date = today;

    const roadmapId = input.roadmapId ?? null;
    const roadmapStepId = input.roadmapStepId ?? null;

    const id = logCompletion({
      kind: 'session',
      title,
      minutes,
      date,
      goalId: input.goalId ?? null,
      roadmapId,
      roadmapStepId,
      understood: (input.understood ?? '').trim(),
      struggled: (input.struggled ?? '').trim(),
      next: (input.next ?? '').trim(),
      notes: (input.notes ?? '').trim(),
    });

    if (roadmapId && roadmapStepId) {
      const roadmap = state.roadmaps.find((r) => r.id === roadmapId);
      const step = roadmap?.steps.map(normalizeRoadmapStep).find((s) => s.id === roadmapStepId);
      if (step) {
        if (input.markStepComplete && step.status !== 'completed') {
          updateRoadmapStep(roadmapId, roadmapStepId, { status: 'completed' });
        } else if (step.status === 'not_started') {
          updateRoadmapStep(roadmapId, roadmapStepId, { status: 'in_progress' });
        }
      }
    }
    return id;
  }

  function updateLearningSession(
    id: string,
    patch: Partial<Omit<LearningSessionInput, 'markStepComplete'>>,
  ) {
    setState((s) => ({
      ...s,
      completions: s.completions.map((raw) => {
        const c = normalizeCompletion(raw);
        if (c.id !== id || c.kind !== 'session') return c;
        const nextDate = patch.date !== undefined ? patch.date.slice(0, 10) : c.date;
        return {
          ...c,
          ...(patch.title !== undefined ? { title: patch.title.trim() || c.title } : {}),
          ...(patch.minutes !== undefined
            ? { minutes: Math.max(1, Math.floor(patch.minutes) || c.minutes) }
            : {}),
          ...(patch.date !== undefined
            ? {
                date:
                  /^\d{4}-\d{2}-\d{2}$/.test(nextDate) && nextDate <= todayString()
                    ? nextDate
                    : c.date,
              }
            : {}),
          ...(patch.goalId !== undefined ? { goalId: patch.goalId } : {}),
          ...(patch.roadmapId !== undefined ? { roadmapId: patch.roadmapId } : {}),
          ...(patch.roadmapStepId !== undefined ? { roadmapStepId: patch.roadmapStepId } : {}),
          ...(patch.understood !== undefined ? { understood: patch.understood } : {}),
          ...(patch.struggled !== undefined ? { struggled: patch.struggled } : {}),
          ...(patch.next !== undefined ? { next: patch.next } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        };
      }),
    }));
  }

  function deleteCompletion(id: string) {
    setState((s) => ({ ...s, completions: s.completions.filter((c) => c.id !== id) }));
  }

  function resetAll() {
    setState(seedState);
  }

  return {
    state,
    streak,
    addTask,
    updateTask,
    setTaskStatus,
    setTaskPriority,
    toggleTask,
    deleteTask,
    addGoal,
    updateGoal,
    setGoalStatus,
    deleteGoal,
    addRoadmap,
    updateRoadmap,
    addRoadmapStep,
    updateRoadmapStep,
    setRoadmapStepStatus,
    toggleRoadmapStep,
    deleteRoadmapStep,
    moveRoadmapStep,
    addStepResource,
    removeStepResource,
    updateStepResource,
    deleteRoadmap,
    addFolder,
    deleteFolder,
    addNote,
    updateNote,
    deleteNote,
    logSession,
    logLearningSession,
    updateLearningSession,
    deleteCompletion,
    resetAll,
  };
}

export type LearnFlowApi = ReturnType<typeof useLearnFlow>;
