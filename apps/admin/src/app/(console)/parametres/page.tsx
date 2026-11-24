'use client';

import { useEffect, useState } from 'react';
import { ErrorBox, Loading, PageHeader, Tabs, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { categories, fcfa, settingLabels } from '@/lib/format';
import { useData } from '@/lib/use-data';

type City = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  center: { type: string; coordinates: [number, number] } | null;
  neighborhoods: { id: string; name: string; active: boolean; center: { coordinates: [number, number] } | null }[];
};
type Tier = { maxDistanceMeters: number; fee: number };
type Tab = 'rules' | 'commissions' | 'tariffs' | 'zones';

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('rules');
  return (
    <>
      <PageHeader title="Paramètres" />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          ['rules', 'Règles'],
          ['commissions', 'Commissions'],
          ['tariffs', 'Frais de livraison'],
          ['zones', 'Villes et quartiers'],
        ]}
      />
      {tab === 'rules' && <Rules />}
      {tab === 'commissions' && <Commissions />}
      {tab === 'tariffs' && <Tariffs />}
      {tab === 'zones' && <Zones />}
    </>
  );
}

function Rules() {
  const { data, error, reload } = useData<Record<string, number>>('/admin/settings');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const action = useAction();
  useEffect(() => {
    if (data) setDraft(Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])));
  }, [data]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const save = (key: string) =>
    action.run(async () => {
      await api(`/admin/settings/${key}`, { method: 'PUT', body: { value: Number(draft[key]) } });
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
      await reload();
    });
  return (
    <div className="card flush">
      {action.error && <ErrorBox message={action.error} />}
      <table>
        <tbody>
          {Object.keys(settingLabels).map((key) => (
            <tr key={key}>
              <td>{settingLabels[key].label}</td>
              <td className="num">
                <input
                  type="number"
                  className="narrow"
                  aria-label={settingLabels[key].label}
                  value={draft[key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                />{' '}
                {settingLabels[key].unit ?? ''}
              </td>
              <td className="actions">
                {String(data[key]) !== draft[key] && (
                  <button className="btn primary small" disabled={action.busy || draft[key] === ''} onClick={() => save(key)}>
                    Enregistrer
                  </button>
                )}
                {saved === key && <span className="ok-text small">Enregistré ✓</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Commissions() {
  const { data, error, reload } = useData<{ category: string; ratePercent: number }[]>('/admin/commissions');
  const settings = useData<Record<string, number>>('/admin/settings');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const action = useAction();
  useEffect(() => {
    const base = Object.fromEntries(Object.keys(categories).map((c) => [c, '']));
    for (const r of data ?? []) base[r.category] = String(r.ratePercent);
    setDraft(base);
  }, [data]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const save = () =>
    action.run(async () => {
      const items = Object.entries(draft)
        .filter(([, v]) => v !== '')
        .map(([category, v]) => ({ category, ratePercent: Number(v) }));
      await api('/admin/commissions', { method: 'PUT', body: { items } });
      await reload();
    });
  return (
    <section className="card narrow-card">
      <p className="muted">
        Commission prélevée sur les ventes, par catégorie. Vide = taux par défaut ({settings.data?.defaultCommissionPercent ?? 10} %). Un taux propre à un commerce se règle dans Comptes.
      </p>
      <table>
        <tbody>
          {Object.entries(categories).map(([key, label]) => (
            <tr key={key}>
              <td>{label}</td>
              <td className="num">
                <input type="number" min={0} max={50} step={0.5} className="narrow" aria-label={label} value={draft[key] ?? ''} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /> %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {action.error && <ErrorBox message={action.error} />}
      <button className="btn primary" disabled={action.busy} onClick={save}>
        Enregistrer les commissions
      </button>
    </section>
  );
}

function Tariffs() {
  const cities = useData<City[]>('/admin/cities');
  const [cityId, setCityId] = useState('');
  const city = cityId || (cities.data?.find((c) => c.active) ?? cities.data?.[0])?.id || '';
  const tariffs = useData<Tier[]>(city ? `/admin/cities/${city}/tariffs` : null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const action = useAction();
  useEffect(() => setTiers(tariffs.data ?? []), [tariffs.data]);
  if (!cities.data) return <Loading />;
  const update = (i: number, patch: Partial<Tier>) => setTiers(tiers.map((t, j) => (i === j ? { ...t, ...patch } : t)));
  const save = () =>
    action.run(async () => {
      const sorted = [...tiers].filter((t) => t.maxDistanceMeters > 0).sort((a, b) => a.maxDistanceMeters - b.maxDistanceMeters);
      await api(`/admin/cities/${city}/tariffs`, { method: 'PUT', body: { tiers: sorted } });
      await tariffs.reload();
    });
  let prev = 0;
  return (
    <section className="card narrow-card">
      <div className="row">
        <label>
          Ville{' '}
          <select value={city} onChange={(e) => setCityId(e.target.value)}>
            {cities.data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted">Frais payés par le client selon la distance entre le commerce et l’adresse de livraison.</p>
      <table>
        <thead>
          <tr>
            <th>Jusqu’à (m)</th>
            <th>Frais</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {tiers.map((t, i) => {
            const label = `${(prev / 1000).toString().replace('.', ',')} à ${(t.maxDistanceMeters / 1000).toString().replace('.', ',')} km : ${fcfa(t.fee)}`;
            prev = t.maxDistanceMeters;
            return (
              <tr key={i} title={label}>
                <td>
                  <input type="number" min={100} step={100} className="narrow" aria-label="Distance maximale" value={t.maxDistanceMeters} onChange={(e) => update(i, { maxDistanceMeters: Number(e.target.value) })} />
                </td>
                <td>
                  <input type="number" min={0} step={50} className="narrow" aria-label="Frais" value={t.fee} onChange={(e) => update(i, { fee: Number(e.target.value) })} /> F
                </td>
                <td className="actions">
                  <button className="btn ghost small" aria-label="Supprimer la tranche" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="row">
        <button className="btn ghost" onClick={() => setTiers([...tiers, { maxDistanceMeters: (tiers.at(-1)?.maxDistanceMeters ?? 0) + 1000, fee: (tiers.at(-1)?.fee ?? 500) + 250 }])}>
          + Ajouter une tranche
        </button>
        <button className="btn primary" disabled={action.busy} onClick={save}>
          Enregistrer les frais
        </button>
      </div>
      {action.error && <ErrorBox message={action.error} />}
    </section>
  );
}

function Zones() {
  const { data, error, reload } = useData<City[]>('/admin/cities');
  const [form, setForm] = useState({ cityId: '', name: '', lat: '', lng: '' });
  const action = useAction();
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const cityId = form.cityId || data[0]?.id || '';
  const add = () =>
    action.run(async () => {
      await api('/admin/neighborhoods', {
        method: 'POST',
        body: { cityId, name: form.name, lat: form.lat ? Number(form.lat) : undefined, lng: form.lng ? Number(form.lng) : undefined },
      });
      setForm({ ...form, name: '', lat: '', lng: '' });
      await reload();
    });
  const toggle = (cityIdOf: string, n: City['neighborhoods'][number]) =>
    action.run(async () => {
      await api(`/admin/neighborhoods/${n.id}`, { method: 'PUT', body: { cityId: cityIdOf, name: n.name, active: !n.active } });
      await reload();
    });
  const toggleCity = (c: City) =>
    action.run(async () => {
      await api(`/admin/cities/${c.id}`, { method: 'PUT', body: { slug: c.slug, name: c.name, active: !c.active } });
      await reload();
    });
  return (
    <div className="grid two">
      <div>
        {data.map((c) => (
          <section key={c.id} className="card">
            <div className="row spread">
              <h2>{c.name}</h2>
              <button className={`btn small ${c.active ? 'ghost' : 'primary'}`} onClick={() => toggleCity(c)}>
                {c.active ? 'Désactiver la ville' : 'Ouvrir la ville'}
              </button>
            </div>
            <table>
              <tbody>
                {c.neighborhoods.map((n) => (
                  <tr key={n.id}>
                    <td>{n.name}</td>
                    <td className="muted small">{n.center ? `${n.center.coordinates[1].toFixed(4)}, ${n.center.coordinates[0].toFixed(4)}` : 'sans position'}</td>
                    <td className="actions">
                      <label className="check">
                        <input type="checkbox" checked={n.active} onChange={() => toggle(c.id, n)} /> Ouvert
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
      <section className="card">
        <h2>Ajouter un quartier</h2>
        <label>
          Ville
          <select value={cityId} onChange={(e) => setForm({ ...form, cityId: e.target.value })}>
            {data.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nom du quartier
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="row">
          <label>
            Latitude
            <input value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} placeholder="6.1319" />
          </label>
          <label>
            Longitude
            <input value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} placeholder="-5.9506" />
          </label>
        </div>
        {action.error && <ErrorBox message={action.error} />}
        <button className="btn primary" disabled={action.busy || !form.name.trim()} onClick={add}>
          Ajouter
        </button>
      </section>
    </div>
  );
}
