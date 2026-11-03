import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import ImportForm from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data } = await supabase.from('companies').select('id, company_name').order('company_name');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-600">นำเข้าพนักงานจากไฟล์</h1>
        <Link href="/admin/employees" className="btn-ghost">
          ← กลับหน้าพนักงาน
        </Link>
      </div>

      <section className="card space-y-2 text-sm text-slate-600">
        <p>
          รองรับไฟล์ <b>CSV</b> (ใน Excel เลือก <i>บันทึกเป็น → CSV UTF-8</i>) หรือคัดลอกตารางจาก Excel มาวางได้เลย หลายร้อยคนต่อครั้ง
        </p>
        <p>
          คอลัมน์: <b>รหัสพนักงาน · ชื่อ-สกุล · เบอร์โทร · แผนก · PIN</b> (และ <b>บริษัท</b> ถ้าต้องการรวมหลายบริษัทในไฟล์เดียว) —
          PIN เว้นว่างได้ ระบบจะสุ่ม PIN 6 หลักให้ แล้วให้ดาวน์โหลดรายการ PIN หลังนำเข้า
        </p>
        <p>
          <a href="/import-template.csv" download className="font-medium text-brand-600 hover:underline">
            ⬇ ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </p>
      </section>

      <ImportForm companies={data ?? []} />
    </div>
  );
}
