'use client';

import { useState } from 'react';

import { BUILDING_TYPES, STATUSES, type Building } from '@/lib/types';
import type { Role } from '@/lib/session';

import { AddressField } from './AddressField';
import { ImagesGallery } from './ImagesGallery';
import { DeleteBuildingModal } from './DeleteBuildingModal';

import styles from './BuildingWorkspace.module.css';
import formStyles from './BuildingInfoPanel.module.css';

interface BuildingInfoPanelProps {
  building: Building;
  role: Role;
  onSaved: () => void;
  onDeleted: () => void;
}

interface Draft {
  name: string;
  address: string;
  placeId: string | null;
  levels: string;
  building_type: Building['building_type'];
  status: Building['status'];
  screen_count: string;
  notes: string;
}

function draftFrom(building: Building): Draft {
  return {
    name: building.name,
    address: building.address,
    placeId: null,
    levels: String(building.levels),
    building_type: building.building_type,
    status: building.status,
    screen_count: String(building.screen_count),
    notes: building.notes,
  };
}

export function BuildingInfoPanel({ building, role, onSaved, onDeleted }: BuildingInfoPanelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(building));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = role === 'editor';

  function startEditing() {
    setDraft(draftFrom(building));
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      name: draft.name,
      levels: Number(draft.levels),
      building_type: draft.building_type,
      status: draft.status,
      screen_count: Number(draft.screen_count),
      notes: draft.notes,
    };
    if (draft.placeId) body.placeId = draft.placeId;

    try {
      const response = await fetch(`/api/buildings/${building.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? 'Could not save changes.');
        setSaving(false);
        return;
      }

      setEditing(false);
      setSaving(false);
      onSaved();
    } catch {
      setError('Could not reach the server. Check your connection.');
      setSaving(false);
    }
  }

  async function confirmDelete() {
    const response = await fetch(`/api/buildings/${building.id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('delete failed');
    setDeleting(false);
    onDeleted();
  }

  if (editing) {
    return (
      <div className={styles.details}>
        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Address</span>
          <AddressField
            defaultValue={draft.address}
            onSelect={({ placeId, address }) => setDraft({ ...draft, placeId, address })}
          />
        </label>

        <div className={formStyles.row}>
          <label className="field">
            <span>Levels</span>
            <input
              className="input"
              type="number"
              min={1}
              value={draft.levels}
              onChange={(e) => setDraft({ ...draft, levels: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Screens</span>
            <input
              className="input"
              type="number"
              min={0}
              value={draft.screen_count}
              onChange={(e) => setDraft({ ...draft, screen_count: e.target.value })}
            />
          </label>
        </div>

        <div className={formStyles.row}>
          <label className="field">
            <span>Building type</span>
            <select
              className="input"
              value={draft.building_type}
              onChange={(e) => setDraft({ ...draft, building_type: e.target.value as Building['building_type'] })}
            >
              {BUILDING_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select
              className="input"
              value={draft.status}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as Building['status'] })}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea
            className={`input ${formStyles.textarea}`}
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>

        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}

        <div className={formStyles.actions}>
          <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </button>
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? 'Saving' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.details}>
      <h2 className={styles.name}>{building.name}</h2>
      <p className={styles.address}>{building.address}</p>
      <dl className={styles.factList}>
        <div>
          <dt>Status</dt>
          <dd>{building.status}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{building.building_type}</dd>
        </div>
        <div>
          <dt>Levels</dt>
          <dd>{building.levels}</dd>
        </div>
        <div>
          <dt>Screens</dt>
          <dd>{building.screen_count}</dd>
        </div>
      </dl>

      {building.notes && <p className={formStyles.notes}>{building.notes}</p>}

      {canEdit && (
        <div className={formStyles.actions}>
          <button className="btn btn-secondary" onClick={startEditing}>
            Edit
          </button>
          <button className={`btn btn-secondary ${formStyles.deleteBtn}`} onClick={() => setDeleting(true)}>
            Delete
          </button>
        </div>
      )}

      <ImagesGallery buildingId={building.id} canEdit={canEdit} />

      {deleting && (
        <DeleteBuildingModal
          buildingName={building.name}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(false)}
        />
      )}
    </div>
  );
}
