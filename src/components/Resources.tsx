import type { LearnFlowApi } from '../store';
import { formatDate } from '../utils';
import { Button, Card, CardHeader, EmptyState } from './ui';
import { IconBookmark, IconLink, IconTrash } from './icons';
import type { ViewKey } from '../types';

export default function Resources({
  api,
  search,
  go,
}: {
  api: LearnFlowApi;
  search: string;
  go: (v: ViewKey) => void;
}) {
  const { state, deleteNote } = api;
  const q = search.trim().toLowerCase();
  const visible = state.notes.filter((n) => {
    if (!n.url) return false;
    if (q && !(n.title + ' ' + n.url + ' ' + n.content).toLowerCase().includes(q)) return false;
    return true;
  });
  const folderName = (id: string) => state.folders.find((f) => f.id === id)?.name ?? 'Unknown';

  return (
    <Card>
      <CardHeader title="Resources" subtitle={`${visible.length} saved links`} />
      <div className="space-y-3 p-4">
        {visible.length === 0 ? (
          <div>
            <EmptyState title="No resources yet" hint={q ? 'No links match your search.' : 'Add a URL to any note to see it here.'} />
            <div className="mt-3 text-center">
              <Button variant="secondary" onClick={() => go('notes')}>Go to Learning Notes</Button>
            </div>
          </div>
        ) : (
          visible.map((n) => (
            <div key={n.id} className="flex items-start gap-3 rounded-lg border border-line p-4">
              <IconBookmark className="h-5 w-5 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{n.title}</p>
                <a
                  href={n.url.startsWith('http') ? n.url : `https://${n.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                >
                  <IconLink /> {n.url}
                </a>
                {n.content && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{n.content}</p>}
                <p className="mt-1 text-[11px] text-ink-muted">{folderName(n.folderId)} · Updated {formatDate(n.updatedAt)}</p>
              </div>
              <button onClick={() => deleteNote(n.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-danger" aria-label="Delete resource">
                <IconTrash />
              </button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
