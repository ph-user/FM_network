'use client';

import { useState } from 'react';

import { Modal } from './Modal';
import styles from './DeleteBuildingModal.module.css';

interface DeleteBuildingModalProps {
  buildingName: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * Typing the name, not two sequential OK dialogs -- two dialogs in a row
 * train people to click through both without reading (CLAUDE.md).
 */
export function DeleteBuildingModal({ buildingName, onConfirm, onClose }: DeleteBuildingModalProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim() === buildingName;

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Could not delete this building. Try again.');
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h2 className={styles.title}>Delete {buildingName}?</h2>
      <p className={styles.body}>
        This permanently deletes the building and all of its images. This cannot be undone.
      </p>
      <label className={`field ${styles.field}`}>
        <span>
          Type <strong>{buildingName}</strong> to confirm
        </span>
        <input
          className="input"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          autoFocus
        />
      </label>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className={`btn ${styles.deleteBtn}`} onClick={handleConfirm} disabled={!matches || busy}>
          {busy ? 'Deleting' : 'Delete building'}
        </button>
      </div>
    </Modal>
  );
}
