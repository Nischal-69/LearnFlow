import { describe, expect, it } from 'vitest';
import type { LearnFlowState } from '../types';
import { migrateStoredState, seedState } from './schema';
import {
  createDailyReview,
  createFolder,
  createGoal,
  createLearningSession,
  createNote,
  createResource,
  createRoadmap,
  createRoadmapStep,
  createStreakSnapshot,
  createSubfolder,
  createTask,
  createUser,
  deleteDailyReview,
  deleteFolder,
  deleteGoal,
  deleteLearningSession,
  deleteNote,
  deleteResource,
  deleteRoadmap,
  deleteRoadmapStep,
  deleteStreakHistory,
  deleteTask,
  deleteWeeklyReview,
  getLearningSession,
  listLearningSessions,
  listStreakHistory,
  moveRoadmapStep,
  saveDailyReview,
  saveWeeklyReview,
  updateDailyReview,
  updateGoal,
  updateLearningSession,
  updateNote,
  updateResource,
  updateRoadmap,
  updateRoadmapStep,
  updateSettings,
  updateTask,
  updateUser,
} from './service';
import { hasExistingData, parseBackup, serializeBackup } from './backup';

function fresh(): LearnFlowState {
  return seedState();
}

const taskInput = {
  title: 'Study verbs',
  description: '',
  dueDate: '2026-10-08',
  priority: 'high' as const,
  category: '',
  estimatedMinutes: 20,
};

describe('tasks', () => {
  it('creates, completes (logging history), reopens and deletes', () => {
    let s = fresh();
    const { state: s1, id } = createTask(s, taskInput);
    expect(id).not.toBe('');
    expect(s1.tasks).toHaveLength(1);
    s = s1;

    const logsBefore = s.completions.length;
    s = updateTask(s, id, { status: 'completed' });
    const task = s.tasks.find((t) => t.id === id)!;
    expect(task.status).toBe('completed');
    expect(task.done).toBe(true);
    expect(task.doneAt).not.toBeNull();
    expect(s.completions.length).toBe(logsBefore + 1);

    s = updateTask(s, id, { status: 'todo' });
    expect(s.tasks.find((t) => t.id === id)!.doneAt).toBeNull();
    expect(s.completions.length).toBe(logsBefore + 1); // reopening logs nothing

    s = updateTask(s, id, { status: 'completed' });
    expect(s.completions.length).toBe(logsBefore + 2); // re-completing logs again

    s = deleteTask(s, id);
    expect(s.tasks).toHaveLength(0);
  });

  it('rejects empty titles', () => {
    const { state, id } = createTask(fresh(), { ...taskInput, title: '   ' });
    expect(id).toBe('');
    expect(state.tasks).toHaveLength(0);
  });

  it('preserves existing title when update clears it', () => {
    let s = createTask(fresh(), taskInput).state;
    const id = s.tasks[0].id;
    s = updateTask(s, id, { title: '   ' });
    expect(s.tasks[0].title).toBe('Study verbs');
  });
});

describe('goals', () => {
  it('creates, completes with timestamp + log, and deletes', () => {
    let s = createGoal(fresh(), {
      title: 'Spanish',
      description: '',
      motivation: 'travel',
      deadline: '',
      dailyTargetMinutes: 20,
      weeklyTargetMinutes: 100,
    }).state;
    const id = s.goals[0].id;
    const logs = s.completions.length;
    s = updateGoal(s, id, { status: 'completed' });
    expect(s.goals[0].completedAt).not.toBeNull();
    expect(s.completions.length).toBe(logs + 1);
    s = deleteGoal(s, id);
    expect(s.goals).toHaveLength(0);
  });
});

describe('roadmaps and steps', () => {
  it('creates roadmap with steps, advances steps, logs completion once', () => {
    let s = createRoadmap(fresh(), 'French', '', ['Basics', 'Verbs']).state;
    const roadmapId = s.roadmaps[0].id;
    expect(s.roadmaps[0].steps).toHaveLength(2);

    s = createRoadmapStep(s, roadmapId, 'Nouns');
    expect(s.roadmaps[0].steps).toHaveLength(3);

    const stepId = s.roadmaps[0].steps[0].id;
    const logs = s.completions.length;
    s = updateRoadmapStep(s, roadmapId, stepId, { status: 'in_progress' });
    expect(s.completions.length).toBe(logs); // starting logs nothing
    s = updateRoadmapStep(s, roadmapId, stepId, { status: 'completed' });
    expect(s.completions.length).toBe(logs + 1);

    s = moveRoadmapStep(s, roadmapId, stepId, 'down');
    expect(s.completions.length).toBe(logs + 1); // moving logs nothing

    s = deleteRoadmapStep(s, roadmapId, stepId);
    expect(s.roadmaps[0].steps).toHaveLength(2);
    s = deleteRoadmap(s, roadmapId);
    expect(s.roadmaps).toHaveLength(0);
  });

  it('updates roadmap title and description', () => {
    let s = createRoadmap(fresh(), 'Old', '', []).state;
    const id = s.roadmaps[0].id;
    s = updateRoadmap(s, id, { title: 'New' });
    expect(s.roadmaps[0].title).toBe('New');
  });
});

