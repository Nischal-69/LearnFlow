import { useRef, useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { LearnFlowState, TaskPriority } from '../types';
import { KEYS } from '../data/storage';
import { downloadBackup, hasExistingData, parseBackup } from '../data/backup';
import { Button, Card, CardHeader, Input, Label, Modal } from './ui';

const APP_VERSION = '0.1.0';

const AVATAR_PRESETS = ['🦊', '🐼', '🦁', '🐸', '🦄', '🐝', '🌱', '🚀'];

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

function AvatarFace({ avatar, name, size = 'h-12 w-12 text-xl' }: { avatar: string; name: string; size?: string }) {
  if (avatar.startsWith('data:image')) {
    return <img src={avatar} alt="" className={`${size} rounded-full object-cover`} />;
  }
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-primary-600 font-semibold text-white`}
    >
      {avatar ? <span className="leading-none">{avatar}</span> : (name.trim().charAt(0) || 'L').toUpperCase()}
    </div>
  );
}

/** Downscale an uploaded photo to a small square data-URL so storage stays tiny. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Please choose an image under 5 MB.'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const size = 96;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas unavailable');
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Could not process that image.'));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

export default function Settings({ api }: { api: LearnFlowApi }) {
  const {
    state,
    streak,
    resetAll,
    replaceAll,
    updateUserProfile,
    updateReminderPrefs,
    updateSettings,
  } = api;
  const prefs = state.settings.reminders;

  // ---- Profile drafts (saved explicitly, persisted via the data layer) ----
  const [nameDraft, setNameDraft] = useState(state.user.name);
  const [goalDraft, setGoalDraft] = useState(state.user.learningGoal);
  const [profileSaved, setProfileSaved] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  function saveProfile() {
    updateUserProfile({ name: nameDraft.trim() || state.user.name, learningGoal: goalDraft.trim() });
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 1500);
  }

  async function onAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarError('');
    try {
      updateUserProfile({ avatar: await fileToAvatar(file) });
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not use that image.');
    }
  }

  // ---- Productivity draft ----
  const [targetDraft, setTargetDraft] = useState(
    state.settings.dailyLearningTargetMinutes > 0 ? String(state.settings.dailyLearningTargetMinutes) : '',
  );
  const [targetError, setTargetError] = useState('');

  function saveTarget() {
    const trimmed = targetDraft.trim();
    if (trimmed === '') {
      updateSettings({ dailyLearningTargetMinutes: 0 });
      setTargetError('');
      return;
    }
    const minutes = Math.floor(Number(trimmed));
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      setTargetError('Enter 0–1440 minutes, or leave empty for no target.');
      return;
    }
    updateSettings({ dailyLearningTargetMinutes: minutes });
    setTargetError('');
  }

  // ---- Backup / import / clear ----
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

  const priorities: TaskPriority[] = ['low', 'medium', 'high'];

  return (
    <div className="space-y-4">
      {/* ---------- Profile ---------- */}
      <Card>
        <CardHeader title="Profile" subtitle="How LearnFlow addresses you." />
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-3 rounded-lg border border-line p-4">
            <AvatarFace avatar={state.user.avatar} name={state.user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{state.user.name}</p>
              <p className="truncate text-xs text-ink-muted">
                {state.user.learningGoal ? `Learning: ${state.user.learningGoal}` : 'Plan it. Learn it. Track it. Build the streak.'}
              </p>
            </div>
          </div>

          <div>
            <Label>Avatar</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {AVATAR_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setAvatarError('');
                    updateUserProfile({ avatar: state.user.avatar === emoji ? '' : emoji });
                  }}
                  aria-pressed={state.user.avatar === emoji}
                  aria-label={`Use ${emoji} as avatar`}
                  className={`rounded-lg border px-2 py-1 text-lg leading-none ${
                    state.user.avatar === emoji
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-line bg-white hover:bg-surface'
                  }`}
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => avatarRef.current?.click()}
                className="rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-ink-secondary hover:bg-surface"
              >
                Upload photo…
              </button>
              {state.user.avatar && (
                <button
                  onClick={() => updateUserProfile({ avatar: '' })}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-ink-muted hover:text-danger"
                >
                  Remove
                </button>
              )}
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Upload a profile photo"
                onChange={onAvatarFile}
              />
            </div>
            {avatarError && <p className="mt-1 text-xs text-danger">{avatarError}</p>}
          </div>

          <div>
            <Label>Name</Label>
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name"
              maxLength={40}
            />
          </div>
          <div>
            <Label>Learning goal</Label>
            <Input
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              placeholder="e.g. Conversational Spanish"
              maxLength={200}
            />
            <p className="mt-1 text-xs text-ink-muted">Your current focus — shown here and in reminders.</p>
          </div>
          <div>
            <Button variant="secondary" onClick={saveProfile}>
              {profileSaved ? 'Saved ✓' : 'Save profile'}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1 text-center">
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

      {/* ---------- Appearance ---------- */}
      <Card>
        <CardHeader title="Appearance" subtitle="Light, dark, or follow your system." />
        <div className="p-4">
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((t) => (
              <button
                key={t}
                onClick={() => updateSettings({ theme: t })}
                aria-pressed={state.settings.theme === t}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium capitalize ${
                  state.settings.theme === t
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-line bg-white text-ink-secondary hover:bg-surface'
                }`}
              >
                <span className="block text-base" aria-hidden>
                  {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'}
                </span>
                {t}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            System follows your device setting and updates automatically.
          </p>
        </div>
      </Card>

      {/* ---------- Productivity ---------- */}
      <Card>
        <CardHeader title="Productivity" subtitle="Defaults that shape your daily flow." />
        <div className="space-y-3 p-4">
          <div>
            <Label>Daily learning target (minutes)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                max={1440}
                value={targetDraft}
                onChange={(e) => {
                  setTargetDraft(e.target.value);
                  setTargetError('');
                }}
                placeholder="e.g. 30 (empty = no target)"
              />
              <Button variant="secondary" onClick={saveTarget} className="shrink-0">
                Save
              </Button>
            </div>
            {targetError ? (
              <p className="mt-1 text-xs text-danger">{targetError}</p>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">
                {state.settings.dailyLearningTargetMinutes > 0
                  ? `Currently ${state.settings.dailyLearningTargetMinutes} min/day — shown in your daily reminder.`
                  : 'No daily target set.'}
              </p>
            )}
          </div>
          <div>
            <Label>Default task priority</Label>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map((p) => (
                <button
                  key={p}
                  onClick={() => updateSettings({ defaultTaskPriority: p })}
                  aria-pressed={state.settings.defaultTaskPriority === p}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                    state.settings.defaultTaskPriority === p
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-line bg-white text-ink-secondary hover:bg-surface'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-muted">Pre-selected when you create a new task.</p>
          </div>
        </div>
      </Card>

      {/* ---------- Notifications ---------- */}
      <Card>
        <CardHeader title="Notifications" subtitle="Gentle in-app hints only — never aggressive." />
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
            label="Learning reminders"
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
          <Toggle
            checked={prefs.dailyReview}
            onChange={(v) => updateReminderPrefs({ dailyReview: v })}
            label="Daily review reminders"
            hint="A nudge to reflect on your day."
          />
          <p className="pt-1 text-xs text-ink-muted">
            Stored locally via the centralized data service under{' '}
            <code className="rounded bg-surface px-1">{KEYS.STATE}</code>. Dismissed reminders reappear
            tomorrow if still relevant.
          </p>
        </div>
      </Card>

      {/* ---------- Data ---------- */}
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
              Export data
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              Import data
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
              Clear data
            </Button>
          </div>
        </div>
      </Card>

      {/* ---------- About ---------- */}
      <Card>
        <CardHeader title="About" subtitle="LearnFlow at a glance." />
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-base font-bold text-white">
            L
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">
              LearnFlow <span className="font-normal text-ink-muted">v{APP_VERSION}</span>
            </p>
            <p className="text-xs text-ink-muted">Plan it. Learn it. Track it. Build the streak.</p>
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
