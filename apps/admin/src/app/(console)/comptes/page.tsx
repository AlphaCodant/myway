'use client';

import { useState, type FormEvent } from 'react';
import { Badge, Empty, ErrorBox, Loading, Modal, PageHeader, Tabs, useAction } from '@/components/ui';
import { api, fileUrl } from '@/lib/api';
import { accountStatus, ago, categories, dateTime, fcfa, roles, vehicles } from '@/lib/format';
import { useData } from '@/lib/use-data';

type Shop = {
  id: string;
  name: string;
  category: string;
  neighborhoodId: string;
  landmarkText: string | null;
  photoUrl: string | null;
  idDocumentUrl: string | null;
  mobileMoneyNumber: string | null;
  status: string;
  isOpen: boolean;
  selfDelivery: boolean;
  commissionRateOverride: number | null;
  commissionFreeUntil: string | null;
  ratingAvg: number;
  createdAt: string;
  owner: { id: string; name: string | null; phone: string; status: string };
};
type Courier = {
  userId: string;
  vehicle: string;
  idDocumentUrl: string | null;
  licenseUrl: string | null;
  registrationUrl: string | null;
  photoUrl: string | null;
  emergencyContact: string | null;
  mobileMoneyNumber: string | null;
  online: boolean;
  cashHeld: number;
  cashBlocked: boolean;
  lastSeenAt: string | null;
  user: { id: string; name: string | null; phone: string; status: string };
};
type User = { id: string; name: string | null; phone: string; role: string; status: string; createdAt: string };
type City = { id: string; name: string; neighborhoods: { id: string; name: string }[] };

type Tab = 'pending' | 'shops' | 'couriers' | 'staff' | 'users';

const tone = (s: string) => (s === 'ACTIVE' ? 'ok' : s === 'PENDING' ? 'warn' : 'danger') as 'ok' | 'warn' | 'danger';

function Docs({ items }: { items: [string, string | null][] }) {
  const present = items.filter(([, url]) => url);
  const missing = items.filter(([, url]) => !url).map(([l]) => l);
  return (
    <div className="docs">
      {present.map(([label, url]) => (
        <a key={label} href={fileUrl(url)} target="_blank" rel="noreferrer">
          {label}
        </a>
      ))}
      {missing.length > 0 && <span className="muted small">Manque : {missing.join(', ')}</span>}
    </div>
  );
}

