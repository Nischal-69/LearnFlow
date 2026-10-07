import { useEffect, useMemo, useRef, useState } from 'react';
import type { LearnFlowApi } from '../store';
import type { ViewKey } from '../types';
import { countResults, globalSearch, type SearchGroupKey, type SearchHit } from '../search';
import {
  IconBook,
  IconBookmark,
  IconCheckCircle,
  IconFlame,
  IconFolder,
  IconMap,
  IconNote,
  IconSearch,
} from './icons';

const GROUP_ICON: Record<SearchGroupKey, (className: string) => JSX.Element> = {
  tasks: (c) => <IconCheckCircle className={c} />,
  goals: (c) => <IconBook className={c} />,
  roadmaps: (c) => <IconMap className={c} />,
  notes: (c) => <IconNote className={c} />,
  folders: (c) => <IconFolder className={c} />,
  resources: (c) => <IconBookmark className={c} />,
  sessions: (c) => <IconFlame className={c} />,
};

type Row =
  | { kind: 'hit'; hit: SearchHit }
  | { kind: 'more'; view: ViewKey; label: string; remaining: number };

export default function SearchOverlay({
  api,
  query,
  onQuery,
  onSelect,
  onClose,
}: {
  api: LearnFlowApi;
  query: string;
  onQuery: (v: string) => void;
  onSelect: (view: ViewKey, query: string) => void;
  onClose: () => void;
}) {
  const groups = useMemo(() => globalSearch(api.state, query), [api.state, query]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset highlight whenever results change.
  useEffect(() => {
    setActive(0);
  }, [query]);

  // Autofocus the input on open.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const g of groups) {
      for (const hit of g.hits) out.push({ kind: 'hit', hit });
      if (g.total > g.hits.length) {
        out.push({ kind: 'more', view: g.view, label: g.label, remaining: g.total - g.hits.length });
      }
    }
    return out;
  }, [groups]);

  const total = countResults(groups);

  // Keep the highlighted row visible.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-row="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(row: Row) {
    if (row.kind === 'hit') onSelect(row.hit.view, query);
    else onSelect(row.view, query);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (rows.length === 0 ? 0 : (a + 1) % rows.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (rows.length === 0 ? 0 : (a - 1 + rows.length) % rows.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[active];
      if (row) choose(row);
    }
  }

  let rowIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]" onClick={onClose} role="dialog" aria-modal="true" aria-label="Global search">
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-line bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <IconSearch className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks, notes, goals…"
            aria-label="Search everything"
            className="w-full bg-transparent py-3 text-sm text-ink placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-line bg-surface px-1.5 py-0.5 text-[11px] text-ink-muted">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim() === '' ? (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">
              Type to search across tasks, goals, roadmaps, notes, folders, resources and sessions.
            </p>
          ) : total === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">
              No results for “{query.trim()}”.
            </p>
          ) : (
            groups.map((g) => {
              if (g.hits.length === 0 && g.total === 0) return null;
              return (
                <div key={g.key} className="mb-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    {g.label} · {g.total} {g.total === 1 ? 'result' : 'results'}
                  </p>
                  {g.hits.map((hit) => {
                    rowIndex += 1;
                    const idx = rowIndex;
                    const isActive = idx === active;
                    return (
                      <button
                        key={hit.id}
                        data-row={idx}
                        onClick={() => onSelect(hit.view, query)}
                        onMouseEnter={() => setActive(idx)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left ${
                          isActive ? 'bg-primary-50' : ''
                        }`}
                      >
                        <span className="shrink-0 text-slate-400">{GROUP_ICON[hit.group]('h-4 w-4')}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{hit.title}</span>
                          <span className="block truncate text-xs text-ink-muted">{hit.subtitle}</span>
                        </span>
                      </button>
                    );
                  })}
                  {g.total > g.hits.length && (
                    (() => {
                      rowIndex += 1;
                      const idx = rowIndex;
                      const isActive = idx === active;
                      return (
                        <button
                          key={`${g.key}-more`}
                          data-row={idx}
                          onClick={() => onSelect(g.view, query)}
                          onMouseEnter={() => setActive(idx)}
                          className={`w-full rounded-lg px-3 py-1.5 pl-9 text-left text-xs font-medium text-primary-600 hover:underline ${
                            isActive ? 'bg-primary-50' : ''
                          }`}
                        >
                          See all {g.total} in {g.label} →
                        </button>
                      );
                    })()
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-ink-muted">
          <span><kbd className="rounded border border-line bg-surface px-1">↑↓</kbd> move</span>
          <span><kbd className="rounded border border-line bg-surface px-1">↵</kbd> open</span>
          <span><kbd className="rounded border border-line bg-surface px-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
