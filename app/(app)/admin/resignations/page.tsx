import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTH, formatDateTimeTH } from '@/lib/time';
import { RATINGS, reasonLabel, tenureLabel, type ResignationRow } from '@/lib/resign';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';
import AckButton from './AckButton';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ResignationsPage({ searchParams }: { searchParams: { company?: string; status?: string } }) {
  await requireAdmin();
  const supabase = createClient();
  const { data: companies } = await supabase.from('companies').select('id, company_name').order('company_name');

  let q = supabase
    .from('resignations')
    .select('*, employees(employee_code, full_name), companies(company_name)')
    .order('submitted_at', { ascending: false })
    .limit(300);
  if (searchParams.company) q = q.eq('company_id', searchParams.company);
  if (searchParams.status) q = q.eq('status', searchParams.status);
  const { data } = await q;
  const rows = (data ?? []) as ResignationRow[];
  const comps = (companies ?? []) as Company[];
  const qs = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => v) as [string, string][],
  ).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-600">การลาออก</h1>
        <a href={`/api/resignations${qs ? `?${qs}` : ''}`} className="btn-outline">
          ดาวน์โหลด CSV
        </a>
      </div>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        {comps.length > 1 && (
          <div className="min-w-[180px] flex-1">
            <label className="label">บริษัท</label>
            <AutoSubmitSelect name="company" defaultValue={searchParams.company ?? ''} className="input">
              <option value="">ทุกบริษัท</option>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </AutoSubmitSelect>
          </div>
        )}
        <div className="min-w-[160px]">
          <label className="label">สถานะ</label>
          <AutoSubmitSelect name="status" defaultValue={searchParams.status ?? ''} className="input">
            <option value="">ทั้งหมด</option>
            <option value="submitted">รอรับทราบ</option>
            <option value="acknowledged">รับทราบแล้ว</option>
          </AutoSubmitSelect>
        </div>
        <Link href="/admin/resignations" className="btn-ghost">
          ล้าง
        </Link>
      </form>

      <section className="space-y-4">
        {rows.length === 0 && <p className="card text-center text-sm text-slate-500">ยังไม่มีแบบฟอร์มลาออก</p>}
        {rows.map((r) => (
          <article key={r.id} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {r.employees?.full_name} <span className="font-normal text-slate-400">· {r.employees?.employee_code}</span>
                </p>
                <p className="text-sm text-slate-500">
                  {r.companies?.company_name} · ส่งเมื่อ {formatDateTimeTH(r.submitted_at)}
                </p>
              </div>
              {r.status === 'submitted' ? (
                <AckButton id={r.id} />
              ) : (
                <span className="badge bg-emerald-50 text-emerald-700">
                  รับทราบแล้ว{r.acknowledged_name && ` · ${r.acknowledged_name}`}
                </span>
              )}
            </div>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <div><dt className="text-slate-400">วันทำงานวันสุดท้าย</dt><dd className="font-medium">{formatDateTH(r.last_working_date)}</dd></div>
              <div><dt className="text-slate-400">อายุงาน</dt><dd>{tenureLabel(r.tenure)}</dd></div>
              <div><dt className="text-slate-400">เหตุผลการลาออก</dt><dd>{reasonLabel(r.reason)}</dd></div>
              <div className="sm:col-span-3"><dt className="text-slate-400">อธิบายเพิ่มเติม</dt><dd className="whitespace-pre-wrap">{r.detail}</dd></div>
              <div className="sm:col-span-3">
                <dt className="text-slate-400">ความพึงพอใจ (1–5)</dt>
                <dd className="flex flex-wrap gap-2 pt-1">
                  {RATINGS.map(([k, l]) => (
                    <span key={k} className="badge bg-slate-100 text-slate-600">
                      {l}: <b className="ml-1">{(r as any)[k]}</b>
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </section>
    </div>
  );
}
