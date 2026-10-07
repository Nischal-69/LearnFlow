import type { ViewKey } from '../../types';
import { BOTTOM_NAV_KEYS, findNavItem } from './nav';
import { IconSettings } from '../icons';

export default function BottomNav({
  view,
  onNavigate,
  onMore,
}: {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  onMore: () => void;
}) {
  const inBottom = (BOTTOM_NAV_KEYS as ViewKey[]).includes(view);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card md:hidden">
      <div className="grid grid-cols-6 px-1">
        {BOTTOM_NAV_KEYS.map((key) => {
          const item = findNavItem(key)!;
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? 'text-primary-600' : 'text-ink-muted'
              }`}
            >
              {item.icon('h-5 w-5')}
              {item.label}
            </button>
          );
        })}
        <button
          onClick={onMore}
          className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
            !inBottom ? 'text-primary-600' : 'text-ink-muted'
          }`}
          aria-label="More sections"
        >
          <IconSettings className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
