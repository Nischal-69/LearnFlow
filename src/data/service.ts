/**
 * Centralized data service — CRUD for every data type.
 *
 * All functions here are pure state transitions:
 *   (state, ...args) => newState
 * React persistence (load once, save on change) lives in
 * `src/data/index.ts` (`useLearnFlowData`). Components must never touch
 * storage directly.
 *
 * Supabase / PostgreSQL migration path:
 *   Each list/get/create/update/delete group below maps 1:1 to a table
 *   (users, tasks, goals, roadmaps, roadmap_steps, folders, notes,
 *   resources, completions, daily_reviews, weekly_reviews, streak_history,
 *   settings). Keep the same function names and signatures, replace the bodies
 *   with async Supabase queries, and swap the persistence hook for a
 *   remote-sync version. roadmap steps become a roadmap_steps table keyed by
 *   roadmapId; completions with kind session become learning_sessions.
 */
import type {
  CompletionEntry,
  DailyReview,
  Folder,
  Goal,
  LearnFlowState,
  LearningSession,
  Note,
  Resource,
  Roadmap,
  RoadmapStep,
  Settings,
  StreakHistoryEntry,
  Task,
  User,
  WeeklyReview,
} from '../types';
import { todayString, uid } from '../utils';
import {
  normalizeCompletion,
  normalizeDailyReview,
  normalizeFolder,
  normalizeGoal,
  normalizeNote,
  normalizeResource,
  normalizeReview,
  normalizeRoadmapStep,
  normalizeSettings,
  normalizeStreakEntry,
  normalizeTags,
  normalizeTask,
  seedState,
} from './schema';

// ---------- shared input shapes (stable API for a future backend) ----------

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

export type RoadmapStepSeed = string | { title: string; description?: string; estimatedMinutes?: number };

export interface RoadmapStepPatch {
  title?: string;
  description?: string;
  estimatedMinutes?: number;
  status?: RoadmapStep['status'];
  notes?: string;
}

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
  markStepComplete?: boolean;
}

export interface NoteExtra {
  tags?: string[] | string;
  pinned?: boolean;
  goalId?: string | null;
  roadmapId?: string | null;
  roadmapStepId?: string | null;
  resourceType?: Note['resourceType'];
}

export interface NotePatch {
  title?: string;
  url?: string;
  content?: string;
  kind?: Note['kind'];
  folderId?: string;
  tags?: string[] | string;
  pinned?: boolean;
  goalId?: string | null;
  roadmapId?: string | null;
  resourceType?: Note['resourceType'];
  roadmapStepId?: string | null;
}

export interface ResourceInput {
  title: string;
  url: string;
  description?: string;
  folderId?: string | null;
  tags?: string[] | string;
  goalId?: string | null;
  roadmapId?: string | null;
  resourceType?: Resource['resourceType'];
}

export interface WeeklyReviewInput {
  weekKey: string;
  learned: string;
  missed: string;
  focusNext: string;
}

export interface DailyReviewInput {
  date: string;
  accomplished: string;
  learned: string;
  notCompleted: string;
  planTomorrow: string;
}

// ---------- internal helpers ----------

