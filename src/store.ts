/**
 * Backward-compatibility façade over the centralized data layer.
 *
 * New code should import from `src/data/*` directly:
 *   - types      → `src/types.ts`
 *   - storage    → `src/data/storage.ts` (only localStorage touchpoint)
 *   - schema     → `src/data/schema.ts`
 *   - CRUD       → `src/data/service.ts`
 *   - React hook → `src/data/index.ts` (`useLearnFlowData`)
 *
 * This module re-exports the same names so existing components keep working
 * without scattered storage access.
 */
import type { Roadmap, RoadmapStep } from './types';
import { KEYS } from './data/storage';
import {
  isResourceNote,
  normalizeResourceType,
  normalizeRoadmapStep,
  normalizeTags,
} from './data/schema';
import { useLearnFlowData } from './data/index';
import type {
  DailyReviewInput,
  GoalInput,
  LearningSessionInput,
  NoteExtra,
  NotePatch,
  RoadmapStepPatch,
  RoadmapStepSeed,
  TaskInput,
  WeeklyReviewInput,
} from './data/service';

export const STORAGE_KEY = KEYS.STATE;

export function currentRoadmapStep(roadmap: Roadmap): RoadmapStep | null {
  const steps = roadmap.steps.map(normalizeRoadmapStep);
  return steps.find((s) => s.status === 'in_progress') ?? steps.find((s) => s.status !== 'completed') ?? null;
}

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
  return useLearnFlowData();
}

export type LearnFlowApi = ReturnType<typeof useLearnFlow>;

export { isResourceNote, normalizeResourceType, normalizeRoadmapStep, normalizeTags };
export type {
  DailyReviewInput,
  GoalInput,
  LearningSessionInput,
  NoteExtra,
  NotePatch,
  RoadmapStepPatch,
  RoadmapStepSeed,
  TaskInput,
  WeeklyReviewInput,
};
