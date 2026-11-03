import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatPhone } from '@/lib/phone';
import { toggleEmployee } from '@/app/actions/admin';
import EmployeeForm from './EmployeeForm';
import ResetPinForm from './ResetPinForm';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function EmployeesPage({ searchParams }: { searchParams: { company?: string; q?: string } }) {
  await requireAdmin();
  const supabase = createClient();

  const { data: companies } = await supabase.from('companies').select('id, company_name').order('company_name');
  let q = supabase
    .from('employees')
    .select('id, employee_code, full_name, department, phone_number, status, company_id, companies(company_name)')
    .order('company_id')
    .order('employee_code')
    .limit(100);
  if (searchParams.company) q = q.eq('company_id', searchParams.company);
  if (searchParams.q) {
    const t = searchParams.q.replace(/[%,()]/g, '').trim();
    if (t) q = q.or(`employee_code.ilike.%${t}%,full_name.ilike.%${t}%,phone_number.ilike.%${t}%`);
  }
  const { data } = await q;
  const comps = (companies ?? []) as Company[];
  const rows = (data ?? []) as any[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-600">พนักงาน</h1>
        <Link href="/admin/employees/import" className="btn-primary">
          ⬆ นำเข้าจาก Excel/CSV
        </Link>
      </div>

      <section className="card">
        <h2 className="card-title">เพิ่มพนักงาน</h2>
        <p className="mt-1 text-sm text-slate-500">
          ระบบสร้างบัญชีเข้าสู่ระบบจากเบอร์โทรให้อัตโนมัติ พนักงานจะถูกเตือนให้เปลี่ยน PIN ครั้งแรก
        </p>
        <EmployeeForm companies={comps} />
      </section>

      <form method="get" className="card flex flex-wrap items-end gap-3">
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
        <div className="min-w-[200px] flex-1">
          <label className="label">ค้นหา (รหัส / ชื่อ / เบอร์)</label>
          <input name="q" defaultValue={searchParams.q ?? ''} className="input" />
        </div>
        <button className="btn-primary" type="submit">
          ค้นหา
        </button>
      </form>

      <section className="card">
        <div className="table-wrap">
          <table className="tbl !min-w-[820px]">
            <thead>
              <tr>
                <th>บริษัท</th>
                <th>รหัส</th>
                <th>ชื่อ-สกุล</th>
                <th>เบอร์โทร</th>
                <th>สถานะ</th>
                <th>ตั้ง PIN ใหม่</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const active = e.status === 'active';
                const comp = Array.isArray(e.companies) ? e.companies[0] : e.companies;
                return (
                  <tr key={e.id} className={active ? '' : 'opacity-60'}>
                    <td>{comp?.company_name}</td>
                    <td className="font-medium">{e.employee_code}</td>
                    <td>
                      {e.full_name}
                      {e.department && <p className="text-xs text-slate-400">{e.department}</p>}
                    </td>
                    <td className="whitespace-nowrap">{formatPhone(e.phone_number)}</td>
                    <td>
                      <span className={`badge ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {active ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </span>
                    </td>
                    <td>
                      <ResetPinForm employeeId={e.id} />
                    </td>
                    <td className="text-right">
                      <form action={toggleEmployee}>
                        <input type="hidden" name="id" value={e.id} />
                        <input type="hidden" name="next" value={active ? 'inactive' : 'active'} />
                        <button className={`${active ? 'btn-danger' : 'btn-success'} btn-sm`} type="submit">
                          {active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    ไม่พบพนักงาน
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