function applyTaskStatus(t: Task, status: Task['status']): { task: Task; didComplete: boolean } {
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

function appendCompletion(state: LearnFlowState, entry: CompletionEntry): LearnFlowState {
  return { ...state, completions: [entry, ...state.completions] };
}

function makeCompletion(
  entry: Partial<CompletionEntry> & { kind: CompletionEntry['kind']; title: string },
): CompletionEntry {
  return normalizeCompletion({
    ...entry,
    id: uid('log'),
    date: entry.date ?? todayString(),
    createdAt: new Date().toISOString(),
  } as CompletionEntry);
}

function makeStep(title: string, extra?: { description?: string; estimatedMinutes?: number }): RoadmapStep {
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

function touchFolder(ids: Set<string>, now: string) {
  return (f: Folder): Folder => (ids.has(f.id) ? { ...normalizeFolder(f), updatedAt: now } : f);
}

// ============================ User ============================

export function getUser(state: LearnFlowState): User {
  return state.user;
}

export function createUser(state: LearnFlowState, name: string): { state: LearnFlowState; id: string } {
  const now = new Date().toISOString();
  const trimmed = name.trim() || 'Learner';
  const id = uid('user');
  return { state: { ...state, user: { id, name: trimmed, avatar: '', learningGoal: '', createdAt: now, updatedAt: now } }, id };
}

export function updateUser(
  state: LearnFlowState,
  patch: { name?: string; avatar?: string; learningGoal?: string },
): LearnFlowState {
  const name = patch.name !== undefined ? patch.name.trim() || state.user.name : state.user.name;
  return {
    ...state,
    user: {
      ...state.user,
      name,
      ...(patch.avatar !== undefined ? { avatar: patch.avatar.slice(0, 200000) } : {}),
      ...(patch.learningGoal !== undefined ? { learningGoal: patch.learningGoal.slice(0, 200) } : {}),
      updatedAt: new Date().toISOString(),
    },
  };
}

export function deleteUser(state: LearnFlowState): LearnFlowState {
  const now = new Date().toISOString();
  return {
    ...state,
    user: { id: 'user_local', name: 'Learner', avatar: '', learningGoal: '', createdAt: now, updatedAt: now },
  };
}

// ============================ Settings ============================

export function getSettings(state: LearnFlowState): Settings {
  return state.settings;
}

export function createSettings(state: LearnFlowState, patch: Partial<Settings>): LearnFlowState {
  return { ...state, settings: normalizeSettings({ ...patch, updatedAt: new Date().toISOString() }) };
}

export function updateSettings(state: LearnFlowState, patch: Partial<Settings>): LearnFlowState {
  return {
    ...state,
    settings: normalizeSettings({
      ...state.settings,
      ...patch,
      reminders: { ...state.settings.reminders, ...(patch.reminders ?? {}) },
      updatedAt: new Date().toISOString(),
    }),
  };
}

export function deleteSettings(state: LearnFlowState): LearnFlowState {
  void state;
  // Settings row is never truly deleted — reset reminders/theme to defaults.
  // Callers should use updateSettings for a real reset; kept for CRUD symmetry.
  return state;
}

// ============================ Tasks ============================

export function listTasks(state: LearnFlowState): Task[] {
  return state.tasks;
}

export function getTask(state: LearnFlowState, id: string): Task | null {
  return state.tasks.find((t) => t.id === id) ?? null;
}

export function createTask(state: LearnFlowState, input: TaskInput): { state: LearnFlowState; id: string } {
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
  if (!task.title) return { state, id: '' };
  return { state: { ...state, tasks: [task, ...state.tasks] }, id: task.id };
}

export function updateTask(
  state: LearnFlowState,
  id: string,
  patch: Partial<TaskInput> & { status?: Task['status'] },
): LearnFlowState {
  let completedTitle = '';
  let didComplete = false;
  const tasks = state.tasks.map((raw) => {
    if (raw.id !== id) return raw;
    const current = normalizeTask(raw);
    const next: Task = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title.trim() || current.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate || todayString() } : {}),
      ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
      ...(patch.category !== undefined ? { category: patch.category.trim() } : {}),
      ...(patch.estimatedMinutes !== undefined
        ? { estimatedMinutes: Math.max(0, Math.floor(patch.estimatedMinutes) || 0) }
        : {}),
    };
    if (patch.status !== undefined && patch.status !== next.status) {
      const applied = applyTaskStatus(next, patch.status);
      if (applied.didComplete) {
        didComplete = true;
        completedTitle = applied.task.title;
      }
      return applied.task;
    }
    return next;
  });
  let next: LearnFlowState = { ...state, tasks };
  if (didComplete) next = appendCompletion(next, makeCompletion({ kind: 'task', title: completedTitle, minutes: 0 }));
  return next;
}

export function deleteTask(state: LearnFlowState, id: string): LearnFlowState {
  return { ...state, tasks: state.tasks.filter((t) => t.id !== id) };
}

// ============================ Learning Goals ============================

export function listGoals(state: LearnFlowState): Goal[] {
  return state.goals;
}

