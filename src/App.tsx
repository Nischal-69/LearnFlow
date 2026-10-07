import { useState } from 'react';
import type { ViewKey } from './types';
import { useLearnFlow } from './store';
import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import Learning from './components/Learning';
import Roadmaps from './components/Roadmaps';
import Streaks from './components/Streaks';
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

  function navigate(v: ViewKey) {
    setView(v);
    setDrawerOpen(false);
  }

  return (
    <div className="min-h-screen bg-surface text-ink">
      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-line bg-card md:block">
        <Sidebar view={view} onNavigate={navigate} />
      </aside>

      {/* Content column */}
      <div className="flex min-h-screen flex-col md:pl-64">
        <TopHeader view={view} api={api} search={search} onSearch={setSearch} onMenu={() => setDrawerOpen(true)} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 md:pb-10">
          {view === 'dashboard' && <Dashboard api={api} go={navigate} search={search} />}
          {view === 'tasks' && <Tasks api={api} search={search} />}
          {view === 'roadmaps' && <Roadmaps api={api} search={search} />}
          {view === 'learning' && <Learning api={api} search={search} />}
          {view === 'streaks' && <Streaks api={api} />}
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

      {/* Mobile bottom nav */}
      <BottomNav view={view} onNavigate={navigate} onMore={() => setDrawerOpen(true)} />
    </div>
  );
}