export default function AccountsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const shops = useData<Shop[]>('/admin/shops');
  const couriers = useData<Courier[]>('/admin/couriers');
  const cities = useData<City[]>('/admin/cities');
  const nbName = new Map((cities.data ?? []).flatMap((c) => c.neighborhoods.map((n) => [n.id, n.name] as const)));
  const action = useAction();
  const [suspending, setSuspending] = useState<{ userId?: string; shopId?: string; label: string } | null>(null);
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState<Shop | null>(null);

  const reloadAll = () => Promise.all([shops.reload(), couriers.reload()]);
  const setShopStatus = (id: string, status: string) =>
    action.run(async () => {
      await api(`/admin/shops/${id}/status`, { method: 'POST', body: { status } });
      await reloadAll();
    });
  const setUserStatus = (id: string, status: string, why?: string) =>
    action.run(async () => {
      await api(`/admin/users/${id}/status`, { method: 'POST', body: { status, reason: why || undefined } });
      await reloadAll();
    });

  const pendingShops = (shops.data ?? []).filter((s) => s.status === 'PENDING');
  const pendingCouriers = (couriers.data ?? []).filter((c) => c.user.status === 'PENDING');

  const shopRow = (s: Shop) => (
    <tr key={s.id}>
      <td>
        <strong>{s.name}</strong>
        <div className="muted small">
          {categories[s.category] ?? s.category} · {nbName.get(s.neighborhoodId) ?? '—'}
        </div>
        {s.landmarkText && <div className="muted small">{s.landmarkText}</div>}
      </td>
      <td>
        {s.owner.name ?? '—'}
        <div className="muted small">{s.owner.phone}</div>
      </td>
      <td>
        <Docs items={[['Pièce d’identité', s.idDocumentUrl], ['Photo du commerce', s.photoUrl]]} />
        <div className="muted small">Mobile Money : {s.mobileMoneyNumber ?? '—'}</div>
      </td>
      <td>
        <Badge tone={tone(s.status)}>{accountStatus[s.status]}</Badge> {s.status === 'ACTIVE' && <Badge tone={s.isOpen ? 'info' : 'neutral'}>{s.isOpen ? 'Ouvert' : 'Fermé'}</Badge>}
        <div className="muted small">
          Commission : {s.commissionRateOverride != null ? `${s.commissionRateOverride} %` : 'par catégorie'}
          {s.commissionFreeUntil && new Date(s.commissionFreeUntil) > new Date() ? ` · offerte jusqu’au ${new Date(s.commissionFreeUntil).toLocaleDateString('fr-FR')}` : ''}
        </div>
      </td>
      <td className="actions">
        {s.status !== 'ACTIVE' && (
          <button className="btn primary small" disabled={action.busy} onClick={() => setShopStatus(s.id, 'ACTIVE')}>
            {s.status === 'PENDING' ? 'Valider' : 'Réactiver'}
          </button>
        )}
        {s.status === 'ACTIVE' && (
          <button className="btn ghost small" onClick={() => setEditing(s)}>
            Commission
          </button>
        )}
        {s.status !== 'SUSPENDED' && (
          <button className="btn danger-ghost small" disabled={action.busy} onClick={() => setSuspending({ shopId: s.id, userId: s.owner.id, label: s.name })}>
            {s.status === 'PENDING' ? 'Refuser' : 'Suspendre'}
          </button>
        )}
      </td>
    </tr>
  );

  const courierRow = (c: Courier) => (
    <tr key={c.userId}>
      <td>
        <strong>{c.user.name ?? 'Sans nom'}</strong>
        <div className="muted small">
          {c.user.phone} · {vehicles[c.vehicle] ?? c.vehicle}
        </div>
      </td>
      <td>
        <Docs
          items={[
            ['Pièce d’identité', c.idDocumentUrl],
            ['Photo', c.photoUrl],
            ...(c.vehicle === 'MOTO' ? ([['Permis', c.licenseUrl], ['Carte grise', c.registrationUrl]] as [string, string | null][]) : []),
          ]}
        />
        <div className="muted small">Urgence : {c.emergencyContact ?? '—'}</div>
      </td>
      <td>
        <Badge tone={tone(c.user.status)}>{accountStatus[c.user.status]}</Badge> {c.online && <Badge tone="info">En service</Badge>}
        <div className={`small ${c.cashBlocked ? 'danger-text' : 'muted'}`}>Espèces : {fcfa(c.cashHeld)}</div>
        {c.lastSeenAt && <div className="muted small">Vu {ago(c.lastSeenAt)}</div>}
      </td>
      <td className="actions">
        {c.user.status !== 'ACTIVE' && (
          <button className="btn primary small" disabled={action.busy} onClick={() => setUserStatus(c.user.id, 'ACTIVE')}>
            {c.user.status === 'PENDING' ? 'Valider' : 'Réactiver'}
          </button>
        )}
        {c.user.status !== 'SUSPENDED' && (
          <button className="btn danger-ghost small" disabled={action.busy} onClick={() => setSuspending({ userId: c.user.id, label: c.user.name ?? c.user.phone })}>
            {c.user.status === 'PENDING' ? 'Refuser' : 'Suspendre'}
          </button>
        )}
      </td>
    </tr>
  );

  const loading = (shops.loading && !shops.data) || (couriers.loading && !couriers.data);

  return (
    <>
      <PageHeader title="Comptes" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['pending', 'À valider', pendingShops.length + pendingCouriers.length],
          ['shops', 'Commerces', shops.data?.length],
          ['couriers', 'Livreurs', couriers.data?.length],
          ['staff', 'Équipe'],
          ['users', 'Rechercher un compte'],
        ]}
      />
      {(shops.error || couriers.error) && <ErrorBox message={(shops.error || couriers.error)!} onRetry={reloadAll} />}
      {action.error && <ErrorBox message={action.error} />}
      {loading && <Loading />}

      {tab === 'pending' && !loading && (
        <>
          <h2>Commerces ({pendingShops.length})</h2>
          {pendingShops.length ? (
            <div className="card flush">
              <table>
                <tbody>{pendingShops.map(shopRow)}</tbody>
              </table>
            </div>
          ) : (
            <Empty>Aucun commerce en attente.</Empty>
          )}
          <h2>Livreurs ({pendingCouriers.length})</h2>
          {pendingCouriers.length ? (
            <div className="card flush">
              <table>
                <tbody>{pendingCouriers.map(courierRow)}</tbody>
              </table>
            </div>
          ) : (
            <Empty>Aucun livreur en attente.</Empty>
          )}
        </>
      )}
      {tab === 'shops' && shops.data && (
        <div className="card flush">
          <table>
            <thead>
              <tr>
                <th>Commerce</th>
                <th>Commerçant</th>
                <th>Pièces</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>{shops.data.map(shopRow)}</tbody>
          </table>
        </div>
      )}
      {tab === 'couriers' && couriers.data && (
        <div className="card flush">
          <table>
            <thead>
              <tr>
                <th>Livreur</th>
                <th>Pièces</th>
                <th>État</th>
                <th />
              </tr>
            </thead>
            <tbody>{couriers.data.map(courierRow)}</tbody>
          </table>
        </div>
      )}
      {tab === 'staff' && <Staff />}
      {tab === 'users' && <UserSearch onChange={reloadAll} />}

      {suspending && (
        <Modal title={`Suspendre ${suspending.label}`} onClose={() => setSuspending(null)}>
          <p>Le compte ne pourra plus se connecter aux commandes{suspending.shopId ? ' et le commerce sera fermé' : ''}. Le motif est envoyé par SMS.</p>
          <input placeholder="Motif" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Motif" autoFocus />
          <div className="row end">
            <button className="btn ghost" onClick={() => setSuspending(null)}>
              Retour
            </button>
            <button
              className="btn danger"
              disabled={action.busy}
              onClick={async () => {
                if (suspending.shopId) await api(`/admin/shops/${suspending.shopId}/status`, { method: 'POST', body: { status: 'SUSPENDED' } }).catch(() => null);
                if (suspending.userId) await setUserStatus(suspending.userId, 'SUSPENDED', reason);
                setSuspending(null);
                setReason('');
                await reloadAll();
              }}
            >
              Suspendre
            </button>
          </div>
        </Modal>
      )}
      {editing && <CommissionModal shop={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); shops.reload(); }} />}
    </>
  );
}

