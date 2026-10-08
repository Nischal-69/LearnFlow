/**
 * Backup (export / import) helpers for LearnFlow local data.
 *
 * - Export serializes the full `LearnFlowState` into a versioned JSON
 *   document: `{ app: 'learnflow', version, exportedAt, data }`.
 * - Import parses + validates structure first, then normalizes through
 *   `migrateStoredState` so older exports upgrade safely.
 * - Nothing here touches storage directly; persistence stays in
 *   `src/data/index.ts` (`replaceAll`). Components only call these pure
 *   helpers plus the download trigger below.
 */
import type { LearnFlowState } from '../types';
import { migrateStoredState } from './schema';

export const BACKUP_APP = 'learnflow';
export const BACKUP_VERSION = 1;

/** Collections that must be arrays when present in an imported document. */
const ARRAY_COLLECTIONS = [
  'tasks',
  'goals',
  'roadmaps',
  'folders',
  'notes',
  'completions',
  'weeklyReviews',
  'dailyReviews',
  'resources',
  'streakHistory',
] as const;

export interface BackupDocument {
  app: string;
  version: number;
  exportedAt: string;
  data: LearnFlowState;
}

export function buildBackupDocument(state: LearnFlowState): BackupDocument {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

export function serializeBackup(state: LearnFlowState): string {
  return JSON.stringify(buildBackupDocument(state), null, 2);
}

export type BackupValidation =
  | { ok: true; state: LearnFlowState }
  | { ok: false; error: string };

/**
 * Validate an imported JSON string without touching existing data.
 * Returns the normalized state ready for `replaceAll` on success.
 */
export function parseBackup(text: string): BackupValidation {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON. Please choose a LearnFlow backup file.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'That file is not a LearnFlow backup (expected a JSON object).' };
  }
  const doc = raw as Record<string, unknown>;
  // Accept both the versioned envelope and a bare state object (v1 exports).
  // An envelope without its data section is corrupt, not empty.
  if (doc.data === undefined && (doc.app !== undefined || doc.version !== undefined || doc.exportedAt !== undefined)) {
    return { ok: false, error: 'Backup is missing its data section.' };
  }
  const data = (doc.data ?? doc) as Record<string, unknown>;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'Backup is missing its data section.' };
  }
  if (doc.data !== undefined && doc.app !== undefined && doc.app !== BACKUP_APP) {
    return { ok: false, error: 'That backup was created by a different app.' };
  }
  for (const key of ARRAY_COLLECTIONS) {
    const value = data[key];
    if (value !== undefined && !Array.isArray(value)) {
      return { ok: false, error: `Backup looks corrupt: “${key}” should be a list.` };
    }
  }
  if (
    (data.user !== undefined && (typeof data.user !== 'object' || data.user === null)) ||
    (data.settings !== undefined && (typeof data.settings !== 'object' || data.settings === null))
  ) {
    return { ok: false, error: 'Backup looks corrupt: user/settings sections are invalid.' };
  }
  try {
    return { ok: true, state: migrateStoredState(data) };
  } catch {
    return { ok: false, error: 'Could not read that backup file. It may be corrupted.' };
  }
}

/** True when there is any user data that an import would replace. */
export function hasExistingData(state: LearnFlowState): boolean {
  return (
    state.tasks.length > 0 ||
    state.goals.length > 0 ||
    state.roadmaps.length > 0 ||
    state.notes.length > 0 ||
    state.completions.length > 0 ||
    state.resources.length > 0 ||
    state.folders.length > 1 ||
    state.dailyReviews.length > 0 ||
    state.weeklyReviews.length > 0 ||
    state.streakHistory.length > 0
  );
}

export function backupFileName(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `learnflow-backup-${y}-${m}-${d}.json`;
}

/** Trigger a browser download of the serialized backup. */
export function downloadBackup(state: LearnFlowState): void {
  const blob = new Blob([serializeBackup(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
