import { useMemo } from 'react';
import type { LearnFlowApi } from '../store';
import { normalizeRoadmapStep } from '../store';
import { formatDate, formatShort, last7Days, parseDateOnly, toISODate, todayString } from '../utils';
import { Badge, Card, CardHeader, EmptyState } from './ui';
import { IconFlame } from './icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHours(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes} min`;
  return `${(totalMinutes / 60).toFixed(1)} h`;
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(toISODate(d));
  }
  return out;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-muted">{sub}</p>}
    </Card>
  );
}

function Bars({ values, labels, titles }: { values: number[]; labels: string[]; titles: string[] }) {
  const max = Math.max(0, ...values);
  return (
    <div className="flex h-32 items-end gap-2">
      {values.map((v, i) => {
        const pct = max > 0 ? Math.round((v / max) * 100) : 0;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              title={titles[i]}
              className={`w-full rounded-t-md ${v > 0 ? 'bg-primary-600' : 'bg-slate-100'}`}
              style={{ height: `${v > 0 ? Math.max(8, pct) : 6}%`, maxHeight: '100%', minHeight: v > 0 ? 8 : 6 }}
            />
            <span className="truncate text-[10px] text-ink-muted">{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Progress({ api }: { api: LearnFlowApi }) {
  const { state, streak } = api;

  const sessions = useMemo(() => state.completions.filter((c) => c.kind === 'session'), [state.completions]);
  const totalMinutes = useMemo(() => sessions.reduce((a, c) => a + Math.max(0, c.minutes || 0), 0), [sessions]);

  const tasksCompleted = state.tasks.filter((t) => t.done).length;
  const goalsCompleted = state.goals.filter((g) => g.status === 'completed').length;
  const roadmapsCompleted = state.roadmaps.filter(
    (r) => r.steps.length > 0 && r.steps.map(normalizeRoadmapStep).every((s) => s.status === 'completed'),
  ).length;

  // ---- 7-day activity ----
  const days7 = useMemo(() => last7Days(), []);
  const minutes7 = days7.map((d) => streak.minutesByDate[d] ?? 0);
  const total7 = minutes7.reduce((a, b) => a + b, 0);

  // ---- 30-day activity ----
  const days30 = useMemo(() => lastNDays(30), []);
  const minutes30 = days30.map((d) => streak.minutesByDate[d] ?? 0);
  const total30 = minutes30.reduce((a, b) => a + b, 0);
  const active30 = minutes30.filter((m) => m > 0).length;

  // ---- weekly learning time (last 8 weeks, 7-day windows ending today) ----
  const weeks = useMemo(() => {
    const today = todayString();
    const out: { label: string; title: string; minutes: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      const sKey = toISODate(start);
      const eKey = toISODate(end);
      let minutes = 0;
      for (const c of sessions) {
        if (c.date >= sKey && c.date <= eKey) minutes += Math.max(0, c.minutes || 0);
      }
      out.push({
        label: formatShort(sKey),
        title: `${formatDate(sKey)} → ${eKey === today ? 'today' : formatDate(eKey)} — ${minutes} min`,
        minutes,
      });
    }
    return out;
  }, [sessions]);

  // ---- task completion ----
  const todoCount = state.tasks.filter((t) => !t.done && (t.status ?? 'todo') === 'todo').length;
  const inProgressCount = state.tasks.filter((t) => !t.done && t.status === 'in_progress').length;
  const taskTotal = state.tasks.length;
  const taskPct = (n: number) => (taskTotal > 0 ? Math.round((n / taskTotal) * 100) : 0);

  // ---- highlights ----
  const productiveDay = useMemo(() => {
    if (sessions.length === 0) return null;
    const byDay = [0, 0, 0, 0, 0, 0, 0];
    for (const c of sessions) {
      try {
        byDay[parseDateOnly(c.date).getDay()] += Math.max(0, c.minutes || 0);
      } catch {
        // ignore malformed dates
      }
    }
    let best = 0;
    for (let i = 1; i < 7; i++) if (byDay[i] > byDay[best]) best = i;
    if (byDay[best] <= 0) return null;
    return { day: WEEKDAYS[best], minutes: byDay[best] };
  }, [sessions]);

  const topGoal = useMemo(() => {
    const byGoal = new Map<string, number>();
    for (const c of sessions) {
      if (!c.goalId) continue;
      byGoal.set(c.goalId, (byGoal.get(c.goalId) ?? 0) + Math.max(0, c.minutes || 0));
    }
    let bestId: string | null = null;
    let bestMin = 0;
    for (const [id, min] of byGoal) {
      if (min > bestMin) {
        bestMin = min;
        bestId = id;
      }
    }
    if (!bestId) return null;
    const goal = state.goals.find((g) => g.id === bestId);
    return { title: goal?.title ?? 'Unknown goal', minutes: bestMin };
  }, [sessions, state.goals]);

  const topFolder = useMemo(() => {
    if (state.notes.length === 0) return null;
    const counts = new Map<string, { count: number; latest: string }>();
    for (const n of state.notes) {
      const cur = counts.get(n.folderId) ?? { count: 0, latest: '' };
      counts.set(n.folderId, {
        count: cur.count + 1,
        latest: n.updatedAt > cur.latest ? n.updatedAt : cur.latest,
      });
    }
    let bestId: string | null = null;
    let bestCount = 0;
    let bestLatest = '';
    for (const [id, v] of counts) {
      if (v.count > bestCount || (v.count === bestCount && v.latest > bestLatest)) {
        bestId = id;
        bestCount = v.count;
        bestLatest = v.latest;
      }
    }
    if (!bestId) return null;
    const folder = state.folders.find((f) => f.id === bestId);
    return { name: folder?.name ?? 'Unknown folder', count: bestCount };
  }, [state.notes, state.folders]);

  const hasActivity = sessions.length > 0;

  return (
    <div className="space-y-6">
      {/* headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Total learning time" value={formatHours(totalMinutes)} sub={`${totalMinutes} min · ${sessions.length} sessions`} />
        <Stat label="Total learning days" value={String(streak.activeDays)} sub="Days with a session" />
        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-ink-muted">
            <IconFlame className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-medium uppercase tracking-wide">Current streak</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-ink">{streak.current} <span className="text-sm font-medium text-ink-muted">days</span></p>
          <div className="mt-1.5">
            {streak.loggedToday ? <Badge tone="success">Logged today</Badge> : <span className="text-xs text-ink-muted">Log a session today</span>}
          </div>
        </Card>
        <Stat label="Longest streak" value={`${streak.longest} days`} sub={streak.longestStart && streak.longestEnd ? `${formatDate(streak.longestStart)} → ${formatDate(streak.longestEnd)}` : 'Personal best'} />
        <Stat label="Tasks completed" value={String(tasksCompleted)} sub={`of ${state.tasks.length} tasks`} />
        <Stat label="Goals completed" value={String(goalsCompleted)} sub={`of ${state.goals.length} goals`} />
        <Stat label="Roadmaps completed" value={String(roadmapsCompleted)} sub={`of ${state.roadmaps.length} roadmaps`} />
        <Stat label="Notes created" value={String(state.notes.length)} sub={state.folders.length > 0 ? `in ${state.folders.length} folders` : undefined} />
      </div>

      {/* activity charts */}
      <Card>
        <CardHeader title="Last 7 days" subtitle={`${formatHours(total7)} learned · ${minutes7.filter((m) => m > 0).length} active days`} />
        <div className="p-4 sm:p-5">
          {!hasActivity ? (
            <EmptyState title="No learning yet" hint="Log a learning session to see your 7-day activity." />
          ) : (
            <Bars
              values={minutes7}
              labels={days7.map((d) => formatShort(d))}
              titles={days7.map((d, i) => `${formatDate(d)} — ${minutes7[i]} min`)}
            />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Last 30 days" subtitle={`${formatHours(total30)} learned · ${active30} active days`} />
        <div className="p-4 sm:p-5">
          {!hasActivity ? (
            <EmptyState title="No learning yet" hint="Your 30-day trend will appear here." />
          ) : (
            <>
              <div className="flex h-24 items-end gap-[3px]">
                {minutes30.map((v, i) => (
                  <div
                    key={days30[i]}
                    title={`${formatDate(days30[i])} — ${v} min`}
                    className={`min-w-0 flex-1 rounded-t ${v > 0 ? 'bg-primary-600' : 'bg-slate-100'}`}
                    style={{ height: `${v > 0 ? Math.max(6, Math.round((v / Math.max(1, ...minutes30)) * 100)) : 4}%`, minHeight: 4 }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-ink-muted">
                <span>{formatShort(days30[0])}</span>
                <span>{formatShort(days30[days30.length - 1])}</span>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Weekly learning time" subtitle="Minutes per 7-day window · last 8 weeks" />
        <div className="p-4 sm:p-5">
          {!hasActivity ? (
            <EmptyState title="No learning yet" hint="Weekly totals will appear once you log sessions." />
          ) : (
            <Bars values={weeks.map((w) => w.minutes)} labels={weeks.map((w) => w.label)} titles={weeks.map((w) => w.title)} />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Task completion" subtitle={taskTotal === 0 ? 'No tasks yet' : `${tasksCompleted} of ${taskTotal} done`} />
        <div className="p-4 sm:p-5">
          {taskTotal === 0 ? (
            <EmptyState title="No tasks yet" hint="Add a task to track completion here." />
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-success" style={{ width: `${taskPct(tasksCompleted)}%` }} title={`Completed: ${tasksCompleted}`} />
                <div className="h-full bg-primary-600" style={{ width: `${taskPct(inProgressCount)}%` }} title={`In progress: ${inProgressCount}`} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span><strong className="text-ink">{tasksCompleted}</strong> completed ({taskPct(tasksCompleted)}%)</span>
                <span><strong className="text-ink">{inProgressCount}</strong> in progress</span>
                <span><strong className="text-ink">{todoCount}</strong> to do</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* highlights */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Most productive day</p>
          {productiveDay ? (
            <>
              <p className="mt-1 text-xl font-bold text-ink">{productiveDay.day}</p>
              <p className="mt-1 text-xs text-ink-muted">{formatHours(productiveDay.minutes)} total</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">Log sessions to find out.</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Most studied goal</p>
          {topGoal ? (
            <>
              <p className="mt-1 truncate text-xl font-bold text-ink" title={topGoal.title}>{topGoal.title}</p>
              <p className="mt-1 text-xs text-ink-muted">{formatHours(topGoal.minutes)} logged</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">Link sessions to a goal.</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Most active folder</p>
          {topFolder ? (
            <>
              <p className="mt-1 truncate text-xl font-bold text-ink" title={topFolder.name}>{topFolder.name}</p>
              <p className="mt-1 text-xs text-ink-muted">{topFolder.count} {topFolder.count === 1 ? 'note' : 'notes'}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">Create a note to begin.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
