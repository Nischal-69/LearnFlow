import { useMemo } from 'react';
import type { CompletionEntry, Goal, GoalStatus, LearnFlowState, Task, TaskStatus } from './types';
import { useLocalStorage } from './hooks';
import { computeStreak, todayString, uid } from './utils';

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

export function useLearnFlow() {
  const [stored, setStored] = useLocalStorage<LearnFlowState>(STORAGE_KEY, seedState);

  // Migrate tasks/goals saved by older versions to the full shapes.
  const state: LearnFlowState = useMemo(
    () => ({
      ...stored,
      tasks: stored.tasks.map(normalizeTask),
      goals: stored.goals.map(normalizeGoal),
      completions: stored.completions.map((c) => ({ ...c, goalId: c.goalId ?? null })),
    }),
    [stored],
  );
  const setState = setStored;

  const streak = useMemo(
    () => computeStreak(state.completions.map((c) => c.date)),
    [state.completions],
  );

  function logCompletion(
    entry: Omit<CompletionEntry, 'id' | 'createdAt' | 'date' | 'goalId'> & {
      date?: string;
      goalId?: string | null;
    },
  ) {
    const full: CompletionEntry = {
      id: uid('log'),
      date: entry.date ?? todayString(),
      goalId: null,
      createdAt: new Date().toISOString(),
      ...entry,
    } as CompletionEntry;
    setState((s) => ({ ...s, completions: [full, ...s.completions] }));
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
  function addRoadmap(title: string, description: string, stepTitles: string[]) {
    setState((s) => ({
      ...s,
      roadmaps: [
        {
          id: uid('roadmap'),
          title: title.trim(),
          description: description.trim(),
          createdAt: new Date().toISOString(),
          steps: stepTitles
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t) => ({ id: uid('step'), title: t, done: false, resource: '' })),
        },
        ...s.roadmaps,
      ],
    }));
  }

  function addRoadmapStep(roadmapId: string, title: string) {
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== roadmapId
          ? r
          : { ...r, steps: [...r.steps, { id: uid('step'), title: title.trim(), done: false, resource: '' }] },
      ),
    }));
  }

  function toggleRoadmapStep(roadmapId: string, stepId: string) {
    let stepTitle = '';
    let roadmapTitle = '';
    let didComplete = false;
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) => {
        if (r.id !== roadmapId) return r;
        roadmapTitle = r.title;
        return {
          ...r,
          steps: r.steps.map((st) => {
            if (st.id !== stepId) return st;
            const done = !st.done;
            if (done) {
              didComplete = true;
              stepTitle = st.title;
            }
            return { ...st, done };
          }),
        };
      }),
    }));
    if (didComplete) logCompletion({ kind: 'roadmap-step', title: `${roadmapTitle} — ${stepTitle}`, minutes: 0 });
  }

  function updateStepResource(roadmapId: string, stepId: string, resource: string) {
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== roadmapId
          ? r
          : { ...r, steps: r.steps.map((st) => (st.id === stepId ? { ...st, resource } : st)) },
      ),
    }));
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

  // ---- Sessions ----
  function logSession(title: string, minutes: number, date?: string, goalId?: string) {
    logCompletion({
      kind: 'session',
      title: title.trim() || 'Learning session',
      minutes,
      date,
      goalId: goalId ?? null,
    });
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
    addRoadmapStep,
    toggleRoadmapStep,
    updateStepResource,
    deleteRoadmap,
    addFolder,
    deleteFolder,
    addNote,
    updateNote,
    deleteNote,
    logSession,
    deleteCompletion,
    resetAll,
  };
}

export type LearnFlowApi = ReturnType<typeof useLearnFlow>;
