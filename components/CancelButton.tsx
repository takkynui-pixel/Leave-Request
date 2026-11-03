'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function CancelButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function cancel() {
    if (!window.confirm('ยืนยันยกเลิกใบลานี้?')) return;
    setBusy(true);
    setErr('');
    const { error } = await createClient().from('leave_requests').update({ status: 'cancelled' }).eq('id', id);
    setBusy(false);
    if (error) return setErr(error.message);
    router.refresh();
  }

  return (
    <>
      <button onClick={cancel} disabled={busy} className="btn-danger btn-sm">
        {busy ? '…' : 'ยกเลิก'}
      </button>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </>
  );
}
