'use client';

import { useState, useTransition } from 'react';
import { setPassword } from '@/app/auth/actions';

export function PasswordForm() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="gate__form"
      onSubmit={(e) => {
        e.preventDefault();
        if (a !== b) { setError('The two passwords differ.'); return; }
        setError(null);
        start(async () => { const r = await setPassword(a); if (r?.error) setError(r.error); });
      }}
    >
      <div className="field">
        <label htmlFor="pw-a">Password</label>
        <input id="pw-a" type="password" required minLength={8} autoFocus autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pw-b">Again</label>
        <input id="pw-b" type="password" required minLength={8} autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      </div>
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      <button type="submit" className="btn btn--primary gate__btn" disabled={pending}>{pending ? 'Saving…' : 'Save and open Big Tribe Builders'}</button>
    </form>
  );
}
