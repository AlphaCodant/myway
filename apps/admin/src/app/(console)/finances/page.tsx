'use client';

import { useState } from 'react';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHeader, Tabs, useAction } from '@/components/ui';
import { api, download } from '@/lib/api';
import { dateTime, fcfa } from '@/lib/format';
import { useData } from '@/lib/use-data';

type Balances = {
  shops: { id: string; name: string; mobileMoneyNumber: string | null; payoutFrequency: string; balance: number }[];
  couriers: { id: string; name: string | null; phone: string; cashHeld: number; mobileMoneyNumber: string | null; balance: number }[];
};
type Payout = {
  id: string;
  accountType: 'SHOP' | 'COURIER';
  accountId: string;
  accountName: string | null;
  amount: number;
  mobileMoneyNumber: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
  processedAt: string | null;
};
type Tab = 'cash' | 'payouts' | 'shops' | 'export';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>('cash');
  const balances = useData<Balances>('/admin/finance/balances');
  const payouts = useData<Payout[]>('/admin/finance/payouts');
  const settings = useData<Record<string, number>>('/admin/settings');
  const ceiling = settings.data?.courierCashCeiling ?? 50000;
  const action = useAction();
  const [remit, setRemit] = useState<Balances['couriers'][number] | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [paying, setPaying] = useState<Payout | null>(null);
  const [ref, setRef] = useState('');
  const [from, setFrom] = useState(iso(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(iso(new Date()));

  const requested = (payouts.data ?? []).filter((p) => p.status === 'REQUESTED');
  const cashTotal = (balances.data?.couriers ?? []).reduce((s, c) => s + c.cashHeld, 0);

  const saveRemit = () =>
    action.run(async () => {
      await api('/admin/finance/remittances', { method: 'POST', body: { courierId: remit!.id, amount: Number(amount), note: note || undefined } });
      setRemit(null);
      setNote('');
      await balances.reload();
    });
  const pay = () =>
    action.run(async () => {
      await api(`/admin/finance/payouts/${paying!.id}/pay`, { method: 'POST', body: { providerRef: ref || undefined } });
      setPaying(null);
      setRef('');
      await Promise.all([payouts.reload(), balances.reload()]);
    });
  const reject = (p: Payout) =>
    action.run(async () => {
      await api(`/admin/finance/payouts/${p.id}/reject`, { method: 'POST' });
      await payouts.reload();
    });

  return (
    <>
      <PageHeader title="Finances" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['cash', 'Espèces des livreurs'],
          ['payouts', 'Reversements à faire', requested.length],
          ['shops', 'Soldes des commerces'],
          ['export', 'Export comptable'],
        ]}
      />
      {(balances.error || payouts.error) && <ErrorBox message={(balances.error || payouts.error)!} onRetry={() => { balances.reload(); payouts.reload(); }} />}
      {action.error && <ErrorBox message={action.error} />}
      {!balances.data && <Loading />}

      {tab === 'cash' && balances.data && (
        <>
          <p className="muted">
            Espèces encaissées par les livreurs et pas encore reversées : <strong>{fcfa(cashTotal)}</strong>. Au-delà de {fcfa(ceiling)}, un livreur ne reçoit plus de course.
          </p>
          <div className="card flush">
            <table>
              <thead>
                <tr>
                  <th>Livreur</th>
                  <th className="num">Espèces à reverser</th>
                  <th className="num">Gains à payer</th>
                  <th>Mobile Money</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {balances.data.couriers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name ?? '—'}</strong>
                      <div className="muted small">{c.phone}</div>
                    </td>
                    <td className="num">
                      {fcfa(c.cashHeld)} {c.cashHeld >= ceiling && <Badge tone="danger">Bloqué</Badge>}
                    </td>
                    <td className="num">{fcfa(c.balance)}</td>
                    <td>{c.mobileMoneyNumber ?? '—'}</td>
                    <td className="actions">
                      <button
                        className="btn primary small"
                        disabled={c.cashHeld <= 0}
                        onClick={() => {
                          setRemit(c);
                          setAmount(String(c.cashHeld));
                        }}
                      >
                        Remise d’espèces
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'payouts' && payouts.data && (
        <>
          {requested.length === 0 && <Empty>Aucune demande de reversement en attente.</Empty>}
          {requested.length > 0 && (
            <div className="card flush">
              <table>
                <thead>
                  <tr>
                    <th>Bénéficiaire</th>
                    <th className="num">Montant</th>
                    <th>Mobile Money</th>
                    <th>Demandé</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {requested.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.accountName ?? p.accountId.slice(0, 8)}</strong> <Badge>{p.accountType === 'SHOP' ? 'Commerce' : 'Livreur'}</Badge>
                      </td>
                      <td className="num">{fcfa(p.amount)}</td>
                      <td>{p.mobileMoneyNumber}</td>
                      <td className="muted">{dateTime(p.createdAt)}</td>
                      <td className="actions">
                        <button className="btn primary small" onClick={() => setPaying(p)}>
                          Marquer payé
                        </button>
                        <button className="btn danger-ghost small" disabled={action.busy} onClick={() => reject(p)}>
                          Rejeter
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h2>Historique</h2>
          <div className="card flush">
            <table>
              <tbody>
                {payouts.data
                  .filter((p) => p.status !== 'REQUESTED')
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{p.accountName ?? '—'}</td>
                      <td className="num">{fcfa(p.amount)}</td>
                      <td>
                        <Badge tone={p.status === 'PAID' ? 'ok' : 'neutral'}>{p.status === 'PAID' ? 'Payé' : 'Rejeté'}</Badge>
                      </td>
                      <td className="muted">{p.providerRef ?? ''}</td>
                      <td className="muted">{dateTime(p.processedAt)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'shops' && balances.data && (
        <div className="card flush">
          <table>
            <thead>
              <tr>
                <th>Commerce</th>
                <th className="num">Solde dû</th>
                <th>Mobile Money</th>
                <th>Rythme de reversement</th>
              </tr>
            </thead>
            <tbody>
              {balances.data.shops.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className={`num ${s.balance < 0 ? 'danger-text' : ''}`}>{fcfa(s.balance)}</td>
                  <td>{s.mobileMoneyNumber ?? '—'}</td>
                  <td>{s.payoutFrequency === 'DAILY' ? 'Quotidien' : s.payoutFrequency === 'WEEKLY' ? 'Hebdomadaire' : s.payoutFrequency}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small pad">Un solde négatif signifie que le commerce doit des commissions à MyWay (ventes encaissées en espèces par lui-même).</p>
        </div>
      )}

      {tab === 'export' && (
        <section className="card narrow-card">
          <h2>Export des commandes (CSV pour Excel)</h2>
          <div className="row">
            <label>
              Du <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              au <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <button className="btn primary" disabled={action.busy} onClick={() => action.run(() => download('/admin/finance/export.csv', `commandes-${from}-${to}.csv`, { from, to }))}>
            Télécharger
          </button>
        </section>
      )}

      {remit && (
        <Modal title={`Remise d’espèces de ${remit.name ?? remit.phone}`} onClose={() => setRemit(null)}>
          <p>Le livreur détient {fcfa(remit.cashHeld)}. Saisis le montant reçu.</p>
          <label>
            Montant reçu (F)
            <input type="number" min={1} max={remit.cashHeld} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </label>
          <label>
            Note (optionnelle)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reçu par l’agent du quartier Commerce" />
          </label>
          <div className="row end">
            <button className="btn ghost" onClick={() => setRemit(null)}>
              Retour
            </button>
            <button className="btn primary" disabled={action.busy || !(Number(amount) > 0)} onClick={saveRemit}>
              Enregistrer la remise
            </button>
          </div>
        </Modal>
      )}
      {paying && (
        <Modal title={`Payer ${fcfa(paying.amount)} à ${paying.accountName ?? ''}`} onClose={() => setPaying(null)}>
          <p>
            Envoie {fcfa(paying.amount)} sur le {paying.mobileMoneyNumber}, puis note la référence de la transaction.
          </p>
          <label>
            Référence Mobile Money
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="ex. OM241124.1532.A12345" autoFocus />
          </label>
          <div className="row end">
            <button className="btn ghost" onClick={() => setPaying(null)}>
              Retour
            </button>
            <button className="btn primary" disabled={action.busy} onClick={pay}>
              Confirmer le paiement
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
