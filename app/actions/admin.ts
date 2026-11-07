'use server';

import { randomInt } from 'crypto';
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
export async function updateShift(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get('id') ?? '');
  const name = String(fd.get('name') ?? '').trim();
  const t = (k: string) => String(fd.get(k) ?? '');
  const start = t('start'), end = t('end'), open = t('open'), close = t('close');
  const hm = /^\d{2}:\d{2}$/;
  if (!id || !name) return { error: 'กรุณากรอกชื่อกะ' };
  if (![start, end, open, close].every((v) => hm.test(v))) return { error: 'รูปแบบเวลาไม่ถูกต้อง' };
  if (open > close) return { error: 'เวลาเปิดรับต้องไม่เกินเวลาปิดรับ (ช่วงยื่นลาต้องอยู่ภายในวันเดียวกัน)' };
  if (start === end) return { error: 'เวลาเริ่มและเลิกงานต้องไม่เท่ากัน' };

  // ครึ่งกะ: เว้นว่างทั้ง 4 ช่อง (ตัดครึ่งอัตโนมัติ) หรือกรอกครบทั้ง 4 ช่อง
  const h = [t('h1s'), t('h1e'), t('h2s'), t('h2e')];
  const filled = h.filter(Boolean).length;
  if (filled !== 0 && filled !== 4) return { error: 'เวลาครึ่งกะ: กรอกให้ครบทั้ง 4 ช่อง หรือเว้นว่างทั้งหมด' };
  if (filled === 4) {
    if (!h.every((v) => hm.test(v))) return { error: 'รูปแบบเวลาครึ่งกะไม่ถูกต้อง' };
    const mins = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
    const len = ((mins(end) - mins(start)) % 1440 + 1440) % 1440 || 1440;
    // เวลาเทียบกับจุดเริ่มกะ (เวลาหลังเที่ยงคืนของกะดึกนับเป็นวันถัดไป)
    const rel = (v: string) => ((mins(v) - mins(start)) % 1440 + 1440) % 1440;
    const relEnd = (v: string) => rel(v) || len;
    const [a1, b1, a2, b2] = [rel(h[0]), relEnd(h[1]), rel(h[2]), relEnd(h[3])];
    if (!(a1 < b1 && b1 <= a2 && a2 < b2 && b2 <= len)) {
      return {
        error: `เวลาครึ่งกะต้องอยู่ในช่วงกะ (${start}–${end}) และเรียงลำดับ: ครึ่งแรกก่อนครึ่งหลัง ไม่ทับกัน`,
      };
    }
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('shifts')
    .update({
      name,
      start_time: start,
      end_time: end,
      open_time: open,
      close_time: close,
      half1_start: h[0] || null,
      half1_end: h[1] || null,
      half2_start: h[2] || null,
      half2_end: h[3] || null,
      // ฟอร์มของบริษัทมีช่อง "เปิดใช้กะนี้" (has_active) — ฟอร์มชุดมาตรฐานไม่มี
      ...(fd.get('has_active') ? { active: fd.get('active') === 'on' } : {}),
    }) // RLS: super_admin (ชุดมาตรฐาน) หรือแอดมินของบริษัทนั้น (กะเฉพาะบริษัท)
    .eq('id', id)
    .select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'ไม่มีสิทธิ์แก้ไข' };
  revalidatePath('/admin/settings');
  revalidatePath('/admin/leave-rules');
  revalidatePath('/');
  revalidatePath('/leave/new');
  return { ok: 'บันทึกแล้ว' };
}

