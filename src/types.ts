export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // yyyy-mm-dd
  priority: TaskPriority;
  category: string; // free text, '' = none
  estimatedMinutes: number; // 0 = unset
  status: TaskStatus;
  done: boolean; // synced from status (completed ⇔ done)
  doneAt: string | null; // ISO, stamped when completed
  createdAt: string; // ISO
}

export type GoalStatus = 'active' | 'paused' | 'completed';

export interface Goal {
  id: string;
  title: string;
  description: string;
  motivation: string; // why I want to learn this
  deadline: string; // target date, yyyy-mm-dd or ''
  dailyTargetMinutes: number; // 0 = no target
  weeklyTargetMinutes: number; // 0 = no target
  status: GoalStatus;
  completedAt: string | null;
  createdAt: string;
}

export type RoadmapStepStatus = 'not_started' | 'in_progress' | 'completed';

export interface RoadmapResource {
  id: string;
  label: string;
  url: string;
}

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number; // 0 = unset
  resources: RoadmapResource[];
  status: RoadmapStepStatus;
  notes: string;
  /** legacy: completed ⇔ status === 'completed' (kept for migration) */
  done?: boolean;
  /** legacy single resource string (migrated into resources/notes) */
  resource?: string;
}

export interface Roadmap {
  id: string;
  title: string;
  description: string;
  steps: RoadmapStep[];
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  /** null = top-level folder, otherwise id of the parent (one level only) */
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteKind = 'note' | 'summary' | 'resource' | 'link' | 'topic';

export type ResourceType = 'website' | 'youtube' | 'documentation' | 'course' | 'article' | 'other';

export interface Note {
  id: string;
  folderId: string;
  title: string;
  url: string;
  content: string;
  kind: NoteKind;
  /** free-text tags, lowercased/trimmed */
  tags: string[];
  /** pinned notes sort first */
  pinned: boolean;
  /** related learning goal (optional) */
  goalId: string | null;
  /** related roadmap (optional) */
  roadmapId: string | null;
  /** related roadmap step (optional, requires roadmapId) */
  roadmapStepId: string | null;
  /** resource type, null when not a resource */
  resourceType: ResourceType | null;
  createdAt: string;
  updatedAt: string;
}

export type CompletionKind = 'task' | 'goal' | 'roadmap-step' | 'session';

export interface CompletionEntry {
  id: string;
  /** yyyy-mm-dd in local time */
  date: string;
  kind: CompletionKind;
  title: string;
  minutes: number;
  /** linked goal, if the activity was recorded against one */
  goalId: string | null;
  /** linked roadmap + step, for learning sessions */
  roadmapId: string | null;
  roadmapStepId: string | null;
  /** reflection captured by the Learning Tracker */
  understood: string;
  struggled: string;
  next: string;
  notes: string;
  createdAt: string;
}

export interface WeeklyReview {
  id: string;
  /** ISO week key, YYYY-Www */
  weekKey: string;
  learned: string;
  missed: string;
  focusNext: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReview {
  id: string;
  /** yyyy-mm-dd in local time */
  date: string;
  accomplished: string;
  learned: string;
  notCompleted: string;
  planTomorrow: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearnFlowState {
  tasks: Task[];
  goals: Goal[];
  roadmaps: Roadmap[];
  folders: Folder[];
  notes: Note[];
  completions: CompletionEntry[];
  weeklyReviews: WeeklyReview[];
  dailyReviews: DailyReview[];
}

export type ViewKey =
  | 'dashboard'
  | 'tasks'
  | 'roadmaps'
  | 'learning'
  | 'streaks'
  | 'progress'
  | 'library'
  | 'folders'
  | 'notes'
  | 'resources'
  | 'settings';
