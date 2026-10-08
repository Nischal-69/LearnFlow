/**
 * Persistence + React binding for the centralized data layer.
 *
 * - Load once from `storage` (refresh-safe), save on every change.
 * - Only this module (via `storage.ts`) touches browser persistence.
 * - `useLearnFlowData` is the single hook components should use; `src/store.ts`
 *   re-exports it for backward compatibility.
 */
import { useEffect, useMemo, useState } from 'react';
import type { LearnFlowState } from '../types';
import { computeLearningStreak } from '../utils';
import { KEYS, loadJSON, removeKey, saveJSON } from './storage';
import { migrateStoredState, normalizeSettings, normalizeUser, seedState } from './schema';
import {
  createDailyReview as svcCreateDailyReview,
  createFolder as svcCreateFolder,
  createGoal as svcCreateGoal,
  createLearningSession as svcCreateLearningSession,
  createNote as svcCreateNote,
  createResource as svcCreateResource,
  createRoadmap as svcCreateRoadmap,
  createRoadmapStep as svcCreateRoadmapStep,
  createStreakSnapshot as svcCreateStreakSnapshot,
  createSubfolder as svcCreateSubfolder,
  createTask as svcCreateTask,
  createUser as svcCreateUser,
  deleteDailyReview as svcDeleteDailyReview,
  deleteFolder as svcDeleteFolder,
  deleteGoal as svcDeleteGoal,
  deleteLearningSession as svcDeleteLearningSession,
  deleteNote as svcDeleteNote,
  deleteResource as svcDeleteResource,
  deleteRoadmap as svcDeleteRoadmap,
  deleteRoadmapStep as svcDeleteRoadmapStep,
  deleteStreakHistory as svcDeleteStreakHistory,
  deleteTask as svcDeleteTask,
  deleteUser as svcDeleteUser,
  deleteWeeklyReview as svcDeleteWeeklyReview,
  listDailyReviews,
  listFolders,
  listGoals,
  listLearningSessions,
  listNotes,
  listResources,
  listRoadmapSteps,
  listRoadmaps,
  listStreakHistory,
  listTasks,
  moveRoadmapStep as svcMoveRoadmapStep,
  saveDailyReview as svcSaveDailyReview,
  saveWeeklyReview as svcSaveWeeklyReview,
  updateDailyReview as svcUpdateDailyReview,
  updateFolder as svcUpdateFolder,
  updateGoal as svcUpdateGoal,
  updateLearningSession as svcUpdateLearningSession,
  updateNote as svcUpdateNote,
  updateResource as svcUpdateResource,
  updateRoadmap as svcUpdateRoadmap,
  updateRoadmapStep as svcUpdateRoadmapStep,
  updateSettings as svcUpdateSettings,
  updateStreakHistory as svcUpdateStreakHistory,
  updateTask as svcUpdateTask,
  updateUser as svcUpdateUser,
  type DailyReviewInput,
  type GoalInput,
  type LearningSessionInput,
  type NoteExtra,
  type NotePatch,
  type ResourceInput,
  type RoadmapStepPatch,
  type RoadmapStepSeed,
  type TaskInput,
  type WeeklyReviewInput,
} from './service';

function usePersistentDocument<T>(key: string, fallback: T, migrate: (raw: unknown) => T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => migrate(loadJSON<unknown>(key, fallback)));
  useEffect(() => {
    saveJSON(key, value);
  }, [key, value]);
  return [value, setValue];
}

export { usePersistentDocument };

export interface DismissedRemindersDoc {
  date: string;
  ids: string[];
}

function normalizeDismissedDoc(raw: unknown): DismissedRemindersDoc {
  const r = (raw ?? {}) as Partial<DismissedRemindersDoc>;
  const ids = Array.isArray(r.ids) ? r.ids.filter((x): x is string => typeof x === 'string') : [];
  const date =
    typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
      ? r.date
      : new Date().toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (date !== today) return { date: today, ids: [] };
  return { date, ids };
}

