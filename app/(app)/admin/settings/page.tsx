import { requireSuper } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ShiftForm from './ShiftForm';
import CompanyForm from './CompanyForm';
import AdminForm from './AdminForm';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireSuper();
  const supabase = createClient();

  const [{ data: companies }, { data: admins }, { data: shifts }] = await Promise.all([
    supabase.from('companies').select('id, company_name, leave_cutoff_time').order('company_name'),
    supabase.from('company_admins').select('id, full_name, role, company_id, companies(company_name)').order('role'),
    supabase.from('shifts').select('id, name, start_time, end_time, open_time, close_time, half1_start, half1_end, half2_start, half2_end').is('company_id', null).eq('active', true).order('sort_order'),
  ]);
  const comps = (companies ?? []) as Company[];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-brand-600">ตั้งค่า</h1>

      <section>
        <div className="mb-3 px-1">
          <h2 className="card-title">กะทำงานและเวลายื่นลา</h2>
          <p className="mt-0.5 text-sm text-slate-500">ชุดมาตรฐาน ใช้กับบริษัทที่ยังไม่ได้ตั้งกะของตัวเอง (ตั้งเฉพาะบริษัทได้ที่เมนู “เงื่อนไขการลา”) · เวลาแบบ 24 ชั่วโมง (เวลาไทย)</p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {(shifts ?? []).map((sh: any) => (
            <ShiftForm key={sh.id} shift={sh} />
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">บริษัทลูกค้า</h2>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">
          {comps.map((c) => (
            <li key={c.id} className="py-2.5 font-medium">
              {c.company_name}
            </li>
          ))}
          {comps.length === 0 && <li className="py-2.5 text-slate-400">ยังไม่มีบริษัท — เพิ่มด้านล่าง</li>}
        </ul>
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
