const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.85;

/**
 * Downscales to 1600px on the long edge and converts to WebP, in the
 * browser, before upload. Keeps a 20-image building around 3 MB instead of
 * 80 MB and sidesteps iPhone HEIC files some browsers won't display.
 */
export async function downscaleToWebP(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
  if (!blob) throw new Error('Could not convert image.');

  return blob;
}

/**
 * Caption default for a single-building upload (the info panel's "Add
 * images"): just the filename, extension stripped. The building is already
 * known from context here, so there's no "Building Name-Caption.jpg" to
 * parse -- that hyphen-splitting convention is bulk upload's, not this.
 */
export function captionFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').trim();
}

/**
 * Bulk uploader filenames follow "Building Name-Caption.jpg" (CLAUDE.md).
 * Split on the **last** hyphen, so building names containing hyphens
 * ("152-156 Swanston St-Lobby.jpg") still match -- captions must not
 * contain hyphens. A filename with no hyphen at all can't be split, so it
 * comes back with an empty name (guaranteed not to match any building,
 * landing it in Unassigned) and the whole filename as the caption -- still
 * parsed, per spec, even when unmatched.
 */
export function parseBulkFilename(filename: string): { name: string; caption: string } {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const lastHyphen = withoutExtension.lastIndexOf('-');

  if (lastHyphen === -1) {
    return { name: '', caption: withoutExtension.trim() };
  }

  return {
    name: withoutExtension.slice(0, lastHyphen).trim(),
    caption: withoutExtension.slice(lastHyphen + 1).trim(),
  };
}