function CommissionModal({ shop, onClose, onSaved }: { shop: Shop; onClose: () => void; onSaved: () => void }) {
  const [rate, setRate] = useState(shop.commissionRateOverride != null ? String(shop.commissionRateOverride) : '');
  const [freeUntil, setFreeUntil] = useState(shop.commissionFreeUntil ? shop.commissionFreeUntil.slice(0, 10) : '');
  const [selfDelivery, setSelfDelivery] = useState(shop.selfDelivery);
  const action = useAction();
  const save = () =>
    action.run(async () => {
      await api(`/admin/shops/${shop.id}`, {
        method: 'PATCH',
        body: { commissionRateOverride: rate === '' ? null : Number(rate), commissionFreeUntil: freeUntil || null, selfDelivery },
      });
      onSaved();
    });
  return (
    <Modal title={`Conditions de ${shop.name}`} onClose={onClose}>
      <label>
        Commission propre au commerce (%) — vide = taux de la catégorie
        <input type="number" min={0} max={50} step={0.5} value={rate} onChange={(e) => setRate(e.target.value)} />
      </label>
      <label>
        Commission offerte jusqu’au
        <input type="date" value={freeUntil} onChange={(e) => setFreeUntil(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={selfDelivery} onChange={(e) => setSelfDelivery(e.target.checked)} /> Le commerce peut livrer lui-même
      </label>
      {action.error && <ErrorBox message={action.error} />}
      <div className="row end">
        <button className="btn ghost" onClick={onClose}>
          Retour
        </button>
        <button className="btn primary" disabled={action.busy} onClick={save}>
          Enregistrer
        </button>
      </div>
    </Modal>
  );
}

function Staff() {
  const admins = useData<User[]>('/admin/users', { query: { role: 'ADMIN' } });
  const agents = useData<User[]>('/admin/users', { query: { role: 'AGENT' } });
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('AGENT');
  const action = useAction();
  const add = (e: FormEvent) => {
    e.preventDefault();
    action.run(async () => {
      await api('/admin/staff', { method: 'POST', body: { phone, name, role } });
      setPhone('');
      setName('');
      await Promise.all([admins.reload(), agents.reload()]);
    });
  };
  const rows = [...(admins.data ?? []), ...(agents.data ?? [])];
  return (
    <div className="grid two">
      <section className="card flush">
        <table>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Rôle</th>
              <th>Depuis</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.name ?? '—'}</td>
                <td>{u.phone}</td>
                <td>{roles[u.role]}</td>
                <td className="muted">{dateTime(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <form className="card" onSubmit={add}>
        <h2>Ajouter un membre de l’équipe</h2>
        <label>
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Téléphone
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 …" required />
        </label>
        <label>
          Rôle
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="AGENT">Agent terrain (inscrit les commerçants)</option>
            <option value="ADMIN">Administrateur (accès à cette console)</option>
          </select>
        </label>
        {action.error && <ErrorBox message={action.error} />}
        <button className="btn primary" disabled={action.busy}>
          Ajouter
        </button>
      </form>
    </div>
  );
}

function UserSearch({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const users = useData<User[]>(term ? '/admin/users' : null, { query: { q: term } });
  const action = useAction();
  const setStatus = (id: string, status: string) =>
    action.run(async () => {
      await api(`/admin/users/${id}/status`, { method: 'POST', body: { status } });
      await users.reload();
      onChange();
    });
  return (
    <>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(q.trim());
        }}
      >
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou numéro" aria-label="Nom ou numéro" />
        <button className="btn primary">Rechercher</button>
      </form>
      {action.error && <ErrorBox message={action.error} />}
      {term && users.data && (
        <div className="card flush">
          {users.data.length === 0 ? (
            <Empty>Aucun compte trouvé.</Empty>
          ) : (
            <table>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name ?? '—'}</td>
                    <td>{u.phone}</td>
                    <td>{roles[u.role]}</td>
                    <td>
                      <Badge tone={tone(u.status)}>{accountStatus[u.status]}</Badge>
                    </td>
                    <td className="actions">
                      {u.status === 'SUSPENDED' ? (
                        <button className="btn ghost small" onClick={() => setStatus(u.id, 'ACTIVE')}>
                          Réactiver
                        </button>
                      ) : (
                        <button className="btn danger-ghost small" onClick={() => setStatus(u.id, 'SUSPENDED')}>
                          Suspendre
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}
