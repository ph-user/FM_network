'use client';

import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface AddressRadiusInputProps {
  onSelect: (result: { address: string; lat: number; lng: number }) => void;
}

/**
 * Wraps the new Places Autocomplete element (PlaceAutocompleteElement), per
 * CLAUDE.md's "build against the new one". It's a web component that renders
 * its own input, so it's mounted imperatively rather than through JSX.
 */
export function AddressRadiusInput({ onSelect }: AddressRadiusInputProps) {
  const placesLibrary = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!placesLibrary || !containerRef.current) return;

    const element = new placesLibrary.PlaceAutocompleteElement();
    containerRef.current.appendChild(element);

    // PlaceAutocompleteElement only overrides addEventListener's typing, not
    // removeEventListener's, so both calls need the same widened event type
    // to satisfy the (unoverridden) EventTarget signature on removal.
    const handleSelect = (async (event: Event) => {
      const { placePrediction } = event as google.maps.places.PlacePredictionSelectEvent;
      const { place } = await placePrediction.toPlace().fetchFields({
        fields: ['formattedAddress', 'location'],
      });

      if (!place.location) return;
      onSelectRef.current({
        address: place.formattedAddress ?? '',
        lat: place.location.lat(),
        lng: place.location.lng(),
      });
    }) as EventListener;

    element.addEventListener('gmp-select', handleSelect);

    return () => {
      element.removeEventListener('gmp-select', handleSelect);
      element.remove();
    };
  }, [placesLibrary]);

  return <div ref={containerRef} />;
}
