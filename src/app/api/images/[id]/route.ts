import { requireEditorOrResponse } from '@/lib/auth';
import { supabase, BUILDING_IMAGES_BUCKET } from '@/lib/supabase';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.caption !== 'string') {
    return Response.json({ error: 'Caption is required.' }, { status: 400 });
  }

  const { id } = await params;
  const { error } = await supabase.from('building_images').update({ caption: body.caption }).eq('id', id);

  if (error) {
    return Response.json({ error: 'Could not save caption.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const { id } = await params;
  const { data: row, error: fetchError } = await supabase
    .from('building_images')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError || !row) {
    return Response.json({ error: 'Image not found.' }, { status: 404 });
  }

  await supabase.storage.from(BUILDING_IMAGES_BUCKET).remove([row.storage_path]);

  const { error: deleteError } = await supabase.from('building_images').delete().eq('id', id);
  if (deleteError) {
    return Response.json({ error: 'Could not delete image.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
