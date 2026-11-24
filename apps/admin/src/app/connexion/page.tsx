'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { user, requestCode, verify } = useAuth();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace('/');
  }, [user, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!sent) {
        setDevCode(await requestCode(phone));
        setSent(true);
      } else {
        await verify(phone, code);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand big">
          MyWay <span>Console</span>
        </div>
        <p className="muted">Accès réservé à l’équipe MyWay.</p>
        <label>
          Numéro de téléphone
          <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07 00 00 00 00" disabled={sent} autoFocus required />
        </label>
        {sent && (
          <label>
            Code reçu par SMS
            <input name="code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoFocus required />
            {devCode && <span className="muted small">Code de développement : {devCode}</span>}
          </label>
        )}
        {error && <div className="error-box">{error}</div>}
        <button className="btn primary" disabled={busy}>
          {sent ? 'Se connecter' : 'Recevoir le code'}
        </button>
        {sent && (
          <button type="button" className="btn ghost" onClick={() => { setSent(false); setCode(''); }}>
            Changer de numéro
          </button>
        )}
      </form>
    </div>
  );
}
