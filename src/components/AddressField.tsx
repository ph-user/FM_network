'use client';

import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

interface AddressFieldProps {
  defaultValue: string;
  onSelect: (result: { placeId: string; address: string }) => void;
}

/**
 * Address entry for the building edit form. Only sends placeId to the
 * caller -- place_id is server-side only, and the server re-resolves the
 * authoritative address and coordinates from it rather than trusting
 * anything the client read off the place directly.
 */
export function AddressField({ defaultValue, onSelect }: AddressFieldProps) {
  const placesLibrary = useMapsLibrary('places');
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!placesLibrary || !containerRef.current) return;

    const element = new placesLibrary.PlaceAutocompleteElement();
    element.value = defaultValue;
    containerRef.current.appendChild(element);

    const handleSelect = (async (event: Event) => {
      const { placePrediction } = event as google.maps.places.PlacePredictionSelectEvent;
      const { place } = await placePrediction.toPlace().fetchFields({
        fields: ['id', 'formattedAddress'],
      });
      onSelectRef.current({ placeId: place.id, address: place.formattedAddress ?? '' });
    }) as EventListener;

    element.addEventListener('gmp-select', handleSelect);

    return () => {
      element.removeEventListener('gmp-select', handleSelect);
      element.remove();
    };
    // defaultValue only seeds the initial input text; re-running on every
    // keystroke elsewhere would tear down the element mid-search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLibrary]);

  return <div ref={containerRef} />;
}
