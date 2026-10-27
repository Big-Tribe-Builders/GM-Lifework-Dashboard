'use client';

import { useRef, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { BANNER_BUCKET } from '@/lib/quinb';

type Result = { error: string | null };
const MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a picture to the banner bucket and saves its address; saving '' removes it. */
export function useImageUpload(prefix: string, onSave: (url: string) => Promise<Result>) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith('image/')) { setError('Pick an image: PNG, JPG, WebP or GIF.'); return; }
    if (file.size > MAX_BYTES) { setError('The image is larger than 5 MB.'); return; }
    const db = getSupabase();
    if (!db) { setError('Supabase is not configured.'); return; }
    setBusy(true);
    const ext = (file.name.split('.').pop() ?? 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error: upErr } = await db.storage.from(BANNER_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { setBusy(false); setError(upErr.message); return; }
    const { data } = db.storage.from(BANNER_BUCKET).getPublicUrl(path);
    const r = await onSave(data.publicUrl);
    setBusy(false);
    if (r.error) setError(r.error);
  }

  return {
    input, busy, error,
    choose: () => input.current?.click(),
    onPick: (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); },
    remove: async () => {
      setError(null); setBusy(true);
      const r = await onSave('');
      setBusy(false);
      if (r.error) setError(r.error);
    },
  };
}

