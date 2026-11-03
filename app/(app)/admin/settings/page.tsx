import { requireSuper } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { updateCutoff } from '@/app/actions/admin';
import CompanyForm from './CompanyForm';
import AdminForm from './AdminForm';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireSuper();
  const supabase = createClient();

  const [{ data: companies }, { data: admins }] = await Promise.all([
    supabase.from('companies').select('id, company_name, leave_cutoff_time').order('company_name'),
    supabase.from('company_admins').select('id, full_name, role, company_id, companies(company_name)').order('role'),
  ]);
  const comps = (companies ?? []) as Company[];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-brand-600">ตั้งค่า</h1>

      <section className="card">
        <h2 className="card-title">เวลาปิดรับแจ้งลาของวันนี้ (แยกรายบริษัท)</h2>
        <p className="mt-1 text-sm text-slate-500">
          พนักงานยื่นลาสำหรับวันนี้ได้ถึงเวลานี้ (เวลาไทย) — มีผลทันทีทั้งหน้าจอและฐานข้อมูล
        </p>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead>
              <tr>
                <th>บริษัท</th>
                <th>เวลาปิดรับ (น.)</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.company_name}</td>
                  <td>
                    <form action={updateCutoff} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        type="time"
                        name="time"
                        defaultValue={c.leave_cutoff_time.slice(0, 5)}
                        className="input !w-36 !py-1.5"
                        required
                      />
                      <button className="btn-outline btn-sm" type="submit">
                        บันทึก
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {comps.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-slate-400">
                    ยังไม่มีบริษัท — เพิ่มด้านล่าง
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <CompanyForm />
      </section>

      <section className="card">
        <h2 className="card-title">แอดมินประจำบริษัทลูกค้า</h2>
        <p className="mt-1 text-sm text-slate-500">เข้าสู่ระบบด้วยอีเมล เห็นและอนุมัติใบลาเฉพาะบริษัทของตน</p>
        <div className="table-wrap mt-3">
          <table className="tbl">
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>สิทธิ์</th>
                <th>บริษัท</th>
              </tr>
            </thead>
            <tbody>
              {(admins ?? []).map((a: any) => {
                const comp = Array.isArray(a.companies) ? a.companies[0] : a.companies;
                return (
                  <tr key={a.id}>
                    <td className="font-medium">{a.full_name}</td>
                    <td>{a.role === 'super_admin' ? 'Super Admin' : 'Company Admin'}</td>
                    <td>{comp?.company_name ?? 'ทุกบริษัท'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AdminForm companies={comps} />
      </section>
    </div>
  );
}
