'use client';

import { useFormState } from 'react-dom';
import { updateShift } from '@/app/actions/admin';
import SubmitButton from '@/components/SubmitButton';

interface ShiftRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  open_time: string;
  close_time: string;
}

const hm = (t: string) => t.slice(0, 5);

export default function ShiftForm({ shift }: { shift: ShiftRow }) {
  const [state, action] = useFormState(updateShift, undefined);
  return (
    <form action={action} className="rounded-2xl border border-slate-100 p-4">
      <input type="hidden" name="id" value={shift.id} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label">ชื่อกะ</label>
          <input name="name" className="input" defaultValue={shift.name} required />
        </div>
        <div>
          <label className="label">เริ่มงาน</label>
          <input type="time" name="start" className="input" defaultValue={hm(shift.start_time)} required />
        </div>
        <div>
          <label className="label">เลิกงาน</label>
          <input type="time" name="end" className="input" defaultValue={hm(shift.end_time)} required />
        </div>
        <div>
          <label className="label">เปิดรับลาวันนี้</label>
          <input type="time" name="open" className="input" defaultValue={hm(shift.open_time)} required />
        </div>
        <div>
          <label className="label">ปิดรับลาวันนี้</label>
          <input type="time" name="close" className="input" defaultValue={hm(shift.close_time)} required />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SubmitButton className="btn-outline btn-sm">บันทึก</SubmitButton>
        {state?.ok && <span className="text-sm text-emerald-600">✓ {state.ok}</span>}
        {state?.error && <span className="text-sm text-rose-600">{state.error}</span>}
      </div>
    </form>
  );
}
