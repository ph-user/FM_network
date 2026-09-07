'use client';

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Map, AdvancedMarker, Pin, useMap } from '@vis.gl/react-google-maps';

import type { Building, City } from '@/lib/types';
import type { Role } from '@/lib/session';
import type { RadiusFilter } from '@/lib/filters';
import { RadiusCircle } from './RadiusCircle';
import { BuildingInfoPanel } from './BuildingInfoPanel';

import styles from './BuildingWorkspace.module.css';
import shellStyles from '@/app/shell.module.css';

const CITY_CENTER: Record<City, { lat: number; lng: number }> = {
  Melbourne: { lat: -37.8136, lng: 144.9631 },
  Sydney: { lat: -33.8688, lng: 151.2093 },
};
const DEFAULT_ZOOM = 13;

const PIN_COLOR = '#c62828';

/**
 * Under 300 buildings total, so every marker is loaded and rendered up front
 * -- no clustering, no viewport-based fetching.
 */
interface BuildingWorkspaceProps {
  buildings: Building[];
  city: City;
  radiusFilter: RadiusFilter | null;
  role: Role;
  filtersCollapsed: boolean;
  onToggleFilters: () => void;
}

export function BuildingWorkspace({
  buildings,
  city,
  radiusFilter,
  role,
  filtersCollapsed,
  onToggleFilters,
}: BuildingWorkspaceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('building');
  const selected = useMemo(
    () => buildings.find((b) => b.id === selectedId) ?? null,
    [buildings, selectedId],
  );

  function select(id: string | null) {
    const params = new URLSearchParams(searchParams);
    if (id) {
      params.set('building', id);
    } else {
      params.delete('building');
    }
    router.replace(`/${params.size ? `?${params.toString()}` : ''}`, { scroll: false });
  }

  return (
    <main className={shellStyles.map}>
      <button
        type="button"
        className={styles.filtersToggle}
        onClick={onToggleFilters}
        aria-label={filtersCollapsed ? 'Show filters' : 'Hide filters'}
        aria-expanded={!filtersCollapsed}
      >
        <span className={styles.filtersToggleIcon} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        Filters
      </button>

      <Map
        key={city}
        mapId="DEMO_MAP_ID"
        defaultCenter={CITY_CENTER[city]}
        defaultZoom={DEFAULT_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI={false}
        clickableIcons={false}
        onClick={() => select(null)}
        style={{ width: '100%', height: '100%' }}
      >
        <FitToBuildings buildings={buildings} skip={radiusFilter != null} />
        {radiusFilter && (
          <RadiusCircle center={{ lat: radiusFilter.lat, lng: radiusFilter.lng }} radiusKm={radiusFilter.km} />
        )}
        {buildings.map((building) => (
          <AdvancedMarker
            key={building.id}
            position={{ lat: building.lat, lng: building.lng }}
            title={building.name}
            onClick={() => select(building.id)}
          >
            <div className={building.id === selectedId ? styles.selectedRing : undefined}>
              <Pin background={PIN_COLOR} borderColor={PIN_COLOR} glyphColor="#ffffff" scale={building.id === selectedId ? 1.15 : 1} />
            </div>
          </AdvancedMarker>
        ))}
      </Map>

      {selected && (
        <div className={styles.infoCard}>
          <button type="button" className={styles.infoCardClose} onClick={() => select(null)} aria-label="Close">
            ×
          </button>
          <BuildingInfoPanel
            key={selected.id}
            building={selected}
            role={role}
            onSaved={() => router.refresh()}
            onDeleted={() => {
              select(null);
              router.refresh();
            }}
          />
        </div>
      )}
    </main>
  );
}

/**
 * Frames every marker when the filtered set changes. Skipped while a radius
 * filter is active -- RadiusCircle frames the circle instead, so the two
 * don't fight over the viewport.
 */
function FitToBuildings({ buildings, skip }: { buildings: Building[]; skip: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (!map || skip || buildings.length === 0) return;

    if (buildings.length === 1) {
      map.setCenter({ lat: buildings[0].lat, lng: buildings[0].lng });
      map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    buildings.forEach((b) => bounds.extend({ lat: b.lat, lng: b.lng }));
    map.fitBounds(bounds, 48);
    // Only when the filtered set changes, not on every pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, skip, buildings.length]);

  return null;
}
