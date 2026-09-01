import type { BuildingType, Status } from './types';

/** Column order for both import and export (CLAUDE.md). */
export const CSV_COLUMNS = [
  'id',
  'name',
  'address',
  'levels',
  'building_type',
  'postcode',
  'suburb',
  'status',
  'screen_count',
  'notes',
] as const;

/** Every CSV cell arrives as a string; this is what the parser produces. */
export interface RawImportRow {
  id: string;
  name: string;
  address: string;
  levels: string;
  building_type: string;
  postcode: string;
  suburb: string;
  status: string;
  screen_count: string;
  notes: string;
}

export interface ImportCandidate {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
  postcode: string;
  suburb: string;
}

export type ImportRowStatus = 'new' | 'update' | 'ambiguous' | 'unresolved' | 'invalid';

export interface ResolvedImportRow {
  rowIndex: number;
  raw: RawImportRow;
  status: ImportRowStatus;
  error?: string;
  existingId?: string;
  matchedBy?: 'id' | 'name';
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
  name: string;
  levels: number;
  building_type: BuildingType;
  status: Status;
  screen_count: number;
  notes: string;
}

/** Validates and coerces the non-address fields. Returns an error message on failure. */
export function validateRow(
  raw: RawImportRow,
  buildingTypes: readonly string[],
  statuses: readonly string[],
): { ok: true; fields: ValidatedFields } | { ok: false; error: string } {
  const name = raw.name.trim();
  if (!name) return { ok: false, error: 'Name is required.' };

  if (!raw.address.trim()) return { ok: false, error: 'Address is required.' };

  const levels = Number(raw.levels);
  if (!Number.isFinite(levels) || levels <= 0) {
    return { ok: false, error: 'Levels must be a positive number.' };
  }

  if (!buildingTypes.includes(raw.building_type)) {
    return { ok: false, error: `Building type must be one of: ${buildingTypes.join(', ')}.` };
  }

  if (!statuses.includes(raw.status)) {
    return { ok: false, error: `Status must be one of: ${statuses.join(', ')}.` };
  }

  const screenCount = raw.screen_count.trim() === '' ? 0 : Number(raw.screen_count);
  if (!Number.isInteger(screenCount) || screenCount < 0) {
    return { ok: false, error: 'Screen count must be a non-negative whole number.' };
  }

  return {
    ok: true,
    fields: {
      name,
      levels,
      building_type: raw.building_type as BuildingType,
      status: raw.status as Status,
      screen_count: screenCount,
      notes: raw.notes,
    },
  };
}