describe('learning sessions', () => {
  it('logs, edits and deletes sessions', () => {
    let s = fresh();
    const { state: s1, id } = createLearningSession(s, { title: 'Verbs', minutes: 30 });
    expect(id).not.toBeNull();
    s = s1;
    expect(listLearningSessions(s)).toHaveLength(1);

    s = updateLearningSession(s, id!, { minutes: 45 });
    expect(getLearningSession(s, id!)!.minutes).toBe(45);

    s = deleteLearningSession(s, id!);
    expect(listLearningSessions(s)).toHaveLength(0);
  });

  it('rejects empty titles and non-positive minutes', () => {
    expect(createLearningSession(fresh(), { title: '  ', minutes: 30 }).id).toBeNull();
    expect(createLearningSession(fresh(), { title: 'X', minutes: 0 }).id).toBeNull();
  });

  it('clamps future dates to today', () => {
    const { state } = createLearningSession(fresh(), { title: 'X', minutes: 10, date: '2999-01-01' });
    const sessions = listLearningSessions(state);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].date).not.toBe('2999-01-01');
  });

  it('deleteLearningSession only removes session entries', () => {
    let s = createTask(fresh(), taskInput).state;
    const taskId = s.tasks[0].id;
    s = updateTask(s, taskId, { status: 'completed' });
    const taskLogId = s.completions.find((c) => c.kind === 'task')!.id;
    const kept = deleteLearningSession(s, taskLogId);
    expect(kept.completions.some((c) => c.id === taskLogId)).toBe(true);
  });

  it('markStepComplete completes the linked step', () => {
    let s = createRoadmap(fresh(), 'R', '', ['S1']).state;
    const roadmapId = s.roadmaps[0].id;
    const stepId = s.roadmaps[0].steps[0].id;
    const res = createLearningSession(s, {
      title: 'Studied',
      minutes: 20,
      roadmapId,
      roadmapStepId: stepId,
      markStepComplete: true,
    });
    s = res.state;
    expect(s.roadmaps[0].steps[0].status).toBe('completed');
  });
});

describe('folders, notes and resources', () => {
  it('enforces one-level subfolders', () => {
    let s = createFolder(fresh(), 'Top').state;
    const topId = s.folders.find((f) => f.name === 'Top')!.id;
    const sub = createSubfolder(s, topId, 'Child');
    expect(sub.id).not.toBe('');
    s = sub.state;
    const childId = sub.id;
    // A child cannot be a parent.
    expect(createSubfolder(s, childId, 'Grandchild').id).toBe('');
  });

  it('cascades folder deletion to notes', () => {
    let s = createFolder(fresh(), 'Top').state;
    const topId = s.folders.find((f) => f.name === 'Top')!.id;
    s = createNote(s, topId, 'Note', '', 'content').state;
    expect(s.notes).toHaveLength(1);
    s = deleteFolder(s, topId);
    expect(s.notes).toHaveLength(0);
  });

  it('creates, pins, edits and deletes notes', () => {
    let s = fresh();
    const folderId = s.folders[0].id;
    const { state: s1, id } = createNote(s, folderId, 'Title', '', 'body');
    expect(id).not.toBe('');
    s = s1;
    s = updateNote(s, id, { pinned: true } as never);
    expect(s.notes[0].pinned).toBe(true);
    s = deleteNote(s, id);
    expect(s.notes).toHaveLength(0);
  });

  it('manages standalone resources', () => {
    let s = fresh();
    const { state: s1, id } = createResource(s, { title: 'Docs', url: 'https://example.com' });
    expect(id).not.toBe('');
    s = s1;
    s = updateResource(s, id, { title: 'Docs 2' });
    expect(s.resources[0].title).toBe('Docs 2');
    s = deleteResource(s, id);
    expect(s.resources).toHaveLength(0);
  });
});

