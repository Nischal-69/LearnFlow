import { useEffect, useMemo, useRef, useState } from 'react';
import type { Folder, Goal, Note, Roadmap } from '../types';
import { applyMarkdownFormat, renderMarkdown, type FormatKind } from '../markdown';
import { Button, Input, Label } from './ui';

export interface NoteDraft {
  title: string;
  content: string;
  tagsInput: string;
  folderId: string;
  goalId: string;
  roadmapId: string;
  roadmapStepId: string;
  pinned: boolean;
}

export function draftFromNote(n: Note): NoteDraft {
  return {
    title: n.title,
    content: n.content ?? '',
    tagsInput: (n.tags ?? []).join(', '),
    folderId: n.folderId,
    goalId: n.goalId ?? '',
    roadmapId: n.roadmapId ?? '',
    roadmapStepId: n.roadmapStepId ?? '',
    pinned: n.pinned === true,
  };
}

function draftsEqual(a: NoteDraft, b: NoteDraft): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.tagsInput === b.tagsInput &&
    a.folderId === b.folderId &&
    a.goalId === b.goalId &&
    a.roadmapId === b.roadmapId &&
    a.roadmapStepId === b.roadmapStepId &&
    a.pinned === b.pinned
  );
}

const TOOLBAR: { kind: FormatKind; label: string; hint: string }[] = [
  { kind: 'h1', label: 'H1', hint: 'Heading 1' },
  { kind: 'h2', label: 'H2', hint: 'Heading 2' },
  { kind: 'h3', label: 'H3', hint: 'Heading 3' },
  { kind: 'bold', label: 'B', hint: 'Bold (**text**)' },
  { kind: 'italic', label: 'I', hint: 'Italic (*text*)' },
  { kind: 'bullet', label: '• List', hint: 'Bullet list' },
  { kind: 'numbered', label: '1. List', hint: 'Numbered list' },
  { kind: 'code', label: '</>', hint: 'Code block / inline code' },
  { kind: 'link', label: 'Link', hint: 'Link [text](url)' },
];

