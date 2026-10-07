import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { formatDate } from '../utils';
import { Button, Card, CardHeader, EmptyState, Input, Textarea, Label } from './ui';
import { IconFolder, IconLink, IconNote, IconPlus, IconTrash } from './icons';

export default function Library({ api }: { api: LearnFlowApi }) {
  const { state, addFolder, deleteFolder, addNote, updateNote, deleteNote } = api;
  const [folderName, setFolderName] = useState('');
  const [activeFolder, setActiveFolder] = useState<string | null>(state.folders[0]?.id ?? null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [noteTitle, setNoteTitle] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [noteContent, setNoteContent] = useState('');

  const currentFolderId = activeFolder ?? state.folders[0]?.id ?? null;
  const notes = state.notes.filter((n) => n.folderId === currentFolderId);
  const editing = state.notes.find((n) => n.id === editingId);

  function resetForm() {
    setNoteTitle('');
    setNoteUrl('');
    setNoteContent('');
    setEditingId(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="h-fit">
        <CardHeader title="Folders" subtitle={`${state.folders.length} total`} />
        <div className="space-y-2 p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!folderName.trim()) return;
              addFolder(folderName);
              setFolderName('');
            }}
          >
            <Input placeholder="New folder…" value={folderName} onChange={(e) => setFolderName(e.target.value)} />
            <Button type="submit" variant="secondary"><IconPlus className="h-4 w-4" /></Button>
          </form>
          {state.folders.map((f) => {
            const count = state.notes.filter((n) => n.folderId === f.id).length;
            const active = f.id === currentFolderId;
            return (
              <div
                key={f.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${active ? 'border-primary-500 bg-primary-50' : 'border-line hover:bg-surface'}`}
              >
                <button onClick={() => setActiveFolder(f.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <IconFolder className={`h-4 w-4 shrink-0 ${active ? 'text-primary-600' : 'text-slate-400'}`} />
                  <span className="truncate text-sm font-medium text-ink">{f.name}</span>
                  <span className="text-xs text-ink-muted">({count})</span>
                </button>
                {state.folders.length > 1 && (
                  <button onClick={() => { deleteFolder(f.id); if (currentFolderId === f.id) setActiveFolder(null); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label={`Delete ${f.name}`}>
                    <IconTrash />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Notes & resources" subtitle="Save links, summaries and references inside folders." />
        <div className="border-b border-line p-4">
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!currentFolderId || !noteTitle.trim()) return;
              if (editingId) {
                updateNote(editingId, { title: noteTitle, url: noteUrl, content: noteContent });
              } else {
                addNote(currentFolderId, noteTitle, noteUrl, noteContent);
              }
              resetForm();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{editingId ? 'Edit title' : 'Title'}</Label>
                <Input placeholder="e.g. Flexbox cheatsheet" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
              </div>
              <div>
                <Label>Link (optional)</Label>
                <Input placeholder="https://…" value={noteUrl} onChange={(e) => setNoteUrl(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={3} placeholder="Key points, code snippets, what to remember…" value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button type="submit"><IconPlus className="h-4 w-4" /> {editingId ? 'Save changes' : 'Save note'}</Button>
              {editingId && <Button variant="secondary" onClick={resetForm}>Cancel</Button>}
            </div>
          </form>
        </div>
        <div className="space-y-3 p-4">
          {!currentFolderId ? (
            <EmptyState title="No folder selected" hint="Create a folder to start saving notes." />
          ) : notes.length === 0 ? (
            <EmptyState title="No notes in this folder" hint="Save your first resource or summary above." />
          ) : (
            notes.map((n) => (
              <div key={n.id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <IconNote className="h-4 w-4 text-slate-400" />
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { setEditingId(n.id); setNoteTitle(n.title); setNoteUrl(n.url); setNoteContent(n.content); }}
                      className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
                    >
                      {editing && editing.id === n.id ? 'Editing…' : 'Edit'}
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
