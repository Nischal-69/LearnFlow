import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { formatDate } from '../utils';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Textarea, Label } from './ui';
import { IconLink, IconNote, IconPlus, IconTrash } from './icons';

export default function Notes({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state, addNote, updateNote, deleteNote } = api;
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState(state.folders[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');

  const q = search.trim().toLowerCase();
  const visible = state.notes.filter((n) => {
    if (folderFilter !== 'all' && n.folderId !== folderFilter) return false;
    if (q && !(n.title + ' ' + n.content + ' ' + n.url).toLowerCase().includes(q)) return false;
    return true;
  });

  const folderName = (id: string) => state.folders.find((f) => f.id === id)?.name ?? 'Unknown';
  const activeFolderId = folderId || state.folders[0]?.id || '';

  function reset() {
    setTitle('');
    setUrl('');
    setContent('');
    setEditingId(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Learning Notes"
          subtitle={`${visible.length} of ${state.notes.length} notes`}
          action={
            <select
              value={folderFilter}
              onChange={(e) => setFolderFilter(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm text-ink"
            >
              <option value="all">All folders</option>
              {state.folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          }
        />
        <form
          className="grid gap-3 border-b border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !activeFolderId) return;
            if (editingId) updateNote(editingId, { title, url, content });
            else addNote(activeFolderId, title, url, content);
            reset();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_180px]">
            <div>
              <Label>Title</Label>
              <Input placeholder="e.g. Flexbox cheatsheet" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Link (optional)</Label>
              <Input placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
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
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} placeholder="Key points, what to remember…" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit"><IconPlus className="h-4 w-4" /> {editingId ? 'Save changes' : 'Save note'}</Button>
            {editingId && <Button variant="secondary" onClick={reset}>Cancel</Button>}
          </div>
        </form>
        <div className="space-y-3 p-4">
          {visible.length === 0 ? (
            <EmptyState title="No notes here" hint={q ? 'No notes match your search.' : 'Save your first note above.'} />
          ) : (
            visible.map((n) => (
              <div key={n.id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <IconNote className="h-4 w-4 shrink-0 text-slate-400" />
                    <p className="truncate text-sm font-semibold text-ink">{n.title}</p>
                    <Badge tone="neutral">{folderName(n.folderId)}</Badge>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => { setEditingId(n.id); setTitle(n.title); setUrl(n.url); setContent(n.content); setFolderId(n.folderId); }}
                      className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                    >
                      Edit
                    </button>
                    <button onClick={() => deleteNote(n.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete note">
                      <IconTrash />
                    </button>
                  </div>
                </div>
                {n.url && (
                  <a href={n.url.startsWith('http') ? n.url : `https://${n.url}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
                    <IconLink /> {n.url}
                  </a>
                )}
                {n.content && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{n.content}</p>}
                <p className="mt-2 text-[11px] text-ink-muted">Updated {formatDate(n.updatedAt)}</p>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
