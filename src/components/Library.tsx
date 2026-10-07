import { useMemo, useState } from 'react';
import type { LearnFlowApi } from '../store';
import { isResourceNote } from '../store';
import type { Folder, Note, NoteKind } from '../types';
import { formatDate } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, Textarea } from './ui';
import { IconBookmark, IconFolder, IconLink, IconNote, IconPlus, IconTrash } from './icons';

type Tab = 'all' | 'notes' | 'summaries' | 'resources' | 'topics';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'notes', label: 'Notes' },
  { key: 'summaries', label: 'Summaries' },
  { key: 'resources', label: 'Resources & Links' },
  { key: 'topics', label: 'Completed topics' },
];

const KIND_LABEL: Record<NoteKind, string> = {
  note: 'Note',
  summary: 'Summary',
  resource: 'Resource',
  link: 'Link',
  topic: 'Topic done',
};

function kindTone(kind: NoteKind): 'neutral' | 'primary' | 'success' {
  if (kind === 'resource' || kind === 'link') return 'primary';
  if (kind === 'topic' || kind === 'summary') return 'success';
  return 'neutral';
}

export interface FolderStats {
  notes: number;
  resources: number;
  total: number;
  updatedAt: string;
}

export function folderStats(folders: Folder[], notes: Note[], folderId: string): FolderStats {
  const childIds = new Set<string>([folderId]);
  for (const f of folders) {
    if (f.parentId === folderId) childIds.add(f.id);
  }
  const scoped = notes.filter((n) => childIds.has(n.folderId));
  const resources = scoped.filter(isResourceNote).length;
  const total = scoped.length;
  let updatedAt = folders.find((f) => f.id === folderId)?.updatedAt ?? '';
  for (const f of folders) {
    if (childIds.has(f.id) && f.updatedAt > updatedAt) updatedAt = f.updatedAt;
  }
  for (const n of scoped) {
    if (n.updatedAt > updatedAt) updatedAt = n.updatedAt;
  }
  return { notes: total - resources, resources, total, updatedAt };
}

function displayUrl(url: string): string {
  const v = url.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  return v;
}

