import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import LeaveForm from './LeaveForm';
import type { LeaveOptions } from '@/lib/types';

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

  // ตัวเลือกการลาแยกตามบริษัท (เวลาเซิร์ฟเวอร์ + กะ + ประเภทการลา + ช่วงที่ลา)
  const companyIds = [...new Set(ctx.employees.map((e) => e.company_id))];
  const results = await Promise.all(companyIds.map((id) => supabase.rpc('get_leave_options', { p_company: id })));
  const options: Record<string, LeaveOptions> = {};
  companyIds.forEach((id, i) => {
    const d = results[i].data as LeaveOptions | null;
    options[id] = d ?? { server_epoch_ms: Date.now(), shifts: [], types: [], settings: { allow_full: true, allow_half: true, allow_hours: true, max_hours: null, note: null } };
  });
  const serverEpochMs = Number(options[companyIds[0]]?.server_epoch_ms ?? Date.now());

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-2xl font-bold text-brand-600">ยื่นใบลา</h1>
      <LeaveForm employees={ctx.employees} options={options} serverEpochMs={serverEpochMs} />
    </div>
  );
}
