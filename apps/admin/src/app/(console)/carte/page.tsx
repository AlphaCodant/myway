'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Badge, ErrorBox, PageHeader } from '@/components/ui';
import { ago, dispatchStatus, fcfa, orderStatus, vehicles } from '@/lib/format';
import { useData } from '@/lib/use-data';

// Leaflet a besoin du navigateur : la carte n'est chargée que côté client.
const LiveMap = dynamic(() => import('@/components/live-map'), { ssr: false, loading: () => <div className="map placeholder">Chargement de la carte…</div> });

type Live = {
  couriers: { id: string; name: string | null; vehicle: string; location: { lat: number; lng: number } | null; lastSeenAt: string | null; cashHeld: number }[];
  orders: {
    id: string;
    reference: string;
    status: string;
    dispatchStatus: string;
    courierId: string | null;
    late: boolean;
    createdAt: string;
    shop?: { name: string; location: { lat: number; lng: number } | null };
    dropoff: { lat: number; lng: number } | null;
  }[];
};

export default function LivePage() {
  const router = useRouter();
  const { data, error, reload } = useData<Live>('/admin/live', { refreshMs: 10000, refreshOn: ['order.updated', 'order.no_courier', 'order.late'] });
  const busy = new Set(data?.orders.map((o) => o.courierId).filter(Boolean));
  const open = (id: string) => router.push(`/commandes/?id=${id}`);
  const alerts = data?.orders.filter((o) => o.late || o.dispatchStatus === 'NO_COURIER') ?? [];

  return (
    <>
      <PageHeader title="Carte en direct">
        <span className="muted small">Mise à jour toutes les 10 s et à chaque événement</span>
      </PageHeader>
      {error && <ErrorBox message={error} onRetry={reload} />}
      <div className="live">
        <div className="card map-card">
          <LiveMap
            couriers={(data?.couriers ?? []).map((c) => ({ id: c.id, name: c.name, location: c.location, busy: busy.has(c.id) }))}
            orders={(data?.orders ?? []).map((o) => ({ ...o, noCourier: o.dispatchStatus === 'NO_COURIER' }))}
            onSelectOrder={open}
          />
          <div className="legend">
            <span><i style={{ background: '#1565c0' }} /> Livreur libre</span>
            <span><i style={{ background: '#5c5c5c' }} /> Livreur en course</span>
            <span><i style={{ background: '#e85d04' }} /> Commerce</span>
            <span><i style={{ background: '#007a3d' }} /> Client</span>
            <span><i style={{ background: '#b00020' }} /> En retard / sans livreur</span>
          </div>
        </div>
        <div className="live-side">
          <section className="card">
            <h2>À traiter ({alerts.length})</h2>
            {alerts.length === 0 && <p className="muted">Aucune commande en retard ni sans livreur.</p>}
            {alerts.map((o) => (
              <button key={o.id} className="list-item" onClick={() => open(o.id)}>
                <strong>{o.reference}</strong> · {o.shop?.name}
                <div className="row small">
                  {o.late && <Badge tone="danger">En retard</Badge>}
                  {o.dispatchStatus === 'NO_COURIER' && <Badge tone="danger">Aucun livreur</Badge>}
                  <span className="muted">{orderStatus[o.status]} · {ago(o.createdAt)}</span>
                </div>
              </button>
            ))}
          </section>
          <section className="card">
            <h2>Livreurs en service ({data?.couriers.length ?? 0})</h2>
            {data?.couriers.map((c) => (
              <div key={c.id} className="list-item static">
                <strong>{c.name ?? 'Livreur'}</strong> <span className="muted small">{vehicles[c.vehicle] ?? c.vehicle}</span>
                <div className="row small">
                  <Badge tone={busy.has(c.id) ? 'neutral' : 'info'}>{busy.has(c.id) ? 'En course' : 'Libre'}</Badge>
                  <span className="muted">vu {ago(c.lastSeenAt)} · espèces {fcfa(c.cashHeld)}</span>
                </div>
              </div>
            ))}
          </section>
          <section className="card">
            <h2>Commandes en cours ({data?.orders.length ?? 0})</h2>
            {data?.orders.map((o) => (
              <button key={o.id} className="list-item" onClick={() => open(o.id)}>
                <strong>{o.reference}</strong> · {o.shop?.name}
                <div className="muted small">
                  {orderStatus[o.status]} · {dispatchStatus[o.dispatchStatus]}
                </div>
              </button>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
