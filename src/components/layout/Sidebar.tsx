import type { ViewKey } from '../../types';
import { NAV_SECTIONS } from './nav';

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <div>
        <p className="text-base font-bold leading-none text-ink">LearnFlow</p>
        <p className="mt-0.5 text-[11px] leading-none text-ink-muted">Build the streak.</p>
      </div>
    </div>
  );
}

export default function Sidebar({
  view,
  onNavigate,
}: {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-2 pt-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = view === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-ink-secondary hover:bg-surface hover:text-ink'
                    }`}
                  >
                    {item.icon('h-5 w-5 shrink-0')}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line px-4 py-3">
        <p className="text-xs text-ink-muted">Data stays in your browser (v1).</p>
      </div>
    </div>
  );
}
