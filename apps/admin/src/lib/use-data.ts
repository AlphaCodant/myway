'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { useRealtime, type AdminEvent } from './realtime';

type Options = { query?: Record<string, unknown>; refreshMs?: number; refreshOn?: AdminEvent[] };

/** Charge une ressource de l'API, la rafraîchit périodiquement et sur les événements temps réel choisis. */
export function useData<T>(path: string | null, opts: Options = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const queryKey = JSON.stringify(opts.query ?? {});
  const realtime = useRealtime();
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!path) return;
    const call = ++latest.current;
    try {
      const res = await api<T>(path, { query: JSON.parse(queryKey) });
      if (call === latest.current) {
        setData(res);
        setError(null);
      }
    } catch (e) {
      if (call === latest.current) setError((e as Error).message);
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, [path, queryKey]);

  useEffect(() => {
    setLoading(true);
    reload();
  }, [reload]);

  useEffect(() => {
    if (!opts.refreshMs) return;
    const t = setInterval(reload, opts.refreshMs);
    return () => clearInterval(t);
  }, [reload, opts.refreshMs]);

  const events = (opts.refreshOn ?? []).join(',');
  useEffect(() => {
    if (!realtime || !events) return;
    const wanted = events.split(',');
    return realtime.subscribe((e) => {
      if (wanted.includes(e)) reload();
    });
  }, [realtime, events, reload]);

  return { data, error, loading, reload, setData };
}
