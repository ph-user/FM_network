'use client';

import { useEffect, useRef, useState } from 'react';

import type { BuildingImage } from '@/lib/types';
import { captionFromFilename, downscaleToWebP } from '@/lib/image';

import styles from './ImagesGallery.module.css';

interface ImagesGalleryProps {
  buildingId: string;
  canEdit: boolean;
}

export function ImagesGallery({ buildingId, canEdit }: ImagesGalleryProps) {
  const [images, setImages] = useState<BuildingImage[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // No need to reset to null on buildingId change: the parent
    // BuildingInfoPanel is keyed by building id, so this component remounts
    // (with a fresh null state) rather than being reused across buildings.
    let cancelled = false;

    fetch(`/api/buildings/${buildingId}/images`)
      .then((res) => res.json())
      .then((data: BuildingImage[]) => {
        if (!cancelled) setImages(data);
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [buildingId]);

  async function handleFiles(files: FileList) {
    setUploading(true);
    setError(null);

    try {
      for (const file of Array.from(files)) {
        const blob = await downscaleToWebP(file);
        const formData = new FormData();
        formData.append('file', blob, 'image.webp');
        formData.append('caption', captionFromFilename(file.name));

        const response = await fetch(`/api/buildings/${buildingId}/images`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error();

        const created: BuildingImage = await response.json();
        setImages((prev) => [...(prev ?? []), created]);
      }
    } catch {
      setError('Could not upload one or more images. Try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function updateCaption(id: string, caption: string) {
    setImages((prev) => prev?.map((img) => (img.id === id ? { ...img, caption } : img)) ?? null);
    await fetch(`/api/images/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption }),
    });
  }

  async function deleteImage(id: string) {
    setConfirmingDeleteId(null);
    setImages((prev) => prev?.filter((img) => img.id !== id) ?? null);
    await fetch(`/api/images/${id}`, { method: 'DELETE' });
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.label}>Images</span>
        {canEdit && (
          <>
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading' : 'Add images'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </>
        )}
      </div>

      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}

      {images === null ? (
        <p className={styles.placeholder}>Loading images…</p>
      ) : images.length === 0 ? (
        <p className={styles.placeholder}>No images yet.</p>
      ) : (
        <div className={styles.grid}>
          {images.map((image) => (
            <div key={image.id} className={styles.item}>
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs, not a static asset */}
              <img src={image.url} alt={image.caption || 'Building photo'} className={styles.thumb} />
              {canEdit ? (
                <>
                  <input
                    className={styles.captionInput}
                    defaultValue={image.caption}
                    onBlur={(e) => updateCaption(image.id, e.target.value)}
                    placeholder="Caption"
                  />
                  {confirmingDeleteId === image.id ? (
                    <button className={styles.confirmDelete} onClick={() => deleteImage(image.id)}>
                      Really delete?
                    </button>
                  ) : (
                    <button className={styles.deleteLink} onClick={() => setConfirmingDeleteId(image.id)}>
                      Delete
                    </button>
                  )}
                </>
              ) : (
                image.caption && <p className={styles.caption}>{image.caption}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
