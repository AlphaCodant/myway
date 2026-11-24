'use client';

import { useState, type ReactNode } from 'react';

export function Badge({ tone = 'neutral', children }: { tone?: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: 'warn' | 'ok' }) {
  return (
    <div className={`card stat ${tone ?? ''}`}>
      <div className="muted">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      <div className="row">{children}</div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-box" role="alert">
      {message}
      {onRetry && (
        <button className="btn ghost" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function Loading() {
  return <div className="muted pad">Chargement…</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Exécute une action (appel API) en gérant l'état « en cours » et l'erreur. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string, number?][] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([key, label, count]) => (
        <button key={key} role="tab" aria-selected={value === key} className={value === key ? 'active' : ''} onClick={() => onChange(key)}>
          {label}
          {count ? <span className="count">{count}</span> : null}
        </button>
      ))}
    </div>
  );
}
