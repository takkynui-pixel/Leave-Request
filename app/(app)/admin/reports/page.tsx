import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchReport, partLabel, summarize } from '@/lib/report';
import { currentMonthTH, formatDateTH, monthLabelTH, monthRange } from '@/lib/time';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: { company?: string; month?: string } }) {
  await requireAdmin();
  const supabase = createClient();

  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? '') ? searchParams.month! : currentMonthTH();
  const company = searchParams.company || '';

  const { data: companies } = await supabase.from('companies').select('id, company_name').order('company_name');
  const comps = (companies ?? []) as Company[];

  const rows = await fetchReport(supabase, month, company || null);
  const summary = summarize(rows);

  // แจ้งเตือนใบลาที่ยังไม่อนุมัติในเดือนนี้ (รายงานนับเฉพาะที่อนุมัติแล้ว)
  const { first, last } = monthRange(month);
  let pq = supabase
    .from('leave_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
    .lte('start_date', last)
    .gte('end_date', first);
  if (company) pq = pq.eq('company_id', company);
  const { count: pendingCount } = await pq;

  const qs = new URLSearchParams({ month, ...(company ? { company } : {}) }).toString();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-brand-600">รายงานการลาประจำเดือน</h1>

      <form method="get" className="card flex flex-wrap items-end gap-3">
        {comps.length > 1 && (
          <div className="min-w-[200px] flex-1">
            <label className="label">บริษัท</label>
            <select name="company" defaultValue={company} className="input">
              <option value="">ทุกบริษัท</option>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">เดือน</label>
          <input type="month" name="month" defaultValue={month} className="input" />
        </div>
        <button className="btn-primary" type="submit">
          แสดงรายงาน
        </button>
        <div className="ml-auto flex flex-wrap gap-2">
          <a className="btn-outline" href={`/api/report?${qs}&kind=daily`}>
            ⬇ Export รายวัน (CSV)
          </a>
          <a className="btn-outline" href={`/api/report?${qs}&kind=summary`}>
            ⬇ Export สรุปรายคน (CSV)
          </a>
        </div>
      </form>

      {!!pendingCount && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          มีใบลาที่ยังรออนุมัติในเดือนนี้ {pendingCount} ใบ — รายงานนี้นับเฉพาะใบลาที่อนุมัติแล้ว
        </p>
      )}

      <section className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="card-title">เดือน{monthLabelTH(month)}</h2>
          <p className="text-sm text-slate-400">
            {rows.length} รายการ · {summary.length} คน
          </p>
        </div>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead>
              <tr>
                <th>รหัสพนักงาน</th>
                <th>ชื่อ-สกุล</th>
                <th>วันที่ลา</th>
                <th>ประเภท</th>
                <th>กะ / ช่วงที่ลา</th>
                <th>เหตุผล</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.company_id}-${r.employee_code}-${r.leave_date}-${i}`}>
                  <td className="font-medium">
                    {r.employee_code}
                    {comps.length > 1 && !company && <p className="text-xs font-normal text-slate-400">{r.company_name}</p>}
                  </td>
                  <td>{r.full_name}</td>
                  <td className="whitespace-nowrap">{formatDateTH(r.leave_date)}</td>
                  <td>{r.leave_type}</td>
                  <td className="whitespace-nowrap text-slate-600">
                    {r.shift_name}
                    <p className="text-xs text-slate-400">
                      {partLabel(r)}
                      {r.day_part === 'hours' ? ` · ${Number(r.total_hours)} ชม.` : r.day_part === 'full' ? '' : ' · 0.5 วัน'}
                    </p>
                  </td>
                  <td className="max-w-[320px] text-slate-600">{r.reason}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    ไม่มีข้อมูลการลาในเดือนนี้
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {summary.length > 0 && (
        <section className="card">
          <h2 className="card-title">สรุปรายคน</h2>
          <div className="table-wrap mt-3">
            <table className="tbl">
              <thead>
                <tr>
                  <th>รหัสพนักงาน</th>
                  <th>ชื่อ-สกุล</th>
                  <th>รวม (วัน)</th>
                  <th>ลารายชั่วโมง (ชม.)</th>
                  <th>แยกตามประเภท (วัน)</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={`${s.company_name}-${s.employee_code}`}>
                    <td className="font-medium">{s.employee_code}</td>
                    <td>{s.full_name}</td>
                    <td className="font-semibold">{s.days}</td>
                    <td>{s.hours || '-'}</td>
                    <td className="text-slate-600">
                      {Object.entries(s.byType)
                        .map(([t, n]) => `${t} ${n}`)
                        .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