describe('reviews', () => {
  it('upserts one daily review per date and validates content', () => {
    let s = fresh();
    expect(saveDailyReview(s, { date: '2026-10-01', accomplished: '', learned: '', notCompleted: '', planTomorrow: '' }).ok).toBe(false);
    const r1 = saveDailyReview(s, { date: '2026-10-01', accomplished: 'Did X', learned: '', notCompleted: '', planTomorrow: '' });
    expect(r1.ok).toBe(true);
    s = r1.state;
    const r2 = saveDailyReview(s, { date: '2026-10-01', accomplished: 'Did Y', learned: '', notCompleted: '', planTomorrow: '' });
    s = r2.state;
    expect(s.dailyReviews.filter((r) => r.date === '2026-10-01')).toHaveLength(1);
    expect(s.dailyReviews[0].accomplished).toBe('Did Y');
    s = updateDailyReview(s, '2026-10-01', { learned: 'Z' });
    expect(s.dailyReviews[0].learned).toBe('Z');
    s = deleteDailyReview(s, '2026-10-01');
    expect(s.dailyReviews).toHaveLength(0);
  });

  it('rejects future review dates and bad week keys', () => {
    expect(saveDailyReview(fresh(), { date: '2999-01-01', accomplished: 'x', learned: '', notCompleted: '', planTomorrow: '' }).ok).toBe(false);
    expect(saveWeeklyReview(fresh(), { weekKey: 'nope', learned: 'x', missed: '', focusNext: '' }).ok).toBe(false);
    const r = saveWeeklyReview(fresh(), { weekKey: '2026-W40', learned: 'x', missed: '', focusNext: '' });
    expect(r.ok).toBe(true);
    const s = deleteWeeklyReview(r.state, '2026-W40');
    expect(s.weeklyReviews).toHaveLength(0);
  });

  it('createDailyReview helper creates entries', () => {
    const { state, ok } = createDailyReview(fresh(), { date: '2026-10-02', accomplished: 'a', learned: '', notCompleted: '', planTomorrow: '' });
    expect(ok).toBe(true);
    expect(state.dailyReviews).toHaveLength(1);
  });
});

describe('user, settings and streak history', () => {
  it('updates user profile fields', () => {
    let s = createUser(fresh(), 'Ada').state;
    s = updateUser(s, { name: '  ', avatar: '🚀', learningGoal: 'Rust' });
    expect(s.user.name).toBe('Ada'); // blank keeps old
    expect(s.user.avatar).toBe('🚀');
    expect(s.user.learningGoal).toBe('Rust');
  });

  it('validates settings fields', () => {
    let s = updateSettings(fresh(), { theme: 'dark', dailyLearningTargetMinutes: 45, defaultTaskPriority: 'low' });
    expect(s.settings.theme).toBe('dark');
    expect(s.settings.dailyLearningTargetMinutes).toBe(45);
    expect(s.settings.defaultTaskPriority).toBe('low');
    s = updateSettings(s, { theme: 'neon' as never, dailyLearningTargetMinutes: 9999, defaultTaskPriority: 'urgent' as never });
    expect(s.settings.theme).toBe('system');
    expect(s.settings.dailyLearningTargetMinutes).toBeLessThanOrEqual(1440);
    expect(s.settings.defaultTaskPriority).toBe('medium');
  });

  it('upserts streak snapshots by date', () => {
    let s = createStreakSnapshot(fresh(), { date: '2026-10-01', current: 2, longest: 5, activeDays: 6, loggedToday: true });
    s = createStreakSnapshot(s, { date: '2026-10-01', current: 3, longest: 5, activeDays: 7, loggedToday: true });
    expect(listStreakHistory(s).filter((e) => e.date === '2026-10-01')).toHaveLength(1);
    s = deleteStreakHistory(s, '2026-10-01');
    expect(listStreakHistory(s)).toHaveLength(0);
  });
});

describe('migration and backup', () => {
  it('upgrades legacy payloads without losing data', () => {
    const legacy = {
      tasks: [{ id: 't1', title: 'Keep me', status: 'todo', done: false, createdAt: '2026-01-01T00:00:00.000Z' }],
      goals: [],
      roadmaps: [],
      folders: [],
      notes: [],
      completions: [],
      weeklyReviews: [],
      dailyReviews: [],
    };
    const s = migrateStoredState(legacy);
    expect(s.tasks).toHaveLength(1);
    expect(s.tasks[0].title).toBe('Keep me');
    expect(s.user.name).toBe('Learner');
    expect(s.resources).toEqual([]);
    expect(s.settings.reminders.dailyReview).toBe(true);
  });

  it('falls back to seed on corrupt input', () => {
    const s = migrateStoredState(null);
    expect(s.tasks).toEqual([]);
    expect(s.folders.length).toBeGreaterThan(0);
  });

  it('survives present-but-non-array collections without throwing', () => {
    const s = migrateStoredState({ tasks: 'nope', notes: 42, completions: null, folders: {} });
    expect(s.tasks).toEqual([]);
    expect(s.notes).toEqual([]);
    expect(s.completions).toEqual([]);
    expect(s.folders.length).toBeGreaterThan(0);
  });

  it('round-trips export → import', () => {
    let s = createTask(fresh(), taskInput).state;
    const json = serializeBackup(s);
    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.tasks).toHaveLength(1);
      expect(parsed.state.tasks[0].title).toBe('Study verbs');
    }
  });

  it('rejects invalid backups', () => {
    expect(parseBackup('not json{{{').ok).toBe(false);
    expect(parseBackup('[1,2]').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other', version: 1, data: { tasks: [] } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'learnflow', version: 1, exportedAt: '', data: { tasks: 'nope' } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'learnflow', version: 1 })).ok).toBe(false);
  });

  it('detects existing data for overwrite confirmation', () => {
    expect(hasExistingData(fresh())).toBe(false);
    expect(hasExistingData(createTask(fresh(), taskInput).state)).toBe(true);
  });
});
