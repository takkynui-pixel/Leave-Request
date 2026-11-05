import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { thaiParts } from '@/lib/time';
import type { EmployeeRef } from '@/lib/types';

export interface Ctx {
  userId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isSuper: boolean;
  adminCompanyIds: string[];
  employees: EmployeeRef[];
  mustChangePin: boolean;
}

export const getContext = cache(async (): Promise<Ctx> => {
  const supabase = createClient();
  // middleware ตรวจ/รีเฟรช session ด้วย getUser() ทุกคำขอแล้ว — ที่นี่อ่านจาก cookie ได้เลย (เร็วกว่า ไม่ต้องเรียกเครือข่ายซ้ำ)
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) redirect('/login');

  const [empRes, adminRes] = await Promise.all([
    supabase
      .from('employees')
      .select('id, company_id, employee_code, full_name, department, phone_number, companies(company_name), resignations(status, last_working_date)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at'),
    supabase.from('company_admins').select('company_id, role, full_name').eq('user_id', user.id),
  ]);

  // ลาออกแล้ว (แอดมินรับทราบ) และพ้นวันทำงานวันสุดท้าย → ไม่ถือเป็นพนักงานที่ใช้งานอยู่ (ตรงกับกฎใน DB)
  const todayTH = thaiParts(Date.now()).date;
  const stillWorking = (e: any) => {
    const r = Array.isArray(e.resignations) ? e.resignations[0] : e.resignations;
    return !(r && r.status === 'acknowledged' && r.last_working_date < todayTH);
  };

  const employees: EmployeeRef[] = (empRes.data ?? []).filter(stillWorking).map((e: any) => ({
    id: e.id,
    company_id: e.company_id,
    employee_code: e.employee_code,
    full_name: e.full_name,
    department: e.department,
    phone_number: e.phone_number,
    company_name: (Array.isArray(e.companies) ? e.companies[0] : e.companies)?.company_name ?? '',
  }));
  const admins = (adminRes.data ?? []) as { company_id: string | null; role: string; full_name: string }[];

  return {
    userId: user.id,
    email: user.email ?? '',
    displayName: admins[0]?.full_name ?? employees[0]?.full_name ?? user.email?.split('@')[0] ?? 'ผู้ใช้',
    isAdmin: admins.length > 0,
    isSuper: admins.some((a) => a.role === 'super_admin'),
    adminCompanyIds: admins.map((a) => a.company_id).filter(Boolean) as string[],
    employees,
    mustChangePin: user.user_metadata?.must_change_pin === true,
  };
});

export async function requireAdmin() {
  const ctx = await getContext();
  if (!ctx.isAdmin) redirect('/');
  return ctx;
}

export async function requireSuper() {
  const ctx = await getContext();
  if (!ctx.isSuper) redirect('/');
  return ctx;
}
