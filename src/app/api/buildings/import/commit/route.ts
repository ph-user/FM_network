import { requireEditorOrResponse } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { resolvePlace } from '@/lib/places';
import { mapWithConcurrency } from '@/lib/concurrency';
import { BUILDING_TYPES, CITIES, type Database } from '@/lib/types';
import { buildingConflictMessage } from '@/lib/dbErrors';

type BuildingInsert = Database['public']['Tables']['buildings']['Insert'];

interface CommitRow {
  id: string;
  city: string;
  name: string;
  placeId: string;
  building_type: string[];
  suburb: string;
  levels: number | null;
  screen_count: number;
  population: number | null;
  notes: string;
}

const MAX_ROWS = 300;
const CONCURRENCY = 5;

/**
 * Nothing is written until the review screen is confirmed (CLAUDE.md). This
 * is that confirmation: every row is re-resolved from its place_id here --
 * never trusting the coordinates the review step already showed the client,
 * same rule as everywhere else. Suburb is the exception to "never trust the
 * client": it comes from the row as typed, not from geocoding.
 *
 * Id is the client's own building id (never server-generated -- see
 * CLAUDE.md), so writes are an upsert keyed on id rather than a branch on
 * "does this row have an id": insert if it's new, update in place if it
 * already exists. Avoids a race against the id having been taken between
 * the review step and this confirm step.
 */
export async function POST(request: Request) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const rows: CommitRow[] = Array.isArray(body?.rows) ? body.rows : [];

  if (rows.length === 0) {
    return Response.json({ error: 'No rows to import.' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return Response.json({ error: `Import is limited to ${MAX_ROWS} rows at a time.` }, { status: 400 });
  }

  const { data: existing, error: existingError } = await supabase.from('buildings').select('id');
  if (existingError) {
    return Response.json({ error: 'Could not load existing buildings.' }, { status: 500 });
  }
  const existingIds = new Set(existing.map((b) => b.id));

  const results = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const id = row.id?.trim();
    if (!id) return { name: row.name, ok: false, error: 'Id is required.' } as const;

    const name = row.name?.trim();
    if (!name) return { name: row.name, ok: false, error: 'Name is required.' } as const;
    if (!row.placeId) return { name, ok: false, error: 'No address was resolved for this row.' } as const;
    if (!CITIES.includes(row.city as (typeof CITIES)[number])) {
      return { name, ok: false, error: 'Invalid city.' } as const;
    }
    const allowedTypes: readonly string[] = BUILDING_TYPES;
    if (
      !Array.isArray(row.building_type) ||
      row.building_type.length === 0 ||
      !row.building_type.every((t) => allowedTypes.includes(t))
    ) {
      return { name, ok: false, error: 'Invalid type.' } as const;
    }
    const suburb = row.suburb?.trim();
    if (!suburb) return { name, ok: false, error: 'Suburb is required.' } as const;
    if (row.levels != null && (!Number.isFinite(row.levels) || row.levels <= 0)) {
      return { name, ok: false, error: 'Level must be a positive number.' } as const;
    }
    if (!Number.isInteger(row.screen_count) || row.screen_count < 0) {
      return { name, ok: false, error: 'Screen must be a non-negative whole number.' } as const;
    }
    if (row.population != null && (!Number.isInteger(row.population) || row.population < 0)) {
      return { name, ok: false, error: 'Population must be a non-negative whole number.' } as const;
    }

    let resolved;
    try {
      resolved = await resolvePlace(row.placeId);
    } catch {
      return { name, ok: false, error: 'Could not resolve the address.' } as const;
    }

    const fields: BuildingInsert = {
      id,
      city: row.city as BuildingInsert['city'],
      name,
      address: resolved.address,
      place_id: row.placeId,
      lat: resolved.lat,
      lng: resolved.lng,
      suburb,
      building_type: row.building_type as BuildingInsert['building_type'],
      levels: row.levels,
      screen_count: row.screen_count,
      population: row.population,
      notes: row.notes ?? '',
    };

    const { error } = await supabase.from('buildings').upsert(fields, { onConflict: 'id' });
    if (error) {
      const message = error.code === '23505' ? buildingConflictMessage(error) : 'Could not save.';
      return { name, ok: false, error: message } as const;
    }

    return { name, ok: true, action: existingIds.has(id) ? 'updated' : 'created' } as const;
  });

  const created = results.filter((r) => r.ok && r.action === 'created').length;
  const updated = results.filter((r) => r.ok && r.action === 'updated').length;
  const failed = results
    .filter((r) => !r.ok)
    .map((r) => ({ name: r.name, error: 'error' in r ? r.error : 'Could not import.' }));

  return Response.json({ created, updated, failed });
}
