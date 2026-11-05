import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTH, formatDateTimeTH, thaiParts } from '@/lib/time';
import { RATINGS, reasonLabel, tenureLabel, type ResignationRow } from '@/lib/resign';
import ResignForm from './ResignForm';

export const dynamic = 'force-dynamic';

export default async function ResignPage() {
  const ctx = await getContext();
  if (ctx.employees.length === 0) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <p className="font-semibold">บัญชีนี้ยังไม่ได้ผูกกับรหัสพนักงาน</p>
        <Link href="/" className="btn-outline mt-5">
          กลับหน้าแรก
        </Link>
      </div>
    );
  }

  const supabase = createClient();
  const { data } = await supabase
    .from('resignations')
    .select('*')
    .in('employee_id', ctx.employees.map((e) => e.id));
  const done = (data ?? []) as ResignationRow[];
  const doneIds = new Set(done.map((r) => r.employee_id));
  const open = ctx.employees.filter((e) => !doneIds.has(e.id));
  const today = thaiParts(Date.now()).date;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold text-brand-600">แบบฟอร์มลาออก</h1>

      {done.map((r) => {
        const emp = ctx.employees.find((e) => e.id === r.employee_id);
        return (
          <section key={r.id} className="card space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {emp?.company_name} · {emp?.employee_code} · {emp?.full_name}
              </p>
              <span className={`badge ${r.status === 'acknowledged' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {r.status === 'acknowledged' ? 'ฝ่ายบุคคลรับทราบแล้ว' : 'รอฝ่ายบุคคลรับทราบ'}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-slate-400">ส่งเมื่อ</dt><dd>{formatDateTimeTH(r.submitted_at)}</dd></div>
              <div><dt className="text-slate-400">วันทำงานวันสุดท้าย</dt><dd>{formatDateTH(r.last_working_date)}</dd></div>
              <div><dt className="text-slate-400">อายุงาน</dt><dd>{tenureLabel(r.tenure)}</dd></div>
              <div><dt className="text-slate-400">เหตุผลการลาออก</dt><dd>{reasonLabel(r.reason)}</dd></div>
              <div className="sm:col-span-2"><dt className="text-slate-400">อธิบายเพิ่มเติม</dt><dd className="whitespace-pre-wrap">{r.detail}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-slate-400">ความพึงพอใจ</dt>
                <dd>{RATINGS.map(([k, l]) => `${l} ${(r as any)[k]}`).join(' · ')}</dd>
              </div>
            </dl>
            {r.status === 'acknowledged' && (
              <p className="text-xs text-slate-400">
                รับทราบเมื่อ {formatDateTimeTH(r.acknowledged_at)}
                {r.acknowledged_name && ` โดย ${r.acknowledged_name}`} · บัญชีนี้จะใช้งานได้ถึงสิ้นวันที่{' '}
                {formatDateTH(r.last_working_date)}
              </p>
            )}
          </section>
        );
      })}

      {open.length > 0 && (
        <>
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ต้องกรอกทุกข้อ และเมื่อส่งแล้วจะแก้ไขไม่ได้ — กรุณาตรวจสอบก่อนกดส่ง
          </p>
          <ResignForm employees={open} today={today} />
        </>
      )}
    </div>
  );
}
