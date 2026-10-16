'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addMember } from '@/app/d/quinb/actions';

const EMPTY = { name: '', email: '', memberSince: '' };

/**
 * QuinB Community › Members: the add button in the toolbar, and its dialog
 * (Giulia, 16 Oct 2026: the only buttons here are Add member and the search).
 */
export function MembersBar() {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>+ Add member</button>
      {adding ? <AddMemberDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function AddMemberDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) d.showModal();
    const closed = () => onClose();
    d.addEventListener('close', closed);
    return () => d.removeEventListener('close', closed);
  }, [onClose]);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addMember(form);
      if (r.error) { setError(r.error); return; }
      router.refresh();
      ref.current?.close();
    });
  }

  return (
    <dialog ref={ref} className="dialog dialog--form" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <form className="dialog__body" onSubmit={submit}>
        <p className="dialog__title">New member</p>
        <div className="field">
          <label htmlFor="nm-name">Name</label>
          <input id="nm-name" required autoFocus value={form.name} onChange={set('name')} />
        </div>
        <div className="field">
          <label htmlFor="nm-email">Email</label>
          <input id="nm-email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <div className="field">
          <label htmlFor="nm-since">Member since</label>
          <input id="nm-since" type="date" value={form.memberSince} onChange={set('memberSince')} />
        </div>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()} disabled={pending}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? 'Saving…' : 'Add member'}</button>
        </div>
      </form>
    </dialog>
  );
}
