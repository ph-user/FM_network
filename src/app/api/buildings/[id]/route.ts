import { requireEditorOrResponse } from '@/lib/auth';
import { supabase, BUILDING_IMAGES_BUCKET } from '@/lib/supabase';
import { resolvePlace } from '@/lib/places';
import { BUILDING_TYPES, CITIES, toClientBuilding, type Database } from '@/lib/types';
import { buildingConflictMessage } from '@/lib/dbErrors';

type BuildingUpdate = Database['public']['Tables']['buildings']['Update'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const update: BuildingUpdate = {};

  if (typeof body.city === 'string') {
    if (!CITIES.includes(body.city)) {
      return Response.json({ error: 'Invalid city.' }, { status: 400 });
    }
    update.city = body.city;
  }

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 });
    update.name = name;
  }

  if ('building_type' in body) {
    const allowedTypes: readonly string[] = BUILDING_TYPES;
    if (
      !Array.isArray(body.building_type) ||
      body.building_type.length === 0 ||
      !body.building_type.every((t: unknown) => typeof t === 'string' && allowedTypes.includes(t))
    ) {
      return Response.json({ error: 'Select at least one building type.' }, { status: 400 });
    }
    update.building_type = body.building_type as BuildingUpdate['building_type'];
  }

  if (typeof body.suburb === 'string') {
    const suburb = body.suburb.trim();
    if (!suburb) return Response.json({ error: 'Suburb is required.' }, { status: 400 });
    update.suburb = suburb;
  }

  // levels and population are could-have -- 'levels' in body distinguishes
  // "not sent, leave alone" from "sent as null/empty, clear it".
  if ('levels' in body) {
    if (body.levels == null || body.levels === '') {
      update.levels = null;
    } else {
      const levels = Number(body.levels);
      if (!Number.isFinite(levels) || levels <= 0) {
        return Response.json({ error: 'Level must be a positive number.' }, { status: 400 });
      }
      update.levels = levels;
    }
  }

  if (body.screen_count != null) {
    const screenCount = Number(body.screen_count);
    if (!Number.isInteger(screenCount) || screenCount < 0) {
      return Response.json(
        { error: 'Screen must be a non-negative whole number.' },
        { status: 400 },
      );
    }
    update.screen_count = screenCount;
  }

  if ('population' in body) {
    if (body.population == null || body.population === '') {
      update.population = null;
    } else {
      const population = Number(body.population);
      if (!Number.isInteger(population) || population < 0) {
        return Response.json({ error: 'Population must be a non-negative whole number.' }, { status: 400 });
      }
      update.population = population;
    }
  }

  if (typeof body.notes === 'string') {
    update.notes = body.notes;
  }

  // Address changes always arrive as a place_id (from Places Autocomplete),
  // never as free-typed text or client-supplied coordinates -- place_id is
  // server-side only, and this is the one place that resolves it. Suburb is
  // not touched here -- it comes from the client's own input, not Google.
  if (typeof body.placeId === 'string' && body.placeId) {
    try {
      const resolved = await resolvePlace(body.placeId);
      update.address = resolved.address;
      update.lat = resolved.lat;
      update.lng = resolved.lng;
      update.place_id = body.placeId;
    } catch {
      return Response.json(
        { error: 'Could not resolve that address. Try picking it again.' },
        { status: 400 },
      );
    }
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const { id } = await params;
  const { data, error } = await supabase.from('buildings').update(update).eq('id', id).select().single();

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: buildingConflictMessage(error) }, { status: 409 });
    }
    return Response.json({ error: 'Could not save changes.' }, { status: 500 });
  }

  return Response.json(toClientBuilding(data));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const { id } = await params;

  const { data: images } = await supabase.from('building_images').select('storage_path').eq('building_id', id);

  if (images && images.length > 0) {
    await supabase.storage.from(BUILDING_IMAGES_BUCKET).remove(images.map((image) => image.storage_path));
  }

  const { error } = await supabase.from('buildings').delete().eq('id', id);
  if (error) {
    return Response.json({ error: 'Could not delete building.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
