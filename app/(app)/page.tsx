import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDateTH, greeting, thaiParts } from '@/lib/time';
import StatusBadge from '@/components/StatusBadge';
import CancelButton from '@/components/CancelButton';
import { leaveAmount, partText, type LeaveRow, type Shift } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: { submitted?: string } }) {
  const ctx = await getContext();
  const now = thaiParts(Date.now());
  const hello = `${greeting(now.hour)}, ${ctx.displayName.split(' ')[0]}!`;

  // ล็อกอินได้แต่ยังไม่มีสิทธิ์ใดๆ (ไม่ใช่แอดมิน และยังไม่ผูกรหัสพนักงาน)
  if (!ctx.isAdmin && ctx.employees.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-base font-bold text-brand-600 sm:text-lg">{hello}</h1>
        <section className="card max-w-3xl space-y-3">
          <h2 className="card-title">บัญชีนี้ยังไม่ได้รับสิทธิ์ใช้งาน</h2>
          <p className="text-sm text-slate-600">
            ถ้าคุณเป็น <b>Super Admin คนแรก</b> ให้เปิด Supabase → SQL Editor แล้วรันคำสั่งนี้ครั้งเดียว จากนั้นรีเฟรชหน้านี้
            เมนู <b>ใบลา / พนักงาน / รายงาน / ตั้งค่า</b> จะปรากฏ:
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`insert into public.company_admins (user_id, company_id, role, full_name)
select id, null, 'super_admin', 'ชื่อแอดมิน'
from auth.users where email = '${ctx.email}';`}
          </pre>
          <p className="text-sm text-slate-500">
            ถ้าคุณเป็นพนักงาน กรุณาติดต่อฝ่ายบุคคลเพื่อเพิ่มรหัสพนักงานของคุณ
          </p>
        </section>
      </div>
    );
  }

  return ctx.isAdmin ? (
    <AdminHome hello={hello} today={now.date} />
  ) : (
    <EmployeeHome hello={hello} submitted={searchParams.submitted === '1'} />
  );
}

