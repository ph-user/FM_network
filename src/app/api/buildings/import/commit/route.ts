import { requireEditorOrResponse } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { resolvePlace } from '@/lib/places';
import { mapWithConcurrency } from '@/lib/concurrency';
import { BUILDING_TYPES, STATUSES, type Database } from '@/lib/types';

type BuildingInsert = Database['public']['Tables']['buildings']['Insert'];
type BuildingFields = Omit<BuildingInsert, 'id'>;

interface CommitRow {
  id?: string;
  name: string;
  placeId: string;
  levels: number;
  building_type: string;
  status: string;
  screen_count: number;
  notes: string;
}

const MAX_ROWS = 300;
const CONCURRENCY = 5;

/**
 * Nothing is written until the review screen is confirmed (CLAUDE.md). This
 * is that confirmation: every row is re-resolved from its place_id here --
 * never trusting the coordinates the review step already showed the client,
 * same rule as everywhere else.
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

  const results = await mapWithConcurrency(rows, CONCURRENCY, async (row) => {
    const name = row.name?.trim();
    if (!name) return { name: row.name, ok: false, error: 'Name is required.' } as const;
    if (!row.placeId) return { name, ok: false, error: 'No address was resolved for this row.' } as const;
    if (!BUILDING_TYPES.includes(row.building_type as (typeof BUILDING_TYPES)[number])) {
      return { name, ok: false, error: 'Invalid building type.' } as const;
    }
    if (!STATUSES.includes(row.status as (typeof STATUSES)[number])) {
      return { name, ok: false, error: 'Invalid status.' } as const;
    }
    if (!Number.isFinite(row.levels) || row.levels <= 0) {
      return { name, ok: false, error: 'Levels must be a positive number.' } as const;
    }
    if (!Number.isInteger(row.screen_count) || row.screen_count < 0) {
      return { name, ok: false, error: 'Screen count must be a non-negative whole number.' } as const;
    }

    let resolved;
    try {
      resolved = await resolvePlace(row.placeId);
    } catch {
      return { name, ok: false, error: 'Could not resolve the address.' } as const;
    }

    const fields: BuildingFields = {
      name,
      address: resolved.address,
      place_id: row.placeId,
      lat: resolved.lat,
      lng: resolved.lng,
      levels: row.levels,
      building_type: row.building_type as BuildingFields['building_type'],
      postcode: resolved.postcode,
      suburb: resolved.suburb,
      status: row.status as BuildingFields['status'],
      screen_count: row.screen_count,
      notes: row.notes ?? '',
    };

    if (row.id) {
      const { error } = await supabase.from('buildings').update(fields).eq('id', row.id);
      if (error) {
        const message = error.code === '23505' ? 'A building with this name already exists.' : 'Could not update.';
        return { name, ok: false, error: message } as const;
      }
      return { name, ok: true, action: 'updated' } as const;
    }

    const { error } = await supabase.from('buildings').insert(fields);
    if (error) {
      const message = error.code === '23505' ? 'A building with this name already exists.' : 'Could not create.';
      return { name, ok: false, error: message } as const;
    }
    return { name, ok: true, action: 'created' } as const;
  });

  const created = results.filter((r) => r.ok && r.action === 'created').length;
  const updated = results.filter((r) => r.ok && r.action === 'updated').length;
  const failed = results
    .filter((r) => !r.ok)
    .map((r) => ({ name: r.name, error: 'error' in r ? r.error : 'Could not import.' }));

  return Response.json({ created, updated, failed });
}
