'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BarChart } from '@/components/bar-chart';
import { ErrorBox, Loading, PageHeader, Stat } from '@/components/ui';
import { fcfa } from '@/lib/format';
import { useData } from '@/lib/use-data';

type Dashboard = {
  totals: { orders: number; delivered: number; cancelled: number; gmv: number; revenue: number; cancellationRate: number };
  perDay: { day: string; orders: number; delivered: number; cancelled: number; gmv: number; revenue: number; avgDeliveryMinutes: number | null }[];
  perNeighborhood: { quartier: string | null; orders: number; delivered: number; gmv: number }[];
  activeShops: number;
  onlineCouriers: number;
  pendingAccounts: number;
  openTickets: number;
};

export default function DashboardPage() {
  const [days, setDays] = useState(7);
  const { data, error, loading, reload } = useData<Dashboard>('/admin/dashboard', {
    query: { days },
    refreshMs: 60000,
    refreshOn: ['order.updated'],
  });
  const avgMinutes = (() => {
    const rows = data?.perDay.filter((d) => d.avgDeliveryMinutes != null) ?? [];
    if (!rows.length) return null;
    const total = rows.reduce((s, d) => s + d.delivered, 0);
    return Math.round(rows.reduce((s, d) => s + (d.avgDeliveryMinutes ?? 0) * d.delivered, 0) / Math.max(1, total));
  })();

  return (
    <>
      <PageHeader title="Tableau de bord">
        <select aria-label="Période" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>Aujourd’hui</option>
          <option value={7}>7 derniers jours</option>
          <option value={30}>30 derniers jours</option>
        </select>
      </PageHeader>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <>
          <div className="grid stats">
            <Stat label="Commandes" value={data.totals.orders} hint={`${data.totals.delivered} livrées`} />
            <Stat label="Ventes livrées" value={fcfa(data.totals.gmv)} />
            <Stat label="Revenus MyWay" value={fcfa(data.totals.revenue)} hint="commissions + part livraison" />
            <Stat label="Délai moyen" value={avgMinutes == null ? '—' : avgMinutes < 1 ? '< 1 min' : `${avgMinutes} min`} hint="de la commande à la remise" />
            <Stat label="Taux d’annulation" value={`${String(data.totals.cancellationRate).replace('.', ',')} %`} tone={data.totals.cancellationRate > 10 ? 'warn' : undefined} />
          </div>
          <div className="grid stats">
            <Link href="/comptes/" className="card stat link">
              <div className="muted">Comptes à valider</div>
              <div className={`stat-value ${data.pendingAccounts ? 'warn-text' : ''}`}>{data.pendingAccounts}</div>
            </Link>
            <Link href="/support/" className="card stat link">
              <div className="muted">Réclamations ouvertes</div>
              <div className={`stat-value ${data.openTickets ? 'warn-text' : ''}`}>{data.openTickets}</div>
            </Link>
            <Link href="/carte/" className="card stat link">
              <div className="muted">Livreurs en service</div>
              <div className="stat-value">{data.onlineCouriers}</div>
            </Link>
            <Stat label="Commerces actifs" value={data.activeShops} />
          </div>
          <div className="grid two">
            <section className="card">
              <h2>Commandes par jour</h2>
              <p className="muted small">Clair : toutes les commandes · foncé : livrées</p>
              <BarChart label="Commandes par jour" points={data.perDay.map((d) => ({ day: d.day, value: d.orders, secondary: d.delivered }))} />
            </section>
            <section className="card">
              <h2>Par quartier</h2>
              <table>
                <thead>
                  <tr>
                    <th>Quartier</th>
                    <th className="num">Commandes</th>
                    <th className="num">Livrées</th>
                    <th className="num">Ventes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.perNeighborhood.map((n) => (
                    <tr key={n.quartier ?? '—'}>
                      <td>{n.quartier ?? 'Retrait'}</td>
                      <td className="num">{n.orders}</td>
                      <td className="num">{n.delivered}</td>
                      <td className="num">{fcfa(n.gmv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
