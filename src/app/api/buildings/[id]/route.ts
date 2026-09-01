import { requireEditorOrResponse } from '@/lib/auth';
import { supabase, BUILDING_IMAGES_BUCKET } from '@/lib/supabase';
import { resolvePlace } from '@/lib/places';
import { BUILDING_TYPES, STATUSES, toClientBuilding, type Database } from '@/lib/types';

type BuildingUpdate = Database['public']['Tables']['buildings']['Update'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const update: BuildingUpdate = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) return Response.json({ error: 'Name is required.' }, { status: 400 });
    update.name = name;
  }

  if (body.levels != null) {
    const levels = Number(body.levels);
    if (!Number.isFinite(levels) || levels <= 0) {
      return Response.json({ error: 'Levels must be a positive number.' }, { status: 400 });
    }
    update.levels = levels;
  }

  if (typeof body.building_type === 'string') {
    if (!BUILDING_TYPES.includes(body.building_type)) {
      return Response.json({ error: 'Invalid building type.' }, { status: 400 });
    }
    update.building_type = body.building_type;
  }

  if (typeof body.status === 'string') {
    if (!STATUSES.includes(body.status)) {
      return Response.json({ error: 'Invalid status.' }, { status: 400 });
    }
    update.status = body.status;
  }

  if (body.screen_count != null) {
    const screenCount = Number(body.screen_count);
    if (!Number.isInteger(screenCount) || screenCount < 0) {
      return Response.json(
        { error: 'Screen count must be a non-negative whole number.' },
        { status: 400 },
      );
    }
    update.screen_count = screenCount;
  }

  if (typeof body.notes === 'string') {
    update.notes = body.notes;
  }

  // Address changes always arrive as a place_id (from Places Autocomplete),
  // never as free-typed text or client-supplied coordinates -- place_id is
  // server-side only, and this is the one place that resolves it.
  if (typeof body.placeId === 'string' && body.placeId) {
    try {
      const resolved = await resolvePlace(body.placeId);
      update.address = resolved.address;
      update.lat = resolved.lat;
      update.lng = resolved.lng;
      update.postcode = resolved.postcode;
      update.suburb = resolved.suburb;
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
      return Response.json({ error: 'A building with this name already exists.' }, { status: 409 });
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
