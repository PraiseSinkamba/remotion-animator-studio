import React from 'react';
import type { StorageStatus } from '../storage/types';

export interface StorageIndicatorProps {
  status: StorageStatus;
  /** True while the editor holds changes that storage does not have yet. */
  saving: boolean;
  /** The last failure, if the workspace could not be written. */
  error: string | null;
  /** Commits the document right away. */
  onSave?: () => void;
}

type Tone = 'ok' | 'busy' | 'warn' | 'bad';

interface Chip {
  label: string;
  tone: Tone;
}

/**
 * What the chip says about the workspace.
 *
 * The order matters: a problem with the backend outranks a pending save, and
 * nothing claims to be saved while the editor holds unsaved changes or the
 * last write failed.
 */
const describe = (status: StorageStatus, saving: boolean, error: string | null): Chip => {
  if (status.problem === 'locked-by-other-tab' || status.writeAccess === 'read-only') {
    return { label: 'Read-only — another tab owns this workspace', tone: 'warn' };
  }
  if (status.problem === 'quota-exceeded') {
    return { label: 'Storage full — export to keep your work', tone: 'bad' };
  }
  if (status.problem) {
    return { label: `Storage degraded — ${status.detail ?? status.problem}`, tone: 'bad' };
  }
  if (error) {
    return { label: 'Not saved — use Save As to keep your work', tone: 'bad' };
  }
  if (saving) {
    return { label: 'Saving…', tone: 'busy' };
  }
  if (!status.durable) {
    return { label: 'Not saved — use Save As to keep your work', tone: 'bad' };
  }
  return { label: 'Saved locally', tone: 'ok' };
};

/**
 * The chip in the top bar that tells the user where their work lives.
 *
 * Clicking it commits the document right away.
 */
export const StorageIndicator: React.FC<StorageIndicatorProps> = ({ status, saving, error, onSave }) => {
  const { label, tone } = describe(status, saving, error);
  return (
    <button
      type="button"
      className={`storage-chip storage-chip--${tone}`}
      title={error ?? status.detail ?? 'This project is stored in your browser'}
      onClick={() => onSave?.()}
    >
      {label}
    </button>
  );
};
