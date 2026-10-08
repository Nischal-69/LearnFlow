import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { Reminder } from '../reminders';
import Reminders from './Reminders';
import { currentRoadmapStep, nextRoadmapStep } from '../store';
import type { ViewKey } from '../types';
import { formatDate, goalStats, todayString } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, LinkButton, ProgressBar, Textarea } from './ui';
import {
  IconBook,
  IconCheckCircle,
  IconFlame,
  IconFolder,
  IconMap,
  IconNote,
  IconTrash,
} from './icons';

const DAILY_LEARNING_TARGET = 3;

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {action}
    </div>
  );
}

function ViewAll({ onClick }: { onClick: () => void }) {
  return (
    <LinkButton onClick={onClick}>
      View all
    </LinkButton>
  );
}

export default function Dashboard({
  api,
  go,
  search,
  reminders,
  onDismissReminder,
}: {
  api: LearnFlowApi;
  go: (v: ViewKey) => void;
  search: string;
  reminders: Reminder[];
  onDismissReminder: (id: string) => void;
}) {
  const { state, streak, logSession, toggleTask, toggleRoadmapStep, saveDailyReview, deleteDailyReview } = api;
  const today = todayString();
  const q = search.trim().toLowerCase();
  const matches = (s: string) => (q ? s.toLowerCase().includes(q) : true);

  // ---- 1. Today's Progress ----
  const dueSet = state.tasks.filter((t) => t.dueDate <= today);
  const doneTodayInDue = dueSet.filter((t) => t.done && t.doneAt?.startsWith(today)).length;
  const tasksPct =
    dueSet.length === 0
      ? (doneTodayInDue > 0 ? 100 : 0)
      : Math.min(100, Math.round((doneTodayInDue / dueSet.length) * 100));
  const learningToday = state.completions.filter((c) => c.date === today && c.kind !== 'task').length;
  const learningPct = Math.min(100, Math.round((learningToday / DAILY_LEARNING_TARGET) * 100));
  const overallPct = Math.round((tasksPct + learningPct) / 2);

  // ---- 2. Today's Tasks ----
  const pendingTasks = dueSet.filter((t) => !t.done && matches(t.title)).slice(0, 5);
  const completedToday = state.tasks
    .filter((t) => t.done && t.doneAt?.startsWith(today) && matches(t.title))
    .slice(0, 5);

  // ---- 3. Learning Goal (oldest active; progress from recorded sessions only) ----
  const mainGoal = [...state.goals]
    .filter((g) => g.status === 'active')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const mainGoalStats = mainGoal
    ? goalStats(state.completions, mainGoal.id, mainGoal.weeklyTargetMinutes)
    : null;
  const goalPct = mainGoalStats?.progress ?? 0;

  // ---- 4. Current Roadmap (oldest with incomplete steps, 3-state status) ----
  const isIncomplete = (s: { status?: string; done?: boolean }) =>
    (s.status ?? (s.done ? 'completed' : 'not_started')) !== 'completed';
  const activeRoadmap = [...state.roadmaps]
    .filter((r) => r.steps.some(isIncomplete))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  const doneSteps = activeRoadmap ? activeRoadmap.steps.filter((s) => !isIncomplete(s)) : [];
  const currentStep = activeRoadmap ? currentRoadmapStep(activeRoadmap) : null;
  const nextStep = activeRoadmap ? nextRoadmapStep(activeRoadmap) : null;
  const remainingCount = activeRoadmap
    ? activeRoadmap.steps.filter(isIncomplete).length - (currentStep ? 1 : 0)
    : 0;

  // ---- 6. Continue Learning (folders by latest note activity) ----
  const folderActivity = state.folders
    .map((f) => {
      const folderNotes = state.notes.filter((n) => n.folderId === f.id);
      const latest =
        folderNotes.length > 0
          ? folderNotes.map((n) => n.updatedAt).sort().reverse()[0]
          : f.createdAt;
      return { folder: f, noteCount: folderNotes.length, latest };
    })
    .sort((a, b) => b.latest.localeCompare(a.latest))
    .slice(0, 4);

  // ---- 6b. Recently updated notes (pinned first, then updatedAt desc) ----
  const folderById = new Map(state.folders.map((f) => [f.id, f]));
  const recentNotes = [...state.notes]
    .filter((n) => (q ? `${n.title} ${n.content} ${(n.tags ?? []).join(' ')}`.toLowerCase().includes(q) : true))
    .sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 4);

  // ---- 7. Recent Activity (derived, today only) ----
  interface ActivityItem {
    key: string;
    ts: string;
    icon: React.ReactNode;
    text: string;
    sub: string;
  }
  const activity: ActivityItem[] = [];
  for (const c of state.completions.filter((c) => c.date === today)) {
    const label =
      c.kind === 'task'
        ? 'Completed task'
        : c.kind === 'session'
          ? 'Completed learning session'
          : c.kind === 'goal'
            ? 'Completed goal'
            : 'Completed roadmap step';
    if (!matches(c.title)) continue;
    activity.push({
      key: c.id,
      ts: c.createdAt,
      icon:
        c.kind === 'session' ? (
          <IconFlame className="h-4 w-4 text-orange-500" />
        ) : (
          <IconCheckCircle className="h-4 w-4 text-success" />
        ),
      text: `${label} — ${c.title}`,
      sub: c.minutes > 0 ? `${c.minutes} min` : formatDate(c.date),
    });
  }
  for (const n of state.notes.filter((n) => n.createdAt.startsWith(today))) {
    if (!matches(n.title + ' ' + n.content)) continue;
    activity.push({
      key: n.id,
      ts: n.createdAt,
      icon: <IconNote className="h-4 w-4 text-slate-400" />,
      text: `Added note — ${n.title}`,
      sub: 'Today',
    });
  }
  for (const r of state.roadmaps.filter((r) => r.createdAt.startsWith(today))) {
    if (!matches(r.title)) continue;
    activity.push({
      key: r.id,
      ts: r.createdAt,
      icon: <IconMap className="h-4 w-4 text-slate-400" />,
      text: `Created roadmap — ${r.title}`,
      sub: 'Today',
    });
  }
  activity.sort((a, b) => b.ts.localeCompare(a.ts));
  const recentActivity = activity.slice(0, 5);

  const [showLog, setShowLog] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('');
  const [minutes, setMinutes] = useState('25');

  // ---- 8. Daily Review (optional, collapsed by default) ----
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewDate, setReviewDate] = useState(today);
  const [rAccomplished, setRAccomplished] = useState('');
  const [rLearned, setRLearned] = useState('');
  const [rNotCompleted, setRNotCompleted] = useState('');
  const [rTomorrow, setRTomorrow] = useState('');
  const [editingReviewDate, setEditingReviewDate] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState('');
  const [showAllReviews, setShowAllReviews] = useState(false);

  const todayReview = (state.dailyReviews ?? []).find((r) => r.date === today);
  const sortedDaily = [...(state.dailyReviews ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const visibleDaily = showAllReviews ? sortedDaily : sortedDaily.slice(0, 14);
  const sessionsToday = state.completions.filter((c) => c.date === today && c.kind === 'session');
  const minutesLearnedToday = sessionsToday.reduce((a, c) => a + Math.max(0, c.minutes || 0), 0);
  const doneTasksToday = state.tasks.filter((t) => t.done && t.doneAt?.startsWith(today));
  const goalsWithDaily = state.goals.filter((g) => g.status === 'active' && g.dailyTargetMinutes > 0);

  function resetDailyForm() {
    setReviewDate(today);
    setRAccomplished('');
    setRLearned('');
    setRNotCompleted('');
    setRTomorrow('');
    setEditingReviewDate(null);
    setReviewError('');
  }

  function submitDaily(e: React.FormEvent) {
    e.preventDefault();
    const ok = saveDailyReview({
      date: reviewDate || today,
      accomplished: rAccomplished,
      learned: rLearned,
      notCompleted: rNotCompleted,
      planTomorrow: rTomorrow,
    });
    if (!ok) {
      setReviewError('Answer at least one question before saving.');
      return;
    }
    resetDailyForm();
  }

  function startEditDaily(date: string) {
    const r = (state.dailyReviews ?? []).find((x) => x.date === date);
    if (!r) return;
    setReviewDate(r.date);
    setRAccomplished(r.accomplished);
    setRLearned(r.learned);
    setRNotCompleted(r.notCompleted);
    setRTomorrow(r.planTomorrow);
    setEditingReviewDate(r.date);
    setReviewError('');
  }

  return (
    <div className="space-y-6">
      {/* Greeting (plain, no card) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink sm:text-2xl">Good to see you. Keep the streak alive.</h2>
          <p className="mt-1 text-sm text-ink-muted">
            {streak.loggedToday
              ? `Today is logged. Current streak: ${streak.current} day${streak.current === 1 ? '' : 's'}.`
              : streak.current > 0
                ? `One session today keeps your ${streak.current}-day streak going.`
                : 'Log your first session today to start your streak.'}
          </p>
        </div>
        <Button onClick={() => setShowLog((v) => !v)} className="shrink-0">
          <IconFlame className="h-4 w-4" />
          {streak.loggedToday ? 'Log another session' : 'Log today’s learning'}
        </Button>
      </div>

      <Reminders reminders={reminders} onDismiss={onDismissReminder} go={go} />

      {showLog && (
        <form
          className="grid gap-3 rounded-xl border border-line bg-card p-4 shadow-card sm:grid-cols-[1fr_120px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            const mins = Math.max(0, Math.floor(Number(minutes)) || 0);
            if (mins < 1) return;
            logSession(sessionTitle || 'Learning session', mins);
            setSessionTitle('');
            setMinutes('25');
            setShowLog(false);
          }}
        >
          <Input
            placeholder="What did you learn? e.g. React hooks"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            max={600}
            placeholder="Minutes"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
          <Button type="submit" disabled={Math.max(0, Math.floor(Number(minutes)) || 0) < 1}>Save</Button>
        </form>
      )}

      {/* 1. Today's Progress */}
      <Card>
        <CardHeader
          title="Today's Progress"
          subtitle={`${doneTodayInDue} of ${dueSet.length} tasks done · ${learningToday} learning activities`}
          action={<span className="text-sm font-semibold text-ink">{overallPct}%</span>}
        />
        <div className="space-y-3 p-4">
          <ProgressBar value={overallPct} tone={overallPct === 100 ? 'success' : 'primary'} />
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-surface p-3">
              <p className="text-lg font-bold text-ink">{tasksPct}%</p>
              <p className="text-xs text-ink-muted">Tasks completed</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-lg font-bold text-ink">{learningPct}%</p>
              <p className="text-xs text-ink-muted">Learning completed</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Today's Tasks */}
      <Card>
        <CardHeader
          title="Today's Tasks"
          subtitle={`${pendingTasks.length} pending · ${completedToday.length} completed`}
          action={<ViewAll onClick={() => go('tasks')} />}
        />
        <div className="space-y-2 p-4">
          {pendingTasks.length === 0 && completedToday.length === 0 ? (
            <EmptyState
              title="Nothing due today"
              hint="Add a task to plan your next learning step."
              icon={<IconCheckCircle className="h-5 w-5" />}
              action={<Button size="sm" onClick={() => go('tasks')}>Create your first task</Button>}
            />
          ) : (
            <>
              {pendingTasks.map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => toggleTask(t.id)}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                  />
                  <span className="flex-1 truncate text-sm text-ink" title={t.title}>{t.title}</span>
                  <span className="text-xs text-ink-muted">{formatDate(t.dueDate)}</span>
                </label>
              ))}
              {completedToday.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2.5">
                  <IconCheckCircle className="h-4 w-4 shrink-0 text-success" />
                  <span className="flex-1 truncate text-sm text-ink-muted line-through" title={t.title}>{t.title}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      {/* 3 + 4. Goal + Roadmap */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Learning Goal" action={<ViewAll onClick={() => go('learning')} />} />
          <div className="p-4">
            {!mainGoal ? (
              <EmptyState title="No active goals" hint="Set a learning goal to give your tasks direction." />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <IconBook className="h-4 w-4 shrink-0 text-slate-400" />
                  <p className="truncate text-sm font-semibold text-ink">{mainGoal.title}</p>
                </div>
                {mainGoal.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{mainGoal.description}</p>
                )}
                {mainGoal.deadline && (
                  <p className="mt-1 text-xs text-ink-muted">Target: {formatDate(mainGoal.deadline)}</p>
                )}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>
                      {mainGoal.weeklyTargetMinutes > 0
                        ? `${mainGoalStats?.weekMinutes ?? 0}/${mainGoal.weeklyTargetMinutes} min this week`
                        : `${mainGoalStats?.totalMinutes ?? 0} min logged`}
                    </span>
                    <span className="font-semibold text-ink">{goalPct}%</span>
                  </div>
                  <ProgressBar value={goalPct} tone={goalPct === 100 ? 'success' : 'primary'} />
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Current Roadmap" action={<ViewAll onClick={() => go('roadmaps')} />} />
          <div className="p-4">
            {!activeRoadmap || !currentStep ? (
              <EmptyState title="No active roadmap" hint="Create a roadmap to break a topic into steps." />
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <IconMap className="h-4 w-4 shrink-0 text-slate-400" />
                  <p className="truncate text-sm font-semibold text-ink">{activeRoadmap.title}</p>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {doneSteps.length} completed · 1 current · {remainingCount} remaining
                </p>
                <div className="mt-3 rounded-lg border border-primary-500 bg-primary-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">Current step</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="flex-1 text-sm font-medium text-ink">{currentStep.title}</p>
                    <button
                      onClick={() => toggleRoadmapStep(activeRoadmap.id, currentStep.id)}
                      className="shrink-0 rounded-lg bg-primary-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-primary-700"
                    >
                      Mark done
                    </button>
                  </div>
                  {nextStep && (
                    <p className="mt-1.5 text-xs text-primary-700">Next: {nextStep.title}</p>
                  )}
                </div>
                {doneSteps.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {doneSteps.slice(-3).map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-sm text-ink-muted">
                        <IconCheckCircle className="h-3.5 w-3.5 shrink-0 text-success" />
                        <span className="truncate line-through">{s.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* 5. Streak (plain strip) */}
      <section>
        <SectionTitle title="Streak" action={<ViewAll onClick={() => go('streaks')} />} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-line bg-card px-4 py-3 shadow-card">
          <div className="flex items-center gap-1.5">
            <IconFlame className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-ink-muted">Current:</span>
            <span className="text-sm font-bold text-ink">{streak.current} days</span>
            {streak.loggedToday && <Badge tone="success">Logged today</Badge>}
          </div>
          <div className="text-sm">
            <span className="text-ink-muted">Longest: </span>
            <span className="font-bold text-ink">{streak.longest} days</span>
          </div>
          <div className="text-sm">
            <span className="text-ink-muted">Total learning days: </span>
            <span className="font-bold text-ink">{streak.activeDays}</span>
          </div>
        </div>
      </section>

      {/* Recently updated notes */}
      <section>
        <SectionTitle title="Recently updated notes" action={<ViewAll onClick={() => go('notes')} />} />
        {recentNotes.length === 0 ? (
          <EmptyState title="No notes yet" hint="Write your first learning note to see it here." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {recentNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => go('notes')}
                className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left shadow-card hover:bg-surface"
              >
                <IconNote className="h-5 w-5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {n.pinned ? '★ ' : ''}{n.title}
                  </span>
                  <span className="block truncate text-xs text-ink-muted">
                    {folderById.get(n.folderId)?.name ?? 'Unknown'}
                    {(n.tags ?? []).length > 0 ? ` · #${(n.tags ?? []).slice(0, 2).join(' #')}` : ''} · Updated {formatDate(n.updatedAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 6 + 7. Continue Learning + Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle title="Continue Learning" action={<ViewAll onClick={() => go('library')} />} />
          {folderActivity.length === 0 ? (
            <EmptyState title="No folders yet" hint="Create a folder to organize your notes." />
          ) : (
            <div className="space-y-2">
              {folderActivity.map(({ folder, noteCount }) => (
                <button
                  key={folder.id}
                  onClick={() => go('library')}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-left shadow-card hover:bg-surface"
                >
                  <IconFolder className="h-5 w-5 shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{folder.name}</span>
                    <span className="block text-xs text-ink-muted">
                      {noteCount} {noteCount === 1 ? 'note' : 'notes'}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionTitle title="Recent Activity" action={<ViewAll onClick={() => go('streaks')} />} />
          {recentActivity.length === 0 ? (
            <EmptyState title="No activity yet" hint="Complete a task or log a session to get started." />
          ) : (
            <div className="space-y-2">
              {recentActivity.map((a) => (
                <div key={a.key} className="flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-2.5 shadow-card">
                  <span className="shrink-0">{a.icon}</span>
                  <p className="min-w-0 flex-1 truncate text-sm text-ink">{a.text}</p>
                  <span className="shrink-0 text-xs text-ink-muted">{a.sub}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 8. Daily Review (optional, collapsed by default — never intrusive) */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">Daily Review</h3>
            {todayReview ? <Badge tone="success">Reviewed today</Badge> : <Badge tone="neutral">Not reviewed yet</Badge>}
          </div>
          <button onClick={() => setReviewOpen((v) => !v)} className="text-xs font-medium text-primary-600 hover:text-primary-700">
            {reviewOpen ? 'Hide' : 'Review today'}
          </button>
        </div>
        {reviewOpen && (
          <Card>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div className="rounded-lg bg-surface p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Today&apos;s Plan</p>
                <p className="mt-2 text-xs font-medium text-ink">Planned tasks ({dueSet.length})</p>
                {dueSet.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-muted">No tasks due today.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {dueSet.slice(0, 6).map((t) => (
                      <li key={t.id} className="flex items-center gap-1.5 text-sm text-ink-secondary">
                        <span aria-hidden>{t.done ? '✓' : '○'}</span>
                        <span className={`min-w-0 flex-1 truncate ${t.done ? 'line-through text-ink-muted' : ''}`}>{t.title}</span>
                      </li>
                    ))}
                    {dueSet.length > 6 && <li className="text-xs text-ink-muted">+ {dueSet.length - 6} more</li>}
                  </ul>
                )}
                <p className="mt-3 text-xs font-medium text-ink">Planned learning (your focus)</p>
                {goalsWithDaily.length === 0 && !currentStep ? (
                  <p className="mt-1 text-sm text-ink-muted">No daily targets or roadmap step set.</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {goalsWithDaily.slice(0, 3).map((g) => {
                      const s = goalStats(state.completions, g.id, g.weeklyTargetMinutes);
                      return (
                        <p key={g.id} className="truncate text-sm text-ink-secondary">
                          {g.title} <span className="text-xs text-ink-muted">· {s.todayMinutes}/{g.dailyTargetMinutes} min today</span>
                        </p>
                      );
                    })}
                    {currentStep && activeRoadmap && (
                      <p className="truncate text-sm text-ink-secondary">
                        Step: {currentStep.title} <span className="text-xs text-ink-muted">· {activeRoadmap.title}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-lg bg-surface p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Today&apos;s Reality</p>
                <p className="mt-2 text-sm text-ink-secondary">
                  {doneTasksToday.length} task{doneTasksToday.length === 1 ? '' : 's'} completed · {sessionsToday.length} session{sessionsToday.length === 1 ? '' : 's'} · {minutesLearnedToday} min learned
                </p>
                {doneTasksToday.length === 0 && sessionsToday.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-muted">Nothing completed or logged yet today.</p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {doneTasksToday.slice(0, 4).map((t) => (
                      <li key={t.id} className="flex items-center gap-1.5 text-sm text-ink-secondary">
                        <span aria-hidden>✓</span>
                        <span className="min-w-0 flex-1 truncate line-through">{t.title}</span>
                      </li>
                    ))}
                    {sessionsToday.slice(0, 4).map((c) => (
                      <li key={c.id} className="flex items-center gap-1.5 text-sm text-ink-secondary">
                        <IconFlame className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                        <span className="min-w-0 flex-1 truncate">{c.title} <span className="text-xs text-ink-muted">· {c.minutes} min</span></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <form onSubmit={submitDaily} className="mx-4 mb-4 grid gap-3 rounded-lg bg-surface p-3">
              <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
                <div>
                  <Label>Date</Label>
                  <Input type="date" value={reviewDate} max={today} onChange={(e) => setReviewDate(e.target.value)} />
                </div>
                {editingReviewDate && (
                  <p className="text-xs text-ink-muted">
                    Editing {formatDate(editingReviewDate)}.{' '}
                    <button type="button" onClick={resetDailyForm} className="font-medium text-primary-600 hover:underline">
                      Start new instead
                    </button>
                  </p>
                )}
              </div>
              <div>
                <Label>What did you accomplish today?</Label>
                <Textarea rows={2} placeholder="e.g. Finished 3 tasks, shipped the navbar" value={rAccomplished} onChange={(e) => setRAccomplished(e.target.value)} />
              </div>
              <div>
                <Label>What did you learn today?</Label>
                <Textarea rows={2} placeholder="e.g. How flexbox alignment works" value={rLearned} onChange={(e) => setRLearned(e.target.value)} />
              </div>
              <div>
                <Label>What did you not complete?</Label>
                <Textarea rows={2} placeholder="e.g. Didn't start the grid tutorial" value={rNotCompleted} onChange={(e) => setRNotCompleted(e.target.value)} />
              </div>
              <div>
                <Label>What should you do tomorrow?</Label>
                <Textarea rows={2} placeholder="e.g. Grid tutorial + review notes" value={rTomorrow} onChange={(e) => setRTomorrow(e.target.value)} />
              </div>
              {reviewError && <p className="text-xs text-danger">{reviewError}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  {editingReviewDate ? `Update ${formatDate(editingReviewDate)}` : 'Save daily review'}
                </Button>
                {editingReviewDate && (
                  <Button variant="secondary" onClick={resetDailyForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
            <div className="space-y-2 p-4 pt-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Previous reviews</p>
              {sortedDaily.length === 0 ? (
                <EmptyState title="No reviews yet" hint="Answer the questions above at the end of your day." />
              ) : (
                <>
                  {visibleDaily.map((r) => (
                    <div key={r.date} className="rounded-lg border border-line p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{formatDate(r.date)}</p>
                        <div className="flex shrink-0 gap-1">
                          <button onClick={() => startEditDaily(r.date)} className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50">
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete review for ${formatDate(r.date)}?`)) {
                                deleteDailyReview(r.date);
                                if (editingReviewDate === r.date) resetDailyForm();
                              }
                            }}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                            aria-label={`Delete review for ${r.date}`}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                      {r.accomplished && <p className="mt-1 text-sm text-ink-secondary"><span className="font-medium text-ink">Accomplished: </span>{r.accomplished}</p>}
                      {r.learned && <p className="mt-1 text-sm text-ink-secondary"><span className="font-medium text-ink">Learned: </span>{r.learned}</p>}
                      {r.notCompleted && <p className="mt-1 text-sm text-ink-secondary"><span className="font-medium text-ink">Not completed: </span>{r.notCompleted}</p>}
                      {r.planTomorrow && <p className="mt-1 text-sm text-ink-secondary"><span className="font-medium text-ink">Tomorrow: </span>{r.planTomorrow}</p>}
                    </div>
                  ))}
                  {sortedDaily.length > 14 && (
                    <button onClick={() => setShowAllReviews((v) => !v)} className="w-full py-1 text-center text-xs font-medium text-primary-600 hover:underline">
                      {showAllReviews ? 'Show less' : `Show all ${sortedDaily.length} reviews`}
                    </button>
                  )}
                </>
              )}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
