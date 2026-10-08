/**
 * Database schema, seed, normalization and migration.
 *
 * Single source of truth for the persisted document shape. All readers go
 * through `migrateStoredState` so v1 payloads (missing user/settings/
 * resources/streakHistory) upgrade in place without losing data — refresh
 * safe by construction.
 *
 * Future SQL migration: each collection here becomes a table
 * (users, tasks, goals, roadmaps, roadmap_steps, folders, notes,
 * resources, completions/sessions, reviews, streak_history, settings).
 */
import type {
  CompletionEntry,
  DailyReview,
  Folder,
  Goal,
  GoalStatus,
  LearnFlowState,
  Note,
  NoteKind,
  Resource,
  ResourceType,
  Roadmap,
  RoadmapStep,
  RoadmapStepStatus,
  Settings,
  StreakHistoryEntry,
  Task,
  TaskStatus,
  User,
  WeeklyReview,
} from '../types';
import { todayString, uid, weekKeyFor } from '../utils';

export const SCHEMA_VERSION = 2;

export function defaultUser(): User {
  const now = new Date().toISOString();
  return { id: 'user_local', name: 'Learner', avatar: '', learningGoal: '', createdAt: now, updatedAt: now };
}

export function defaultSettings(): Settings {
  return {
    theme: 'system',
    dailyLearningTargetMinutes: 30,
    defaultTaskPriority: 'medium',
    reminders: { enabled: true, dailyLearning: true, tasks: true, roadmaps: true, dailyReview: true },
    updatedAt: new Date().toISOString(),
  };
}

export function seedState(): LearnFlowState {
  const now = new Date().toISOString();
  return {
    tasks: [],
    goals: [],
    roadmaps: [],
    folders: [
      { id: 'folder_getting_started', name: 'Getting started', parentId: null, createdAt: now, updatedAt: now },
    ],
    notes: [],
    completions: [],
    weeklyReviews: [],
    dailyReviews: [],
    user: defaultUser(),
    resources: [],
    streakHistory: [],
    settings: defaultSettings(),
  };
}

