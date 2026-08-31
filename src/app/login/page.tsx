'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import styles from './login.module.css';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account, password }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? 'Could not sign in. Try again.');
        setBusy(false);
        return;
      }

      // Only ever follow a path, never an absolute URL.
      const next = params.get('next');
      router.replace(next?.startsWith('/') && !next.startsWith('//') ? next : '/');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection.');
      setBusy(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' && account && password && !busy) signIn();
  }

  return (
    <main className={styles.page}>
      <div className={styles.column}>
        {/* The product reduced to its smallest form: pins on a map. */}
        <div className={styles.pins} aria-hidden="true">
          {PIN_PATTERN.map((kind, index) => (
            <span key={index} className={styles[kind]} />
          ))}
        </div>

        <h1 className={styles.title}>Building network</h1>
        <p className={styles.subtitle}>
          Every building carrying a Focus Media screen, on one map.
        </p>

        <div className={styles.form} onKeyDown={onKeyDown}>
          <label className="field">
            <span>Account</span>
            <input
              className="input"
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="viewer or editor"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>

          {error && (
            <p className="notice notice-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="btn"
            onClick={signIn}
            disabled={busy || !account || !password}
          >
            {busy ? 'Signing in' : 'Sign in'}
          </button>
        </div>

        <p className={styles.legend}>
          <span className="dot dot-installed" /> Installed
          <span className="dot dot-signed" /> Signed
        </p>
      </div>
    </main>
  );
}

/**
 * A fixed, hand-set arrangement rather than a random one, so the page looks the
 * same on every load and nothing moves under you while you type.
 */
const PIN_PATTERN = [
  'pinFaint', 'pinFaint', 'pinInstalled', 'pinFaint', 'pinFaint', 'pinSigned',
  'pinFaint', 'pinInstalled', 'pinFaint', 'pinFaint', 'pinFaint', 'pinFaint',
  'pinSigned', 'pinFaint', 'pinFaint', 'pinInstalled', 'pinFaint', 'pinFaint',
] as const;

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
