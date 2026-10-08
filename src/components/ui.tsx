import type { ReactNode } from 'react';
import { IconClose } from './icons';

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-card shadow-card ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  className = '',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
}) {
  const sizes = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm';
  const styles =
    variant === 'primary'
      ? 'bg-primary-600 text-white hover:bg-primary-700'
      : variant === 'secondary'
        ? 'border border-line bg-white text-ink hover:bg-surface'
        : variant === 'danger'
          ? 'bg-danger-bg text-danger hover:bg-red-100'
          : 'text-ink-secondary hover:bg-slate-100';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${sizes} ${styles} ${FOCUS_RING} ${className}`}
    >
      {children}
    </button>
  );
}

/** Small text-button for secondary actions like Edit. */
export function LinkButton({
  children,
  onClick,
  className = '',
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`rounded-md px-2 py-1 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 ${FOCUS_RING} ${className}`}
    >
      {children}
    </button>
  );
}

/** Icon-only button, e.g. delete actions. */
export function IconButton({
  children,
  onClick,
  label,
  title,
  tone = 'danger',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  title?: string;
  tone?: 'danger' | 'muted';
  className?: string;
}) {
  const styles =
    tone === 'danger'
      ? 'text-slate-400 hover:bg-red-50 hover:text-danger'
      : 'text-slate-400 hover:bg-surface hover:text-ink';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={title ?? label}
      className={`rounded-md p-1.5 transition-colors ${styles} ${FOCUS_RING} ${className}`}
    >
      {children}
    </button>
  );
}

/** Filter pill for list filters. */
export function Pill({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${FOCUS_RING} ${
        active ? 'bg-ink text-white' : 'bg-slate-100 text-ink-secondary hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

/** Segmented single-select (theme, priority, …). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${FOCUS_RING} ${
            value === opt
              ? 'border-primary-600 bg-primary-50 text-primary-700'
              : 'border-line bg-white text-ink-secondary hover:bg-surface'
          }`}
        >
          {opt === 'in_progress' ? 'In Progress' : opt}
        </button>
      ))}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 hover:border-slate-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 ${props.className ?? ''}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 hover:border-slate-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-line bg-white px-2.5 py-2 text-sm text-ink hover:border-slate-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 ${props.className ?? ''}`}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">{children}</label>;
}

export function ProgressBar({ value, tone = 'primary' }: { value: number; tone?: 'primary' | 'success' }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full transition-all ${tone === 'success' ? 'bg-success' : 'bg-primary-600'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string;
  hint: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center">
      {icon && <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink-muted">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{hint}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary' }) {
  const map: Record<string, string> = {
    neutral: 'bg-slate-100 text-slate-600',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
    danger: 'bg-danger-bg text-danger',
    primary: 'bg-primary-50 text-primary-700',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-line bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className={`rounded-md p-1.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink ${FOCUS_RING}`} aria-label="Close">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
