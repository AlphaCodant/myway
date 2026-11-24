'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_URL, tokenStore } from './api';

/** Événements temps réel envoyés aux administrateurs. */
export const ADMIN_EVENTS = ['order.updated', 'order.no_courier', 'order.late', 'ticket.new', 'ticket.updated'] as const;
export type AdminEvent = (typeof ADMIN_EVENTS)[number];
type Listener = (event: AdminEvent, data: any) => void;
type Notice = { id: number; text: string; tone: 'warn' | 'info' };

const Ctx = createContext<{ subscribe: (l: Listener) => () => void; connected: boolean } | null>(null);

const noticeFor = (event: AdminEvent, data: any): Notice['text'] | null =>
  ({
    'order.no_courier': `Aucun livreur pour la commande ${data?.reference ?? ''}`,
    'order.late': `Commande ${data?.reference ?? ''} en retard`,
    'ticket.new': `Nouvelle réclamation : ${data?.subject ?? ''}`,
  })[event as string] ?? null;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    const socket: Socket = io(`${API_URL}/realtime`, { auth: { token }, transports: ['websocket'] });
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    for (const e of ADMIN_EVENTS) {
      socket.on(e, (data: unknown) => {
        listeners.current.forEach((l) => l(e, data));
        const text = noticeFor(e, data);
        if (text) {
          const id = Date.now() + Math.random();
          setNotices((n) => [...n.slice(-3), { id, text, tone: e === 'ticket.new' ? 'info' : 'warn' }]);
          setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 8000);
        }
      });
    }
    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribe = (l: Listener) => {
    listeners.current.add(l);
    return () => listeners.current.delete(l);
  };

  return (
    <Ctx.Provider value={{ subscribe, connected }}>
      {children}
      <div className="toasts" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={`toast ${n.tone}`}>
            {n.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useRealtime() {
  return useContext(Ctx);
}
