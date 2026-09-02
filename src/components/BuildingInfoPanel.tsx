'use client';

import { useState } from 'react';

import { BUILDING_TYPES, CITIES, type Building, type BuildingType } from '@/lib/types';
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
  city: Building['city'];
  name: string;
  address: string;
  placeId: string | null;
  building_type: Set<BuildingType>;
  suburb: string;
  levels: string;
  screen_count: string;
  population: string;
  notes: string;
}

function draftFrom(building: Building): Draft {
  return {
    city: building.city,
    name: building.name,
    address: building.address,
    placeId: null,
    building_type: new Set(building.building_type),
    suburb: building.suburb,
    levels: building.levels != null ? String(building.levels) : '',
    screen_count: String(building.screen_count),
    population: building.population != null ? String(building.population) : '',
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

  function toggleType(type: BuildingType) {
    setDraft((prev) => {
      const next = new Set(prev.building_type);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return { ...prev, building_type: next };
    });
  }

  async function save() {
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
      city: draft.city,
      name: draft.name,
      building_type: Array.from(draft.building_type),
      suburb: draft.suburb,
      levels: draft.levels.trim() === '' ? null : Number(draft.levels),
      screen_count: Number(draft.screen_count),
      population: draft.population.trim() === '' ? null : Number(draft.population),
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
            <span>City</span>
            <select
              className="input"
              value={draft.city}
              onChange={(e) => setDraft({ ...draft, city: e.target.value as Building['city'] })}
            >
              {CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Suburb</span>
            <input
              className="input"
              value={draft.suburb}
              onChange={(e) => setDraft({ ...draft, suburb: e.target.value })}
            />
          </label>
        </div>

        <div className="field">
          <span>Type</span>
          <div className={formStyles.checkboxList}>
            {BUILDING_TYPES.map((type) => (
              <label key={type} className={formStyles.checkbox}>
                <input type="checkbox" checked={draft.building_type.has(type)} onChange={() => toggleType(type)} />
                {type}
              </label>
            ))}
          </div>
        </div>

        <div className={formStyles.row}>
          <label className="field">
            <span>Level</span>
            <input
              className="input"
              type="number"
              min={1}
              value={draft.levels}
              onChange={(e) => setDraft({ ...draft, levels: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Screen</span>
            <input
              className="input"
              type="number"
              min={0}
              value={draft.screen_count}
              onChange={(e) => setDraft({ ...draft, screen_count: e.target.value })}
            />
          </label>
        </div>

        <label className="field">
          <span>Population</span>
          <input
            className="input"
            type="number"
            min={0}
            value={draft.population}
            onChange={(e) => setDraft({ ...draft, population: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Note</span>
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
          <button className="btn" onClick={save} disabled={saving || draft.building_type.size === 0}>
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
          <dt>Id</dt>
          <dd>{building.id}</dd>
        </div>
        <div>
          <dt>City</dt>
          <dd>{building.city}</dd>
        </div>
        <div>
          <dt>Suburb</dt>
          <dd>{building.suburb}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{building.building_type.join(', ')}</dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd>{building.levels ?? '—'}</dd>
        </div>
        <div>
          <dt>Screen</dt>
          <dd>{building.screen_count}</dd>
        </div>
        {building.population != null && (
          <div>
            <dt>Population</dt>
            <dd>{building.population}</dd>
          </div>
        )}
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
