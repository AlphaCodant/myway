/** Client HTTP de l'API pour la console. Le jeton admin est gardé dans le navigateur (localStorage). */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TOKEN_KEY = 'myway.admin.token';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const tokenStore = {
  get: (): string | null => (typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

/** Lit le message d'erreur de l'API (NestJS renvoie { message: string | string[] }). */
export function errorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const m = (body as { message: unknown }).message;
    if (Array.isArray(m)) return m.join('\n');
    if (typeof m === 'string') return m;
  }
  if (status === 401) return 'Session expirée : reconnecte-toi.';
  if (status === 403) return 'Accès réservé aux administrateurs.';
  return 'Une erreur est survenue. Réessaie.';
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; query?: Record<string, unknown> } = {}): Promise<T> {
  const url = new URL(`${API_URL}/api${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'Connexion à l’API impossible. Vérifie le réseau.');
  }
  const text = await res.text();
  const data = text ? (res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text) : null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('myway:unauthorized'));
    throw new ApiError(res.status, errorMessage(res.status, data));
  }
  return data as T;
}

export const fileUrl = (path?: string | null) => (!path ? '' : path.startsWith('http') ? path : `${API_URL}${path}`);

/** Téléchargement d'un fichier protégé (export CSV) avec le jeton. */
export async function download(path: string, filename: string, query?: Record<string, string>) {
  const url = new URL(`${API_URL}/api${path}`);
  for (const [k, v] of Object.entries(query ?? {})) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, null));
  const blob = new Blob(['﻿', await res.blob()], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
