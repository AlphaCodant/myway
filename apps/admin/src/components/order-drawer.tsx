'use client';

import { useState } from 'react';
import { api, fileUrl } from '@/lib/api';
import { dateTime, deliveryMode, dispatchStatus, fcfa, orderStatus, payment, timelineLabels } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { Badge, ErrorBox, Loading, useAction } from './ui';

type Detail = {
  id: string;
  reference: string;
  status: string;
  dispatchStatus: string;
  deliveryMode: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  commission: number;
  courierEarning: number;
  cancellationFee: number;
  cancelReason: string | null;
  deliveryCode?: string;
  deliveryLandmark: string | null;
  deliveryPhotoUrl: string | null;
  distanceMeters: number | null;
  note: string | null;
  clientCallAttempts: number;
  items: { id: string; name: string; quantity: number; unitPrice: number; status: string; substituteName: string | null }[];
  shop: { id: string; name: string; landmarkText: string | null } | null;
  courier: { id: string; name: string | null } | null;
  timeline: { type: string; at: string }[];
};
type Courier = { userId: string; online: boolean; cashBlocked: boolean; user: { name: string | null; phone: string } };

const CANCELLABLE = ['AWAITING_PAYMENT', 'PENDING', 'AWAITING_CLIENT', 'CONFIRMED', 'READY', 'PICKED_UP'];
const ASSIGNABLE = ['CONFIRMED', 'READY', 'PICKED_UP'];

/** Panneau latéral d'une commande : détail, historique, réaffectation et annulation. */
export function OrderDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data: o, error, reload } = useData<Detail>(`/admin/orders/${id}`, { refreshOn: ['order.updated'] });
  const couriers = useData<Courier[]>('/admin/couriers', { query: { status: 'ACTIVE' } });
  const [courierId, setCourierId] = useState('');
  const [reason, setReason] = useState('');
  const [fee, setFee] = useState('0');
  const action = useAction();

  const done = async () => {
    await reload();
    onChanged();
  };
  const assign = () =>
    action.run(async () => {
      await api(`/admin/orders/${id}/assign`, { method: 'POST', body: { courierId } });
      setCourierId('');
      await done();
    });
  const cancel = () =>
    action.run(async () => {
      await api(`/admin/orders/${id}/cancel`, { method: 'POST', body: { reason, fee: Number(fee) || 0 } });
      setReason('');
      await done();
    });

  const available = (couriers.data ?? []).filter((c) => c.online && c.userId !== o?.courier?.id);

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Détail de la commande">
        <div className="modal-head">
          <h2>{o ? `Commande ${o.reference}` : 'Commande'}</h2>
          <button className="btn ghost" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <ErrorBox message={error} onRetry={reload} />}
        {!o ? (
          <Loading />
        ) : (
          <>
            <div className="row">
              <Badge tone="info">{orderStatus[o.status] ?? o.status}</Badge>
              {o.deliveryMode === 'PLATFORM' && <Badge tone={o.dispatchStatus === 'NO_COURIER' ? 'danger' : 'neutral'}>{dispatchStatus[o.dispatchStatus]}</Badge>}
            </div>
            <dl className="facts">
              <dt>Commerce</dt>
              <dd>{o.shop?.name ?? '—'}</dd>
              <dt>Livraison</dt>
              <dd>
                {deliveryMode[o.deliveryMode]}
                {o.distanceMeters ? ` · ${(o.distanceMeters / 1000).toFixed(1).replace('.', ',')} km` : ''}
              </dd>
              <dt>Repère client</dt>
              <dd>{o.deliveryLandmark ?? '—'}</dd>
              <dt>Livreur</dt>
              <dd>{o.courier?.name ?? '—'}</dd>
              <dt>Paiement</dt>
              <dd>
                {payment[o.paymentMethod]} · {o.paymentStatus === 'PAID' ? 'payé' : o.paymentStatus === 'REFUNDED' ? 'remboursé' : 'à encaisser'}
              </dd>
              <dt>Code de remise</dt>
              <dd>
                <code>{o.deliveryCode ?? '—'}</code>
              </dd>
              {o.clientCallAttempts > 0 && (
                <>
                  <dt>Appels sans réponse</dt>
                  <dd>{o.clientCallAttempts}</dd>
                </>
              )}
              {o.note && (
                <>
                  <dt>Note du client</dt>
                  <dd>{o.note}</dd>
                </>
              )}
              {o.cancelReason && (
                <>
                  <dt>Motif d’annulation</dt>
                  <dd>{o.cancelReason}</dd>
                </>
              )}
            </dl>
            {o.deliveryPhotoUrl && (
              <a href={fileUrl(o.deliveryPhotoUrl)} target="_blank" rel="noreferrer" className="small">
                Voir la photo du portail
              </a>
            )}
            <h3>Articles</h3>
            <table>
              <tbody>
                {o.items.map((i) => (
                  <tr key={i.id} className={i.status === 'REMOVED' ? 'struck' : ''}>
                    <td>
                      {i.quantity} × {i.substituteName ?? i.name}
                      {i.substituteName && <span className="muted small"> (remplace {i.name})</span>}
                    </td>
                    <td className="num">{fcfa(i.unitPrice * i.quantity)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="muted">Livraison</td>
                  <td className="num">{fcfa(o.deliveryFee)}</td>
                </tr>
                <tr className="total">
                  <td>Total</td>
                  <td className="num">{fcfa(o.total)}</td>
                </tr>
                {o.status === 'DELIVERED' && (
                <tr>
                  <td className="muted">Commission MyWay · gain livreur</td>
                  <td className="num muted">
                    {fcfa(o.commission)} · {fcfa(o.courierEarning)}
                  </td>
                </tr>
                )}
              </tbody>
            </table>
            <h3>Historique</h3>
            <ol className="timeline">
              {o.timeline.map((t, i) => (
                <li key={i}>
                  <span className="muted small">{dateTime(t.at)}</span> {timelineLabels[t.type] ?? t.type}
                </li>
              ))}
            </ol>
            {action.error && <ErrorBox message={action.error} />}
            {o.deliveryMode === 'PLATFORM' && ASSIGNABLE.includes(o.status) && (
              <section className="action-box">
                <h3>{o.courier ? 'Réaffecter à un autre livreur' : 'Affecter un livreur'}</h3>
                <div className="row">
                  <select aria-label="Livreur" value={courierId} onChange={(e) => setCourierId(e.target.value)}>
                    <option value="">Choisir un livreur en service…</option>
                    {available.map((c) => (
                      <option key={c.userId} value={c.userId} disabled={c.cashBlocked}>
                        {c.user.name ?? c.user.phone}
                        {c.cashBlocked ? ' (plafond d’espèces)' : ''}
                      </option>
                    ))}
                  </select>
                  <button className="btn primary" disabled={!courierId || action.busy} onClick={assign}>
                    Affecter
                  </button>
                </div>
                {available.length === 0 && <p className="muted small">Aucun livreur en service pour le moment.</p>}
              </section>
            )}
            {CANCELLABLE.includes(o.status) && (
              <section className="action-box danger">
                <h3>Annuler la commande</h3>
                <input placeholder="Motif (envoyé au client par SMS)" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif d’annulation" />
                <div className="row">
                  <label>
                    Frais retenus{' '}
                    <input type="number" min={0} step={100} value={fee} onChange={(e) => setFee(e.target.value)} className="narrow" aria-label="Frais retenus" /> F
                  </label>
                  <button className="btn danger" disabled={!reason.trim() || action.busy} onClick={cancel}>
                    Annuler la commande
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
