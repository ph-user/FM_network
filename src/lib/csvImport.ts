import type { BuildingType, City } from './types';

/**
 * Column order for both import and export, matching the client's own
 * spreadsheet headers (CLAUDE.md). City, Id, Name, Type, Suburb and Address
 * are must-have; Level, Screen, Population and Note are could-have.
 */
export const CSV_COLUMNS = [
  'City',
  'Id',
  'Name',
  'Type',
  'Suburb',
  'Address',
  'Level',
  'Screen',
  'Population',
  'Note',
] as const;

export const MUST_HAVE_COLUMNS = ['City', 'Id', 'Name', 'Type', 'Suburb', 'Address'] as const;

/** Every CSV cell arrives as a string; this is what the parser produces. */
export interface RawImportRow {
  City: string;
  Id: string;
  Name: string;
  Type: string;
  Suburb: string;
  Address: string;
  Level: string;
  Screen: string;
  Population: string;
  Note: string;
}

export interface ImportCandidate {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

export type ImportRowStatus = 'new' | 'update' | 'ambiguous' | 'unresolved' | 'invalid';

export interface ResolvedImportRow {
  rowIndex: number;
  raw: RawImportRow;
  status: ImportRowStatus;
  error?: string;
  /** Set when raw.Id matches an existing building -- this row updates it. */
  existingId?: string;
  duplicateInFile?: boolean;
  candidate?: ImportCandidate;
  candidates?: ImportCandidate[];
}

/**
 * Matches the unique index in supabase/schema.sql exactly:
 * lower(regexp_replace(name, '\s+', ' ', 'g')) -- collapses whitespace runs,
 * does not trim the ends.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ');
}

export interface ValidatedFields {
  city: City;
  name: string;
  building_type: BuildingType;
  suburb: string;
  levels: number | null;
  screen_count: number;
  population: number | null;
  notes: string;
}

/**
 * Validates and coerces every field. City, Id, Name, Type, Suburb and
 * Address are must-have; Level, Screen, Population and Note are could-have
 * and simply come back null/default when blank.
 */
export function validateRow(
  raw: RawImportRow,
  cities: readonly string[],
  buildingTypes: readonly string[],
): { ok: true; fields: ValidatedFields } | { ok: false; error: string } {
  if (!raw.Id.trim()) return { ok: false, error: 'Id is required.' };

  if (!cities.includes(raw.City)) {
    return { ok: false, error: `City must be one of: ${cities.join(', ')}.` };
  }

  const name = raw.Name.trim();
  if (!name) return { ok: false, error: 'Name is required.' };

  if (!buildingTypes.includes(raw.Type)) {
    return { ok: false, error: `Type must be one of: ${buildingTypes.join(', ')}.` };
  }

  const suburb = raw.Suburb.trim();
  if (!suburb) return { ok: false, error: 'Suburb is required.' };

  if (!raw.Address.trim()) return { ok: false, error: 'Address is required.' };

  let levels: number | null = null;
  if (raw.Level.trim() !== '') {
    levels = Number(raw.Level);
    if (!Number.isFinite(levels) || levels <= 0) {
      return { ok: false, error: 'Level must be a positive number.' };
    }
  }

  const screenCount = raw.Screen.trim() === '' ? 0 : Number(raw.Screen);
  if (!Number.isInteger(screenCount) || screenCount < 0) {
    return { ok: false, error: 'Screen must be a non-negative whole number.' };
  }

  let population: number | null = null;
  if (raw.Population.trim() !== '') {
    population = Number(raw.Population);
    if (!Number.isInteger(population) || population < 0) {
      return { ok: false, error: 'Population must be a non-negative whole number.' };
    }
  }

  return {
    ok: true,
    fields: {
      city: raw.City as City,
      name,
      building_type: raw.Type as BuildingType,
      suburb,
      levels,
      screen_count: screenCount,
      population,
      notes: raw.Note,
    },
  };
}
