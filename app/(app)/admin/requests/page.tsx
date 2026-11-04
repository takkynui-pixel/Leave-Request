import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTH, formatDateTimeTH } from '@/lib/time';
import StatusBadge from '@/components/StatusBadge';
import ReviewActions from './ReviewActions';
import { leaveAmount, partText, type Company, type LeaveRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface SP {
  company?: string;
  status?: string;
  from?: string;
  to?: string;
}

export default async function RequestsPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const supabase = createClient();

  const { data: companies } = await supabase.from('companies').select('id, company_name').order('company_name');

  let q = supabase
    .from('leave_requests')
    .select('*, leave_types(name, code), shifts(name), employees(employee_code, full_name), companies(company_name)')
    .order('submitted_at', { ascending: false })
    .limit(200);
  if (searchParams.company) q = q.eq('company_id', searchParams.company);
  if (searchParams.status) q = q.eq('status', searchParams.status);
  if (searchParams.from) q = q.gte('end_date', searchParams.from);
  if (searchParams.to) q = q.lte('start_date', searchParams.to);

  const { data } = await q;
  const rows = (data ?? []) as LeaveRow[];

  // ลิงก์ดูไฟล์แนบ (signed URL อายุ 1 ชั่วโมง) — สิทธิ์ตรวจโดย Storage RLS
  const paths = rows.map((r) => r.attachment_path).filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('leave-documents').createSignedUrls(paths, 3600);
    signed?.forEach((s) => s.path && s.signedUrl && urls.set(s.path, s.signedUrl));
  }

  const comps = (companies ?? []) as Company[];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-brand-600">รายการใบลา</h1>

      <form className="card flex flex-wrap items-end gap-3" method="get">
        {comps.length > 1 && (
          <div className="min-w-[180px] flex-1">
            <label className="label">บริษัท</label>
            <select name="company" defaultValue={searchParams.company ?? ''} className="input">
              <option value="">ทุกบริษัท</option>
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-[150px]">
          <label className="label">สถานะ</label>
          <select name="status" defaultValue={searchParams.status ?? ''} className="input">
            <option value="">ทั้งหมด</option>
            <option value="submitted">รออนุมัติ</option>
            <option value="approved">อนุมัติแล้ว</option>
            <option value="rejected">ไม่อนุมัติ</option>
            <option value="cancelled">ยกเลิก</option>
          </select>
        </div>
        <div>
          <label className="label">ตั้งแต่วันที่</label>
          <input type="date" name="from" defaultValue={searchParams.from ?? ''} className="input" />
        </div>
        <div>
          <label className="label">ถึงวันที่</label>
          <input type="date" name="to" defaultValue={searchParams.to ?? ''} className="input" />
        </div>
        <button className="btn-primary" type="submit">
          กรอง
        </button>
        <Link href="/admin/requests" className="btn-ghost">
          ล้าง
        </Link>
      </form>

      <section className="card">
        <div className="table-wrap">
          <table className="tbl !min-w-[900px]">
            <thead>
              <tr>
                <th>ยื่นเมื่อ</th>
                <th>บริษัท</th>
                <th>รหัส</th>
                <th>ชื่อ-สกุล</th>
                <th>ประเภท</th>
                <th>วันที่ลา</th>
                <th>เหตุผล</th>
                <th>สถานะ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-slate-500">{formatDateTimeTH(r.submitted_at)}</td>
                  <td>{r.companies?.company_name}</td>
                  <td className="font-medium">{r.employees?.employee_code}</td>
                  <td>{r.employees?.full_name}</td>
                  <td>{r.leave_types?.name}</td>
                  <td className="whitespace-nowrap">
                    {formatDateTH(r.start_date)}
                    {r.end_date !== r.start_date && ` – ${formatDateTH(r.end_date)}`}
                    <p className="text-xs text-slate-400">
                      {leaveAmount(r)} · {partText(r)}
                    </p>
                  </td>
                  <td className="max-w-[240px] text-slate-600">
                    {r.reason}
                    {r.attachment_path && urls.get(r.attachment_path) && (
                      <a
                        href={urls.get(r.attachment_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block text-xs font-medium text-brand-600 hover:underline"
                      >
                        📎 ดูไฟล์แนบ
                      </a>
                    )}
                    {r.admin_remark && <p className="mt-1 text-xs text-slate-400">หมายเหตุ: {r.admin_remark}</p>}
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                    {r.reviewed_by_name && (
                      <p className="mt-1 text-xs text-slate-400">โดย {r.reviewed_by_name}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {r.status === 'submitted' && <ReviewActions id={r.id} />}
                    {r.status === 'approved' && (
                      <Link href={`/print/${r.id}`} target="_blank" className="btn-outline btn-sm">
                        พิมพ์ใบลา
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-400">
                    ไม่พบรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length === 200 && <p className="mt-3 text-xs text-slate-400">แสดง 200 รายการล่าสุด — ใช้ตัวกรองเพื่อจำกัดผลลัพธ์</p>}
      </section>
    </div>
  );
}
