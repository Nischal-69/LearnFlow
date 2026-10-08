import { useRef, useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { LearnFlowState } from '../types';
import { KEYS } from '../data/storage';
import { downloadBackup, hasExistingData, parseBackup } from '../data/backup';
import { Button, Card, CardHeader, Input, Label, Modal } from './ui';

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-xs text-ink-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-indigo-600"
      />
    </label>
  );
}

export default function Settings({ api }: { api: LearnFlowApi }) {
  const { state, streak, resetAll, replaceAll, updateUserName, updateReminderPrefs, updateSettings } = api;
  const prefs = state.settings.reminders;
  const [nameDraft, setNameDraft] = useState(state.user.name);
  const [savedTick, setSavedTick] = useState(false);

  function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === state.user.name) return;
    updateUserName(trimmed);
    setSavedTick(true);
    window.setTimeout(() => setSavedTick(false), 1500);
  }

  type ConfirmState =
    | { kind: 'clear' }
    | { kind: 'import'; fileName: string; parsed: LearnFlowState };

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [backupStatus, setBackupStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function describeBackup(s: LearnFlowState): string {
    const parts: string[] = [];
    if (s.tasks.length > 0) parts.push(`${s.tasks.length} task${s.tasks.length === 1 ? '' : 's'}`);
    if (s.goals.length > 0) parts.push(`${s.goals.length} goal${s.goals.length === 1 ? '' : 's'}`);
    if (s.notes.length > 0) parts.push(`${s.notes.length} note${s.notes.length === 1 ? '' : 's'}`);
    if (s.roadmaps.length > 0)
      parts.push(`${s.roadmaps.length} roadmap${s.roadmaps.length === 1 ? '' : 's'}`);
    return parts.length > 0 ? parts.join(', ') : 'no items';
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBackupStatus(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setBackupStatus({ tone: 'error', text: 'Could not read that file. Please try again.' });
      return;
    }
    const result = parseBackup(text);
    if (!result.ok) {
      setBackupStatus({ tone: 'error', text: result.error });
      return;
    }
    if (hasExistingData(state)) {
      // Never overwrite without explicit confirmation.
      setConfirm({ kind: 'import', fileName: file.name, parsed: result.state });
    } else {
      replaceAll(result.state);
      setBackupStatus({ tone: 'ok', text: 'Backup imported successfully.' });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Settings" subtitle="Preferences and data." />
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3 rounded-lg border border-line p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-600 text-base font-semibold text-white">
              {(state.user.name.trim().charAt(0) || 'L').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{state.user.name}</p>
              <p className="text-xs text-ink-muted">Plan it. Learn it. Track it. Build the streak.</p>
            </div>
          </div>
          <div>
            <Label>User name</Label>
            <div className="flex gap-2">
              <Input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your name"
                maxLength={40}
              />
              <Button variant="secondary" onClick={saveName}>
                Save{savedTick ? 'd' : ''}
              </Button>
            </div>
          </div>
          <div>
            <Label>Theme</Label>
            <div className="flex gap-2">
              {(['system', 'light', 'dark'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => updateSettings({ theme: t })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                    state.settings.theme === t
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-line bg-white text-ink-secondary hover:bg-surface'
                  }`}
                >
                  {t}
                </button>
              ))}
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
        <CardHeader title="Reminders" subtitle="Gentle in-app hints only — never aggressive." />
        <div className="space-y-2 p-4">
          <Toggle
            checked={prefs.enabled}
            onChange={(v) => updateReminderPrefs({ enabled: v })}
            label="Enable reminders"
            hint="Master switch. Off hides every reminder."
          />
          <Toggle
            checked={prefs.dailyLearning}
            onChange={(v) => updateReminderPrefs({ dailyLearning: v })}
            label="Daily learning reminder"
            hint="You haven't logged learning today."
          />
          <Toggle
            checked={prefs.tasks}
            onChange={(v) => updateReminderPrefs({ tasks: v })}
            label="Task reminders"
            hint="Due today, tomorrow, or overdue — one gentle line."
          />
          <Toggle
            checked={prefs.roadmaps}
            onChange={(v) => updateReminderPrefs({ roadmaps: v })}
            label="Roadmap reminders"
            hint="Nudge toward your current roadmap step."
          />
          <p className="pt-1 text-xs text-ink-muted">
            Stored locally via the centralized data service under{' '}
            <code className="rounded bg-surface px-1">{KEYS.STATE}</code>. Dismissed reminders reappear
            tomorrow if still relevant.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Data" subtitle="Backup, restore, or clear your data." />
        <div className="space-y-3 p-4">
          <p className="text-sm text-ink-secondary">Your data is stored locally in this browser.</p>
          <p className="text-sm text-ink-secondary">
            LearnFlow saves tasks, goals, roadmaps, folders, notes, resources, sessions, reviews,
            streak history, user and settings under the key{' '}
            <code className="rounded bg-surface px-1 text-xs">{KEYS.STATE}</code>. Refreshing never
            deletes it. Clearing your browser data will remove it.
          </p>
          {backupStatus && (
            <p
              role={backupStatus.tone === 'error' ? 'alert' : 'status'}
              className={`rounded-lg px-3 py-2 text-sm ${
                backupStatus.tone === 'error'
                  ? 'bg-danger-bg text-danger'
                  : 'bg-success-bg text-success'
              }`}
            >
              {backupStatus.text}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => downloadBackup(state)}>
              Export as JSON
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Import JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-label="Choose a LearnFlow backup file to import"
              onChange={onImportFile}
            />
            <Button variant="danger" onClick={() => setConfirm({ kind: 'clear' })}>
              Clear all local data
            </Button>
          </div>
        </div>
      </Card>

      {confirm?.kind === 'clear' && (
        <Modal title="Clear all local data?" onClose={() => setConfirm(null)}>
          <p className="text-sm text-ink-secondary">
            This permanently deletes everything stored in this browser — tasks, goals, roadmaps,
            notes, sessions, reviews and settings. This cannot be undone.
          </p>
          <p className="mt-2 text-sm text-ink-secondary">
            Tip: export a JSON backup first so you can restore later.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)} className="flex-1">
              Keep my data
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => {
                resetAll();
                setConfirm(null);
                setBackupStatus({ tone: 'ok', text: 'All local data was cleared.' });
              }}
            >
              Yes, delete everything
            </Button>
          </div>
        </Modal>
      )}

      {confirm?.kind === 'import' && (
        <Modal title="Replace existing data?" onClose={() => setConfirm(null)}>
          <p className="text-sm text-ink-secondary">
            The backup <span className="font-medium text-ink">“{confirm.fileName}”</span> contains{' '}
            {describeBackup(confirm.parsed)}. Importing will replace everything currently stored in
            this browser. This cannot be undone.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)} className="flex-1">
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                replaceAll(confirm.parsed);
                setConfirm(null);
                setBackupStatus({ tone: 'ok', text: 'Backup imported successfully.' });
              }}
            >
              Replace my data
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
