'use client';

import { useState, useTransition } from 'react';
import { acknowledgeResignation } from '@/app/actions/resign';

export default function AckButton({ id }: { id: string }) {
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="btn-success btn-sm"
        disabled={pending}
        onClick={() => {
          setErr('');
          start(async () => {
            const r = await acknowledgeResignation(id);
            if (r?.error) setErr(r.error);
          });
        }}
      >
        {pending ? '…' : 'รับทราบ'}
      </button>
      {err && <p className="max-w-[200px] text-xs text-rose-600">{err}</p>}
    </div>
  );
}
