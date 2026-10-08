import { useMemo, useState } from 'react';
import type { LearnFlowApi } from '../store';
import { normalizeTags } from '../store';
import type { ResourceType, ViewKey } from '../types';
import { formatDate } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Label, Modal, Textarea } from './ui';
import { IconBookmark, IconLink, IconPlus, IconTrash } from './icons';

const RESOURCE_TYPES: { key: ResourceType; label: string }[] = [
  { key: 'website', label: 'Website' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'documentation', label: 'Documentation' },
  { key: 'course', label: 'Course' },
  { key: 'article', label: 'Article' },
  { key: 'other', label: 'Other' },
];

const TYPE_LABEL = new Map<ResourceType, string>(RESOURCE_TYPES.map((t) => [t.key, t.label]));

function displayUrl(url: string): string {
  const v = url.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (/^www\./i.test(v)) return `https://${v}`;
  // Bare domains (example.com/page) would resolve as in-app routes — treat as https.
  if (/^[^\s]+\.[^\s]{2,}(\/\S*)?$/.test(v)) return `https://${v}`;
  return v;
}

function isValidUrl(url: string): boolean {
  const v = url.trim();
  if (!v) return false;
  // Accept http(s)://..., www...., or bare domain like example.com/page
  return /^(https?:\/\/|www\.)/i.test(v) || /^[^\s]+\.[^\s]{2,}(\/\S*)?$/.test(v);
}

interface ResourceForm {
  title: string;
  url: string;
  description: string;
  folderId: string;
  tagsInput: string;
  goalId: string;
  type: ResourceType;
}

function blankForm(defaultFolderId: string): ResourceForm {
  return { title: '', url: '', description: '', folderId: defaultFolderId, tagsInput: '', goalId: '', type: 'website' };
}

