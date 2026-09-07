'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APIProvider } from '@vis.gl/react-google-maps';

import { CITIES, type Building, type City } from '@/lib/types';
import type { Role } from '@/lib/session';
import { applyFilters, EMPTY_FILTERS, type Filters } from '@/lib/filters';
import { buildingsToCsv, downloadCsv } from '@/lib/csv';

import { FiltersPanel } from './FiltersPanel';
import { BuildingWorkspace } from './BuildingWorkspace';

import shellStyles from '@/app/shell.module.css';
import styles from './BuildingExplorer.module.css';

const DEFAULT_CITY: City = 'Melbourne';

function readCity(searchParams: URLSearchParams): City {
  const value = searchParams.get('city');
  return (CITIES as readonly string[]).includes(value ?? '') ? (value as City) : DEFAULT_CITY;
}

/**
 * Owns city selection and filter state, and wraps the filters panel, map and
 * info panel in one APIProvider so the address autocomplete (in the filters
 * panel) and the map (in the centre) share the same loaded Maps JS API
 * instance.
 *
 * City is a live switch, not a filter: the map always renders exactly one
 * city (Melbourne by default), and switching is immediate -- unlike the
 * rest of the filters, which are a draft that only reaches the map once
 * "Apply filters" is clicked (a deliberate client request, so the map
 * doesn't jump around while filters are still being composed). The match
 * count stays live against the draft as a preview of what Apply will do.
 */
export function BuildingExplorer({ buildings, role }: { buildings: Building[]; role: Role }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const city = readCity(searchParams);

  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [collapsed, setCollapsed] = useState(false);

  const inCity = useMemo(() => buildings.filter((b) => b.city === city), [buildings, city]);
  const pending = useMemo(() => applyFilters(inCity, draftFilters), [inCity, draftFilters]);
  const applied = useMemo(() => applyFilters(inCity, appliedFilters), [inCity, appliedFilters]);

  function selectCity(next: City) {
    if (next === city) return;
    const params = new URLSearchParams(searchParams);
    params.set('city', next);
    params.delete('building');
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    router.replace(`/?${params.toString()}`, { scroll: false });
  }

  function onChange(updates: Partial<Filters>) {
    setDraftFilters((prev) => ({ ...prev, ...updates }));
  }

  function onApply() {
    setAppliedFilters(draftFilters);
  }

  function onExport() {
    downloadCsv('buildings.csv', buildingsToCsv(applied));
  }

  return (
    <APIProvider
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY as string}
      libraries={['marker', 'places']}
    >
      <aside className={`${shellStyles.filters} ${collapsed ? shellStyles.filtersCollapsed : ''}`}>
        <button
          type="button"
          className={styles.collapseToggle}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Show filters' : 'Hide filters'}
          aria-expanded={!collapsed}
        >
          {collapsed ? '›' : '‹'}
        </button>

        <div className={styles.filtersBody}>
          <div className={styles.citySwitch}>
            {CITIES.map((c) => (
              <button
                key={c}
                className={c === city ? styles.cityActive : styles.city}
                onClick={() => selectCity(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <FiltersPanel
            allBuildings={inCity}
            filters={draftFilters}
            onChange={onChange}
            pendingCount={pending.length}
            onApply={onApply}
            onExport={onExport}
          />
        </div>
      </aside>

      <BuildingWorkspace buildings={applied} city={city} radiusFilter={appliedFilters.radius} role={role} />
    </APIProvider>
  );
}
