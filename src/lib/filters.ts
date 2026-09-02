import type { Building, BuildingType } from './types';
import { distanceKm } from './geo';

export interface RadiusFilter {
  address: string;
  lat: number;
  lng: number;
  km: number;
}

export interface Filters {
  nameSearch: string;
  addressSearch: string;
  types: Set<BuildingType>;
  suburbs: Set<string>;
  /** "Level from X", no cap -- client asked for a floor only, not a range. */
  minLevels: number | null;
  radius: RadiusFilter | null;
}

export const EMPTY_FILTERS: Filters = {
  nameSearch: '',
  addressSearch: '',
  types: new Set(),
  suburbs: new Set(),
  minLevels: null,
  radius: null,
};

/**
 * All filters are AND-combined. An empty set/unset field means "no filter".
 * City is not here -- it's a live switch applied before these, not a filter
 * (see BuildingExplorer).
 */
export function applyFilters(buildings: Building[], filters: Filters): Building[] {
  const nameSearch = filters.nameSearch.trim().toLowerCase();
  const addressSearch = filters.addressSearch.trim().toLowerCase();

  return buildings.filter((building) => {
    if (nameSearch && !building.name.toLowerCase().includes(nameSearch)) return false;
    if (addressSearch && !building.address.toLowerCase().includes(addressSearch)) return false;

    if (filters.types.size > 0 && !filters.types.has(building.building_type)) return false;
    if (filters.suburbs.size > 0 && !filters.suburbs.has(building.suburb)) return false;

    if (filters.minLevels != null && (building.levels == null || building.levels < filters.minLevels)) {
      return false;
    }

    if (filters.radius) {
      const km = distanceKm(filters.radius, { lat: building.lat, lng: building.lng });
      if (km > filters.radius.km) return false;
    }

    return true;
  });
}
