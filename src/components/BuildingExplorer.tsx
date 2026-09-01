'use client';

import { useMemo, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

import type { Building } from '@/lib/types';
import type { Role } from '@/lib/session';
import { applyFilters, EMPTY_FILTERS, type Filters } from '@/lib/filters';
import { buildingsToCsv, downloadCsv } from '@/lib/csv';

import { FiltersPanel } from './FiltersPanel';
import { BuildingWorkspace } from './BuildingWorkspace';

import shellStyles from '@/app/shell.module.css';

/**
 * Owns filter state and wraps the filters panel, map and info panel in one
 * APIProvider so the address autocomplete (in the filters panel) and the map
 * (in the centre) share the same loaded Maps JS API instance.
 *
 * Filters are edited as a draft and only reach the map (and Export CSV) once
 * "Apply filters" is clicked -- an explicit step the client asked for, so the
 * map doesn't jump around while filters are still being composed. The match
 * count stays live against the draft as a preview of what Apply will do.
 */
export function BuildingExplorer({ buildings, role }: { buildings: Building[]; role: Role }) {
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);

  const pending = useMemo(() => applyFilters(buildings, draftFilters), [buildings, draftFilters]);
  const applied = useMemo(() => applyFilters(buildings, appliedFilters), [buildings, appliedFilters]);

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
      <aside className={shellStyles.filters}>
        <FiltersPanel
          allBuildings={buildings}
          filters={draftFilters}
          onChange={onChange}
          pendingCount={pending.length}
          onApply={onApply}
          onExport={onExport}
        />
      </aside>

      <BuildingWorkspace buildings={applied} radiusFilter={appliedFilters.radius} role={role} />
    </APIProvider>
  );
}
