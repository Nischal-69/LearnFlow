import { useState } from 'react';
import type { LearnFlowApi } from '../store';
import { Button, Card, CardHeader, EmptyState, Input } from './ui';
import { IconFolder, IconPlus, IconTrash } from './icons';

export default function Folders({ api, search }: { api: LearnFlowApi; search: string }) {
  const { state, addFolder, deleteFolder } = api;
  const [name, setName] = useState('');
  const q = search.trim().toLowerCase();
  const visible = state.folders.filter((f) => (q ? f.name.toLowerCase().includes(q) : true));

  return (
    <Card>
      <CardHeader title="My Folders" subtitle={`${state.folders.length} folders, ${state.notes.length} notes`} />
      <div className="border-b border-line p-4">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            addFolder(name);
            setName('');
          }}
        >
          <Input placeholder="New folder… e.g. JavaScript" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit"><IconPlus className="h-4 w-4" /> Add</Button>
        </form>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {visible.length === 0 ? (
          <div className="sm:col-span-2">
            <EmptyState title="No folders here" hint={q ? 'No folders match your search.' : 'Create your first folder above.'} />
          </div>
        ) : (
          visible.map((f) => {
            const count = state.notes.filter((n) => n.folderId === f.id).length;
            const links = state.notes.filter((n) => n.folderId === f.id && n.url).length;
            return (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border border-line p-4">
                <IconFolder className="h-5 w-5 shrink-0 text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{f.name}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{count} {count === 1 ? 'note' : 'notes'} · {links} {links === 1 ? 'resource' : 'resources'}</p>
                </div>
                {state.folders.length > 1 && (
                  <button onClick={() => deleteFolder(f.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label={`Delete ${f.name}`}>
                    <IconTrash />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
