import { useState } from 'react';
import type { ViewKey } from './types';
import { useLearnFlow } from './store';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import Goals from './components/Goals';
import Roadmaps from './components/Roadmaps';
import Library from './components/Library';
import History from './components/History';
import { IconFlame, IconFolder, IconHistory, IconHome, IconMap, IconTarget, IconCheckCircle } from './components/icons';

const NAV: { key: ViewKey; label: string; icon: (c: string) => JSX.Element }[] = [
  { key: 'today', label: 'Today', icon: (c) => <IconHome className={c} /> },
  { key: 'tasks', label: 'Tasks', icon: (c) => <IconCheckCircle className={c} /> },
  { key: 'goals', label: 'Goals', icon: (c) => <IconTarget className={c} /> },
  { key: 'roadmaps', label: 'Roadmaps', icon: (c) => <IconMap className={c} /> },
  { key: 'library', label: 'Library', icon: (c) => <IconFolder className={c} /> },
  { key: 'history', label: 'History', icon: (c) => <IconHistory className={c} /> },
];

export default function App() {
  const api = useLearnFlow();
  const [view, setView] = useState<ViewKey>('today');
  const { streak, resetAll } = api;

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            </div>
            <div>
              <p className="text-base font-bold leading-none">LearnFlow</p>
              <p className="mt-0.5 hidden text-[11px] text-ink-muted sm:block">Plan it. Learn it. Track it. Build the streak.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${streak.loggedToday ? 'bg-success-bg text-success' : 'bg-orange-50 text-orange-600'}`}
              title={streak.loggedToday ? 'Today is logged' : 'Log today to keep your streak'}
            >
              <IconFlame className="h-4 w-4" />
              {streak.current}
              <span className="hidden font-normal sm:inline">{streak.current === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-ink-secondary sm:block">
              Best: {streak.longest}
            </div>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="border-t border-line md:hidden">
          <div className="mx-auto grid max-w-6xl grid-cols-6 px-2">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${view === n.key ? 'text-primary-600' : 'text-ink-muted'}`}
              >
                {n.icon('h-5 w-5')}
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-52 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1 rounded-xl border border-line bg-card p-2 shadow-card">
            {NAV.map((n) => (
              <button
                key={n.key}
                onClick={() => setView(n.key)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${view === n.key ? 'bg-primary-50 text-primary-700' : 'text-ink-secondary hover:bg-surface'}`}
              >
                {n.icon('h-5 w-5')}
                {n.label}
              </button>
            ))}
            <div className="border-t border-line p-3">
              <p className="text-xs text-ink-muted">Data is stored locally in your browser (v1).</p>
              <button
                onClick={() => { if (window.confirm('Delete all LearnFlow data?')) resetAll(); }}
                className="mt-2 text-xs font-medium text-danger hover:underline"
              >
                Reset all data
              </button>
            </div>
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 pb-16 md:pb-8">
          {view === 'today' && <Dashboard api={api} go={(v) => setView(v)} />}
          {view === 'tasks' && <Tasks api={api} />}
          {view === 'goals' && <Goals api={api} />}
          {view === 'roadmaps' && <Roadmaps api={api} />}
          {view === 'library' && <Library api={api} />}
          {view === 'history' && <History api={api} />}

          <footer className="mt-8 text-center text-xs text-ink-muted md:hidden">
            <button onClick={() => { if (window.confirm('Delete all LearnFlow data?')) resetAll(); }} className="font-medium text-danger">
              Reset all data
            </button>
            <p className="mt-1">LearnFlow — data stays in your browser.</p>
          </footer>
        </main>
      </div>
    </div>
  );
}
