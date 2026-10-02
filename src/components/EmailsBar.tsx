'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createEmail, type NewEmail } from '@/app/d/clients/actions';

const EMPTY: NewEmail = { email: '', firstName: '', lastName: '', city: '', state: '', source: '' };

/** The add button for the Emails tab, and its dialog. */
export function EmailsBar() {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>+ Add email</button>
      {adding ? <AddEmailDialog onClose={() => setAdding(false)} /> : null}
    </>
  );
}

function AddEmailDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [form, setForm] = useState<NewEmail>(EMPTY);
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

  const set = (k: keyof NewEmail) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createEmail(form);
      if (r.error) { setError(r.error); return; }
      router.refresh();
      ref.current?.close();
    });
  }

  return (
    <dialog ref={ref} className="dialog dialog--form" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <form className="dialog__body" onSubmit={submit}>
        <p className="dialog__title">New email</p>
        <div className="field">
          <label htmlFor="ne-email">Email</label>
          <input id="ne-email" type="email" required autoFocus value={form.email} onChange={set('email')} />
        </div>
        <div className="field field--pair">
          <div><label htmlFor="ne-first">First name</label><input id="ne-first" value={form.firstName} onChange={set('firstName')} /></div>
          <div><label htmlFor="ne-last">Last name</label><input id="ne-last" value={form.lastName} onChange={set('lastName')} /></div>
        </div>
        <div className="field field--pair">
          <div><label htmlFor="ne-city">City</label><input id="ne-city" value={form.city} onChange={set('city')} /></div>
          <div><label htmlFor="ne-state">State</label><input id="ne-state" value={form.state} onChange={set('state')} /></div>
        </div>
        <div className="field">
          <label htmlFor="ne-source">Came from</label>
          <input id="ne-source" value={form.source} onChange={set('source')} placeholder="QuinB community, Kit, website, …" />
        </div>
        {error ? <p className="field__error" role="alert">{error}</p> : null}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()} disabled={pending}>Cancel</button>
          <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? 'Saving…' : 'Add email'}</button>
        </div>
      </form>
    </dialog>
  );
}