/** Ephemeral UI state (dismiss until tomorrow), still via the central adapter. */
export function useDismissedReminders(): [DismissedRemindersDoc, (id: string) => void] {
  const today = new Date().toISOString().slice(0, 10);
  const [doc, setDoc] = usePersistentDocument<DismissedRemindersDoc>(
    KEYS.REMINDER_DISMISSED,
    { date: today, ids: [] },
    normalizeDismissedDoc,
  );
  function dismiss(id: string) {
    setDoc((prev) => {
      const base = normalizeDismissedDoc(prev);
      const ids = base.date === today ? base.ids : [];
      if (ids.includes(id)) return { date: today, ids };
      return { date: today, ids: [...ids, id] };
    });
  }
  return [normalizeDismissedDoc(doc), dismiss];
}

export function useLearnFlowData() {
  const [stored, setStored] = usePersistentDocument<LearnFlowState>(KEYS.STATE, seedState(), (raw) => {
    const migrated = migrateStoredState(raw);
    // One-time adoption of legacy standalone reminder prefs (v1) into settings.
    try {
      const legacy = loadJSON<unknown>(KEYS.REMINDER_PREFS, null);
      if (legacy && typeof legacy === 'object') {
        const l = legacy as Partial<Record<'enabled' | 'dailyLearning' | 'tasks' | 'roadmaps' | 'dailyReview', unknown>>;
        const hasCustom =
          l.enabled === false ||
          l.dailyLearning === false ||
          l.tasks === false ||
          l.roadmaps === false ||
          l.dailyReview === false;
        const isDefault =
          migrated.settings.reminders.enabled &&
          migrated.settings.reminders.dailyLearning &&
          migrated.settings.reminders.tasks &&
          migrated.settings.reminders.roadmaps &&
          migrated.settings.reminders.dailyReview;
        if (hasCustom && isDefault) {
          return {
            ...migrated,
            settings: normalizeSettings({
              ...migrated.settings,
              reminders: {
                enabled: l.enabled !== false,
                dailyLearning: l.dailyLearning !== false,
                tasks: l.tasks !== false,
                roadmaps: l.roadmaps !== false,
                dailyReview: l.dailyReview !== false,
              },
            }),
          };
        }
      }
    } catch {
      // ignore — settings defaults stand
    }
    return migrated;
  });

  const state: LearnFlowState = useMemo(() => migrateStoredState(stored), [stored]);
  const setState = setStored;

  const streak = useMemo(() => computeLearningStreak(state.completions), [state.completions]);

  // ---- Tasks ----
  function addTask(input: TaskInput) {
    setState((s) => svcCreateTask(s, input).state);
  }
  function updateTask(id: string, patch: Partial<TaskInput> & { status?: Parameters<typeof svcUpdateTask>[2] extends never ? never : import('../types').TaskStatus }) {
    setState((s) => svcUpdateTask(s, id, patch));
  }
  function setTaskStatus(id: string, status: import('../types').TaskStatus) {
    setState((s) => svcUpdateTask(s, id, { status }));
  }
  function setTaskPriority(id: string, priority: import('../types').Task['priority']) {
    setState((s) => svcUpdateTask(s, id, { priority }));
  }
  function toggleTask(id: string) {
    setState((s) => {
      const t = s.tasks.find((x) => x.id === id);
      if (!t) return s;
      const nextStatus = t.status === 'completed' ? 'todo' : 'completed';
      return svcUpdateTask(s, id, { status: nextStatus as import('../types').TaskStatus });
    });
  }
  function deleteTask(id: string) {
    setState((s) => svcDeleteTask(s, id));
  }

  // ---- Goals ----
  function addGoal(input: GoalInput) {
    setState((s) => svcCreateGoal(s, input).state);
  }
  function updateGoal(id: string, patch: Partial<GoalInput> & { status?: import('../types').GoalStatus }) {
    setState((s) => svcUpdateGoal(s, id, patch));
  }
  function setGoalStatus(id: string, status: import('../types').GoalStatus) {
    setState((s) => svcUpdateGoal(s, id, { status }));
  }
  function deleteGoal(id: string) {
    setState((s) => svcDeleteGoal(s, id));
  }

  // ---- Roadmaps ----
  function addRoadmap(title: string, description: string, stepTitles: RoadmapStepSeed[]) {
    setState((s) => svcCreateRoadmap(s, title, description, stepTitles).state);
  }
  function updateRoadmap(id: string, patch: { title?: string; description?: string }) {
    setState((s) => svcUpdateRoadmap(s, id, patch));
  }
  function addRoadmapStep(roadmapId: string, title: string, extra?: { description?: string; estimatedMinutes?: number }) {
    setState((s) => svcCreateRoadmapStep(s, roadmapId, title, extra));
  }
  function updateRoadmapStep(roadmapId: string, stepId: string, patch: RoadmapStepPatch) {
    setState((s) => svcUpdateRoadmapStep(s, roadmapId, stepId, patch));
  }
  function setRoadmapStepStatus(roadmapId: string, stepId: string, status: import('../types').RoadmapStepStatus) {
    setState((s) => svcUpdateRoadmapStep(s, roadmapId, stepId, { status }));
  }
  function toggleRoadmapStep(roadmapId: string, stepId: string) {
    const step = listRoadmapSteps(state, roadmapId).find((x) => x.id === stepId);
    const target = step?.status === 'completed' ? 'not_started' : 'completed';
    setState((s) => svcUpdateRoadmapStep(s, roadmapId, stepId, { status: target as import('../types').RoadmapStepStatus }));
  }
  function deleteRoadmapStep(roadmapId: string, stepId: string) {
    setState((s) => svcDeleteRoadmapStep(s, roadmapId, stepId));
  }
  function moveRoadmapStep(roadmapId: string, stepId: string, dir: 'up' | 'down') {
    setState((s) => svcMoveRoadmapStep(s, roadmapId, stepId, dir));
  }
  function addStepResource(roadmapId: string, stepId: string, label: string, url: string) {
    const { uid } = { uid: (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` };
    const l = label.trim() || url.trim();
    const u = url.trim()
      ? /^https?:\/\//i.test(url.trim())
        ? url.trim()
        : /^www\./i.test(url.trim())
          ? `https://${url.trim()}`
          : url.trim()
      : '';
    if (!l && !u) return;
    setState((s) => ({
      ...s,
      roadmaps: s.roadmaps.map((r) =>
        r.id !== roadmapId
          ? r
          : {
              ...r,
              steps: r.steps.map((st) =>
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
              steps: r.steps.map((st) =>
                st.id !== stepId ? st : { ...st, resources: st.resources.filter((x) => x.id !== resourceId) },
              ),
            },
      ),
    }));
  }
  function updateStepResource(roadmapId: string, stepId: string, resource: string) {
    const value = resource.trim();
    if (!value) {
      setState((s) => ({
        ...s,
        roadmaps: s.roadmaps.map((r) =>
          r.id !== roadmapId
            ? r
            : {
                ...r,
                steps: r.steps.map((st) =>
                  st.id !== stepId ? st : ({ ...st, resources: [] } as import('../types').RoadmapStep),
                ),
              },
        ),
      }));
      return;
    }
    const looksUrl = /^(https?:\/\/|www\.)/i.test(value);
    if (looksUrl) {
      const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      setState((s) => ({
        ...s,
        roadmaps: s.roadmaps.map((r) =>
          r.id !== roadmapId
            ? r
            : {
                ...r,
                steps: r.steps.map((st) => {
                  if (st.id !== stepId) return st;
                  const first = st.resources[0];
                  const uid = `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                  return {
                    ...st,
                    resources: first
                      ? [{ ...first, label: value, url }]
                      : [{ id: uid, label: value, url }],
                  };
                }),
              },
        ),
      }));
    } else {
      setState((s) => svcUpdateRoadmapStep(s, roadmapId, stepId, { notes: value }));
    }
  }
  function deleteRoadmap(id: string) {
    setState((s) => svcDeleteRoadmap(s, id));
  }

  // ---- Folders ----
  function addFolder(name: string): string {
    let id = '';
    setState((s) => {
      const res = svcCreateFolder(s, name);
      id = res.id;
      return res.state;
    });
    return id;
  }
  function addSubfolder(parentId: string, name: string): string {
    let id = '';
    setState((s) => {
      const res = svcCreateSubfolder(s, parentId, name);
      id = res.id;
      return res.state;
    });
    return id;
  }
  function renameFolder(id: string, name: string) {
    setState((s) => svcUpdateFolder(s, id, { name }));
  }
  function deleteFolder(id: string) {
    setState((s) => svcDeleteFolder(s, id));
  }

  // ---- Notes ----
  function addNote(
    folderId: string,
    title: string,
    url: string,
    content: string,
    kind?: import('../types').NoteKind,
    extra?: NoteExtra,
  ): string {
    let id = '';
    setState((s) => {
      const res = svcCreateNote(s, folderId, title, url, content, kind, extra);
      id = res.id;
      return res.state;
    });
    return id;
  }
  function updateNote(id: string, patch: NotePatch) {
    setState((s) => svcUpdateNote(s, id, patch));
  }
  function togglePinNote(id: string) {
    const target = state.notes.find((n) => n.id === id);
    if (!target) return;
    setState((s) => svcUpdateNote(s, id, { pinned: !target.pinned }));
  }
  function moveNote(id: string, folderId: string) {
    if (!state.folders.some((f) => f.id === folderId)) return;
    setState((s) => svcUpdateNote(s, id, { folderId }));
  }
  function deleteNote(id: string) {
    setState((s) => svcDeleteNote(s, id));
  }

  // ---- Resources (first-class) ----
  function listAllResources() {
    return listResources(state);
  }
  function addResource(input: ResourceInput): string {
    let id = '';
    setState((s) => {
      const res = svcCreateResource(s, input);
      id = res.id;
      return res.state;
    });
    return id;
  }
  function updateResource(id: string, patch: Parameters<typeof svcUpdateResource>[2]) {
    setState((s) => svcUpdateResource(s, id, patch));
  }
  function deleteResource(id: string) {
    setState((s) => svcDeleteResource(s, id));
  }

  // ---- Sessions ----
  function logSession(title: string, minutes: number, date?: string, goalId?: string) {
    setState((s) => svcCreateLearningSession(s, { title, minutes, date, goalId: goalId ?? null }).state);
  }
  function logLearningSession(input: LearningSessionInput): string | null {
    let id: string | null = null;
    setState((s) => {
      const res = svcCreateLearningSession(s, input);
      id = res.id;
      return res.state;
    });
    return id;
  }
  function updateLearningSession(id: string, patch: Partial<Omit<LearningSessionInput, 'markStepComplete'>>) {
    setState((s) => svcUpdateLearningSession(s, id, patch));
  }
  function deleteCompletion(id: string) {
    setState((s) => svcDeleteLearningSession(s, id));
  }

  // ---- Reviews ----
  function saveWeeklyReview(input: WeeklyReviewInput): boolean {
    let ok = false;
    setState((s) => {
      const res = svcSaveWeeklyReview(s, input);
      ok = res.ok;
      return res.state;
    });
    return ok;
  }
  function deleteWeeklyReview(weekKey: string) {
    setState((s) => svcDeleteWeeklyReview(s, weekKey));
  }
  function saveDailyReview(input: import('./service').DailyReviewInput): boolean {
    let ok = false;
    setState((s) => {
      const res = svcSaveDailyReview(s, input);
      ok = res.ok;
      return res.state;
    });
    return ok;
  }
  function deleteDailyReview(date: string) {
    setState((s) => svcDeleteDailyReview(s, date));
  }

  // ---- User ----
  function updateUserName(name: string) {
    setState((s) => svcUpdateUser(s, { name }));
  }
  function updateUserProfile(patch: { name?: string; avatar?: string; learningGoal?: string }) {
    setState((s) => svcUpdateUser(s, patch));
  }

  // ---- Settings ----
  function updateSettings(patch: Partial<import('../types').Settings>) {
    setState((s) => svcUpdateSettings(s, patch));
  }
  function updateReminderPrefs(patch: Partial<import('../types').Settings['reminders']>) {
    setState((s) => svcUpdateSettings(s, { reminders: { ...s.settings.reminders, ...patch } }));
  }

  // ---- Streak history ----
  function recordStreak() {
    setState((s) =>
      svcCreateStreakSnapshot(s, {
        date: undefined,
        current: streak.current,
        longest: streak.longest,
        activeDays: streak.activeDays,
        loggedToday: streak.loggedToday,
      }),
    );
  }

  function resetAll() {
    // Drop legacy standalone keys too, or the initializer would re-adopt
    // stale reminder prefs on the next reload (reset resurrection).
    removeKey(KEYS.REMINDER_PREFS);
    removeKey(KEYS.REMINDER_DISMISSED);
    setState(seedState());
  }

  /** Replace the entire dataset (used by validated backup import). */
  function replaceAll(next: LearnFlowState) {
    setState(migrateStoredState(next));
  }

  return {
    state,
    streak,
    // tasks
    addTask,
    updateTask,
    setTaskStatus,
    setTaskPriority,
    toggleTask,
    deleteTask,
    listTasks: () => listTasks(state),
    // goals
    addGoal,
    updateGoal,
    setGoalStatus,
    deleteGoal,
    listGoals: () => listGoals(state),
    // roadmaps
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
    listRoadmaps: () => listRoadmaps(state),
    listRoadmapSteps: (roadmapId: string) => listRoadmapSteps(state, roadmapId),
    // folders
    addFolder,
    addSubfolder,
    renameFolder,
    deleteFolder,
    listFolders: () => listFolders(state),
    // notes
    addNote,
    updateNote,
    togglePinNote,
    moveNote,
    deleteNote,
    listNotes: () => listNotes(state),
    // resources
    listResources: listAllResources,
    addResource,
    updateResource,
    deleteResource,
    // sessions
    logSession,
    logLearningSession,
    updateLearningSession,
    deleteCompletion,
    listSessions: () => listLearningSessions(state),
    // reviews
    saveWeeklyReview,
    deleteWeeklyReview,
    saveDailyReview,
    deleteDailyReview,
    listDailyReviews: () => listDailyReviews(state),
    // user
    updateUserName,
    updateUserProfile,
    createUser: (name: string) => setState((s) => svcCreateUser(s, name).state),
    deleteUser: () => setState((s) => svcDeleteUser(s)),
    // settings
    updateSettings,
    updateReminderPrefs,
    // streak history
    recordStreak,
    listStreakHistory: () => listStreakHistory(state),
    deleteStreakHistory: (date: string) => setState((s) => svcDeleteStreakHistory(s, date)),
    resetAll,
    replaceAll,
    // re-exported for advanced use
    _setState: setState,
  };
}

export type LearnFlowDataApi = ReturnType<typeof useLearnFlowData>;

// Re-export service input types for callers.
export type {
  DailyReviewInput,
  GoalInput,
  LearningSessionInput,
  NoteExtra,
  NotePatch,
  ResourceInput,
  RoadmapStepPatch,
  RoadmapStepSeed,
  TaskInput,
  WeeklyReviewInput,
};

export { normalizeSettings, normalizeUser };
export {
  svcCreateDailyReview,
  svcCreateStreakSnapshot,
  svcDeleteDailyReview,
  svcDeleteStreakHistory,
  svcSaveDailyReview,
  svcUpdateDailyReview,
  svcUpdateSettings,
  svcUpdateStreakHistory,
  svcUpdateUser,
};
