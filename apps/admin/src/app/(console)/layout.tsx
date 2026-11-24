'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { RealtimeProvider, useRealtime } from '@/lib/realtime';

const NAV = [
  ['/', 'Tableau de bord', '▦'],
  ['/carte/', 'Carte en direct', '◉'],
  ['/commandes/', 'Commandes', '☰'],
  ['/comptes/', 'Comptes', '☺'],
  ['/finances/', 'Finances', '₣'],
  ['/support/', 'Réclamations', '✉'],
  ['/parametres/', 'Paramètres', '⚙'],
] as const;

function LiveDot() {
  const rt = useRealtime();
  return (
    <span className={`live-dot ${rt?.connected ? 'on' : ''}`} title={rt?.connected ? 'Temps réel connecté' : 'Temps réel déconnecté'}>
      {rt?.connected ? 'En direct' : 'Hors ligne'}
    </span>
  );
}

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  const { ready, user, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace('/connexion/');
  }, [ready, user, router]);

  if (!ready || !user) return null;

  return (
    <RealtimeProvider>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            MyWay <span>Console</span>
          </div>
          <nav>
            {NAV.map(([href, label, icon]) => {
              const active = href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, ''));
              return (
                <Link key={href} href={href} className={active ? 'active' : ''}>
                  <span className="icon">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="sidebar-foot">
            <LiveDot />
            <div className="muted small">{user.name ?? user.phone}</div>
            <button className="btn ghost small" onClick={logout}>
              Se déconnecter
            </button>
          </div>
        </aside>
        <main className="content">{children}</main>
      </div>
    </RealtimeProvider>
  );
}
