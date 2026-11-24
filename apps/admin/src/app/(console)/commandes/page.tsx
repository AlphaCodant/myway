'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { OrderDrawer } from '@/components/order-drawer';
import { Badge, Empty, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { ago, deliveryMode, dispatchStatus, fcfa, orderStatus, payment } from '@/lib/format';
import { useData } from '@/lib/use-data';

type Row = {
  id: string;
  reference: string;
  status: string;
  dispatchStatus: string;
  deliveryMode: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  late: boolean;
  createdAt: string;
  items: { quantity: number }[];
};

const STATUS_FILTERS: [string, string][] = [
  ['', 'Toutes'],
  ['PENDING', orderStatus.PENDING],
  ['CONFIRMED', orderStatus.CONFIRMED],
  ['READY', orderStatus.READY],
  ['PICKED_UP', orderStatus.PICKED_UP],
  ['DELIVERED', orderStatus.DELIVERED],
  ['CANCELLED', orderStatus.CANCELLED],
  ['RETURNED', orderStatus.RETURNED],
];

function statusTone(s: string) {
  if (s === 'DELIVERED') return 'ok' as const;
  if (s === 'CANCELLED' || s === 'RETURNED') return 'neutral' as const;
  if (s === 'PENDING' || s === 'AWAITING_CLIENT') return 'warn' as const;
  return 'info' as const;
}

function OrdersInner() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get('id');
  const [status, setStatus] = useState('');
  const [late, setLate] = useState(false);
  const [q, setQ] = useState('');
  const { data, error, loading, reload } = useData<Row[]>('/admin/orders', {
    query: { status, late: late ? 'true' : undefined, limit: 200 },
    refreshMs: 30000,
    refreshOn: ['order.updated', 'order.no_courier', 'order.late'],
  });
  const rows = (data ?? []).filter((o) => !q || o.reference.toLowerCase().includes(q.trim().toLowerCase()));
  const open = (id: string | null) => router.push(id ? `/commandes/?id=${id}` : '/commandes/');

  return (
    <>
      <PageHeader title="Commandes">
        <input type="search" placeholder="Référence (GAG-…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une référence" />
        <select aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} /> En retard seulement
        </label>
      </PageHeader>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>Aucune commande pour ces filtres.</Empty>
      ) : (
        <div className="card flush">
          <table className="clickable">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Statut</th>
                <th>Livraison</th>
                <th>Paiement</th>
                <th className="num">Articles</th>
                <th className="num">Total</th>
                <th>Passée</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} onClick={() => open(o.id)} className={selected === o.id ? 'selected' : ''}>
                  <td>
                    <strong>{o.reference}</strong>
                  </td>
                  <td>
                    <Badge tone={statusTone(o.status)}>{orderStatus[o.status] ?? o.status}</Badge> {o.late && <Badge tone="danger">Retard</Badge>}
                  </td>
                  <td>
                    {deliveryMode[o.deliveryMode]}
                    {o.dispatchStatus === 'NO_COURIER' ? (
                      <>
                        {' '}
                        <Badge tone="danger">{dispatchStatus.NO_COURIER}</Badge>
                      </>
                    ) : null}
                  </td>
                  <td>
                    {payment[o.paymentMethod]} {o.paymentStatus === 'PAID' ? '✓' : ''}
                  </td>
                  <td className="num">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="num">{fcfa(o.total)}</td>
                  <td className="muted">{ago(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <OrderDrawer id={selected} onClose={() => open(null)} onChanged={reload} />}
    </>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrdersInner />
    </Suspense>
  );
}