export function getGoal(state: LearnFlowState, id: string): Goal | null {
  return state.goals.find((g) => g.id === id) ?? null;
}

export function createGoal(state: LearnFlowState, input: GoalInput): { state: LearnFlowState; id: string } {
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
  if (!goal.title) return { state, id: '' };
  return { state: { ...state, goals: [goal, ...state.goals] }, id: goal.id };
}

export function updateGoal(
  state: LearnFlowState,
  id: string,
  patch: Partial<GoalInput> & { status?: Goal['status'] },
): LearnFlowState {
  let completedTitle = '';
  let completedGoalId = '';
  let didComplete = false;
  const goals = state.goals.map((raw) => {
    if (raw.id !== id) return raw;
    const current = normalizeGoal(raw);
    const next: Goal = {
      ...current,
      ...(patch.title !== undefined ? { title: patch.title.trim() || current.title } : {}),
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
        completedAt: nowCompleted ? (wasCompleted ? next.completedAt : new Date().toISOString()) : null,
      };
    }
    return next;
  });
  let next: LearnFlowState = { ...state, goals };
  if (didComplete)
    next = appendCompletion(next, makeCompletion({ kind: 'goal', title: completedTitle, minutes: 0, goalId: completedGoalId }));
  return next;
}

export function deleteGoal(state: LearnFlowState, id: string): LearnFlowState {
  return { ...state, goals: state.goals.filter((g) => g.id !== id) };
}

// ============================ Roadmaps ============================

export function listRoadmaps(state: LearnFlowState): Roadmap[] {
  return state.roadmaps;
}

export function getRoadmap(state: LearnFlowState, id: string): Roadmap | null {
  return state.roadmaps.find((r) => r.id === id) ?? null;
}

export function createRoadmap(
  state: LearnFlowState,
  title: string,
  description: string,
  stepTitles: RoadmapStepSeed[],
): { state: LearnFlowState; id: string } {
  if (!title.trim()) return { state, id: '' };
  const id = uid('roadmap');
  const roadmap: Roadmap = {
    id,
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
  };
  return { state: { ...state, roadmaps: [roadmap, ...state.roadmaps] }, id };
}

