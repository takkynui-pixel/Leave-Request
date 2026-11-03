'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPhone, normalizePhone, phoneToEmail } from '@/lib/phone';
import type { FormState } from './auth';

async function assertAdminOf(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase.rpc('is_admin_of_company', { cid: companyId });
  if (data !== true) throw new Error('ไม่มีสิทธิ์ดำเนินการ');
}

async function assertSuper() {
  const supabase = createClient();
  const { data } = await supabase.rpc('is_super_admin');
  if (data !== true) throw new Error('เฉพาะ Super Admin เท่านั้น');
}

// ---------- อนุมัติ / ไม่อนุมัติ ----------
export async function reviewLeave(
  id: string,
  decision: 'approved' | 'rejected',
  remark: string,
): Promise<{ error?: string; ok?: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('leave_requests')
    .update({ status: decision, admin_remark: remark.trim() || null })
    .eq('id', id)
    .eq('status', 'submitted')
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'ไม่พบใบลาที่รออนุมัติ (อาจถูกดำเนินการไปแล้ว)' };
  revalidatePath('/admin/requests');
  revalidatePath('/');
  return { ok: true };
}

// ---------- พนักงาน ----------
export async function createEmployee(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const company_id = String(fd.get('company_id') ?? '');
    const employee_code = String(fd.get('employee_code') ?? '').trim();
    const full_name = String(fd.get('full_name') ?? '').trim();
    const department = String(fd.get('department') ?? '').trim() || null;
    const phone = normalizePhone(String(fd.get('phone') ?? ''));
    const pin = String(fd.get('pin') ?? '');

    if (!company_id || !employee_code || !full_name) return { error: 'กรุณากรอกข้อมูลให้ครบ' };
    if (!isValidPhone(phone)) return { error: 'เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)' };
    if (!/^\d{6}$/.test(pin)) return { error: 'PIN เริ่มต้นต้องเป็นตัวเลข 6 หลัก' };
    await assertAdminOf(company_id);

    const admin = createAdminClient();

    // เบอร์เดียวกันอยู่หลายบริษัทได้ → ใช้ผู้ใช้เดิม
    const { data: existing } = await admin
      .from('employees')
      .select('user_id')
      .eq('phone_number', phone)
      .not('user_id', 'is', null)
      .limit(1)
      .maybeSingle();

    let userId: string | null = existing?.user_id ?? null;
    let note = '';
    if (!userId) {
      const { data, error } = await admin.auth.admin.createUser({
        email: phoneToEmail(phone),
        password: pin,
        email_confirm: true,
        user_metadata: { must_change_pin: true },
      });
      if (error || !data.user) return { error: 'สร้างบัญชีไม่สำเร็จ: ' + (error?.message ?? 'unknown') };
      userId = data.user.id;
    } else {
      note = ' (เบอร์นี้มีบัญชีอยู่แล้ว ใช้ PIN เดิม)';
    }

    const { error: insErr } = await admin.from('employees').insert({
      user_id: userId,
      company_id,
      phone_number: phone,
      employee_code,
      full_name,
      department,
    });
    if (insErr) {
      return {
        error: insErr.message.includes('duplicate')
          ? 'รหัสพนักงานหรือเบอร์โทรนี้มีอยู่ในบริษัทนี้แล้ว'
          : insErr.message,
      };
    }
    revalidatePath('/admin/employees');
    return { ok: `เพิ่ม ${full_name} เรียบร้อย${note}` };
  } catch (e: any) {
    return { error: e.message ?? 'เกิดข้อผิดพลาด' };
  }
}

export async function resetPin(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const employeeId = String(fd.get('employee_id') ?? '');
    const pin = String(fd.get('pin') ?? '');
    if (!/^\d{6}$/.test(pin)) return { error: 'PIN ต้องเป็นตัวเลข 6 หลัก' };

    const admin = createAdminClient();
    const { data: emp } = await admin
      .from('employees')
      .select('user_id, company_id, full_name')
      .eq('id', employeeId)
      .single();
    if (!emp?.user_id) return { error: 'ไม่พบบัญชีผู้ใช้' };
    await assertAdminOf(emp.company_id);

    const { error } = await admin.auth.admin.updateUserById(emp.user_id, {
      password: pin,
      user_metadata: { must_change_pin: true },
    });
    if (error) return { error: error.message };
    return { ok: `ตั้ง PIN ใหม่ให้ ${emp.full_name} แล้ว` };
  } catch (e: any) {
    return { error: e.message ?? 'เกิดข้อผิดพลาด' };
  }
}

export async function toggleEmployee(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const next = String(fd.get('next') ?? '');
  if (!id || !['active', 'inactive'].includes(next)) return;
  const supabase = createClient();
  await supabase.from('employees').update({ status: next }).eq('id', id); // RLS: เฉพาะแอดมินของบริษัทนั้น
  revalidatePath('/admin/employees');
}

// ---------- ตั้งค่า (Super Admin) ----------
export async function updateCutoff(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const time = String(fd.get('time') ?? '');
  if (!id || !/^\d{2}:\d{2}$/.test(time)) return;
  const supabase = createClient();
  await supabase.from('companies').update({ leave_cutoff_time: time }).eq('id', id); // RLS: super_admin เท่านั้น
  revalidatePath('/admin/settings');
}

export async function createCompany(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get('company_name') ?? '').trim();
  const time = String(fd.get('time') ?? '10:00');
  if (!name) return { error: 'กรุณากรอกชื่อบริษัท' };
  const supabase = createClient();
  const { error } = await supabase.from('companies').insert({ company_name: name, leave_cutoff_time: time });
  if (error) return { error: error.message.includes('duplicate') ? 'มีชื่อบริษัทนี้อยู่แล้ว' : error.message };
  revalidatePath('/admin/settings');
  return { ok: `เพิ่มบริษัท ${name} แล้ว` };
}

export async function createAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    await assertSuper();
    const email = String(fd.get('email') ?? '').trim().toLowerCase();
    const password = String(fd.get('password') ?? '');
    const full_name = String(fd.get('full_name') ?? '').trim();
    const company_id = String(fd.get('company_id') ?? '');
    if (!email || !full_name || !company_id) return { error: 'กรุณากรอกข้อมูลให้ครบ' };
    if (password.length < 8) return { error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' };

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return { error: 'สร้างบัญชีไม่สำเร็จ: ' + (error?.message ?? 'unknown') };

    const { error: insErr } = await admin
      .from('company_admins')
      .insert({ user_id: data.user.id, company_id, role: 'company_admin', full_name });
    if (insErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { error: insErr.message };
    }
    revalidatePath('/admin/settings');
    return { ok: `เพิ่มแอดมิน ${full_name} แล้ว (เข้าสู่ระบบด้วยอีเมล ${email})` };
  } catch (e: any) {
    return { error: e.message ?? 'เกิดข้อผิดพลาด' };
  }
}
