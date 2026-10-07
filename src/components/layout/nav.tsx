import type { ViewKey } from '../../types';
import {
  IconHome,
  IconCheckCircle,
  IconMap,
  IconBook,
  IconFlame,
  IconFolder,
  IconNote,
  IconBookmark,
  IconSettings,
} from '../icons';

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: (className: string) => JSX.Element;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Main',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: (c) => <IconHome className={c} /> },
      { key: 'tasks', label: 'Tasks', icon: (c) => <IconCheckCircle className={c} /> },
      { key: 'roadmaps', label: 'Roadmaps', icon: (c) => <IconMap className={c} /> },
      { key: 'learning', label: 'Learning', icon: (c) => <IconBook className={c} /> },
      { key: 'streaks', label: 'Streaks', icon: (c) => <IconFlame className={c} /> },
    ],
  },
  {
    title: 'Library',
    items: [
      { key: 'library', label: 'Learning Library', icon: (c) => <IconFolder className={c} /> },
      { key: 'folders', label: 'My Folders', icon: (c) => <IconFolder className={c} /> },
      { key: 'notes', label: 'Learning Notes', icon: (c) => <IconNote className={c} /> },
      { key: 'resources', label: 'Resources', icon: (c) => <IconBookmark className={c} /> },
    ],
  },
  {
    title: 'Other',
    items: [{ key: 'settings', label: 'Settings', icon: (c) => <IconSettings className={c} /> }],
  },
];

export const BOTTOM_NAV_KEYS: ViewKey[] = ['dashboard', 'tasks', 'roadmaps', 'learning', 'streaks'];

export const PAGE_META: Record<ViewKey, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Plan it. Learn it. Track it.' },
  tasks: { title: 'Tasks', subtitle: 'Small steps, done daily.' },
  roadmaps: { title: 'Roadmaps', subtitle: 'Break big topics into steps.' },
  learning: { title: 'Learning', subtitle: 'Outcomes you are working toward.' },
  streaks: { title: 'Streaks', subtitle: 'Build the streak, day by day.' },
  library: { title: 'Learning Library', subtitle: 'Folders, notes, resources — organized.' },
  folders: { title: 'My Folders', subtitle: 'Organize notes by topic.' },
  notes: { title: 'Learning Notes', subtitle: 'Summaries and references.' },
  resources: { title: 'Resources', subtitle: 'Links worth revisiting.' },
  settings: { title: 'Settings', subtitle: 'Preferences and data.' },
};

export function findNavItem(key: ViewKey): NavItem | undefined {
  for (const s of NAV_SECTIONS) {
    const found = s.items.find((i) => i.key === key);
    if (found) return found;
  }
  return undefined;
}
