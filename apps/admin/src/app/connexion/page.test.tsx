import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/lib/auth';
import { tokenStore } from '@/lib/api';
import LoginPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function mockApi(role: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => {
      if (String(url).endsWith('/otp/request')) return json({ devCode: '123456' });
      return json({ token: 'jeton', user: { id: 'u1', name: 'Anicet', phone: '+2250700000000', role } });
    }),
  );
}

async function login() {
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>,
  );
  fireEvent.change(screen.getByLabelText('Numéro de téléphone'), { target: { value: '0700000000' } });
  fireEvent.click(screen.getByText('Recevoir le code'));
  expect(await screen.findByText('Code de développement : 123456')).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/Code reçu par SMS/), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Se connecter'));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  tokenStore.clear();
  replace.mockReset();
});

describe('connexion à la console', () => {
  it('connecte un administrateur et ouvre le tableau de bord', async () => {
    mockApi('ADMIN');
    await login();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(tokenStore.get()).toBe('jeton');
  });

  it('refuse un compte qui n’est pas administrateur', async () => {
    mockApi('MERCHANT');
    await login();
    expect(await screen.findByText(/n’a pas accès à la console/)).toBeTruthy();
    expect(tokenStore.get()).toBeNull();
  });
});
