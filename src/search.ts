import type { LearnFlowState, ViewKey } from './types';

export type SearchGroupKey =
  | 'tasks'
  | 'goals'
  | 'roadmaps'
  | 'notes'
  | 'folders'
  | 'resources'
  | 'sessions';

export interface SearchHit {
  group: SearchGroupKey;
  id: string;
  title: string;
  subtitle: string;
  /** owning view to navigate to on select */
  view: ViewKey;
}

export interface SearchGroup {
  key: SearchGroupKey;
  label: string;
  view: ViewKey;
  total: number;
  hits: SearchHit[];
}

/** Max rows shown per group in the overlay; `total` keeps the true count. */
export const HITS_PER_GROUP = 5;

const GROUPS: { key: SearchGroupKey; label: string; view: ViewKey }[] = [
  { key: 'tasks', label: 'Tasks', view: 'tasks' },
  { key: 'goals', label: 'Learning goals', view: 'learning' },
  { key: 'roadmaps', label: 'Roadmaps', view: 'roadmaps' },
  { key: 'notes', label: 'Notes', view: 'notes' },
  { key: 'folders', label: 'Folders', view: 'folders' },
  { key: 'resources', label: 'Resources', view: 'resources' },
  { key: 'sessions', label: 'Learning sessions', view: 'learning' },
];

/**
 * Fast cross-entity substring search. Same matching semantics as the
 * per-view filters (case-insensitive). URL-notes only appear under
 * Resources; plain notes only under Notes — never duplicated.
 */
export function globalSearch(state: LearnFlowState, rawQuery: string): SearchGroup[] {
  const q = rawQuery.trim().toLowerCase();
  const empty: SearchGroup[] = GROUPS.map((g) => ({ ...g, total: 0, hits: [] }));
  if (!q) return empty;

  const hitsOf = (key: SearchGroupKey): SearchHit[] => empty.find((g) => g.key === key)!.hits;

  for (const t of state.tasks) {
    if (`${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q)) {
      hitsOf('tasks').push({
        group: 'tasks',
        id: t.id,
        title: t.title || '(Untitled task)',
        subtitle: t.done ? 'Completed' : t.status === 'in_progress' ? 'In progress' : 'To do',
        view: 'tasks',
      });
    }
  }

  for (const g of state.goals) {
    if (`${g.title} ${g.description} ${g.motivation}`.toLowerCase().includes(q)) {
      hitsOf('goals').push({
        group: 'goals',
        id: g.id,
        title: g.title || '(Untitled goal)',
        subtitle: g.status === 'active' ? 'Active goal' : g.status === 'paused' ? 'Paused goal' : 'Completed goal',
        view: 'learning',
      });
    }
  }

  for (const r of state.roadmaps) {
    const stepHit = r.steps.some((s) =>
      `${s.title} ${s.description ?? ''}`.toLowerCase().includes(q),
    );
    if (`${r.title} ${r.description}`.toLowerCase().includes(q) || stepHit) {
      const done = r.steps.filter((s) => (s.status ?? ((s as { done?: boolean }).done ? 'completed' : 'not_started')) === 'completed').length;
      hitsOf('roadmaps').push({
        group: 'roadmaps',
        id: r.id,
        title: r.title || '(Untitled roadmap)',
        subtitle: r.steps.length > 0 ? `${done}/${r.steps.length} steps done` : 'No steps yet',
        view: 'roadmaps',
      });
    }
  }

  const folderById = new Map(state.folders.map((f) => [f.id, f.name]));

  for (const n of state.notes) {
    const isResource = n.url.trim().length > 0;
    const haystack = isResource
      ? `${n.title} ${n.url} ${n.content} ${(n.tags ?? []).join(' ')}`.toLowerCase()
      : `${n.title} ${n.content} ${(n.tags ?? []).join(' ')}`.toLowerCase();
    if (!haystack.includes(q)) continue;
    const folder = folderById.get(n.folderId) ?? 'Unknown folder';
    if (isResource) {
      hitsOf('resources').push({
        group: 'resources',
        id: n.id,
        title: n.title || '(Untitled resource)',
        subtitle: folder,
        view: 'resources',
      });
    } else {
      hitsOf('notes').push({
        group: 'notes',
        id: n.id,
        title: n.title || '(Untitled note)',
        subtitle: folder,
        view: 'notes',
      });
    }
  }

  for (const f of state.folders) {
    if (f.name.toLowerCase().includes(q)) {
      const count = state.notes.filter((n) => n.folderId === f.id).length;
      hitsOf('folders').push({
        group: 'folders',
        id: f.id,
        title: f.name,
        subtitle: `${count} ${count === 1 ? 'note' : 'notes'}`,
        view: 'folders',
      });
    }
  }

  for (const c of state.completions) {
    if (c.kind !== 'session') continue;
    if (`${c.title} ${c.understood} ${c.struggled} ${c.next} ${c.notes}`.toLowerCase().includes(q)) {
      hitsOf('sessions').push({
        group: 'sessions',
        id: c.id,
        title: c.title || '(Untitled session)',
        subtitle: c.minutes > 0 ? `${c.minutes} min · ${c.date}` : c.date,
        view: 'learning',
      });
    }
  }

  for (const g of empty) {
    g.total = g.hits.length;
    if (g.hits.length > HITS_PER_GROUP) g.hits = g.hits.slice(0, HITS_PER_GROUP);
  }
  return empty;
}

export function countResults(groups: SearchGroup[]): number {
  return groups.reduce((a, g) => a + g.total, 0);
}
