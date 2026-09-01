'use client';

import { useState } from 'react';

import { BUILDING_TYPES, STATUSES, type Building } from '@/lib/types';
import { AddressField } from './AddressField';

import styles from './AddBuildingForm.module.css';

interface AddBuildingFormProps {
  onCreated: (building: Building) => void;
  onCancel: () => void;
}

export function AddBuildingForm({ onCreated, onCancel }: AddBuildingFormProps) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [levels, setLevels] = useState('');
  const [buildingType, setBuildingType] = useState<Building['building_type']>('Office');
  const [status, setStatus] = useState<Building['status']>('Signed');
  const [screenCount, setScreenCount] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && placeId && levels;

  async function submit() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          placeId,
          levels: Number(levels),
          building_type: buildingType,
          status,
          screen_count: Number(screenCount) || 0,
          notes,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setError(payload.error ?? 'Could not create building.');
        setSaving(false);
        return;
      }

      const building: Building = await response.json();
      onCreated(building);
    } catch {
      setError('Could not reach the server. Check your connection.');
      setSaving(false);
    }
  }

  return (
    <div className={styles.form}>
      <h2 className={styles.title}>Add a building</h2>

      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>

      <label className="field">
        <span>Address</span>
        <AddressField
          defaultValue={address}
          onSelect={({ placeId: id, address: resolvedAddress }) => {
            setPlaceId(id);
            setAddress(resolvedAddress);
          }}
        />
      </label>

      <div className={styles.row}>
        <label className="field">
          <span>Levels</span>
          <input
            className="input"
            type="number"
            min={1}
            value={levels}
            onChange={(e) => setLevels(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Screens</span>
          <input
            className="input"
            type="number"
            min={0}
            value={screenCount}
            onChange={(e) => setScreenCount(e.target.value)}
          />
        </label>
      </div>

      <div className={styles.row}>
        <label className="field">
          <span>Building type</span>
          <select
            className="input"
            value={buildingType}
            onChange={(e) => setBuildingType(e.target.value as Building['building_type'])}
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
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Building['status'])}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea className={`input ${styles.textarea}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button className="btn" onClick={submit} disabled={!canSubmit || saving}>
          {saving ? 'Adding' : 'Add building'}
        </button>
      </div>
    </div>
  );
}
