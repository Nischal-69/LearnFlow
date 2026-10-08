/**
 * Future remote-backend contract (Supabase / PostgreSQL).
 *
 * v1 uses browser localStorage via `storage.ts` + `service.ts` (sync).
 * When migrating, implement this async interface with Supabase queries —
 * one method per table — keeping the same entity shapes from `src/types.ts`:
 *
 *   users, tasks, goals, roadmaps, roadmap_steps, folders, notes,
 *   resources, completions, daily_reviews, weekly_reviews,
 *   streak_history, settings
 *
 * The pure functions in `service.ts` already use matching names
 * (list/get/create/update/delete per type), so call sites can switch from
 * sync state transitions to `await backend.listTasks()` with minimal churn.
 */
import type {
  DailyReview,
  Folder,
  Goal,
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

export interface LearnFlowBackend {
  // user
  getUser(): Promise<User>;
  updateUser(patch: Partial<User>): Promise<User>;
  // tasks
  listTasks(): Promise<Task[]>;
  createTask(input: Omit<Task, 'id' | 'createdAt' | 'done' | 'doneAt' | 'status'>): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  // goals
  listGoals(): Promise<Goal[]>;
  createGoal(input: Omit<Goal, 'id' | 'createdAt' | 'completedAt' | 'status'>): Promise<Goal>;
  updateGoal(id: string, patch: Partial<Goal>): Promise<Goal>;
  deleteGoal(id: string): Promise<void>;
  // roadmaps + steps
  listRoadmaps(): Promise<Roadmap[]>;
  createRoadmap(input: Pick<Roadmap, 'title' | 'description'>): Promise<Roadmap>;
  updateRoadmap(id: string, patch: Partial<Roadmap>): Promise<Roadmap>;
  deleteRoadmap(id: string): Promise<void>;
  listRoadmapSteps(roadmapId: string): Promise<RoadmapStep[]>;
  createRoadmapStep(roadmapId: string, input: Pick<RoadmapStep, 'title'> & Partial<RoadmapStep>): Promise<RoadmapStep>;
  updateRoadmapStep(roadmapId: string, stepId: string, patch: Partial<RoadmapStep>): Promise<RoadmapStep>;
  deleteRoadmapStep(roadmapId: string, stepId: string): Promise<void>;
  // sessions
  listLearningSessions(): Promise<LearningSession[]>;
  createLearningSession(input: Omit<LearningSession, 'id' | 'createdAt'>): Promise<LearningSession>;
  updateLearningSession(id: string, patch: Partial<LearningSession>): Promise<LearningSession>;
  deleteLearningSession(id: string): Promise<void>;
  // folders / notes / resources
  listFolders(): Promise<Folder[]>;
  createFolder(name: string, parentId?: string | null): Promise<Folder>;
  updateFolder(id: string, patch: Partial<Folder>): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
  listNotes(): Promise<Note[]>;
  createNote(input: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Promise<Note>;
  updateNote(id: string, patch: Partial<Note>): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  listResources(): Promise<Resource[]>;
  createResource(input: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>): Promise<Resource>;
  updateResource(id: string, patch: Partial<Resource>): Promise<Resource>;
  deleteResource(id: string): Promise<void>;
  // reviews / streak / settings
  listDailyReviews(): Promise<DailyReview[]>;
  saveDailyReview(input: DailyReview): Promise<DailyReview>;
  deleteDailyReview(date: string): Promise<void>;
  listWeeklyReviews(): Promise<WeeklyReview[]>;
  saveWeeklyReview(input: WeeklyReview): Promise<WeeklyReview>;
  deleteWeeklyReview(weekKey: string): Promise<void>;
  listStreakHistory(): Promise<StreakHistoryEntry[]>;
  recordStreakSnapshot(entry: Omit<StreakHistoryEntry, 'id' | 'createdAt'>): Promise<StreakHistoryEntry>;
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;
}
