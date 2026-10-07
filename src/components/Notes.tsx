import { useMemo, useState } from 'react';
import type { LearnFlowApi } from '../store';
import { normalizeTags } from '../store';
import { formatDate } from '../utils';
import { renderMarkdown, stripMarkdown } from '../markdown';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label } from './ui';
import { IconNote, IconPlus, IconTrash } from './icons';
import NoteEditor from './NoteEditor';

export default function Notes({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state, addNote, updateNote, togglePinNote, deleteNote } = api;
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [goalFilter, setGoalFilter] = useState<string>('all');
  const [pinnedOnly, setPinnedOnly] = useState(false);

  // quick create
  const [folderId, setFolderId] = useState(state.folders[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [goalId, setGoalId] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);

  const goalById = useMemo(() => new Map(state.goals.map((g) => [g.id, g])), [state.goals]);
  const roadmapById = useMemo(() => new Map(state.roadmaps.map((r) => [r.id, r])), [state.roadmaps]);
  const folderById = useMemo(() => new Map(state.folders.map((f) => [f.id, f])), [state.folders]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of state.notes) {
      for (const t of n.tags ?? []) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [state.notes]);

  const q = search.trim().toLowerCase();

  const visible = useMemo(() => {
    const list = state.notes.filter((n) => {
      if (folderFilter !== 'all' && n.folderId !== folderFilter) return false;
      if (tagFilter !== 'all' && !(n.tags ?? []).includes(tagFilter)) return false;
      if (goalFilter !== 'all' && n.goalId !== goalFilter) return false;
      if (pinnedOnly && !n.pinned) return false;
      if (q) {
        const hay = `${n.title} ${n.content} ${(n.tags ?? []).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // pinned first, then most recently updated
    return [...list].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [state.notes, folderFilter, tagFilter, goalFilter, pinnedOnly, q]);

  const activeFolderId = folderId || state.folders[0]?.id || '';
  const openNote = openId ? state.notes.find((n) => n.id === openId) ?? null : null;
  const pinnedCount = state.notes.filter((n) => n.pinned).length;

  function resetQuick() {
    setTitle('');
    setTagsInput('');
    setGoalId('');
  }

  function submitQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !activeFolderId) return;
    const id = addNote(activeFolderId, title, '', '', 'note', {
      tags: normalizeTags(tagsInput),
      goalId: goalId || null,
    });
    resetQuick();
    if (id) setOpenId(id);
  }

  function confirmDelete(id: string, noteTitle: string) {
    if (window.confirm(`Delete "${noteTitle}"? This cannot be undone.`)) deleteNote(id);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Learning Notes"
          subtitle={`${visible.length} of ${state.notes.length} notes${pinnedCount > 0 ? ` · ${pinnedCount} pinned` : ''}`}
          action={
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
              aria-label="Filter by folder"
            >
              <option value="all">All folders</option>
              {state.folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          }
        />

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            aria-label="Filter by tag"
          >
            <option value="all">All tags</option>
            {allTags.map(([t, c]) => (
              <option key={t} value={t}>#{t} ({c})</option>
            ))}
          </select>
          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            aria-label="Filter by learning goal"
          >
            <option value="all">All goals</option>
            {state.goals.map((g) => (
              <option key={g.id} value={g.id}>{g.title}</option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink-secondary">
            <input
              type="checkbox"
              checked={pinnedOnly}
              onChange={(e) => setPinnedOnly(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
            Pinned only
          </label>
          {(tagFilter !== 'all' || goalFilter !== 'all' || pinnedOnly || folderFilter !== 'all') && (
            <button
              onClick={() => { setTagFilter('all'); setGoalFilter('all'); setPinnedOnly(false); setFolderFilter('all'); }}
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* quick create → opens distraction-free editor */}
        <form className="grid gap-3 border-b border-line p-4" onSubmit={submitQuick}>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <div>
              <Label>Title</Label>
              <Input placeholder="e.g. Flexbox cheatsheet" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Folder</Label>
              <select
                value={activeFolderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                {state.folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tags (comma separated, optional)</Label>
              <Input placeholder="e.g. css, layout" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </div>
            <div>
              <Label>Related goal (optional)</Label>
              <select
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">No goal</option>
                {state.goals.filter((g) => g.status === 'active').map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Button type="submit" disabled={!title.trim() || !activeFolderId}>
              <IconPlus className="h-4 w-4" /> New note
            </Button>
            <p className="mt-1 text-xs text-ink-muted">Creates the note and opens the distraction-free editor (markdown, autosaves locally).</p>
          </div>
        </form>

        {/* list */}
        <div className="space-y-3 p-4">
          {visible.length === 0 ? (
            <EmptyState
              title="No notes here"
              hint={q || tagFilter !== 'all' || goalFilter !== 'all' || pinnedOnly ? 'No notes match your search / filters.' : 'Create your first note above.'}
            />
          ) : (
            visible.map((n) => {
              const folder = folderById.get(n.folderId);
              const goal = n.goalId ? goalById.get(n.goalId) : undefined;
              const roadmap = n.roadmapId ? roadmapById.get(n.roadmapId) : undefined;
              const step = roadmap?.steps.find((s) => s.id === n.roadmapStepId);
              const preview = stripMarkdown(n.content).slice(0, 160);
              return (
                <div key={n.id} className={`rounded-lg border p-4 ${n.pinned ? 'border-amber-300 bg-amber-50/40' : 'border-line'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <IconNote className="h-4 w-4 shrink-0 text-slate-400" />
                      <button onClick={() => setOpenId(n.id)} className="truncate text-left text-sm font-semibold text-ink hover:underline">
                        {n.title}
                      </button>
                      {n.pinned && <Badge tone="warning">Pinned</Badge>}
                      <Badge tone="neutral">{folder?.name ?? 'Unknown'}</Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => togglePinNote(n.id)}
                        title={n.pinned ? 'Unpin' : 'Pin to top'}
                        aria-label={n.pinned ? `Unpin ${n.title}` : `Pin ${n.title}`}
                        className={`rounded-md px-2 py-1 text-xs font-medium ${n.pinned ? 'text-amber-600 hover:bg-amber-100' : 'text-ink-muted hover:bg-surface'}`}
                      >
                        {n.pinned ? '★' : '☆'}
                      </button>
                      <button
                        onClick={() => setOpenId(n.id)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                      >
                        {n.content ? 'Open' : 'Write'}
                      </button>
                      <button onClick={() => confirmDelete(n.id, n.title)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label={`Delete ${n.title}`}>
                        <IconTrash />
                      </button>
                    </div>
                  </div>

                  {(n.tags ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(n.tags ?? []).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTagFilter(t)}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-ink-secondary hover:bg-slate-200"
                          title={`Filter by #${t}`}
                        >
                          #{t}
                        </button>
                      ))}
                    </div>
                  )}

                  {(goal || roadmap) && (
                    <p className="mt-1.5 text-xs text-ink-muted">
                      {goal && <span>🎯 {goal.title}</span>}
                      {goal && roadmap && <span> · </span>}
                      {roadmap && <span>🗺 {roadmap.title}{step ? ` — ${step.title}` : ''}</span>}
                    </p>
                  )}

                  {n.content ? (
                    <div
                      className="mt-2 line-clamp-3 cursor-pointer overflow-hidden"
                      onClick={() => setOpenId(n.id)}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(preview + (stripMarkdown(n.content).length > 160 ? '…' : '')) }}
                    />
                  ) : (
                    <button onClick={() => setOpenId(n.id)} className="mt-2 text-sm text-ink-muted hover:text-primary-600">
                      No content yet — click to start writing…
                    </button>
                  )}
                  <p className="mt-2 text-[11px] text-ink-muted">
                    Created {formatDate(n.createdAt)} · Updated {formatDate(n.updatedAt)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {openNote && (
        <NoteEditor
          note={openNote}
          folders={state.folders}
          goals={state.goals}
          roadmaps={state.roadmaps}
          onAutosave={(id, patch) =>
            updateNote(id, {
              title: patch.title,
              content: patch.content,
              tags: patch.tags,
              folderId: patch.folderId,
              goalId: patch.goalId,
              roadmapId: patch.roadmapId,
              roadmapStepId: patch.roadmapStepId,
              pinned: patch.pinned,
            })
          }
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
