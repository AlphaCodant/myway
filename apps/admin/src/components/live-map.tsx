'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from 'react-leaflet';

export type MapCourier = { id: string; name: string | null; location: { lat: number; lng: number } | null; busy: boolean };
export type MapOrder = {
  id: string;
  reference: string;
  late: boolean;
  noCourier: boolean;
  shop?: { name: string; location: { lat: number; lng: number } | null };
  dropoff: { lat: number; lng: number } | null;
};

const GAGNOA: [number, number] = [6.1319, -5.9506];

/** Carte en direct : livreurs (bleu, gris s'ils sont occupés), commerces et clients des commandes en cours. */
export default function LiveMap({ couriers, orders, onSelectOrder }: { couriers: MapCourier[]; orders: MapOrder[]; onSelectOrder?: (id: string) => void }) {
  const points = [
    ...couriers.map((c) => c.location),
    ...orders.flatMap((o) => [o.shop?.location ?? null, o.dropoff]),
  ].filter((p): p is { lat: number; lng: number } => !!p);
  const bounds = points.length > 1 ? L.latLngBounds(points.map((p) => [p.lat, p.lng])).pad(0.2) : undefined;
  return (
    <MapContainer
      center={points[0] ? [points[0].lat, points[0].lng] : GAGNOA}
      zoom={14}
      bounds={bounds}
      className="map"
      scrollWheelZoom
    >
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
      {orders.map((o) => {
        const color = o.late || o.noCourier ? '#b00020' : '#e85d04';
        const handlers = { click: () => onSelectOrder?.(o.id) };
        return (
          <span key={o.id}>
            {o.shop?.location && o.dropoff && (
              <Polyline positions={[[o.shop.location.lat, o.shop.location.lng], [o.dropoff.lat, o.dropoff.lng]]} pathOptions={{ color, weight: 2, dashArray: '4 6' }} />
            )}
            {o.shop?.location && (
              <CircleMarker center={[o.shop.location.lat, o.shop.location.lng]} radius={8} pathOptions={{ color: '#fff', fillColor: color, fillOpacity: 1, weight: 2 }} eventHandlers={handlers}>
                <Tooltip>
                  {o.reference} · {o.shop.name}
                </Tooltip>
              </CircleMarker>
            )}
            {o.dropoff && (
              <CircleMarker center={[o.dropoff.lat, o.dropoff.lng]} radius={7} pathOptions={{ color: '#fff', fillColor: '#007a3d', fillOpacity: 1, weight: 2 }} eventHandlers={handlers}>
                <Tooltip>{o.reference} · client</Tooltip>
              </CircleMarker>
            )}
          </span>
        );
      })}
      {couriers
        .filter((c) => c.location)
        .map((c) => (
          <CircleMarker
            key={c.id}
            center={[c.location!.lat, c.location!.lng]}
            radius={9}
            pathOptions={{ color: '#fff', fillColor: c.busy ? '#5c5c5c' : '#1565c0', fillOpacity: 1, weight: 3 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              {c.name ?? 'Livreur'}
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
