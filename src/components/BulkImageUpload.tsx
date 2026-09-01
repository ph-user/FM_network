'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Building } from '@/lib/types';
import { normalizeName } from '@/lib/csvImport';
import { downscaleToWebP, parseBulkFilename } from '@/lib/image';
import { mapWithConcurrency } from '@/lib/concurrency';

import styles from './BulkImageUpload.module.css';

interface BulkImageUploadProps {
  buildings: Building[];
  onDone: () => void;
  onCancel: () => void;
}

interface ParsedImage {
  key: string;
  file: File;
  previewUrl: string;
  caption: string;
  buildingId: string | null;
}

const CONCURRENCY = 3;

export function BulkImageUpload({ buildings, onDone, onCancel }: BulkImageUploadProps) {
  const [images, setImages] = useState<ParsedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ uploaded: number; failed: { caption: string; error: string }[] } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildingsByNormalizedName = useMemo(
    () => new Map(buildings.map((b) => [normalizeName(b.name), b])),
    [buildings],
  );
  const buildingsSorted = useMemo(() => [...buildings].sort((a, b) => a.name.localeCompare(b.name)), [buildings]);

  useEffect(() => {
    // Preview URLs are only good for this component's lifetime.
    return () => images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFiles(files: FileList) {
    const parsed: ParsedImage[] = Array.from(files).map((file) => {
      const { name, caption } = parseBulkFilename(file.name);
      const matched = name ? buildingsByNormalizedName.get(normalizeName(name)) : undefined;
      return {
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        previewUrl: URL.createObjectURL(file),
        caption,
        buildingId: matched?.id ?? null,
      };
    });
    setImages((prev) => [...prev, ...parsed]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function setCaption(key: string, caption: string) {
    setImages((prev) => prev.map((img) => (img.key === key ? { ...img, caption } : img)));
  }

  function setBuildingId(key: string, buildingId: string | null) {
    setImages((prev) => prev.map((img) => (img.key === key ? { ...img, buildingId } : img)));
  }

  function removeImage(key: string) {
    setImages((prev) => {
      const target = prev.find((img) => img.key === key);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.key !== key);
    });
  }

  const unassignedCount = images.filter((img) => !img.buildingId).length;

  const groups = useMemo(() => {
    const byBuilding = new Map<string | null, ParsedImage[]>();
    for (const img of images) {
      const key = img.buildingId;
      if (!byBuilding.has(key)) byBuilding.set(key, []);
      byBuilding.get(key)!.push(img);
    }
    const buildingById = new Map(buildings.map((b) => [b.id, b]));
    const entries = Array.from(byBuilding.entries()).map(([buildingId, imgs]) => ({
      building: buildingId ? (buildingById.get(buildingId) ?? null) : null,
      images: imgs,
    }));
    entries.sort((a, b) => {
      if (!a.building) return -1;
      if (!b.building) return 1;
      return a.building.name.localeCompare(b.building.name);
    });
    return entries;
  }, [images, buildings]);

  async function confirmUpload() {
    setUploading(true);
    setProgress(0);

    const outcomes = await mapWithConcurrency(images, CONCURRENCY, async (img) => {
      try {
        const blob = await downscaleToWebP(img.file);
        const formData = new FormData();
        formData.append('file', blob, 'image.webp');
        formData.append('caption', img.caption);

        const response = await fetch(`/api/buildings/${img.buildingId}/images`, {
          method: 'POST',
          body: formData,
        });
        setProgress((p) => p + 1);
        if (!response.ok) return { ok: false as const, caption: img.caption, error: 'Upload failed.' };
        return { ok: true as const };
      } catch {
        setProgress((p) => p + 1);
        return { ok: false as const, caption: img.caption, error: 'Could not reach the server.' };
      }
    });

    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setUploading(false);
    setResult({
      uploaded: outcomes.filter((o) => o.ok).length,
      failed: outcomes.filter((o): o is { ok: false; caption: string; error: string } => !o.ok),
    });
  }

  if (result) {
    return (
      <div className={styles.done}>
        <h2 className={styles.title}>Upload complete</h2>
        <p>{result.uploaded} image(s) uploaded.</p>
        {result.failed.length > 0 && (
          <ul className={styles.failedList}>
            {result.failed.map((f, i) => (
              <li key={i}>
                {f.caption || '(untitled)'}: {f.error}
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <button className="btn" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Filenames like <code>Building Name-Caption.jpg</code>. Split on the last hyphen, so building names with
        hyphens still match; captions can&apos;t contain hyphens.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {images.length > 0 && (
        <>
          <div className={styles.summary}>
            {images.length} image(s){unassignedCount > 0 && `, ${unassignedCount} unassigned`}
          </div>

          <div className={styles.groups}>
            {groups.map((group) => (
              <div key={group.building?.id ?? 'unassigned'} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.building ? group.building.name : 'Unassigned'}</h3>
                <div className={styles.grid}>
                  {group.images.map((img) => (
                    <div key={img.key} className={styles.item}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a static asset */}
                      <img src={img.previewUrl} alt="" className={styles.thumb} />
                      <input
                        className={styles.captionInput}
                        value={img.caption}
                        onChange={(e) => setCaption(img.key, e.target.value)}
                        placeholder="Caption"
                      />
                      {!group.building && (
                        <select
                          className={styles.buildingSelect}
                          value=""
                          onChange={(e) => setBuildingId(img.key, e.target.value || null)}
                        >
                          <option value="">Assign to…</option>
                          {buildingsSorted.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button className={styles.removeBtn} onClick={() => removeImage(img.key)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {uploading && (
        <p className={styles.progress}>
          Uploading {progress} of {images.length}…
        </p>
      )}

      <div className={styles.actions}>
        <button className="btn btn-secondary" onClick={onCancel} disabled={uploading}>
          Cancel
        </button>
        <button
          className="btn"
          onClick={confirmUpload}
          disabled={images.length === 0 || unassignedCount > 0 || uploading}
        >
          {uploading ? 'Uploading…' : `Upload ${images.length} image(s)`}
        </button>
      </div>
    </div>
  );
}
