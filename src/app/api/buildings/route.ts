import { requireEditorOrResponse } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { resolvePlace } from '@/lib/places';
import { BUILDING_TYPES, CITIES, toClientBuilding, type Database } from '@/lib/types';
import { buildingConflictMessage } from '@/lib/dbErrors';

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

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return Response.json({ error: 'Building id is required.' }, { status: 400 });

  if (typeof body.city !== 'string' || !CITIES.includes(body.city)) {
    return Response.json({ error: 'Invalid city.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 });

  if (typeof body.building_type !== 'string' || !BUILDING_TYPES.includes(body.building_type)) {
    return Response.json({ error: 'Invalid building type.' }, { status: 400 });
  }

  const suburb = typeof body.suburb === 'string' ? body.suburb.trim() : '';
  if (!suburb) return Response.json({ error: 'Suburb is required.' }, { status: 400 });

  if (typeof body.placeId !== 'string' || !body.placeId) {
    return Response.json({ error: 'Pick an address from the dropdown.' }, { status: 400 });
  }

  let levels: number | null = null;
  if (body.levels != null && body.levels !== '') {
    levels = Number(body.levels);
    if (!Number.isFinite(levels) || levels <= 0) {
      return Response.json({ error: 'Level must be a positive number.' }, { status: 400 });
    }
  }

  const screenCount = Number(body.screen_count ?? 0);
  if (!Number.isInteger(screenCount) || screenCount < 0) {
    return Response.json({ error: 'Screen must be a non-negative whole number.' }, { status: 400 });
  }

  let population: number | null = null;
  if (body.population != null && body.population !== '') {
    population = Number(body.population);
    if (!Number.isInteger(population) || population < 0) {
      return Response.json({ error: 'Population must be a non-negative whole number.' }, { status: 400 });
    }
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
    id,
    city: body.city,
    name,
    address: resolved.address,
    place_id: body.placeId,
    lat: resolved.lat,
    lng: resolved.lng,
    suburb,
    building_type: body.building_type,
    levels,
    screen_count: screenCount,
    population,
    notes: typeof body.notes === 'string' ? body.notes : '',
  };

  const { data, error } = await supabase.from('buildings').insert(insert).select().single();

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: buildingConflictMessage(error) }, { status: 409 });
    }
    return Response.json({ error: 'Could not create building.' }, { status: 500 });
  }

  return Response.json(toClientBuilding(data), { status: 201 });
}
