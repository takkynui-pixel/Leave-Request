import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import LeaveForm, { type CutoffWindow } from './LeaveForm';
import type { LeaveType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewLeavePage() {
  const ctx = await getContext();
  const supabase = createClient();

  // แอดมินที่ไม่มีสถานะพนักงานจะยื่นแทนไม่ได้จากหน้านี้ (ใช้หน้าพนักงาน/SQL) — แจ้งให้ชัดเจน
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

  const { data: types } = await supabase
    .from('leave_types')
    .select('id, code, name, requires_attachment')
    .order('sort_order');

  // เวลา cut-off + เวลาเซิร์ฟเวอร์ของแต่ละบริษัท (เทียบกับเวลาเซิร์ฟเวอร์ ไม่ใช่เครื่องพนักงาน)
  const windows: Record<string, CutoffWindow> = {};
  await Promise.all(
    [...new Set(ctx.employees.map((e) => e.company_id))].map(async (cid) => {
      const { data } = await supabase.rpc('get_submit_window', { p_company: cid });
      windows[cid] = { serverEpochMs: Number(data?.server_epoch_ms ?? Date.now()), cutoff: data?.cutoff ?? '10:00' };
    }),
  );

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-brand-600">ยื่นใบลา</h1>
      <LeaveForm employees={ctx.employees} types={(types ?? []) as LeaveType[]} windows={windows} />
    </div>
  );
}
