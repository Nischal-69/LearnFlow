import { useMemo } from 'react';
import type { CompletionEntry, LearnFlowState } from './types';
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

export function useLearnFlow() {
  const [state, setState] = useLocalStorage<LearnFlowState>(STORAGE_KEY, seedState);

  const streak = useMemo(
    () => computeStreak(state.completions.map((c) => c.date)),
    [state.completions],
  );

  function logCompletion(entry: Omit<CompletionEntry, 'id' | 'createdAt' | 'date'> & { date?: string }) {
    const full: CompletionEntry = {
      id: uid('log'),
      date: entry.date ?? todayString(),
      createdAt: new Date().toISOString(),
      ...entry,
    } as CompletionEntry;
    setState((s) => ({ ...s, completions: [full, ...s.completions] }));
  }

  // ---- Tasks ----
  function addTask(title: string, dueDate: string) {
    const task = {
      id: uid('task'),
      title: title.trim(),
      dueDate: dueDate || todayString(),
      done: false,
      doneAt: null as string | null,
      createdAt: new Date().toISOString(),
    };
    setState((s) => ({ ...s, tasks: [task, ...s.tasks] }));
  }

  function toggleTask(id: string) {
    let completedTitle = '';
    let didComplete = false;
    setState((s) => ({
      ...s,
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        const done = !t.done;
        if (done) {
          didComplete = true;
          completedTitle = t.title;
        }
        return { ...t, done, doneAt: done ? new Date().toISOString() : null };
      }),
    }));
    if (didComplete) logCompletion({ kind: 'task', title: completedTitle, minutes: 0 });
  }

  function deleteTask(id: string) {
    setState((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  }

  // ---- Goals ----
  function addGoal(title: string, description: string, deadline: string) {
    setState((s) => ({
      ...s,
      goals: [
        {
          id: uid('goal'),
          title: title.trim(),
          description: description.trim(),
          deadline,
          completed: false,
          completedAt: null,
          createdAt: new Date().toISOString(),
        },
        ...s.goals,
      ],
    }));
  }

  function toggleGoal(id: string) {
    let title = '';
    let didComplete = false;
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => {
        if (g.id !== id) return g;
        const completed = !g.completed;
        if (completed) {
          didComplete = true;
          title = g.title;
        }
        return { ...g, completed, completedAt: completed ? new Date().toISOString() : null };
      }),
    }));
    if (didComplete) logCompletion({ kind: 'goal', title, minutes: 0 });
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
  function logSession(title: string, minutes: number, date?: string) {
    logCompletion({ kind: 'session', title: title.trim() || 'Learning session', minutes, date });
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
    toggleTask,
    deleteTask,
    addGoal,
    toggleGoal,
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
