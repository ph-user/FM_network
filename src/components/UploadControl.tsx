'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { APIProvider } from '@vis.gl/react-google-maps';

import type { Building } from '@/lib/types';
import { UploadModal } from './UploadModal';

export function UploadControl({ buildings }: { buildings: Building[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  function onCreated(building: Building) {
    setOpen(false);
    router.push(`/?building=${building.id}`);
    router.refresh();
  }

  function onImported() {
    setOpen(false);
    router.refresh();
  }

  function onImagesUploaded() {
    setOpen(false);
    // The info panel's image gallery only fetches on mount, keyed by the
    // selected building's id, so it won't pick up images just uploaded here
    // for whatever's currently selected. Deselecting forces a fresh fetch on
    // reselect rather than showing a stale gallery.
    if (searchParams.get('building')) {
      router.push('/');
    }
    router.refresh();
  }

  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>
        Upload
      </button>
      {open && (
        <APIProvider
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY as string}
          libraries={['places']}
        >
          <UploadModal
            buildings={buildings}
            onClose={() => setOpen(false)}
            onCreated={onCreated}
            onImported={onImported}
            onImagesUploaded={onImagesUploaded}
          />
        </APIProvider>
      )}
    </>
  );
}
