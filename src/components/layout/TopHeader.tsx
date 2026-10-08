import { useEffect, useRef, useState } from 'react';
import { IconBell, IconMenu, IconSearch } from '../icons';
import { PAGE_META } from './nav';
import type { ViewKey } from '../../types';
import type { LearnFlowApi } from '../../store';
import type { Reminder } from '../../reminders';
import { formatDate, todayString } from '../../utils';

export default function TopHeader({
  view,
  api,
  search,
  onSearch,
  onMenu,
  onOpenSearch,
  reminders,
  onDismissReminder,
  onNavigate,
}: {
  view: ViewKey;
  api: LearnFlowApi;
  search: string;
  onSearch: (v: string) => void;
  onMenu: () => void;
  onOpenSearch: () => void;
  reminders: Reminder[];
  onDismissReminder: (id: string) => void;
  onNavigate: (v: ViewKey) => void;
}) {
  const meta = PAGE_META[view];
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const today = todayString();
  const todaysCount = api.state.completions.filter((c) => c.date === today).length;
  const recent = api.state.completions.slice(0, 5);
  const hasDot = reminders.length > 0;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setNotifOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
        <button
          onClick={onMenu}
          className="rounded-lg p-2 text-ink-secondary hover:bg-surface md:hidden"
          aria-label="Open navigation menu"
        >
          <IconMenu />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-ink sm:text-lg">{meta.title}</h1>
          <p className="hidden truncate text-xs text-ink-muted sm:block">{meta.subtitle}</p>
        </div>

        {/* Desktop search (view filter) + global search hint */}
        <div className="relative hidden w-56 sm:block lg:w-64">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-14 text-sm text-ink placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
          <button
            onClick={onOpenSearch}
            title="Global search (Ctrl+K)"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-1.5 py-0.5 text-[11px] text-ink-muted hover:text-ink"
          >
            Ctrl K
          </button>
        </div>

        {/* Mobile search toggle */}
        <button
          onClick={() => setMobileSearch((v) => !v)}
          className="rounded-lg p-2 text-ink-secondary hover:bg-surface sm:hidden"
          aria-label="Search"
        >
          <IconSearch />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative rounded-lg p-2 text-ink-secondary hover:bg-surface"
            aria-label="Notifications"
          >
            <IconBell />
            {hasDot && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-600" />}
          </button>
          {notifOpen && (
            <div className="absolute right-0 mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-line bg-card p-2 shadow-lg">
              {reminders.length > 0 ? (
                <>
                  <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                    Gentle reminders
                  </p>
                  {reminders.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (r.go) onNavigate(r.go);
                        setNotifOpen(false);
                      }}
                      className="w-full rounded-lg bg-surface px-2 py-1.5 text-left hover:bg-slate-100"
                    >
                      <p className="text-sm text-ink">{r.message}</p>
                      {r.detail && <p className="truncate text-[11px] text-ink-muted">{r.detail}</p>}
                    </button>
                  ))}
                  <div className="mx-2 my-2 border-t border-line" />
                </>
              ) : (
                <p className="px-2 py-1 text-xs text-ink-muted">All caught up. Nothing nudging you.</p>
              )}
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {todaysCount} {todaysCount === 1 ? 'activity' : 'activities'} today
              </p>
              {recent.length === 0 ? (
                <p className="px-2 py-3 text-sm text-ink-muted">Nothing logged yet.</p>
              ) : (
                recent.map((c) => (
                  <div key={c.id} className="rounded-lg px-2 py-1.5 hover:bg-surface">
                    <p className="truncate text-sm text-ink">{c.title}</p>
                    <p className="text-[11px] text-ink-muted">{formatDate(c.date)}</p>
                  </div>
                ))
              )}
              {reminders.length > 0 && (
                <button
                  onClick={() => {
                    reminders.forEach((r) => onDismissReminder(r.id));
                    setNotifOpen(false);
                  }}
                  className="mt-1 w-full rounded-lg px-2 py-1.5 text-center text-xs font-medium text-ink-muted hover:bg-surface hover:text-ink"
                >
                  Dismiss reminders until tomorrow
                </button>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary-600 text-sm font-semibold text-white"
          title={api.state.user.name || 'Your profile'}
        >
          {api.state.user.avatar.startsWith('data:image') ? (
            <img src={api.state.user.avatar} alt="" className="h-full w-full object-cover" />
          ) : api.state.user.avatar ? (
            <span className="text-base leading-none">{api.state.user.avatar}</span>
          ) : (
            (api.state.user.name.trim().charAt(0) || 'L').toUpperCase()
          )}
        </div>
      </div>

      {/* Mobile expanding search */}
      {mobileSearch && (
        <div className="border-t border-line px-4 py-2 sm:hidden">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search tasks, notes, goals…"
              className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-3 text-sm text-ink placeholder:text-slate-400 focus:border-primary-500 focus:outline-none"
            />
          </div>
          <button
            onClick={() => {
              setMobileSearch(false);
              onOpenSearch();
            }}
            className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-secondary"
          >
            Search everything…
          </button>
        </div>
      )}
    </header>
  );
}