/* ------------------------------------------------------------------ */
async function EmployeeHome({ hello, submitted }: { hello: string; submitted: boolean }) {
  const ctx = await getContext();
  const supabase = createClient();

  const todayTH = thaiParts(Date.now()).date;

  // สองคำขอทำงานพร้อมกัน (ไม่รอกัน)
  const [{ data }, winRes] = await Promise.all([
    supabase
      .from('leave_requests')
      .select('*, leave_types(name, code), shifts(name)')
      .in('employee_id', ctx.employees.map((e) => e.id))
      .order('submitted_at', { ascending: false })
      .limit(30),
    supabase.rpc('get_shift_windows'),
  ]);
  const rows = (data ?? []) as LeaveRow[];

  // ช่วงเวลายื่นลาของ "วันนี้" ของแต่ละกะ (เทียบเวลาเซิร์ฟเวอร์)
  const win = winRes.data as { server_epoch_ms: number; shifts: Shift[] } | null;
  const nowTime = thaiParts(win?.server_epoch_ms ?? Date.now()).time;
  const shiftStates = (win?.shifts ?? []).map((sh) => ({
    ...sh,
    isOpen: nowTime >= sh.open && nowTime <= sh.close,
  }));

  const pending = rows.filter((r) => r.status === 'submitted').length;
  const approved = rows.filter((r) => r.status === 'approved').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-base font-bold text-brand-600 sm:text-lg">{hello}</h1>
        <Link href="/leave/new" className="btn-primary !px-7 !py-3.5 text-base">
          + ยื่นใบลา
        </Link>
      </div>

      {submitted && <p className="alert-ok">ส่งใบลาเรียบร้อยแล้ว รอการอนุมัติจากผู้บังคับบัญชา</p>}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-[32px] bg-gradient-to-br from-brand-600 to-brand-400 p-7 text-white shadow-xl shadow-blue-600/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl">🗓️</div>
          <p className="mt-5 text-lg font-semibold">เวลายื่นลาของวันนี้</p>
          <ul className="mt-3 space-y-2.5">
            {shiftStates.map((sh) => (
              <li key={sh.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/15 px-4 py-3">
                <div>
                  <p className="font-semibold">{sh.name}</p>
                  <p className="text-2xl font-bold leading-tight">
                    {sh.open}–{sh.close} น.
                  </p>
                </div>
                <span
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                    sh.isOpen ? 'bg-white text-brand-700' : 'bg-white/25 text-white'
                  }`}
                >
                  {sh.isOpen ? 'เปิดรับอยู่' : 'ปิดอยู่'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-white/90">ลาล่วงหน้าวันอื่น ยื่นได้ตลอดเวลา</p>
        </section>

        <section className="card">
          <h2 className="card-title">ใบลาของฉัน</h2>
          <div className="mt-5 flex gap-8">
            <div>
              <p className="text-5xl font-bold">{pending}</p>
              <p className="mt-1 text-sm text-slate-400">รออนุมัติ</p>
            </div>
            <div>
              <p className="text-5xl font-bold">{approved}</p>
              <p className="mt-1 text-sm text-slate-400">อนุมัติแล้ว</p>
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">สังกัด</h2>
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {ctx.employees.map((e) => (
              <li key={e.id} className="py-2.5">
                <p className="font-semibold">{e.company_name}</p>
                <p className="text-slate-400">รหัส {e.employee_code}</p>
              </li>
            ))}
            {ctx.employees.length === 0 && <li className="py-2.5 text-slate-400">ยังไม่มีข้อมูลพนักงานที่ผูกกับบัญชีนี้</li>}
          </ul>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">ประวัติการลา</h2>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead>
              <tr>
                <th>ประเภท</th>
                <th>วันที่ลา</th>
                <th>จำนวน</th>
                <th>เหตุผล</th>
                <th>สถานะ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">
                    {r.leave_types?.name}
                    <p className="text-xs font-normal text-slate-400">{partText(r)}</p>
                  </td>
                  <td className="whitespace-nowrap">
                    {formatDateTH(r.start_date)}
                    {r.end_date !== r.start_date && ` – ${formatDateTH(r.end_date)}`}
                  </td>
                  <td className="whitespace-nowrap">{leaveAmount(r)}</td>
                  <td className="max-w-[260px] text-slate-600">
                    {r.reason}
                    {r.admin_remark && <p className="mt-1 text-xs text-slate-400">หมายเหตุ: {r.admin_remark}</p>}
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <div className="flex items-start justify-end gap-2">
                      {r.status === 'approved' && (
                        <Link href={`/print/${r.id}`} target="_blank" className="btn-outline btn-sm">
                          พิมพ์ใบลา
                        </Link>
                      )}
                      {r.status === 'submitted' && <CancelButton id={r.id} />}
                      {r.status === 'approved' && r.start_date >= todayTH && <CancelButton id={r.id} approved />}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    ยังไม่มีประวัติการลา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
async function AdminHome({ hello, today }: { hello: string; today: string }) {
  const supabase = createClient();

  const [pendingRes, todayRes, empRes] = await Promise.all([
    supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
    supabase
      .from('leave_requests')
      .select('*, leave_types(name, code), shifts(name), employees(employee_code, full_name), companies(company_name)')
      .in('status', ['submitted', 'approved'])
      .lte('start_date', today)
      .gte('end_date', today)
      .order('submitted_at'),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
  ]);
  const todayRows = (todayRes.data ?? []) as LeaveRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-base font-bold text-brand-600 sm:text-lg">{hello}</h1>
        <Link href="/admin/reports" className="btn-primary !px-7 !py-3.5 text-base">
          รายงานประจำเดือน
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-[32px] bg-gradient-to-br from-brand-600 to-brand-400 p-7 text-white shadow-xl shadow-blue-600/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl">🧑‍💼</div>
          <p className="mt-6 text-lg font-semibold">ลาวันนี้</p>
          <p className="text-6xl font-bold leading-tight">{todayRows.length}</p>
          <p className="mt-3 text-sm text-white/90">รวมใบที่รออนุมัติและอนุมัติแล้ว</p>
        </section>

        <section className="card">
          <h2 className="card-title">รออนุมัติ</h2>
          <p className="mt-5 text-5xl font-bold">{pendingRes.count ?? 0}</p>
          <p className="mt-1 text-sm text-slate-400">ใบลา</p>
          <Link href="/admin/requests?status=submitted" className="btn-outline btn-sm mt-4">
            ดูทั้งหมด
          </Link>
        </section>

        <section className="card">
          <h2 className="card-title">พนักงานที่ใช้งาน</h2>
          <p className="mt-5 text-5xl font-bold">{empRes.count ?? 0}</p>
          <p className="mt-1 text-sm text-slate-400">คน</p>
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">รายชื่อผู้ลาวันนี้ ({formatDateTH(today)})</h2>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead>
              <tr>
                <th>บริษัท</th>
                <th>รหัส</th>
                <th>ชื่อ-สกุล</th>
                <th>ประเภท</th>
                <th>เหตุผล</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {todayRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.companies?.company_name}</td>
                  <td className="font-medium">{r.employees?.employee_code}</td>
                  <td>{r.employees?.full_name}</td>
                  <td>
                    {r.leave_types?.name}
                    <p className="text-xs text-slate-400">{partText(r)}</p>
                  </td>
                  <td className="max-w-[260px] text-slate-600">{r.reason}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {todayRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    วันนี้ไม่มีผู้ลา
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
