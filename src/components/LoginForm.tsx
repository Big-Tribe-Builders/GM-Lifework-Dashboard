'use client';

import { useState, useTransition } from 'react';
import { signIn } from '@/app/auth/actions';

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="gate__form"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => { const r = await signIn(email, password); if (r?.error) setError(r.error); });
      }}
    >
      <div className="field">
        <label htmlFor="li-email">Email</label>
        <input id="li-email" type="email" required autoFocus autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="li-pass">Password</label>
        <input id="li-pass" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn--primary gate__btn" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