export async function createCompany(_prev: FormState, fd: FormData): Promise<FormState> {
  const name = String(fd.get('company_name') ?? '').trim();
  if (!name) return { error: 'กรุณากรอกชื่อบริษัท' };
  const supabase = createClient();
  const { error } = await supabase.from('companies').insert({ company_name: name });
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

// ---------- แก้ไขข้อมูลพนักงาน ----------
export async function updateEmployee(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const id = String(fd.get('id') ?? '');
    const company_id = String(fd.get('company_id') ?? '');
    const employee_code = String(fd.get('employee_code') ?? '').trim();
    const full_name = String(fd.get('full_name') ?? '').trim();
    const department = String(fd.get('department') ?? '').trim() || null;
    let phone = normalizePhone(String(fd.get('phone') ?? ''));
    if (/^[689]\d{8}$/.test(phone)) phone = '0' + phone;

    if (!id || !company_id || !employee_code || !full_name) return { error: 'กรุณากรอกข้อมูลให้ครบ' };
    if (!isValidPhone(phone)) return { error: 'เบอร์โทรไม่ถูกต้อง (เช่น 0812345678)' };

    const admin = createAdminClient();
    const { data: emp } = await admin.from('employees').select('*').eq('id', id).single();
    if (!emp) return { error: 'ไม่พบพนักงาน' };
    await assertAdminOf(emp.company_id);

    // ย้ายบริษัท: ต้องมีสิทธิ์ทั้งสองบริษัท และต้องไม่มีประวัติการลา (ประวัติผูกกับบริษัทเดิม)
    if (company_id !== emp.company_id) {
      await assertAdminOf(company_id);
      const { count } = await admin
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('employee_id', id);
      if (count) {
        return {
          error:
            'พนักงานนี้มีประวัติการลาแล้ว จึงย้ายบริษัทไม่ได้ — ให้ปิดใช้งานรายการเดิม แล้วเพิ่มพนักงานใหม่ในบริษัทใหม่',
        };
      }
    }

    // กันรหัส/เบอร์ซ้ำในบริษัทปลายทาง (ตรวจก่อนแตะบัญชีเข้าสู่ระบบ)
    const { data: dup } = await admin
      .from('employees')
      .select('id, employee_code, phone_number')
      .eq('company_id', company_id)
      .neq('id', id)
      .or(`employee_code.eq.${employee_code.replace(/[,()]/g, '')},phone_number.eq.${phone}`)
      .limit(1);
    if (dup && dup.length) {
      return {
        error: dup[0].employee_code === employee_code ? 'รหัสพนักงานนี้มีอยู่ในบริษัทนี้แล้ว' : 'เบอร์โทรนี้มีอยู่ในบริษัทนี้แล้ว',
      };
    }

    // เปลี่ยนเบอร์ = เปลี่ยนชื่อผู้ใช้ที่ใช้ล็อกอิน
    let userId: string | null = emp.user_id;
    let note = '';
    if (phone !== emp.phone_number) {
      const { data: others } = emp.user_id
        ? await admin.from('employees').select('id').eq('user_id', emp.user_id).neq('id', id).limit(1)
        : { data: [] as { id: string }[] };
      const shared = !!others?.length;

      const { data: target } = await admin
        .from('employees')
        .select('user_id')
        .eq('phone_number', phone)
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (target?.user_id) {
        userId = target.user_id; // เบอร์ใหม่มีบัญชีอยู่แล้ว (เช่น ทำงานหลายบริษัท)
        note = ' (เบอร์ใหม่มีบัญชีอยู่แล้ว ใช้ PIN ของบัญชีนั้น)';
      } else if (emp.user_id && !shared) {
        const { error } = await admin.auth.admin.updateUserById(emp.user_id, {
          email: phoneToEmail(phone),
          email_confirm: true,
        });
        if (error) return { error: 'เปลี่ยนเบอร์เข้าสู่ระบบไม่สำเร็จ: ' + error.message };
        note = ' (PIN เดิมยังใช้ได้ แต่ต้องเข้าสู่ระบบด้วยเบอร์ใหม่)';
      } else {
        const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const { data, error } = await admin.auth.admin.createUser({
          email: phoneToEmail(phone),
          password: pin,
          email_confirm: true,
          user_metadata: { must_change_pin: true },
        });
        if (error || !data.user) return { error: 'สร้างบัญชีสำหรับเบอร์ใหม่ไม่สำเร็จ: ' + (error?.message ?? 'unknown') };
        userId = data.user.id;
        note = ` — PIN เริ่มต้นของเบอร์ใหม่: ${pin} (บันทึกไว้แจ้งพนักงาน)`;
      }
    }

    const { error: upErr } = await admin
      .from('employees')
      .update({ company_id, employee_code, full_name, department, phone_number: phone, user_id: userId })
      .eq('id', id);
    if (upErr) return { error: upErr.message };

    // ลบบัญชีเก่าที่ไม่มีใครใช้แล้ว (ไม่ลบถ้าเป็นแอดมินหรือยังผูกพนักงานอื่น)
    if (emp.user_id && userId !== emp.user_id) {
      const [{ count: empLeft }, { count: admLeft }] = await Promise.all([
        admin.from('employees').select('id', { count: 'exact', head: true }).eq('user_id', emp.user_id),
        admin.from('company_admins').select('id', { count: 'exact', head: true }).eq('user_id', emp.user_id),
      ]);
      if (!empLeft && !admLeft) await admin.auth.admin.deleteUser(emp.user_id);
    }

    revalidatePath('/admin/employees');
    revalidatePath(`/admin/employees/${id}`);
    return { ok: 'บันทึกการแก้ไขเรียบร้อย' + note };
  } catch (e: any) {
    return { error: e.message ?? 'เกิดข้อผิดพลาด' };
  }
}
