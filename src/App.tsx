import { useEffect, useMemo, useState } from 'react';
import type { ViewKey } from './types';
import { useLearnFlow } from './store';
import { useDismissedReminders } from './data';
import { buildReminders, filterDismissed } from './reminders';
import SearchOverlay from './components/SearchOverlay';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import Learning from './components/Learning';
import Roadmaps from './components/Roadmaps';
import Streaks from './components/Streaks';
import Progress from './components/Progress';
import Library from './components/Library';
import Folders from './components/Folders';
import Notes from './components/Notes';
import Resources from './components/Resources';
import Settings from './components/Settings';
import Sidebar from './components/layout/Sidebar';
import TopHeader from './components/layout/TopHeader';
import BottomNav from './components/layout/BottomNav';
import { IconClose } from './components/icons';

export default function App() {
  const api = useLearnFlow();
  const [view, setView] = useState<ViewKey>('dashboard');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');

  // Centralized data layer owns persistence; App only derives view state.
  // Reminder prefs live in settings (migrated from the legacy standalone key).
  const prefs = api.state.settings.reminders;
  const [dismissed, dismissReminder] = useDismissedReminders();
  const reminders = useMemo(
    () => filterDismissed(buildReminders(api.state, api.streak, prefs), dismissed),
    [api.state, api.streak, prefs, dismissed],
  );

  // Apply Light / Dark / System appearance to the document root.
  const theme = api.state.settings.theme;
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    if (theme === 'system') {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  function navigate(v: ViewKey) {
    setView(v);
    setDrawerOpen(false);
  }

  function openPalette() {
    setPaletteQuery(search);
    setPaletteOpen(true);
  }

  function selectGlobal(v: ViewKey, q: string) {
    setSearch(q);
    navigate(v);
    setPaletteOpen(false);
  }

  // Global search shortcut: Ctrl/Cmd+K opens, Esc closes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openPalette();
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [search]);

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-card md:block">
        <Sidebar view={view} onNavigate={navigate} />
      </aside>

      {/* Content column */}
      <div className="flex min-h-screen flex-col md:pl-64">
        <TopHeader view={view} api={api} search={search} onSearch={setSearch} onMenu={() => setDrawerOpen(true)} onOpenSearch={openPalette} reminders={reminders} onDismissReminder={dismissReminder} onNavigate={navigate} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-10">
          {view === 'dashboard' && <Dashboard api={api} go={navigate} search={search} reminders={reminders} onDismissReminder={dismissReminder} />}
          {view === 'tasks' && <Tasks api={api} search={search} />}
          {view === 'roadmaps' && <Roadmaps api={api} search={search} />}
          {view === 'learning' && <Learning api={api} search={search} />}
          {view === 'streaks' && <Streaks api={api} />}
          {view === 'progress' && <Progress api={api} />}
          {view === 'library' && <Library api={api} search={search} />}
          {view === 'folders' && <Folders api={api} search={search} />}
          {view === 'notes' && <Notes api={api} search={search} />}
          {view === 'resources' && <Resources api={api} search={search} go={navigate} />}
          {view === 'settings' && <Settings api={api} />}
        </main>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-card shadow-lg">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-3 rounded-lg p-2 text-ink-secondary hover:bg-surface"
              aria-label="Close navigation menu"
            >
              <IconClose />
            </button>
            <Sidebar view={view} onNavigate={navigate} />
          </div>
        </div>
      )}

      {/* Global search overlay */}
      {paletteOpen && (
        <SearchOverlay
          api={api}
          query={paletteQuery}
          onQuery={setPaletteQuery}
          onSelect={selectGlobal}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Mobile bottom nav */}
      <BottomNav view={view} onNavigate={navigate} onMore={() => setDrawerOpen(true)} />
    </div>
  );
}
