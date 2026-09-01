import type { Building, BuildingType, Status } from './types';
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
  statuses: Set<Status>;
  types: Set<BuildingType>;
  postcodes: Set<string>;
  minLevels: number | null;
  maxLevels: number | null;
  radius: RadiusFilter | null;
}

export const EMPTY_FILTERS: Filters = {
  nameSearch: '',
  addressSearch: '',
  statuses: new Set(),
  types: new Set(),
  postcodes: new Set(),
  minLevels: null,
  maxLevels: null,
  radius: null,
};

/** All filters are AND-combined. An empty set/unset field means "no filter". */
export function applyFilters(buildings: Building[], filters: Filters): Building[] {
  const nameSearch = filters.nameSearch.trim().toLowerCase();
  const addressSearch = filters.addressSearch.trim().toLowerCase();

  return buildings.filter((building) => {
    if (nameSearch && !building.name.toLowerCase().includes(nameSearch)) return false;
    if (addressSearch && !building.address.toLowerCase().includes(addressSearch)) return false;

    if (filters.statuses.size > 0 && !filters.statuses.has(building.status)) return false;
    if (filters.types.size > 0 && !filters.types.has(building.building_type)) return false;
    if (filters.postcodes.size > 0 && !filters.postcodes.has(building.postcode)) return false;

    if (filters.minLevels != null && building.levels < filters.minLevels) return false;
    if (filters.maxLevels != null && building.levels > filters.maxLevels) return false;

    if (filters.radius) {
      const km = distanceKm(filters.radius, { lat: building.lat, lng: building.lng });
      if (km > filters.radius.km) return false;
    }

    return true;
  });
}
