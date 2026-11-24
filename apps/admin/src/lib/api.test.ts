import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, errorMessage, tokenStore } from './api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  tokenStore.clear();
});

describe('client API', () => {
  it('envoie le jeton et les paramètres', async () => {
    tokenStore.set('jeton');
    const fetchMock = vi.fn().mockResolvedValue(json([{ id: 1 }]));
    vi.stubGlobal('fetch', fetchMock);
    const res = await api('/admin/orders', { query: { status: 'PENDING', late: undefined } });
    expect(res).toEqual([{ id: 1 }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://localhost:3000/api/admin/orders?status=PENDING');
    expect(init.headers.Authorization).toBe('Bearer jeton');
  });

  it('remonte le message d’erreur de l’API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: ['amount must be an integer', 'reason should not be empty'] }, 400)));
    await expect(api('/admin/finance/remittances', { method: 'POST', body: {} })).rejects.toThrow('amount must be an integer\nreason should not be empty');
  });

  it('signale une session expirée', async () => {
    const onUnauthorized = vi.fn();
    window.addEventListener('myway:unauthorized', onUnauthorized);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ message: 'Unauthorized' }, 401)));
    await expect(api('/admin/dashboard')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalled();
  });

  it('traduit l’absence de réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(api('/admin/live')).rejects.toThrow('Connexion à l’API impossible');
    expect(errorMessage(403, null)).toBe('Accès réservé aux administrateurs.');
  });
});
