'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHeader, Tabs, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { ago, dateTime, fcfa, orderStatus, roles } from '@/lib/format';
import { useData } from '@/lib/use-data';

type Ticket = {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  messages: { authorRole: string; text: string; at: string }[];
  refundAmount: number | null;
  createdAt: string;
  resolvedAt: string | null;
  user: { name: string | null; phone: string; role: string } | null;
  order: { id: string; reference: string; total: number; status: string } | null;
};

const statusLabel = { OPEN: 'Nouvelle', IN_PROGRESS: 'En cours', RESOLVED: 'Résolue' };

export default function SupportPage() {
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const { data, error, loading, reload } = useData<Ticket[]>('/admin/tickets', { refreshOn: ['ticket.new', 'ticket.updated'] });
  const [selected, setSelected] = useState<Ticket | null>(null);
  const open = (data ?? []).filter((t) => t.status !== 'RESOLVED');
  const rows = tab === 'open' ? open : (data ?? []).filter((t) => t.status === 'RESOLVED');

  return (
    <>
      <PageHeader title="Réclamations" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['open', 'À traiter', open.length],
          ['resolved', 'Résolues'],
        ]}
      />
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && !data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty>{tab === 'open' ? 'Aucune réclamation à traiter.' : 'Aucune réclamation résolue.'}</Empty>
      ) : (
        <div className="card flush">
          <table className="clickable">
            <thead>
              <tr>
                <th>Objet</th>
                <th>De</th>
                <th>Commande</th>
                <th>État</th>
                <th>Reçue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} onClick={() => setSelected(t)}>
                  <td>
                    <strong>{t.subject}</strong>
                    <div className="muted small ellipsis">{t.messages[0]?.text}</div>
                  </td>
                  <td>
                    {t.user?.name ?? t.user?.phone ?? '—'}
                    <div className="muted small">{t.user ? roles[t.user.role] : ''}</div>
                  </td>
                  <td>{t.order?.reference ?? '—'}</td>
                  <td>
                    <Badge tone={t.status === 'RESOLVED' ? 'ok' : t.status === 'OPEN' ? 'warn' : 'info'}>{statusLabel[t.status]}</Badge>
                    {t.refundAmount ? <div className="muted small">Remboursé {fcfa(t.refundAmount)}</div> : null}
                  </td>
                  <td className="muted">{ago(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <TicketModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </>
  );
}

function TicketModal({ ticket, onClose, onDone }: { ticket: Ticket; onClose: () => void; onDone: () => void }) {
  const [message, setMessage] = useState('');
  const [refund, setRefund] = useState('');
  const action = useAction();
  const resolve = () =>
    action.run(async () => {
      await api(`/admin/tickets/${ticket.id}/resolve`, {
        method: 'POST',
        body: { message: message || undefined, refundAmount: refund ? Number(refund) : undefined },
      });
      onDone();
    });
  return (
    <Modal title={ticket.subject} onClose={onClose}>
      <div className="muted small">
        {ticket.user?.name ?? ''} {ticket.user?.phone} · {dateTime(ticket.createdAt)}
      </div>
      {ticket.order && (
        <p>
          Commande{' '}
          <Link href={`/commandes/?id=${ticket.order.id}`}>
            <strong>{ticket.order.reference}</strong>
          </Link>{' '}
          · {fcfa(ticket.order.total)} · {orderStatus[ticket.order.status]}
        </p>
      )}
      <div className="messages">
        {ticket.messages.map((m, i) => (
          <div key={i} className={`message ${m.authorRole === 'ADMIN' ? 'mine' : ''}`}>
            <div>{m.text}</div>
            <div className="muted small">
              {roles[m.authorRole] ?? m.authorRole} · {dateTime(m.at)}
            </div>
          </div>
        ))}
      </div>
      {ticket.status !== 'RESOLVED' && (
        <>
          <label>
            Réponse au client
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Nous avons remboursé…" />
          </label>
          {ticket.order && (
            <label>
              Remboursement (F, optionnel — maximum {fcfa(ticket.order.total)})
              <input type="number" min={0} max={ticket.order.total} step={50} value={refund} onChange={(e) => setRefund(e.target.value)} />
            </label>
          )}
          {action.error && <ErrorBox message={action.error} />}
          <div className="row end">
            <button className="btn ghost" onClick={onClose}>
              Retour
            </button>
            <button className="btn primary" disabled={action.busy} onClick={resolve}>
              Clore la réclamation
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
