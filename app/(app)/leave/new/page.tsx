import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import LeaveForm from './LeaveForm';
import type { LeaveType, Shift } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewLeavePage() {
  const ctx = await getContext();
  const supabase = createClient();

  if (ctx.employees.length === 0) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <p className="font-semibold">บัญชีนี้ยังไม่ได้ผูกกับรหัสพนักงาน</p>
        <p className="mt-1 text-sm text-slate-500">กรุณาติดต่อฝ่ายบุคคลเพื่อเพิ่มข้อมูลพนักงาน</p>
        <Link href="/" className="btn-outline mt-5">
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  const [{ data: types }, { data: win }] = await Promise.all([
    supabase.from('leave_types').select('id, code, name, requires_attachment').order('sort_order'),
    // เวลาเซิร์ฟเวอร์ + กะทั้งหมด (เทียบกับเวลาเซิร์ฟเวอร์ ไม่ใช่เครื่องพนักงาน)
    supabase.rpc('get_shift_windows'),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-brand-600">ยื่นใบลา</h1>
      <LeaveForm
        employees={ctx.employees}
        types={(types ?? []) as LeaveType[]}
        shifts={(win?.shifts ?? []) as Shift[]}
        serverEpochMs={Number(win?.server_epoch_ms ?? Date.now())}
      />
    </div>
  );
}
