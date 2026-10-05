'use client';

import { useState, useTransition } from 'react';
import { inviteUser, removeUser } from '@/app/auth/actions';
import { ConfirmDialog } from '@/components/ClientTable';
import { shortDate } from '@/lib/upwork';

export type UserRow = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  invitedAt: string | null;
  confirmed: boolean;
};

/** The people who can sign in, and a box to invite the next one. */
export function Users({ rows, me, missing }: { rows: UserRow[]; me: string | null; missing: string | null }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      {missing ? (
        <p className="muted" style={{ lineHeight: 1.6 }}>
          Inviting and listing users needs <code>{missing}</code> set in Vercel. It is not set, so this list is empty.
        </p>
      ) : (
        <table className="users">
          <thead><tr><th>Email</th><th>Status</th><th>Last sign-in</th><th aria-label="Remove" /></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>{u.email}{u.email === me ? <span className="badge" style={{ marginLeft: 8 }}>you</span> : null}</td>
                <td>{u.confirmed
                  ? <span className="status status--active">Active</span>
                  : <span className="status status--done">Invited {shortDate(u.invitedAt)}</span>}</td>
                <td>{u.lastSignIn ? shortDate(u.lastSignIn) : <span className="grid2__dash">—</span>}</td>
                <td>{u.email === me ? null : <Remove id={u.id} email={u.email ?? ''} />}</td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={4} className="muted">Nobody yet.</td></tr> : null}
          </tbody>
        </table>
      )}

      <form
        className="users__invite"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null); setSent(null);
          start(async () => {
            const r = await inviteUser(email);
            if (r.error) setError(r.error); else { setSent(email); setEmail(''); }
          });
        }}
      >
        <input type="email" required placeholder="email to invite" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email to invite" />
        <button type="submit" className="btn btn--primary" disabled={pending || Boolean(missing)}>{pending ? 'Sending…' : 'Send invitation'}</button>
      </form>
      {error ? <p className="field__error" role="alert">{error}</p> : null}
      {sent ? <p className="muted" style={{ marginTop: 8 }}>Invitation sent to {sent}. They set their own password from the link.</p> : null}
    </div>
  );
}

function Remove({ id, email }: { id: string; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" className="btn btn--quiet" disabled={pending} onClick={() => setConfirming(true)}>Remove</button>
      {confirming ? (
        <ConfirmDialog
          title={`Remove ${email}?`}
          body="They can no longer sign in. Nothing else is deleted."
          confirmLabel="Remove"
          onCancel={() => setConfirming(false)}
          onConfirm={() => { setConfirming(false); start(async () => { await removeUser(id); }); }}
        />
      ) : null}
    </>
  );
}