export function updateRoadmap(
  state: LearnFlowState,
  id: string,
  patch: { title?: string; description?: string },
): LearnFlowState {
  return {
    ...state,
    roadmaps: state.roadmaps.map((r) =>
      r.id !== id
        ? r
        : {
            ...r,
            ...(patch.title !== undefined ? { title: patch.title.trim() || r.title } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
          },
    ),
  };
}

export function deleteRoadmap(state: LearnFlowState, id: string): LearnFlowState {
  return { ...state, roadmaps: state.roadmaps.filter((r) => r.id !== id) };
}

// ============================ Roadmap Steps (nested; future table: roadmap_steps) ============================

export function listRoadmapSteps(state: LearnFlowState, roadmapId: string): RoadmapStep[] {
  return state.roadmaps.find((r) => r.id === roadmapId)?.steps.map(normalizeRoadmapStep) ?? [];
}

export function getRoadmapStep(state: LearnFlowState, roadmapId: string, stepId: string): RoadmapStep | null {
  return listRoadmapSteps(state, roadmapId).find((s) => s.id === stepId) ?? null;
}

export function createRoadmapStep(
  state: LearnFlowState,
  roadmapId: string,
  title: string,
  extra?: { description?: string; estimatedMinutes?: number },
): LearnFlowState {
  if (!title.trim()) return state;
  return {
    ...state,
    roadmaps: state.roadmaps.map((r) =>
      r.id !== roadmapId ? r : { ...r, steps: [...r.steps.map(normalizeRoadmapStep), makeStep(title, extra)] },
    ),
  };
}

export function updateRoadmapStep(
  state: LearnFlowState,
  roadmapId: string,
  stepId: string,
  patch: RoadmapStepPatch,
): LearnFlowState {
  let completedTitle = '';
  let roadmapTitle = '';
  let didComplete = false;
  const roadmaps = state.roadmaps.map((r) => {
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
  });
  let next: LearnFlowState = { ...state, roadmaps };
  if (didComplete)
    next = appendCompletion(next, makeCompletion({ kind: 'roadmap-step', title: `${roadmapTitle} — ${completedTitle}`, minutes: 0 }));
  return next;
}

export function deleteRoadmapStep(state: LearnFlowState, roadmapId: string, stepId: string): LearnFlowState {
  return {
    ...state,
    roadmaps: state.roadmaps.map((r) =>
      r.id !== roadmapId
        ? r
        : { ...r, steps: r.steps.map(normalizeRoadmapStep).filter((st) => st.id !== stepId) },
    ),
  };
}

export function moveRoadmapStep(
  state: LearnFlowState,
  roadmapId: string,
  stepId: string,
  dir: 'up' | 'down',
): LearnFlowState {
  return {
    ...state,
    roadmaps: state.roadmaps.map((r) => {
      if (r.id !== roadmapId) return r;
      const steps = r.steps.map(normalizeRoadmapStep);
      const idx = steps.findIndex((st) => st.id === stepId);
      if (idx < 0) return r;
      const j = dir === 'up' ? idx - 1 : idx + 1;
      if (j < 0 || j >= steps.length) return r;
      const nextSteps = [...steps];
      [nextSteps[idx], nextSteps[j]] = [nextSteps[j], nextSteps[idx]];
      return { ...r, steps: nextSteps };
    }),
  };
}

// ============================ Learning Sessions (completions kind='session') ============================

function toLearningSession(c: CompletionEntry): LearningSession {
  return {
    id: c.id,
    date: c.date,
    title: c.title,
    minutes: c.minutes,
    goalId: c.goalId,
    roadmapId: c.roadmapId,
    roadmapStepId: c.roadmapStepId,
    understood: c.understood,
    struggled: c.struggled,
    next: c.next,
    notes: c.notes,
    createdAt: c.createdAt,
  };
}

export function listLearningSessions(state: LearnFlowState): LearningSession[] {
  return state.completions.filter((c) => c.kind === 'session').map(toLearningSession);
}

export function getLearningSession(state: LearnFlowState, id: string): LearningSession | null {
  const c = state.completions.find((x) => x.id === id && x.kind === 'session');
  return c ? toLearningSession(normalizeCompletion(c)) : null;
}

export function createLearningSession(
  state: LearnFlowState,
  input: LearningSessionInput,
): { state: LearnFlowState; id: string | null } {
  const title = input.title.trim();
  const minutes = Math.max(0, Math.floor(input.minutes) || 0);
  if (!title || minutes <= 0) return { state, id: null };
  const today = todayString();
  let date = (input.date || today).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
  if (date > today) date = today;
  const roadmapId = input.roadmapId ?? null;
  const roadmapStepId = input.roadmapStepId ?? null;
  const entry = makeCompletion({
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
  let next: LearnFlowState = appendCompletion(state, entry);
  if (roadmapId && roadmapStepId) {
    const roadmap = next.roadmaps.find((r) => r.id === roadmapId);
    const step = roadmap?.steps.map(normalizeRoadmapStep).find((s) => s.id === roadmapStepId);
    if (step) {
      if (input.markStepComplete && step.status !== 'completed') {
        next = updateRoadmapStep(next, roadmapId, roadmapStepId, { status: 'completed' });
      } else if (step.status === 'not_started') {
        next = updateRoadmapStep(next, roadmapId, roadmapStepId, { status: 'in_progress' });
      }
    }
  }
  return { state: next, id: entry.id };
}

export function updateLearningSession(
  state: LearnFlowState,
  id: string,
  patch: Partial<Omit<LearningSessionInput, 'markStepComplete'>>,
): LearnFlowState {
  return {
    ...state,
    completions: state.completions.map((raw) => {
      const c = normalizeCompletion(raw);
      if (c.id !== id || c.kind !== 'session') return c;
      const nextDate = patch.date !== undefined ? patch.date.slice(0, 10) : c.date;
      return {
        ...c,
        ...(patch.title !== undefined ? { title: patch.title.trim() || c.title } : {}),
        ...(patch.minutes !== undefined ? { minutes: Math.max(1, Math.floor(patch.minutes) || c.minutes) } : {}),
        ...(patch.date !== undefined
          ? { date: /^\d{4}-\d{2}-\d{2}$/.test(nextDate) && nextDate <= todayString() ? nextDate : c.date }
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
  };
}

export function deleteLearningSession(state: LearnFlowState, id: string): LearnFlowState {
  return { ...state, completions: state.completions.filter((c) => !(c.id === id && c.kind === 'session')) };
}

// ============================ Folders ============================

export function listFolders(state: LearnFlowState): Folder[] {
  return state.folders;
}

export function getFolder(state: LearnFlowState, id: string): Folder | null {
  return state.folders.find((f) => f.id === id) ?? null;
}

export function createFolder(state: LearnFlowState, name: string): { state: LearnFlowState; id: string } {
  const trimmed = name.trim();
  if (!trimmed) return { state, id: '' };
  const now = new Date().toISOString();
  const id = uid('folder');
  return {
    state: {
      ...state,
      folders: [...state.folders.map(normalizeFolder), { id, name: trimmed, parentId: null, createdAt: now, updatedAt: now }],
    },
    id,
  };
}

export function createSubfolder(
  state: LearnFlowState,
  parentId: string,
  name: string,
): { state: LearnFlowState; id: string } {
  const trimmed = name.trim();
  if (!trimmed) return { state, id: '' };
  const parent = state.folders.map(normalizeFolder).find((f) => f.id === parentId);
  if (!parent || parent.parentId !== null) return { state, id: '' };
  const now = new Date().toISOString();
  const id = uid('folder');
  return {
    state: {
      ...state,
      folders: [
        ...state.folders.map(normalizeFolder),
        { id, name: trimmed, parentId, createdAt: now, updatedAt: now },
      ].map(touchFolder(new Set([parentId]), now)),
    },
    id,
  };
}

export function updateFolder(state: LearnFlowState, id: string, patch: { name?: string }): LearnFlowState {
  const trimmed = (patch.name ?? '').trim();
  if (!trimmed) return state;
  const now = new Date().toISOString();
  return {
    ...state,
    folders: state.folders
      .map(normalizeFolder)
      .map((f) => (f.id === id ? { ...f, name: trimmed, updatedAt: now } : f)),
  };
}

export function deleteFolder(state: LearnFlowState, id: string): LearnFlowState {
  const folders = state.folders.map(normalizeFolder);
  const target = folders.find((f) => f.id === id);
  if (!target) return state;
  const doomed = new Set<string>([id]);
  for (const f of folders) {
    if (f.parentId === id) doomed.add(f.id);
  }
  return {
    ...state,
    folders: folders.filter((f) => !doomed.has(f.id)),
    notes: state.notes.map(normalizeNote).filter((n) => !doomed.has(n.folderId)),
    resources: state.resources.map(normalizeResource).filter((r) => !(r.folderId && doomed.has(r.folderId))),
  };
}

// ============================ Notes ============================

export function listNotes(state: LearnFlowState): Note[] {
  return state.notes;
}

export function getNote(state: LearnFlowState, id: string): Note | null {
  return state.notes.find((n) => n.id === id) ?? null;
}

export function createNote(
  state: LearnFlowState,
  folderId: string,
  title: string,
  url: string,
  content: string,
  kind?: Note['kind'],
  extra?: NoteExtra,
): { state: LearnFlowState; id: string } {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return { state, id: '' };
  const now = new Date().toISOString();
  const targetId = state.folders.some((f) => f.id === folderId)
    ? folderId
    : (state.folders.find((f) => !normalizeFolder(f).parentId)?.id ?? state.folders[0]?.id ?? '');
  if (!targetId) return { state, id: '' };
  const trimmedUrl = (url ?? '').trim();
  const resolvedKind: Note['kind'] = kind ?? (trimmedUrl ? 'resource' : 'note');
  const goalId = extra?.goalId ? extra.goalId : null;
  const roadmapId = extra?.roadmapId ? extra.roadmapId : null;
  const id = uid('note');
  return {
    state: {
      ...state,
      notes: [
        {
          id,
          folderId: targetId,
          title: trimmedTitle,
          url: trimmedUrl,
          content: content ?? '',
          kind: resolvedKind,
          tags: normalizeTags(extra?.tags ?? []),
          pinned: extra?.pinned === true,
          goalId,
          roadmapId,
          roadmapStepId: roadmapId && extra?.roadmapStepId ? extra.roadmapStepId : null,
          resourceType: extra?.resourceType ?? (trimmedUrl ? 'website' : null),
          createdAt: now,
          updatedAt: now,
        },
        ...state.notes.map(normalizeNote),
      ],
      folders: state.folders.map(normalizeFolder).map(touchFolder(new Set([targetId]), now)),
    },
    id,
  };
}

export function updateNote(state: LearnFlowState, id: string, patch: NotePatch): LearnFlowState {
  const now = new Date().toISOString();
  let touchedFolder = '';
  const notes = state.notes.map(normalizeNote).map((n) => {
    if (n.id !== id) return n;
    const nextFolder = patch.folderId && state.folders.some((f) => f.id === patch.folderId) ? patch.folderId : n.folderId;
    touchedFolder = nextFolder;
    const nextTitle = patch.title !== undefined ? patch.title.trim() || n.title : n.title;
    const nextUrl = patch.url !== undefined ? patch.url.trim() : n.url;
    const nextRoadmapId = patch.roadmapId !== undefined ? patch.roadmapId || null : n.roadmapId;
    const nextStepId =
      patch.roadmapStepId !== undefined
        ? nextRoadmapId && patch.roadmapStepId
          ? patch.roadmapStepId
          : null
        : patch.roadmapId !== undefined
          ? null
          : n.roadmapStepId;
    return {
      ...n,
      title: nextTitle,
      url: nextUrl,
      content: patch.content !== undefined ? patch.content : n.content,
      kind: patch.kind ?? (patch.url !== undefined ? (nextUrl ? 'resource' : 'note') : n.kind),
      tags: patch.tags !== undefined ? normalizeTags(patch.tags) : n.tags,
      pinned: patch.pinned !== undefined ? patch.pinned === true : n.pinned,
      goalId: patch.goalId !== undefined ? patch.goalId || null : n.goalId,
      roadmapId: nextRoadmapId,
      roadmapStepId: nextStepId,
      resourceType:
        patch.resourceType !== undefined
          ? (patch.resourceType ?? (nextUrl ? 'website' : null))
          : patch.url !== undefined
            ? nextUrl
              ? (n.resourceType ?? 'website')
              : null
            : n.resourceType,
      folderId: nextFolder,
      updatedAt: now,
    };
  });
  return {
    ...state,
    notes,
    folders: state.folders.map(normalizeFolder).map(touchFolder(new Set([touchedFolder]), now)),
  };
}

export function deleteNote(state: LearnFlowState, id: string): LearnFlowState {
  let folderId = '';
  for (const n of state.notes) {
    if (n.id === id) folderId = n.folderId;
  }
  const now = new Date().toISOString();
  return {
    ...state,
    notes: state.notes.map(normalizeNote).filter((n) => n.id !== id),
    folders: state.folders.map(normalizeFolder).map(touchFolder(new Set([folderId]), now)),
  };
}

// ============================ Resources (first-class collection) ============================

export function listResources(state: LearnFlowState): Resource[] {
  return state.resources;
}

export function getResource(state: LearnFlowState, id: string): Resource | null {
  return state.resources.find((r) => r.id === id) ?? null;
}

export function createResource(
  state: LearnFlowState,
  input: ResourceInput,
): { state: LearnFlowState; id: string } {
  const title = input.title.trim();
  if (!title) return { state, id: '' };
  const now = new Date().toISOString();
  const id = uid('resource');
  const resource: Resource = normalizeResource({
    id,
    title,
    url: (input.url ?? '').trim(),
    description: (input.description ?? '').trim(),
    folderId: input.folderId ?? null,
    tags: normalizeTags(input.tags ?? []),
    goalId: input.goalId ?? null,
    roadmapId: input.roadmapId ?? null,
    resourceType: input.resourceType ?? 'website',
    createdAt: now,
    updatedAt: now,
  } as Resource);
  return { state: { ...state, resources: [resource, ...state.resources] }, id };
}

export function updateResource(
  state: LearnFlowState,
  id: string,
  patch: Partial<Omit<ResourceInput, 'tags'> & { tags?: string[] | string }>,
): LearnFlowState {
  const now = new Date().toISOString();
  return {
    ...state,
    resources: state.resources.map(normalizeResource).map((r) =>
      r.id !== id
        ? r
        : {
            ...r,
            ...(patch.title !== undefined ? { title: patch.title.trim() || r.title } : {}),
            ...(patch.url !== undefined ? { url: patch.url.trim() } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            ...(patch.folderId !== undefined ? { folderId: patch.folderId } : {}),
            ...(patch.tags !== undefined ? { tags: normalizeTags(patch.tags) } : {}),
            ...(patch.goalId !== undefined ? { goalId: patch.goalId || null } : {}),
            ...(patch.roadmapId !== undefined ? { roadmapId: patch.roadmapId || null } : {}),
            ...(patch.resourceType !== undefined ? { resourceType: patch.resourceType ?? 'website' } : {}),
            updatedAt: now,
          },
    ),
  };
}

export function deleteResource(state: LearnFlowState, id: string): LearnFlowState {
  return { ...state, resources: state.resources.filter((r) => r.id !== id) };
}

// ============================ Daily Reviews ============================

function isValidDateOnly(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function listDailyReviews(state: LearnFlowState): DailyReview[] {
  return state.dailyReviews;
}

export function getDailyReview(state: LearnFlowState, date: string): DailyReview | null {
  return state.dailyReviews.find((r) => r.date === date) ?? null;
}

export function createDailyReview(state: LearnFlowState, input: DailyReviewInput): { state: LearnFlowState; ok: boolean } {
  return saveDailyReview(state, input);
}

export function saveDailyReview(state: LearnFlowState, input: DailyReviewInput): { state: LearnFlowState; ok: boolean } {
  const date = input.date.trim().slice(0, 10);
  if (!isValidDateOnly(date) || date > todayString()) return { state, ok: false };
  const accomplished = (input.accomplished ?? '').trim();
  const learned = (input.learned ?? '').trim();
  const notCompleted = (input.notCompleted ?? '').trim();
  const planTomorrow = (input.planTomorrow ?? '').trim();
  if (!accomplished && !learned && !notCompleted && !planTomorrow) return { state, ok: false };
  const now = new Date().toISOString();
  const existing = state.dailyReviews.map(normalizeDailyReview).find((r) => r.date === date);
  if (existing) {
    return {
      state: {
        ...state,
        dailyReviews: state.dailyReviews.map(normalizeDailyReview).map((r) =>
          r.date === date ? { ...r, accomplished, learned, notCompleted, planTomorrow, updatedAt: now } : r,
        ),
      },
      ok: true,
    };
  }
  const review: DailyReview = { id: uid('daily-review'), date, accomplished, learned, notCompleted, planTomorrow, createdAt: now, updatedAt: now };
  return { state: { ...state, dailyReviews: [review, ...state.dailyReviews.map(normalizeDailyReview)] }, ok: true };
}

export function updateDailyReview(state: LearnFlowState, date: string, patch: Partial<DailyReviewInput>): LearnFlowState {
  const existing = state.dailyReviews.find((r) => r.date === date);
  if (!existing) return state;
  const res = saveDailyReview(state, {
    date,
    accomplished: patch.accomplished ?? existing.accomplished,
    learned: patch.learned ?? existing.learned,
    notCompleted: patch.notCompleted ?? existing.notCompleted,
    planTomorrow: patch.planTomorrow ?? existing.planTomorrow,
  });
  return res.state;
}

export function deleteDailyReview(state: LearnFlowState, date: string): LearnFlowState {
  return {
    ...state,
    dailyReviews: state.dailyReviews.map(normalizeDailyReview).filter((r) => r.date !== date),
  };
}

// ============================ Weekly Reviews ============================

export function listWeeklyReviews(state: LearnFlowState): WeeklyReview[] {
  return state.weeklyReviews;
}

export function getWeeklyReview(state: LearnFlowState, weekKey: string): WeeklyReview | null {
  return state.weeklyReviews.find((r) => r.weekKey === weekKey) ?? null;
}

export function saveWeeklyReview(state: LearnFlowState, input: WeeklyReviewInput): { state: LearnFlowState; ok: boolean } {
  const weekKey = input.weekKey.trim();
  if (!/^\d{4}-W\d{2}$/.test(weekKey)) return { state, ok: false };
  const learned = (input.learned ?? '').trim();
  const missed = (input.missed ?? '').trim();
  const focusNext = (input.focusNext ?? '').trim();
  if (!learned && !missed && !focusNext) return { state, ok: false };
  const now = new Date().toISOString();
  const existing = state.weeklyReviews.map(normalizeReview).find((r) => r.weekKey === weekKey);
  if (existing) {
    return {
      state: {
        ...state,
        weeklyReviews: state.weeklyReviews.map(normalizeReview).map((r) =>
          r.weekKey === weekKey ? { ...r, learned, missed, focusNext, updatedAt: now } : r,
        ),
      },
      ok: true,
    };
  }
  const review: WeeklyReview = { id: uid('review'), weekKey, learned, missed, focusNext, createdAt: now, updatedAt: now };
  return { state: { ...state, weeklyReviews: [review, ...state.weeklyReviews.map(normalizeReview)] }, ok: true };
}

export function deleteWeeklyReview(state: LearnFlowState, weekKey: string): LearnFlowState {
  return {
    ...state,
    weeklyReviews: state.weeklyReviews.map(normalizeReview).filter((r) => r.weekKey !== weekKey),
  };
}

// ============================ Streak History ============================

export function listStreakHistory(state: LearnFlowState): StreakHistoryEntry[] {
  return [...state.streakHistory].sort((a, b) => b.date.localeCompare(a.date));
}

export function getStreakHistory(state: LearnFlowState, date: string): StreakHistoryEntry | null {
  return state.streakHistory.find((s) => s.date === date) ?? null;
}

export function createStreakSnapshot(
  state: LearnFlowState,
  snapshot: { date?: string; current: number; longest: number; activeDays: number; loggedToday: boolean },
): LearnFlowState {
  const entry = normalizeStreakEntry({
    id: uid('streak'),
    date: snapshot.date ?? todayString(),
    current: snapshot.current,
    longest: snapshot.longest,
    activeDays: snapshot.activeDays,
    loggedToday: snapshot.loggedToday,
    createdAt: new Date().toISOString(),
  } as StreakHistoryEntry);
  const withoutSameDate = state.streakHistory.filter((s) => s.date !== entry.date);
  return { ...state, streakHistory: [entry, ...withoutSameDate] };
}

/** Alias kept for readability at call sites. */
export const recordStreakSnapshot = createStreakSnapshot;

export function updateStreakHistory(
  state: LearnFlowState,
  date: string,
  patch: Partial<Pick<StreakHistoryEntry, 'current' | 'longest' | 'activeDays' | 'loggedToday'>>,
): LearnFlowState {
  return {
    ...state,
    streakHistory: state.streakHistory.map((s) =>
      s.date === date ? normalizeStreakEntry({ ...s, ...patch }) : s,
    ),
  };
}

export function deleteStreakHistory(state: LearnFlowState, date: string): LearnFlowState {
  return { ...state, streakHistory: state.streakHistory.filter((s) => s.date !== date) };
}

export function clearStreakHistory(state: LearnFlowState): LearnFlowState {
  return { ...state, streakHistory: [] };
}

// ============================ Misc (compat) ============================

export function resetState(state: LearnFlowState): LearnFlowState {
  void state;
  // Fresh seed — callers persist via the data hook (refresh-safe otherwise).
  return seedState();
}