/** Fill defaults for goals saved before the full goals system existed. */
export function normalizeGoal(raw: Goal): Goal {
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
export function normalizeCompletion(raw: CompletionEntry): CompletionEntry {
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

function isValidWeekKey(v: string): boolean {
  return /^\d{4}-W\d{2}$/.test(v);
}

/** Fill defaults for weekly reviews saved by older versions (field may be missing). */
export function normalizeReview(raw: WeeklyReview): WeeklyReview {
  const r = raw as Partial<WeeklyReview>;
  const createdAt = r.createdAt ?? new Date().toISOString();
  const weekKey = r.weekKey && isValidWeekKey(r.weekKey) ? r.weekKey : weekKeyFor(todayString());
  return {
    id: r.id ?? uid('review'),
    weekKey,
    learned: r.learned ?? '',
    missed: r.missed ?? '',
    focusNext: r.focusNext ?? '',
    createdAt,
    updatedAt: (r as { updatedAt?: string }).updatedAt ?? createdAt,
  };
}

function isValidDateOnly(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Fill defaults for daily reviews saved by older versions (field may be missing). */
export function normalizeDailyReview(raw: DailyReview): DailyReview {
  const r = raw as Partial<DailyReview>;
  const createdAt = r.createdAt ?? new Date().toISOString();
  return {
    id: r.id ?? uid('daily-review'),
    date: r.date && isValidDateOnly(r.date) ? r.date : todayString(),
    accomplished: r.accomplished ?? '',
    learned: r.learned ?? '',
    notCompleted: r.notCompleted ?? '',
    planTomorrow: r.planTomorrow ?? '',
    createdAt,
    updatedAt: (r as { updatedAt?: string }).updatedAt ?? createdAt,
  };
}

/** Fill defaults for tasks saved before the full task system existed. */
export function normalizeTask(raw: Task): Task {
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

/** Fill defaults for folders saved before subfolders existed. */
export function normalizeFolder(raw: Folder): Folder {
  const r = raw as Partial<Folder>;
  return {
    id: r.id ?? uid('folder'),
    name: r.name ?? 'Untitled',
    parentId: r.parentId ?? null,
    createdAt: r.createdAt ?? new Date().toISOString(),
    updatedAt: (r as { updatedAt?: string }).updatedAt ?? r.createdAt ?? new Date().toISOString(),
  };
}

export const VALID_NOTE_KINDS: NoteKind[] = ['note', 'summary', 'resource', 'link', 'topic'];

export function normalizeTags(raw: unknown): string[] {
  const arr: unknown = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of arr as unknown[]) {
    const v = String(t ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= 10) break;
  }
  return out;
}

const VALID_RESOURCE_TYPES: ResourceType[] = ['website', 'youtube', 'documentation', 'course', 'article', 'other'];

export function normalizeResourceType(raw: unknown): ResourceType | null {
  return typeof raw === 'string' && (VALID_RESOURCE_TYPES as string[]).includes(raw)
    ? (raw as ResourceType)
    : null;
}

/** Fill defaults for notes saved before kinds existed. */
export function normalizeNote(raw: Note): Note {
  const r = raw as Partial<Note> & { tags?: unknown };
  const kind: NoteKind =
    r.kind && (VALID_NOTE_KINDS as string[]).includes(r.kind)
      ? r.kind
      : r.url && r.url.trim()
        ? 'resource'
        : 'note';
  const roadmapId = typeof r.roadmapId === 'string' && r.roadmapId ? r.roadmapId : null;
  const trimmedUrl = (r.url ?? '').trim();
  const rawType = normalizeResourceType((r as { resourceType?: unknown }).resourceType);
  return {
    id: r.id ?? uid('note'),
    folderId: r.folderId ?? '',
    title: r.title ?? '',
    url: trimmedUrl,
    content: r.content ?? '',
    kind,
    tags: normalizeTags(r.tags),
    pinned: r.pinned === true,
    goalId: typeof r.goalId === 'string' && r.goalId ? r.goalId : null,
    roadmapId,
    roadmapStepId:
      roadmapId && typeof r.roadmapStepId === 'string' && r.roadmapStepId ? r.roadmapStepId : null,
    resourceType: rawType ?? (trimmedUrl ? 'website' : null),
    createdAt: r.createdAt ?? new Date().toISOString(),
    updatedAt: (r as { updatedAt?: string }).updatedAt ?? r.createdAt ?? new Date().toISOString(),
  };
}

/** A note counts as a resource when it links somewhere. */
export function isResourceNote(n: Note): boolean {
  return n.kind === 'resource' || n.kind === 'link' || (n.url.trim().length > 0);
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

export function normalizeRoadmap(raw: Roadmap): Roadmap {
  return {
    ...raw,
    description: (raw as { description?: string }).description ?? '',
    steps: Array.isArray(raw.steps) ? raw.steps.map(normalizeRoadmapStep) : [],
  };
}

export function normalizeUser(raw: unknown): User {
  const r = (raw ?? {}) as Partial<User>;
  const now = new Date().toISOString();
  return {
    id: typeof r.id === 'string' && r.id ? r.id : 'user_local',
    name: typeof r.name === 'string' && r.name.trim() ? r.name : 'Learner',
    avatar: typeof r.avatar === 'string' ? r.avatar.slice(0, 200000) : '',
    learningGoal: typeof r.learningGoal === 'string' ? r.learningGoal.slice(0, 200) : '',
    createdAt: r.createdAt ?? now,
    updatedAt: r.updatedAt ?? r.createdAt ?? now,
  };
}

const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

export function normalizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings> & { reminders?: unknown };
  const rem = (r.reminders ?? {}) as Partial<Settings['reminders']>;
  return {
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : 'system',
    dailyLearningTargetMinutes: Math.max(
      0,
      Math.min(1440, Math.floor(Number(r.dailyLearningTargetMinutes) || 0)),
    ),
    defaultTaskPriority: (VALID_PRIORITIES as readonly string[]).includes(r.defaultTaskPriority ?? '')
      ? (r.defaultTaskPriority as Settings['defaultTaskPriority'])
      : 'medium',
    reminders: {
      enabled: rem.enabled !== false,
      dailyLearning: rem.dailyLearning !== false,
      tasks: rem.tasks !== false,
      roadmaps: rem.roadmaps !== false,
      dailyReview: rem.dailyReview !== false,
    },
    updatedAt: r.updatedAt ?? new Date().toISOString(),
  };
}

export function normalizeResource(raw: Resource): Resource {
  const r = raw as Partial<Resource> & { tags?: unknown };
  const now = new Date().toISOString();
  return {
    id: r.id ?? uid('resource'),
    title: r.title ?? '',
    url: (r.url ?? '').trim(),
    description: r.description ?? '',
    folderId: typeof r.folderId === 'string' && r.folderId ? r.folderId : null,
    tags: normalizeTags(r.tags),
    goalId: typeof r.goalId === 'string' && r.goalId ? r.goalId : null,
    roadmapId: typeof r.roadmapId === 'string' && r.roadmapId ? r.roadmapId : null,
    resourceType: normalizeResourceType(r.resourceType) ?? 'website',
    createdAt: r.createdAt ?? now,
    updatedAt: r.updatedAt ?? r.createdAt ?? now,
  };
}

export function normalizeStreakEntry(raw: StreakHistoryEntry): StreakHistoryEntry {
  const r = raw as Partial<StreakHistoryEntry>;
  return {
    id: r.id ?? uid('streak'),
    date: r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : todayString(),
    current: Math.max(0, Math.floor(r.current ?? 0) || 0),
    longest: Math.max(0, Math.floor(r.longest ?? 0) || 0),
    activeDays: Math.max(0, Math.floor(r.activeDays ?? 0) || 0),
    loggedToday: r.loggedToday === true,
    createdAt: r.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Normalize + repair a raw persisted document. Never throws, never drops
 * user data: unknown fields pass through, missing collections get defaults,
 * corrupt folder parenting is repaired, orphan notes are re-homed.
 */
export function normalizeState(raw: LearnFlowState): LearnFlowState {
  const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const folders = asArray<Folder>(raw.folders).map(normalizeFolder);
  const folderIds = new Set(folders.map((f) => f.id));
  const parentIds = new Set(folders.filter((f) => f.parentId).map((f) => f.parentId as string));
  const safeFolders = folders.map((f) =>
    f.parentId && (!folderIds.has(f.parentId) || parentIds.has(f.id) || f.parentId === f.id)
      ? { ...f, parentId: null }
      : f,
  );
  const validIds = new Set(safeFolders.map((f) => f.id));
  const fallbackId = safeFolders.find((f) => f.parentId === null)?.id ?? safeFolders[0]?.id ?? '';
  const notes = asArray<Note>(raw.notes).map(normalizeNote).map((n) =>
    validIds.has(n.folderId) ? n : { ...n, folderId: fallbackId },
  );
  return {
    tasks: asArray<Task>(raw.tasks).map(normalizeTask),
    goals: asArray<Goal>(raw.goals).map(normalizeGoal),
    roadmaps: asArray<Roadmap>(raw.roadmaps).map(normalizeRoadmap),
    folders: safeFolders,
    notes,
    completions: asArray<CompletionEntry>(raw.completions).map(normalizeCompletion),
    weeklyReviews: asArray<WeeklyReview>(raw.weeklyReviews).map(normalizeReview),
    dailyReviews: asArray<DailyReview>(raw.dailyReviews).map(normalizeDailyReview),
    user: normalizeUser((raw as Partial<LearnFlowState>).user),
    resources: Array.isArray((raw as Partial<LearnFlowState>).resources)
      ? ((raw as Partial<LearnFlowState>).resources as Resource[]).map(normalizeResource)
      : [],
    streakHistory: Array.isArray((raw as Partial<LearnFlowState>).streakHistory)
      ? ((raw as Partial<LearnFlowState>).streakHistory as StreakHistoryEntry[]).map(normalizeStreakEntry)
      : [],
    settings: normalizeSettings((raw as Partial<LearnFlowState>).settings),
  };
}

/** Upgrade any stored payload (v1 without new fields, or corrupt) to v2. */
export function migrateStoredState(raw: unknown): LearnFlowState {
  if (!raw || typeof raw !== 'object') return seedState();
  const seed = seedState();
  // Present-but-wrong-typed collections (e.g. tasks: "nope" from a corrupt
  // write) must not wipe their seed defaults — drop them so the seed applies.
  const cleaned: Record<string, unknown> = { ...(raw as Record<string, unknown>) };
  for (const key of [
    'tasks',
    'goals',
    'roadmaps',
    'folders',
    'notes',
    'completions',
    'weeklyReviews',
    'dailyReviews',
    'resources',
    'streakHistory',
  ]) {
    if (cleaned[key] !== undefined && !Array.isArray(cleaned[key])) delete cleaned[key];
  }
  return normalizeState({ ...(seed as object), ...cleaned } as unknown as LearnFlowState);
}
