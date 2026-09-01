'use client';

import { useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

interface RadiusCircleProps {
  center: { lat: number; lng: number };
  radiusKm: number;
}

/** The circle drawn on the map for the "within X km of an address" filter. */
export function RadiusCircle({ center, radiusKm }: RadiusCircleProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const circle = new google.maps.Circle({
      map,
      center,
      radius: radiusKm * 1000,
      strokeColor: '#cf9300',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#cf9300',
      fillOpacity: 0.08,
      clickable: false,
    });

    map.fitBounds(circle.getBounds() as google.maps.LatLngBounds, 48);

    return () => circle.setMap(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, center.lat, center.lng, radiusKm]);

  return null;
}
