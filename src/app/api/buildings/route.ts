import { requireEditorOrResponse } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { resolvePlace } from '@/lib/places';
import { BUILDING_TYPES, STATUSES, toClientBuilding, type Database } from '@/lib/types';

type BuildingInsert = Database['public']['Tables']['buildings']['Insert'];

/**
 * New buildings can only be created here (manual entry) or via CSV import --
 * never from the map, never from the image uploader (CLAUDE.md).
 */
export async function POST(request: Request) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 });

  if (typeof body.placeId !== 'string' || !body.placeId) {
    return Response.json({ error: 'Pick an address from the dropdown.' }, { status: 400 });
  }

  const levels = Number(body.levels);
  if (!Number.isFinite(levels) || levels <= 0) {
    return Response.json({ error: 'Levels must be a positive number.' }, { status: 400 });
  }

  if (typeof body.building_type !== 'string' || !BUILDING_TYPES.includes(body.building_type)) {
    return Response.json({ error: 'Invalid building type.' }, { status: 400 });
  }

  if (typeof body.status !== 'string' || !STATUSES.includes(body.status)) {
    return Response.json({ error: 'Invalid status.' }, { status: 400 });
  }

  const screenCount = Number(body.screen_count ?? 0);
  if (!Number.isInteger(screenCount) || screenCount < 0) {
    return Response.json(
      { error: 'Screen count must be a non-negative whole number.' },
      { status: 400 },
    );
  }

  let resolved;
  try {
    resolved = await resolvePlace(body.placeId);
  } catch {
    return Response.json(
      { error: 'Could not resolve that address. Try picking it again.' },
      { status: 400 },
    );
  }

  const insert: BuildingInsert = {
    name,
    address: resolved.address,
    place_id: body.placeId,
    lat: resolved.lat,
    lng: resolved.lng,
    levels,
    building_type: body.building_type,
    postcode: resolved.postcode,
    suburb: resolved.suburb,
    status: body.status,
    screen_count: screenCount,
    notes: typeof body.notes === 'string' ? body.notes : '',
  };

  const { data, error } = await supabase.from('buildings').insert(insert).select().single();

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'A building with this name already exists.' }, { status: 409 });
    }
    return Response.json({ error: 'Could not create building.' }, { status: 500 });
  }

  return Response.json(toClientBuilding(data), { status: 201 });
}