export default function Library({ api, search }: { api: LearnFlowApi; search: string }) {
  const {
    state,
    addFolder,
    addSubfolder,
    renameFolder,
    deleteFolder,
    addNote,
    updateNote,
    moveNote,
    deleteNote,
  } = api;

  const folders = state.folders;
  const notes = state.notes;
  const q = search.trim().toLowerCase();

  const topFolders = useMemo(
    () => folders.filter((f) => f.parentId === null).sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );
  const subOf = useMemo(() => {
    const map = new Map<string, Folder[]>();
    for (const f of folders) {
      if (!f.parentId) continue;
      if (!map.has(f.parentId)) map.set(f.parentId, []);
      map.get(f.parentId)!.push(f);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [folders]);

  const [selectedId, setSelectedId] = useState<string>('');
  const selected = folders.find((f) => f.id === selectedId) ?? topFolders[0] ?? folders[0] ?? null;
  const selectedParent = selected?.parentId ? folders.find((f) => f.id === selected.parentId) ?? null : null;
  // The folder whose contents we list: the selected folder itself (own notes only).
  const ownNotes = useMemo(
    () => (selected ? notes.filter((n) => n.folderId === selected.id) : []),
    [notes, selected],
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [subName, setSubName] = useState('');
  const [showSubForm, setShowSubForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');

  // Add note/resource form
  const [formKind, setFormKind] = useState<NoteKind>('note');
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formContent, setFormContent] = useState('');

  // Edit note form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editKind, setEditKind] = useState<NoteKind>('note');
  const [editFolderId, setEditFolderId] = useState('');

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startRename(f: Folder) {
    setRenamingId(f.id);
    setRenameValue(f.name);
  }

  function submitRename() {
    if (renamingId && renameValue.trim()) renameFolder(renamingId, renameValue);
    setRenamingId(null);
  }

  function submitNewFolder() {
    if (!newFolderName.trim()) return;
    const id = addFolder(newFolderName);
    setNewFolderName('');
    if (id) setSelectedId(id);
  }

  function submitSubfolder() {
    if (!selected || selected.parentId !== null || !subName.trim()) return;
    const id = addSubfolder(selected.id, subName);
    setSubName('');
    setShowSubForm(false);
    if (id) {
      setExpanded((prev) => new Set(prev).add(selected.id));
      setSelectedId(id);
    }
  }

  function submitItem() {
    if (!selected || !formTitle.trim()) return;
    if ((formKind === 'resource' || formKind === 'link') && !formUrl.trim()) return;
    addNote(selected.id, formTitle, formUrl, formContent, formKind);
    setFormTitle('');
    setFormUrl('');
    setFormContent('');
  }

  function startEdit(n: Note) {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditUrl(n.url);
    setEditContent(n.content);
    setEditKind(n.kind);
    setEditFolderId(n.folderId);
  }

  function submitEdit() {
    if (!editingId) return;
    updateNote(editingId, { title: editTitle, url: editUrl, content: editContent, kind: editKind });
    if (editFolderId) moveNote(editingId, editFolderId);
    setEditingId(null);
  }

  const visibleTopFolders = topFolders.filter((f) => {
    if (!q) return true;
    const subs = subOf.get(f.id) ?? [];
    return (
      f.name.toLowerCase().includes(q) ||
      subs.some((s) => s.name.toLowerCase().includes(q))
    );
  });

  const filteredOwnNotes = ownNotes.filter((n) => {
    if (q && !(n.title + ' ' + n.content + ' ' + n.url).toLowerCase().includes(q)) return false;
    if (tab === 'notes') return n.kind === 'note';
    if (tab === 'summaries') return n.kind === 'summary';
    if (tab === 'resources') return isResourceNote(n);
    if (tab === 'topics') return n.kind === 'topic';
    return true;
  });

  const completedSteps = useMemo(() => {
    const out: { key: string; roadmap: string; title: string }[] = [];
    for (const r of state.roadmaps) {
      for (const s of r.steps) {
        const status = s.status ?? ((s as { done?: boolean }).done ? 'completed' : 'not_started');
        if (status === 'completed') out.push({ key: `${r.id}:${s.id}`, roadmap: r.title, title: s.title });
      }
    }
    return out.slice(0, 20);
  }, [state.roadmaps]);

  const stats = selected ? folderStats(folders, notes, selected.id) : null;
  const childFolders = selected ? (subOf.get(selected.id) ?? []) : [];
  const isTopLevel = selected ? selected.parentId === null : false;

  function folderRow(f: Folder, depth: number) {
    const s = folderStats(folders, notes, f.id);
    const isSelected = selected?.id === f.id;
    const kids = subOf.get(f.id) ?? [];
    const isOpen = expanded.has(f.id) || isSelected;
    return (
      <div key={f.id}>
        <div
          className={`flex items-center gap-2 rounded-lg px-2 py-2 text-left ${
            isSelected ? 'bg-primary-50 ring-1 ring-primary-500' : 'hover:bg-surface'
          } ${depth > 0 ? 'ml-5' : ''}`}
        >
          {kids.length > 0 ? (
            <button
              onClick={() => toggleExpand(f.id)}
              className="shrink-0 rounded px-1 text-xs text-ink-muted hover:bg-slate-200"
              aria-label={isOpen ? `Collapse ${f.name}` : `Expand ${f.name}`}
            >
              {isOpen ? '▾' : '▸'}
            </button>
          ) : (
            <span className="w-5 shrink-0" />
          )}
          <button onClick={() => setSelectedId(f.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <IconFolder className={`h-5 w-5 shrink-0 ${depth > 0 ? 'text-slate-400' : 'text-amber-500'}`} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
              <span className="block truncate text-[11px] text-ink-muted">
                {s.notes} {s.notes === 1 ? 'note' : 'notes'} · {s.resources}{' '}
                {s.resources === 1 ? 'resource' : 'resources'}
              </span>
            </span>
          </button>
        </div>
        {isOpen &&
          kids.map((k) => {
            const ks = folderStats(folders, notes, k.id);
            const kSelected = selected?.id === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setSelectedId(k.id)}
                className={`ml-10 flex w-[calc(100%-2.5rem)] items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
                  kSelected ? 'bg-primary-50 ring-1 ring-primary-500' : 'hover:bg-surface'
                }`}
              >
                <IconFolder className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{k.name}</span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {ks.notes} {ks.notes === 1 ? 'note' : 'notes'} · {ks.resources}{' '}
                    {ks.resources === 1 ? 'resource' : 'resources'}
                  </span>
                </span>
              </button>
            );
          })}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      {/* Left: folder tree */}
      <Card className="h-fit">
        <CardHeader
          title="My Learning"
          subtitle={`${folders.length} ${folders.length === 1 ? 'folder' : 'folders'} · ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
        />
        <div className="space-y-3 p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitNewFolder();
            }}
          >
            <Input
              placeholder="New folder… e.g. React"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <Button type="submit" className="shrink-0">
              <IconPlus className="h-4 w-4" /> Add
            </Button>
          </form>
          <div className="space-y-1">
            {visibleTopFolders.length === 0 ? (
              <EmptyState
                title="No folders here"
                hint={q ? 'No folders match your search.' : 'Create your first folder above.'}
              />
            ) : (
              visibleTopFolders.map((f) => folderRow(f, 0))
            )}
          </div>
        </div>
      </Card>

      {/* Right: open folder */}
      {!selected || !stats ? (
        <Card className="h-fit p-4">
          <EmptyState title="No folder selected" hint="Create a folder to organize what you learn." />
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <div className="border-b border-line px-5 py-4">
              <nav className="flex flex-wrap items-center gap-1 text-xs text-ink-muted" aria-label="Breadcrumb">
                <span>My Learning</span>
                {selectedParent && (
                  <>
                    <span>/</span>
                    <button onClick={() => setSelectedId(selectedParent.id)} className="font-medium text-primary-600 hover:underline">
                      {selectedParent.name}
                    </button>
                  </>
                )}
                {selected.parentId === null ? (
                  <>
                    <span>/</span>
                    <span className="font-semibold text-ink">{selected.name}</span>
                  </>
                ) : (
                  <>
                    <span>/</span>
                    <span className="font-semibold text-ink">{selected.name}</span>
                    <Badge tone="neutral">Subfolder</Badge>
                  </>
                )}
              </nav>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
                  <IconFolder className="h-5 w-5 text-amber-500" />
                  {renamingId === selected.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submitRename();
                      }}
                    >
                      <Input autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
                      <Button type="submit">Save</Button>
                      <Button variant="secondary" onClick={() => setRenamingId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    selected.name
                  )}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {isTopLevel && (
                    <Button variant="secondary" onClick={() => setShowSubForm((v) => !v)}>
                      <IconPlus className="h-4 w-4" /> Subfolder
                    </Button>
                  )}
                  {renamingId !== selected.id && (
                    <Button variant="secondary" onClick={() => startRename(selected)}>
                      Rename
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => setConfirmDeleteId(selected.id)}>
                    <IconTrash /> Delete
                  </Button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                <span>
                  <strong className="text-ink">{stats.notes}</strong> {stats.notes === 1 ? 'note' : 'notes'}
                </span>
                <span>
                  <strong className="text-ink">{stats.resources}</strong>{' '}
                  {stats.resources === 1 ? 'resource' : 'resources'}
                </span>
                <span>
                  Updated {stats.updatedAt ? formatDate(stats.updatedAt) : '—'}
                </span>
                {isTopLevel && childFolders.length > 0 && (
                  <span>
                    {childFolders.length} {childFolders.length === 1 ? 'subfolder' : 'subfolders'}
                  </span>
                )}
              </div>
              {showSubForm && isTopLevel && (
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitSubfolder();
                  }}
                >
                  <Input
                    autoFocus
                    placeholder={`New subfolder in ${selected.name}…`}
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                  />
                  <Button type="submit">Add</Button>
                  <Button variant="secondary" onClick={() => setShowSubForm(false)}>
                    Cancel
                  </Button>
                </form>
              )}
              {confirmDeleteId === selected.id && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                  <p className="text-ink">
                    Delete <strong>{selected.name}</strong>
                    {isTopLevel && childFolders.length > 0
                      ? `, its ${childFolders.length} subfolder(s)`
                      : ''}
                    {stats.total > 0 ? ` and ${stats.total} note(s)` : ''}? This cannot be undone.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="danger"
                      onClick={() => {
                        const next = topFolders.find((f) => f.id !== selected.id)?.id ?? '';
                        deleteFolder(selected.id);
                        setConfirmDeleteId(null);
                        setSelectedId(next);
                      }}
                    >
                      Delete forever
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmDeleteId(null)}>
                      Keep
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {isTopLevel && childFolders.length > 0 && (
              <div className="border-b border-line p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Subfolders</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {childFolders.map((sub) => {
                    const ss = folderStats(folders, notes, sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => setSelectedId(sub.id)}
                        className="flex items-center gap-3 rounded-lg border border-line p-3 text-left hover:bg-surface"
                      >
                        <IconFolder className="h-5 w-5 shrink-0 text-slate-400" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">{sub.name}</span>
                          <span className="block truncate text-[11px] text-ink-muted">
                            {ss.notes} {ss.notes === 1 ? 'note' : 'notes'} · {ss.resources}{' '}
                            {ss.resources === 1 ? 'resource' : 'resources'} · Updated{' '}
                            {ss.updatedAt ? formatDate(ss.updatedAt) : '—'}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="border-b border-line p-4">
              <div className="mb-3 flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      tab === t.key ? 'bg-ink text-white' : 'bg-slate-100 text-ink-secondary hover:bg-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <form
                className="grid gap-3 rounded-lg bg-surface p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitItem();
                }}
              >
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <div>
                    <Label>Type</Label>
                    <select
                      value={formKind}
                      onChange={(e) => setFormKind(e.target.value as NoteKind)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                    >
                      <option value="note">Note</option>
                      <option value="summary">Learning summary</option>
                      <option value="resource">Resource</option>
                      <option value="link">Link</option>
                      <option value="topic">Completed topic</option>
                    </select>
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input
                      placeholder={
                        formKind === 'resource' || formKind === 'link'
                          ? 'e.g. React docs — Hooks reference'
                          : 'e.g. What I learned about useEffect'
                      }
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                  </div>
                </div>
                {(formKind === 'resource' || formKind === 'link') && (
                  <div>
                    <Label>URL (file or link attachment)</Label>
                    <Input
                      placeholder="https://…"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label>{formKind === 'summary' ? 'Summary' : 'Content'}</Label>
                  <Textarea
                    rows={2}
                    placeholder="Key points, what to remember…"
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                  />
                </div>
                <div>
                  <Button type="submit">
                    <IconPlus className="h-4 w-4" /> Add {KIND_LABEL[formKind].toLowerCase()} to {selected.name}
                  </Button>
                </div>
              </form>
            </div>

            <div className="space-y-3 p-4">
              {tab === 'topics' ? (
                <>
                  {ownNotes.filter((n) => n.kind === 'topic').map((n) => (
                    <div key={n.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-center gap-2">
                        <Badge tone="success">Topic done</Badge>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{n.title}</p>
                        <button
                          onClick={() => startEdit(n)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteNote(n.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                          aria-label="Delete topic"
                        >
                          <IconTrash />
                        </button>
                      </div>
                      {n.content && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-secondary">{n.content}</p>}
                      <p className="mt-1 text-[11px] text-ink-muted">Updated {formatDate(n.updatedAt)}</p>
                    </div>
                  ))}
                  {completedSteps.length > 0 && (
                    <div className="rounded-lg border border-line p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                        Completed roadmap steps
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {completedSteps.map((s) => (
                          <p key={s.key} className="text-sm text-ink-secondary">
                            ✓ {s.title} <span className="text-xs text-ink-muted">· {s.roadmap}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                  {ownNotes.filter((n) => n.kind === 'topic').length === 0 && completedSteps.length === 0 && (
                    <EmptyState title="No completed topics yet" hint="Mark a roadmap step done or add a topic here." />
                  )}
                </>
              ) : filteredOwnNotes.length === 0 ? (
                <EmptyState
                  title="Nothing here yet"
                  hint={q ? 'Nothing matches your search.' : 'Add your first note or resource above.'}
                />
              ) : (
                filteredOwnNotes.map((n) =>
                  editingId === n.id ? (
                    <div key={n.id} className="grid gap-3 rounded-lg border border-primary-500 p-3">
                      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                        <div>
                          <Label>Type</Label>
                          <select
                            value={editKind}
                            onChange={(e) => setEditKind(e.target.value as NoteKind)}
                            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                          >
                            <option value="note">Note</option>
                            <option value="summary">Learning summary</option>
                            <option value="resource">Resource</option>
                            <option value="link">Link</option>
                            <option value="topic">Completed topic</option>
                          </select>
                        </div>
                        <div>
                          <Label>Title</Label>
                          <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <Label>URL</Label>
                          <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://…" />
                        </div>
                        <div>
                          <Label>Move to folder</Label>
                          <select
                            value={editFolderId}
                            onChange={(e) => setEditFolderId(e.target.value)}
                            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                          >
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {(f.parentId ? '↳ ' : '') + f.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <Label>Content</Label>
                        <Textarea rows={2} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={submitEdit}>Save changes</Button>
                        <Button variant="secondary" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div key={n.id} className="rounded-lg border border-line p-3">
                      <div className="flex items-start gap-2">
                        {isResourceNote(n) ? (
                          <IconBookmark className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        ) : (
                          <IconNote className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{n.title}</p>
                            <Badge tone={kindTone(n.kind)}>{KIND_LABEL[n.kind]}</Badge>
                          </div>
                          {n.url && (
                            <a
                              href={displayUrl(n.url)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                            >
                              <IconLink /> {n.url}
                            </a>
                          )}
                          {n.content && (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-secondary">{n.content}</p>
                          )}
                          <p className="mt-1 text-[11px] text-ink-muted">Updated {formatDate(n.updatedAt)}</p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => startEdit(n)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteNote(n.id)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                            aria-label={`Delete ${n.title}`}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
