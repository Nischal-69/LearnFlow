import type { LearnFlowApi } from '../store';
import { Button, Card, CardHeader } from './ui';

export default function Settings({ api }: { api: LearnFlowApi }) {
  const { state, streak, resetAll } = api;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Settings" subtitle="Preferences and data." />
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3 rounded-lg border border-line p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white">
              L
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Learner</p>
              <p className="text-xs text-ink-muted">Plan it. Learn it. Track it. Build the streak.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-surface p-3">
              <p className="text-lg font-bold text-ink">{state.tasks.length}</p>
              <p className="text-xs text-ink-muted">Tasks</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-lg font-bold text-ink">{state.notes.length}</p>
              <p className="text-xs text-ink-muted">Notes</p>
            </div>
            <div className="rounded-lg bg-surface p-3">
              <p className="text-lg font-bold text-ink">{streak.activeDays}</p>
              <p className="text-xs text-ink-muted">Active days</p>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Data" subtitle="Stored locally in your browser (v1)." />
        <div className="p-4">
          <p className="text-sm text-ink-secondary">
            LearnFlow saves tasks, goals, roadmaps, folders, notes and history under the key{' '}
            <code className="rounded bg-surface px-1 text-xs">learnflow-state-v1</code>. Clearing your
            browser data will remove it.
          </p>
          <div className="mt-3">
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm('Delete all LearnFlow data?')) resetAll();
              }}
            >
              Reset all data
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
