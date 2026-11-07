'use client';

import { useState, useTransition } from 'react';

/** ปุ่มเรียก server action แบบง่าย (มีหน้าต่างยืนยันได้) */
export default function ActionButton({
  action,
  children,
  confirm,
  className = 'btn-outline btn-sm',
}: {
  action: () => Promise<{ error?: string; ok?: boolean }>;
  children: React.ReactNode;
  confirm?: string;
  className?: string;
}) {
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setErr('');
          start(async () => {
            const r = await action();
            if (r?.error) setErr(r.error);
          });
        }}
      >
        {pending ? 'กำลังดำเนินการ…' : children}
      </button>
      {err && <span className="text-xs text-rose-600">{err}</span>}
    </span>
  );
}
