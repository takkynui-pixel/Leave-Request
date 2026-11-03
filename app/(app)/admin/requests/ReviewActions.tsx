'use client';

import { useState, useTransition } from 'react';
import { reviewLeave } from '@/app/actions/admin';

export default function ReviewActions({ id }: { id: string }) {
  const [rejecting, setRejecting] = useState(false);
  const [remark, setRemark] = useState('');
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();

  function run(decision: 'approved' | 'rejected') {
    setErr('');
    start(async () => {
      const res = await reviewLeave(id, decision, remark);
      if (res?.error) setErr(res.error);
    });
  }

  if (rejecting) {
    return (
      <div className="flex min-w-[220px] flex-col items-stretch gap-2 text-left">
        <input
          className="input !py-1.5 text-xs"
          placeholder="เหตุผลที่ไม่อนุมัติ"
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2">
          <button className="btn-danger btn-sm" disabled={pending} onClick={() => run('rejected')}>
            ยืนยันไม่อนุมัติ
          </button>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => setRejecting(false)}>
            ยกเลิก
          </button>
        </div>
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button className="btn-success btn-sm" disabled={pending} onClick={() => run('approved')}>
          {pending ? '…' : 'อนุมัติ'}
        </button>
        <button className="btn-danger btn-sm" disabled={pending} onClick={() => setRejecting(true)}>
          ไม่อนุมัติ
        </button>
      </div>
      {err && <p className="max-w-[200px] text-xs text-rose-600">{err}</p>}
    </div>
  );
}