export default function NoteEditor({
  note,
  folders,
  goals,
  roadmaps,
  onAutosave,
  onClose,
}: {
  note: Note;
  folders: Folder[];
  goals: Goal[];
  roadmaps: Roadmap[];
  onAutosave: (id: string, patch: { title: string; content: string; tags: string; folderId: string; goalId: string | null; roadmapId: string | null; roadmapStepId: string | null; pinned: boolean }) => void;
  onClose: () => void;
}) {
  const initial = useMemo(() => draftFromNote(note), [note.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft, setDraft] = useState<NoteDraft>(initial);
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [saveState, setSaveState] = useState<'saved' | 'editing' | 'saving'>('saved');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savedRef = useRef<NoteDraft>(initial);

  // Reset when switching notes
  useEffect(() => {
    setDraft(draftFromNote(note));
    savedRef.current = draftFromNote(note);
    setSaveState('saved');
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave (debounced, local persistence via store → localStorage)
  useEffect(() => {
    if (draftsEqual(draft, savedRef.current)) {
      setSaveState('saved');
      return;
    }
    setSaveState('editing');
    const t = window.setTimeout(() => {
      const current = draftRef.current;
      if (draftsEqual(current, savedRef.current)) return;
      setSaveState('saving');
      onAutosave(note.id, {
        title: current.title.trim() || note.title,
        content: current.content,
        tags: current.tagsInput,
        folderId: current.folderId || note.folderId,
        goalId: current.goalId || null,
        roadmapId: current.roadmapId || null,
        roadmapStepId: current.roadmapId && current.roadmapStepId ? current.roadmapStepId : null,
        pinned: current.pinned,
      });
      savedRef.current = { ...current };
      setSaveState('saved');
      setSavedAt(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 800);
    return () => window.clearTimeout(t);
  }, [draft, note.id, note.title, note.folderId, onAutosave]);

  // Flush on unmount / close handled by parent calling onAutosave once more if dirty
  function flushAndClose() {
    const current = draftRef.current;
    if (!draftsEqual(current, savedRef.current)) {
      onAutosave(note.id, {
        title: current.title.trim() || note.title,
        content: current.content,
        tags: current.tagsInput,
        folderId: current.folderId || note.folderId,
        goalId: current.goalId || null,
        roadmapId: current.roadmapId || null,
        roadmapStepId: current.roadmapId && current.roadmapStepId ? current.roadmapStepId : null,
        pinned: current.pinned,
      });
    }
    onClose();
  }

  function applyFormat(kind: FormatKind) {
    const el = areaRef.current;
    if (!el) {
      // fallback without selection
      const r = applyMarkdownFormat(draft.content, draft.content.length, draft.content.length, kind);
      setDraft((d) => ({ ...d, content: r.text }));
      return;
    }
    const { selectionStart, selectionEnd, value } = el;
    const r = applyMarkdownFormat(value, selectionStart, selectionEnd, kind);
    setDraft((d) => ({ ...d, content: r.text }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(r.selStart, r.selEnd);
    });
  }

  const steps = roadmaps.find((r) => r.id === draft.roadmapId)?.steps ?? [];
  const words = draft.content.trim() ? draft.content.trim().split(/\s+/).length : 0;
  const previewHtml = useMemo(() => renderMarkdown(draft.content), [draft.content]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface" role="dialog" aria-modal="true" aria-label={`Editing ${note.title}`}>
      {/* minimal top bar */}
      <div className="flex items-center gap-3 border-b border-line bg-card px-4 py-3">
        <button onClick={flushAndClose} className="rounded-lg px-2 py-1 text-sm font-medium text-ink-secondary hover:bg-surface" aria-label="Close editor">
          ← Back
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-ink">{draft.title || 'Untitled note'}</p>
          <p className="text-xs text-ink-muted" aria-live="polite">
            {saveState === 'saving' ? 'Saving…' : saveState === 'editing' ? 'Unsaved changes' : savedAt ? `Autosaved · ${savedAt}` : 'Autosaved locally'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-line">
            <button
              onClick={() => setMode('write')}
              className={`px-3 py-1.5 text-xs font-medium ${mode === 'write' ? 'bg-ink text-white' : 'bg-white text-ink-secondary'}`}
            >
              Write
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`px-3 py-1.5 text-xs font-medium ${mode === 'preview' ? 'bg-ink text-white' : 'bg-white text-ink-secondary'}`}
            >
              Preview
            </button>
          </div>
          <Button onClick={flushAndClose} className="hidden sm:inline-flex">Done</Button>
        </div>
      </div>

      {/* meta strip */}
      <div className="border-b border-line bg-card px-4 py-3">
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Title</Label>
            <Input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Note title"
              onKeyDown={(e) => {
                if (e.key === 'Escape') flushAndClose();
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                  e.preventDefault();
                  flushAndClose();
                }
              }}
            />
          </div>
          <div>
            <Label>Folder</Label>
            <select
              value={draft.folderId}
              onChange={(e) => setDraft((d) => ({ ...d, folderId: e.target.value }))}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{(f.parentId ? '↳ ' : '') + f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Tags (comma separated)</Label>
            <Input
              value={draft.tagsInput}
              onChange={(e) => setDraft((d) => ({ ...d, tagsInput: e.target.value }))}
              placeholder="e.g. react, hooks, review"
            />
          </div>
          <div>
            <Label>Related learning goal (optional)</Label>
            <select
              value={draft.goalId}
              onChange={(e) => setDraft((d) => ({ ...d, goalId: e.target.value }))}
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              <option value="">No goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>{g.title}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Roadmap (optional)</Label>
              <select
                value={draft.roadmapId}
                onChange={(e) => setDraft((d) => ({ ...d, roadmapId: e.target.value, roadmapStepId: '' }))}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
              >
                <option value="">None</option>
                {roadmaps.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Step</Label>
              <select
                value={draft.roadmapStepId}
                disabled={!draft.roadmapId}
                onChange={(e) => setDraft((d) => ({ ...d, roadmapStepId: e.target.value }))}
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
                <option value="">{draft.roadmapId ? 'Pick step' : 'Pick roadmap'}</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-secondary sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.pinned}
              onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
              className="h-4 w-4 accent-indigo-600"
            />
            Pin this note (pinned notes stay on top)
          </label>
        </div>
      </div>

      {/* toolbar */}
      {mode === 'write' && (
        <div className="border-b border-line bg-card px-4 py-2">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-1">
            {TOOLBAR.map((t) => (
              <button
                key={t.kind}
                title={t.hint}
                onClick={() => applyFormat(t.kind)}
                className="rounded-md px-2 py-1 text-xs font-semibold text-ink-secondary hover:bg-surface hover:text-ink"
              >
                {t.label}
              </button>
            ))}
            <span className="ml-auto hidden text-xs text-ink-muted sm:inline">Markdown · autosaves locally</span>
          </div>
        </div>
      )}

      {/* distraction-free canvas */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          {mode === 'write' ? (
            <textarea
              ref={areaRef}
              value={draft.content}
              onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
              placeholder={'# Start writing…\n\n**Bold**, *italic*, - lists, 1. lists, `code`, [link](https://…)\n\n```\ncode block\n```'}
              className="min-h-[50vh] w-full resize-y rounded-xl border border-line bg-card p-5 text-[15px] leading-relaxed text-ink shadow-card placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
          ) : (
            <div className="min-h-[50vh] rounded-xl border border-line bg-card p-5 shadow-card">
              {draft.content.trim() ? (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              ) : (
                <p className="text-sm text-ink-muted">Nothing to preview yet — switch to Write and add some markdown.</p>
              )}
            </div>
          )}
          <p className="mt-2 text-right text-xs text-ink-muted">{words} {words === 1 ? 'word' : 'words'}</p>
        </div>
      </div>
    </div>
  );
}
