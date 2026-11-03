import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import EditForm from './EditForm';

export const dynamic = 'force-dynamic';

export default async function EditEmployeePage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const supabase = createClient();

  const [{ data: emp }, { data: companies }, { count }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, company_id, employee_code, full_name, department, phone_number')
      .eq('id', params.id)
      .maybeSingle(),
    supabase.from('companies').select('id, company_name').order('company_name'),
    supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('employee_id', params.id),
  ]);
  if (!emp) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-brand-600">แก้ไขข้อมูลพนักงาน</h1>
        <Link href="/admin/employees" className="btn-ghost">
          ← กลับหน้าพนักงาน
        </Link>
      </div>
      <section className="card">
        <EditForm emp={emp} companies={companies ?? []} hasLeaves={!!count} />
      </section>
    </div>
  );
}
