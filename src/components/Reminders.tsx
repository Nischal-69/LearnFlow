import type { ViewKey } from '../types';
import type { Reminder } from '../reminders';

function kindLabel(kind: Reminder['kind']): string {
  if (kind === 'streak') return 'Streak';
  if (kind === 'daily') return 'Daily';
  if (kind === 'task') return 'Tasks';
  return 'Roadmap';
}

export default function Reminders({
  reminders,
  onDismiss,
  go,
}: {
  reminders: Reminder[];
  onDismiss: (id: string) => void;
  go: (v: ViewKey) => void;
}) {
  if (reminders.length === 0) return null;
  return (
    <section aria-label="Gentle reminders" className="rounded-xl border border-line bg-card px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Gentle reminders</p>
      <ul className="mt-2 space-y-2">
        {reminders.map((r) => (
          <li
            key={r.id}
            className="flex items-start gap-3 rounded-lg bg-surface px-3 py-2.5"
          >
            <span className="mt-0.5 shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
              {kindLabel(r.kind)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-ink">{r.message}</span>
              {r.detail && <span className="block truncate text-xs text-ink-muted">{r.detail}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {r.go && (
                <button
                  onClick={() => r.go && go(r.go)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                >
                  View
                </button>
              )}
              <button
                onClick={() => onDismiss(r.id)}
                className="rounded-md px-2 py-1 text-xs text-ink-muted hover:bg-slate-100 hover:text-ink"
                aria-label={`Dismiss: ${r.message}`}
              >
                Dismiss
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
