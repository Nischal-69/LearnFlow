import { normalizeRoadmapStep } from './store';
import type { CompletionEntry, Goal, Note, Roadmap, RoadmapStepStatus } from './types';

export type VerificationStatus = 'Completed' | 'Still Learning' | 'Not Started';

export interface PlannedStep {
  roadmapId: string;
  roadmapTitle: string;
  stepId: string;
  title: string;
  status: RoadmapStepStatus;
}

export interface LearnedItem {
  title: string;
  date: string;
  understood: string;
}

export interface GoalVerification {
  goalId: string;
  /** what the user said they wanted to learn (description, fallback title) */
  wantToLearn: string;
  targetDate: string;
  plannedSteps: PlannedStep[];
  sessions: CompletionEntry[];
  learned: LearnedItem[];
  completedSteps: PlannedStep[];
  notesCount: number;
  minutes: number;
  /** completed / planned steps, null when nothing was ever linked */
  progress: number | null;
  status: VerificationStatus;
}

/**
 * Honest comparison: planned steps come ONLY from roadmaps the user
 * co-linked with this goal in a recorded session or note. Nothing is
 * inferred from titles and learning is never claimed automatically.
 */
export function verifyGoal(
  goal: Goal,
  completions: CompletionEntry[],
  notes: Note[],
  roadmaps: Roadmap[],
): GoalVerification {
  const sessions = completions
    .filter((c) => c.kind === 'session' && c.goalId === goal.id)
    .sort((a, b) => `${b.date} ${b.createdAt}`.localeCompare(`${a.date} ${a.createdAt}`));

  const linkedRoadmapIds = new Set<string>();
  for (const c of completions) {
    if (c.goalId === goal.id && c.roadmapId) linkedRoadmapIds.add(c.roadmapId);
  }
  for (const n of notes) {
    if (n.goalId === goal.id && n.roadmapId) linkedRoadmapIds.add(n.roadmapId);
  }

  const roadmapById = new Map(roadmaps.map((r) => [r.id, r]));
  const plannedSteps: PlannedStep[] = [];
  const seenSteps = new Set<string>();
  for (const roadmapId of linkedRoadmapIds) {
    const roadmap = roadmapById.get(roadmapId);
    if (!roadmap) continue;
    for (const raw of roadmap.steps.map(normalizeRoadmapStep)) {
      const key = `${roadmapId}:${raw.id}`;
      if (seenSteps.has(key)) continue;
      seenSteps.add(key);
      plannedSteps.push({
        roadmapId,
        roadmapTitle: roadmap.title,
        stepId: raw.id,
        title: raw.title,
        status: raw.status,
      });
    }
  }

  const completedSteps = plannedSteps.filter((s) => s.status === 'completed');
  const notesCount = notes.filter((n) => n.goalId === goal.id).length;
  const minutes = sessions.reduce((a, c) => a + Math.max(0, c.minutes || 0), 0);
  const progress =
    plannedSteps.length > 0 ? Math.round((completedSteps.length / plannedSteps.length) * 100) : null;

  const hasProgress =
    sessions.length > 0 ||
    notesCount > 0 ||
    plannedSteps.some((s) => s.status !== 'not_started');

  const status: VerificationStatus =
    goal.status === 'completed' ? 'Completed' : hasProgress ? 'Still Learning' : 'Not Started';

  return {
    goalId: goal.id,
    wantToLearn: goal.description.trim() || goal.title,
    targetDate: goal.deadline,
    plannedSteps,
    sessions,
    learned: sessions.slice(0, 5).map((s) => ({ title: s.title, date: s.date, understood: s.understood })),
    completedSteps,
    notesCount,
    minutes,
    progress,
    status,
  };
}