export default function Resources({ api, search }: { api: LearnFlowApi; search: string; go?: (v: ViewKey) => void }) {
  const { state, addNote, updateNote, deleteNote } = api;
  const [typeFilter, setTypeFilter] = useState<'all' | ResourceType>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ResourceForm>(blankForm(state.folders[0]?.id ?? ''));
  const [urlError, setUrlError] = useState('');

  const q = search.trim().toLowerCase();
  const folderById = useMemo(() => new Map(state.folders.map((f) => [f.id, f])), [state.folders]);
  const goalById = useMemo(() => new Map(state.goals.map((g) => [g.id, g])), [state.goals]);

  const resources = useMemo(
    () =>
      state.notes
        .filter((n) => n.url && n.url.trim())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.notes],
  );

  const visible = resources.filter((n) => {
    if (typeFilter !== 'all' && (n.resourceType ?? 'website') !== typeFilter) return false;
    if (folderFilter !== 'all' && n.folderId !== folderFilter) return false;
    if (q && `${n.title} ${n.url} ${n.content} ${(n.tags ?? []).join(' ')}`.toLowerCase().includes(q)) return false;
    return true;
  });

  const editingNote = editingId ? state.notes.find((n) => n.id === editingId) ?? null : null;

  function openCreate() {
    setEditingId(null);
    setForm(blankForm(state.folders[0]?.id ?? ''));
    setUrlError('');
    setModalOpen(true);
  }

  function openEdit(id: string) {
    const n = state.notes.find((x) => x.id === id);
    if (!n) return;
    setEditingId(id);
    setForm({
      title: n.title,
      url: n.url,
      description: n.content ?? '',
      folderId: n.folderId,
      tagsInput: (n.tags ?? []).join(', '),
      goalId: n.goalId ?? '',
      type: n.resourceType ?? 'website',
    });
    setUrlError('');
    setModalOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    if (!isValidUrl(form.url)) {
      setUrlError('Enter a valid URL, e.g. https://example.com');
      return;
    }
    const folderId = form.folderId || state.folders[0]?.id || '';
    if (!folderId) return;
    if (editingId) {
      updateNote(editingId, {
        title: form.title,
        url: form.url.trim(),
        content: form.description,
        kind: 'resource',
        folderId,
        tags: normalizeTags(form.tagsInput),
        goalId: form.goalId || null,
        resourceType: form.type,
      });
    } else {
      addNote(folderId, form.title, form.url.trim(), form.description, 'resource', {
        tags: normalizeTags(form.tagsInput),
        goalId: form.goalId || null,
        resourceType: form.type,
      });
    }
    setModalOpen(false);
    setEditingId(null);
  }

  function confirmDelete(id: string, title: string) {
    if (window.confirm(`Delete "${title}"? This cannot be undone.`)) deleteNote(id);
  }

  const formValid = form.title.trim().length > 0 && isValidUrl(form.url) && !!form.folderId;

  return (
    <>
      <Card>
        <CardHeader
          title="Resources"
          subtitle={`${visible.length} of ${resources.length} saved`}
          action={
            <Button onClick={openCreate}>
              <IconPlus className="h-4 w-4" /> Add resource
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | ResourceType)}
            className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {RESOURCE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
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
          {(typeFilter !== 'all' || folderFilter !== 'all') && (
            <button
              onClick={() => { setTypeFilter('all'); setFolderFilter('all'); }}
              className="text-xs font-medium text-primary-600 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="space-y-3 p-4">
          {visible.length === 0 ? (
            <EmptyState
              title="No resources here"
              hint={q || typeFilter !== 'all' || folderFilter !== 'all' ? 'No resources match your search / filters.' : 'Save your first link above — e.g. docs, a YouTube tutorial, a course.'}
            />
          ) : (
            visible.map((n) => {
              const folder = folderById.get(n.folderId);
              const goal = n.goalId ? goalById.get(n.goalId) : undefined;
              const type = n.resourceType ?? 'website';
              return (
                <div key={n.id} className="flex items-start gap-3 rounded-lg border border-line p-4">
                  <IconBookmark className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={displayUrl(n.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-primary-600 hover:underline"
                      >
                        {n.title}
                      </a>
                      <Badge tone="primary">{TYPE_LABEL.get(type) ?? 'Website'}</Badge>
                    </div>
                    <a
                      href={displayUrl(n.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex max-w-full items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                    >
                      <IconLink /> <span className="truncate">{n.url}</span>
                    </a>
                    {n.content && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{n.content}</p>}
                    {(n.tags ?? []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(n.tags ?? []).map((t) => (
                          <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-ink-muted">
                      {folder?.name ?? 'Unknown'}
                      {goal ? ` · 🎯 ${goal.title}` : ''} · Added {formatDate(n.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => openEdit(n.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => confirmDelete(n.id, n.title)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger"
                      aria-label={`Delete ${n.title}`}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {modalOpen && (
        <Modal title={editingId ? 'Edit resource' : 'Add resource'} onClose={() => setModalOpen(false)}>
          <form onSubmit={save} className="grid gap-3">
            <div>
              <Label>Title</Label>
              <Input autoFocus placeholder="e.g. React Hooks reference" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>URL</Label>
              <Input placeholder="https://…" value={form.url} onChange={(e) => { setForm({ ...form, url: e.target.value }); setUrlError(''); }} />
              {urlError && <p className="mt-1 text-xs text-danger">{urlError}</p>}
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea rows={2} placeholder="What is this useful for?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as ResourceType })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                >
                  {RESOURCE_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Folder</Label>
                <select
                  value={form.folderId}
                  onChange={(e) => setForm({ ...form, folderId: e.target.value })}
                  className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                >
                  {state.folders.map((f) => (
                    <option key={f.id} value={f.id}>{(f.parentId ? '↳ ' : '') + f.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Tags (comma separated, optional)</Label>
              <Input placeholder="e.g. react, video" value={form.tagsInput} onChange={(e) => setForm({ ...form, tagsInput: e.target.value })} />
            </div>
            <div>
              <Label>Related goal (optional)</Label>
              <select
                value={form.goalId}
                onChange={(e) => setForm({ ...form, goalId: e.target.value })}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">No goal</option>
                {state.goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </select>
            </div>
            {editingNote && (
              <p className="text-xs text-ink-muted">Added {formatDate(editingNote.createdAt)}{editingNote.updatedAt !== editingNote.createdAt ? ` · Updated ${formatDate(editingNote.updatedAt)}` : ''}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={!formValid}>
                {editingId ? 'Save changes' : 'Add resource'}
              </Button>
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
