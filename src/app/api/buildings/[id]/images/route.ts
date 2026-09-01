import { randomUUID } from 'crypto';

import { requireEditorOrResponse, requireSessionOrResponse } from '@/lib/auth';
import { supabase, BUILDING_IMAGES_BUCKET } from '@/lib/supabase';
import type { BuildingImage } from '@/lib/types';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireSessionOrResponse();
  if (denied) return denied;

  const { id } = await params;
  const { data, error } = await supabase
    .from('building_images')
    .select('*')
    .eq('building_id', id)
    .order('created_at');

  if (error) {
    return Response.json({ error: 'Could not load images.' }, { status: 500 });
  }

  const images: BuildingImage[] = await Promise.all(
    data.map(async (row) => {
      const { data: signed } = await supabase.storage
        .from(BUILDING_IMAGES_BUCKET)
        .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);

      return {
        id: row.id,
        caption: row.caption,
        url: signed?.signedUrl ?? '',
        created_at: row.created_at,
      };
    }),
  );

  return Response.json(images);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireEditorOrResponse();
  if (denied) return denied;

  const { id } = await params;
  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const caption = formData?.get('caption');

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided.' }, { status: 400 });
  }

  const storagePath = `${id}/${randomUUID()}.webp`;

  const { error: uploadError } = await supabase.storage
    .from(BUILDING_IMAGES_BUCKET)
    .upload(storagePath, file, { contentType: 'image/webp' });

  if (uploadError) {
    return Response.json({ error: 'Could not upload image.' }, { status: 500 });
  }

  const { data: row, error: insertError } = await supabase
    .from('building_images')
    .insert({ building_id: id, storage_path: storagePath, caption: typeof caption === 'string' ? caption : '' })
    .select()
    .single();

  if (insertError) {
    await supabase.storage.from(BUILDING_IMAGES_BUCKET).remove([storagePath]);
    return Response.json({ error: 'Could not save image record.' }, { status: 500 });
  }

  const { data: signed } = await supabase.storage
    .from(BUILDING_IMAGES_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

  const image: BuildingImage = {
    id: row.id,
    caption: row.caption,
    url: signed?.signedUrl ?? '',
    created_at: row.created_at,
  };

  return Response.json(image, { status: 201 });
}
