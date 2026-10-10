'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Domain, IconName, Accent } from '@/lib/nav';
import { ICON_CHOICES, ACCENT_CHOICES } from '@/lib/nav';
import { Icon } from '@/components/Icon';
import { saveDomainSettings } from '@/app/d/actions';

/**
 * The cog at the right of the identity bar: the settings.
 *
 * For this space: what it is called, the icon it carries and the colour it
 * wears. For all of them: Settings › Spaces, where every collection and space
 * is listed — order, collection, name, icon, colour, and which spaces and
 * tabs are hidden.
 */
export function DomainSettings({ domain }: { domain: Domain }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Click anywhere else, or press Escape, and the menu closes.
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div className="dsettings" ref={wrap}>
      <button
        type="button"
        className="dsettings__btn"
        aria-label={`${domain.label} settings`}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="settings" />
      </button>

      {open ? (
        <div className="dsettings__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="dsettings__item"
            onClick={() => { setOpen(false); setEditing(true); }}
          >
            Edit name, icon and colour
          </button>
          <Link href={`/settings#space-${domain.slug}`} role="menuitem" className="dsettings__item" onClick={() => setOpen(false)}>
            All spaces and collections
          </Link>
        </div>
      ) : null}

      {editing ? <EditDialog domain={domain} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

export function EditDialog({ domain, onClose }: { domain: Domain; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [name, setName] = useState(domain.label);
  const [icon, setIcon] = useState<IconName>(domain.icon);
  const [accent, setAccent] = useState<Accent>(domain.accent);
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveDomainSettings(domain.slug, { name, icon, accent });
      if (r.error) { setError(r.error); return; }
      router.refresh();
      ref.current?.close();
    });
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
    >
      <form className="dialog__body" onSubmit={submit}>
        <p className="dialog__title">Edit {domain.label}</p>

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
          />
        </label>

        <fieldset className="field">
          <legend>Icon</legend>
          <div className="pickgrid">
            {ICON_CHOICES.map((n) => (
              <button
                key={n}
                type="button"
                className={`pickgrid__icon${n === icon ? ' is-on' : ''} accent-${accent}`}
                aria-label={n}
                aria-pressed={n === icon}
                onClick={() => setIcon(n)}
              >
                <Icon name={n} />
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Colour</legend>
          <div className="pickrow">
            {ACCENT_CHOICES.map((a) => (
              <button
                key={a}
                type="button"
                className={`pickrow__swatch accent-${a}${a === accent ? ' is-on' : ''}`}
                aria-label={a}
                aria-pressed={a === accent}
                onClick={() => setAccent(a)}
              />
            ))}
          </div>
        </fieldset>

        {error ? <p className="field__error" role="alert">{error}</p> : null}

        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
