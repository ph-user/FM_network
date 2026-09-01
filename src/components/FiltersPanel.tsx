'use client';

import { useMemo } from 'react';

import { BUILDING_TYPES, STATUSES, type Building } from '@/lib/types';
import type { Filters } from '@/lib/filters';
import { AddressRadiusInput } from './AddressRadiusInput';

import styles from './FiltersPanel.module.css';

interface FiltersPanelProps {
  allBuildings: Building[];
  filters: Filters;
  onChange: (updates: Partial<Filters>) => void;
  /** How many buildings the current (not-yet-applied) form would match. */
  pendingCount: number;
  onApply: () => void;
  onExport: () => void;
}

export function FiltersPanel({
  allBuildings,
  filters,
  onChange,
  pendingCount,
  onApply,
  onExport,
}: FiltersPanelProps) {
  const postcodes = useMemo(
    () => Array.from(new Set(allBuildings.map((b) => b.postcode))).sort(),
    [allBuildings],
  );

  function toggle<T>(set: Set<T>, value: T): Set<T> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter') onApply();
  }

  return (
    <div className={styles.panel} onKeyDown={onKeyDown}>
      <div className={styles.applyRow}>
        <div className={styles.count}>
          {pendingCount} of {allBuildings.length} buildings
        </div>
        <button className="btn" onClick={onApply}>
          Apply filters
        </button>
      </div>

      <button className="btn btn-secondary" onClick={onExport}>
        Export CSV
      </button>

      <label className={`field ${styles.section}`}>
        <span>Building name</span>
        <input
          className="input"
          value={filters.nameSearch}
          onChange={(e) => onChange({ nameSearch: e.target.value })}
          placeholder="Search by name"
        />
      </label>

      <label className={`field ${styles.section}`}>
        <span>Address</span>
        <input
          className="input"
          value={filters.addressSearch}
          onChange={(e) => onChange({ addressSearch: e.target.value })}
          placeholder="Search by address"
        />
      </label>

      <div className={styles.section}>
        <span className={styles.label}>Status</span>
        <div className={styles.checkboxList}>
          {STATUSES.map((status) => (
            <label key={status} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={filters.statuses.has(status)}
                onChange={() => onChange({ statuses: toggle(filters.statuses, status) })}
              />
              <span className={`dot dot-${status.toLowerCase()}`} />
              {status}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Building type</span>
        <div className={styles.checkboxList}>
          {BUILDING_TYPES.map((type) => (
            <label key={type} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={filters.types.has(type)}
                onChange={() => onChange({ types: toggle(filters.types, type) })}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <span className={styles.label}>Levels</span>
        <div className={styles.levelsRow}>
          <input
            className="input"
            type="number"
            min={1}
            placeholder="Min"
            value={filters.minLevels ?? ''}
            onChange={(e) => onChange({ minLevels: e.target.value ? Number(e.target.value) : null })}
          />
          <span>to</span>
          <input
            className="input"
            type="number"
            min={1}
            placeholder="Max"
            value={filters.maxLevels ?? ''}
            onChange={(e) => onChange({ maxLevels: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      {postcodes.length > 0 && (
        <div className={styles.section}>
          <span className={styles.label}>Postcode</span>
          <div className={`${styles.checkboxList} ${styles.scrollable}`}>
            {postcodes.map((postcode) => (
              <label key={postcode} className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={filters.postcodes.has(postcode)}
                  onChange={() => onChange({ postcodes: toggle(filters.postcodes, postcode) })}
                />
                {postcode}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.label}>Within distance of an address</span>
        <AddressRadiusInput
          onSelect={({ address, lat, lng }) =>
            onChange({ radius: { address, lat, lng, km: filters.radius?.km ?? 2 } })
          }
        />
        {filters.radius && (
          <div className={styles.radiusRow}>
            <span className={styles.radiusAddress}>{filters.radius.address}</span>
            <input
              className="input"
              type="number"
              min={0.1}
              step={0.1}
              value={filters.radius.km}
              onChange={(e) =>
                onChange({ radius: { ...filters.radius!, km: Number(e.target.value) || 0 } })
              }
            />
            <span>km</span>
            <button className="btn btn-secondary" onClick={() => onChange({ radius: null })}>
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
