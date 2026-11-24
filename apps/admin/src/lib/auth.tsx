'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';

type Admin = { id: string; name: string | null; phone: string; role: string };
type AuthState = {
  ready: boolean;
  user: Admin | null;
  requestCode: (phone: string) => Promise<string | null>;
  verify: (phone: string, code: string) => Promise<void>;
  logout: () => void;
};

const Ctx = createContext<AuthState | null>(null);
const USER_KEY = 'myway.admin.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<Admin | null>(null);

  useEffect(() => {
    const raw = window.localStorage.getItem(USER_KEY);
    if (tokenStore.get() && raw) setUser(JSON.parse(raw));
    setReady(true);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    window.localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('myway:unauthorized', logout);
    return () => window.removeEventListener('myway:unauthorized', logout);
  }, [logout]);

  const requestCode = async (phone: string) => (await api<{ devCode?: string }>('/auth/otp/request', { method: 'POST', body: { phone } })).devCode ?? null;

  const verify = async (phone: string, code: string) => {
    const res = await api<{ token: string; user: Admin }>('/auth/otp/verify', { method: 'POST', body: { phone, code } });
    if (res.user.role !== 'ADMIN') throw new Error('Ce numéro n’a pas accès à la console. Demande à un administrateur de t’ajouter.');
    tokenStore.set(res.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  };

  return <Ctx.Provider value={{ ready, user, requestCode, verify, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AuthProvider manquant');
  return ctx;
}
