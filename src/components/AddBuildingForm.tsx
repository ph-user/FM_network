'use client';

import { useState } from 'react';

import { BUILDING_TYPES, CITIES, type Building } from '@/lib/types';
import { AddressField } from './AddressField';

import styles from './AddBuildingForm.module.css';

interface AddBuildingFormProps {
  onCreated: (building: Building) => void;
  onCancel: () => void;
}

export function AddBuildingForm({ onCreated, onCancel }: AddBuildingFormProps) {
  const [id, setId] = useState('');
  const [city, setCity] = useState<Building['city']>('Melbourne');
  const [name, setName] = useState('');
  const [buildingType, setBuildingType] = useState<Building['building_type']>('Office');
  const [suburb, setSuburb] = useState('');
  const [address, setAddress] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [levels, setLevels] = useState('');
  const [screenCount, setScreenCount] = useState('0');
  const [population, setPopulation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = id.trim() && name.trim() && suburb.trim() && placeId;

  async function submit() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/buildings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          city,
          name,
          building_type: buildingType,
          suburb,
          placeId,
          levels: levels.trim() === '' ? null : Number(levels),
          screen_count: Number(screenCount) || 0,
          population: population.trim() === '' ? null : Number(population),
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

      <div className={styles.row}>
        <label className="field">
          <span>Building id</span>
          <input className="input" value={id} onChange={(e) => setId(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>City</span>
          <select className="input" value={city} onChange={(e) => setCity(e.target.value as Building['city'])}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className={styles.row}>
        <label className="field">
          <span>Type</span>
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
          <span>Suburb</span>
          <input className="input" value={suburb} onChange={(e) => setSuburb(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>Address</span>
        <AddressField
          defaultValue={address}
          onSelect={({ placeId: newPlaceId, address: resolvedAddress }) => {
            setPlaceId(newPlaceId);
            setAddress(resolvedAddress);
          }}
        />
      </label>

      <div className={styles.row}>
        <label className="field">
          <span>Level</span>
          <input
            className="input"
            type="number"
            min={1}
            value={levels}
            onChange={(e) => setLevels(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Screen</span>
          <input
            className="input"
            type="number"
            min={0}
            value={screenCount}
            onChange={(e) => setScreenCount(e.target.value)}
          />
        </label>
      </div>

      <label className="field">
        <span>Population</span>
        <input
          className="input"
          type="number"
          min={0}
          value={population}
          onChange={(e) => setPopulation(e.target.value)}
        />
      </label>

      <label className="field">
        <span>Note</span>
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
