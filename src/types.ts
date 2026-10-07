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

export interface Goal {
  id: string;
  title: string;
  description: string;
  deadline: string; // yyyy-mm-dd or ''
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export interface RoadmapStep {
  id: string;
  title: string;
  done: boolean;
  resource: string; // optional URL or note
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
  createdAt: string;
}

export interface Note {
  id: string;
  folderId: string;
  title: string;
  url: string;
  content: string;
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
  createdAt: string;
}

export interface LearnFlowState {
  tasks: Task[];
  goals: Goal[];
  roadmaps: Roadmap[];
  folders: Folder[];
  notes: Note[];
  completions: CompletionEntry[];
}

export type ViewKey =
  | 'dashboard'
  | 'tasks'
  | 'roadmaps'
  | 'learning'
  | 'streaks'
  | 'folders'
  | 'notes'
  | 'resources'
  | 'settings';
