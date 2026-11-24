import { Point } from 'typeorm';

export interface LatLng {
  lat: number;
  lng: number;
}

export function toPoint(p: LatLng): Point {
  return { type: 'Point', coordinates: [p.lng, p.lat] };
}

export function fromPoint(p?: Point | null): LatLng | null {
  if (!p) return null;
  return { lat: p.coordinates[1], lng: p.coordinates[0] };
}

/** Distance à vol d'oiseau en mètres (formule de haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
