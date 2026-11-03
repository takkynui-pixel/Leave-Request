'use server';

import { randomInt } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidPhone, normalizePhone, phoneToEmail } from '@/lib/phone';

export interface ImportRow {
  line: number;
  companyId: string;
  code: string;
  name: string;
  phone: string;
  department: string;
  pin: string;
}

export interface ImportResult {
  line: number;
  code: string;
  name: string;
  phone: string;
  status: 'ok' | 'skip' | 'error';
  message: string;
  pin: string; // PIN ที่ตั้งให้ (ว่างถ้าใช้บัญชีเดิมหรือไม่สำเร็จ)
}

const MAX_PER_CALL = 30;

/** นำเข้าพนักงานเป็นชุดเล็ก (เรียกซ้ำจากหน้าเว็บเพื่อไม่ให้เกินเวลาของ Vercel) */
export async function importEmployeeRows(rows: ImportRow[]): Promise<ImportResult[]> {
  if (rows.length > MAX_PER_CALL) throw new Error('ส่งข้อมูลครั้งละไม่เกิน 30 แถว');

  const supabase = createClient();
  const allowed = new Map<string, boolean>();
  for (const id of new Set(rows.map((r) => r.companyId))) {
    const { data } = await supabase.rpc('is_admin_of_company', { cid: id });
    allowed.set(id, data === true);
  }

  const admin = createAdminClient();
  const phones = [...new Set(rows.map((r) => normalizePhone(r.phone)).filter(isValidPhone))];
  const userByPhone = new Map<string, string>();
  if (phones.length) {
    const { data } = await admin
      .from('employees')
      .select('phone_number, user_id')
      .in('phone_number', phones)
      .not('user_id', 'is', null);
    (data ?? []).forEach((e: any) => userByPhone.set(e.phone_number, e.user_id));
  }

  const out: ImportResult[] = [];
  for (const r of rows) {
    const phone = normalizePhone(r.phone);
    const base = { line: r.line, code: r.code, name: r.name, phone, pin: '' };
    const fail = (message: string): ImportResult => ({ ...base, status: 'error', message });

    if (!allowed.get(r.companyId)) {
      out.push(fail('ไม่มีสิทธิ์ในบริษัทนี้'));
      continue;
    }
    if (!r.code.trim() || !r.name.trim() || !isValidPhone(phone)) {
      out.push(fail('ข้อมูลไม่ครบหรือเบอร์โทรไม่ถูกต้อง'));
      continue;
    }
    if (r.pin && !/^\d{6}$/.test(r.pin)) {
      out.push(fail('PIN ต้องเป็นตัวเลข 6 หลัก'));
      continue;
    }

    // 1) บันทึกแถวพนักงานก่อน (ซ้ำ = ข้าม ไม่สร้างบัญชีเกิน)
    const existingUser = userByPhone.get(phone) ?? null;
    const { data: ins, error: insErr } = await admin
      .from('employees')
      .insert({
        user_id: existingUser,
        company_id: r.companyId,
        phone_number: phone,
        employee_code: r.code.trim(),
        full_name: r.name.trim(),
        department: r.department.trim() || null,
      })
      .select('id')
      .single();
    if (insErr || !ins) {
      out.push(
        insErr?.message.includes('duplicate')
          ? { ...base, status: 'skip', message: 'มีรหัสหรือเบอร์นี้ในบริษัทนี้อยู่แล้ว (ข้าม)' }
          : fail(insErr?.message ?? 'บันทึกไม่สำเร็จ'),
      );
      continue;
    }

    // 2) ผูกบัญชีเข้าสู่ระบบ
    if (existingUser) {
      out.push({ ...base, status: 'ok', message: 'เพิ่มแล้ว (เบอร์นี้มีบัญชีอยู่แล้ว ใช้ PIN เดิม)' });
      continue;
    }
    const pin = r.pin || String(randomInt(0, 1_000_000)).padStart(6, '0');
    const { data: u, error: uErr } = await admin.auth.admin.createUser({
      email: phoneToEmail(phone),
      password: pin,
      email_confirm: true,
      user_metadata: { must_change_pin: true },
    });
    if (uErr || !u.user) {
      await admin.from('employees').delete().eq('id', ins.id); // ย้อนกลับ ไม่ให้เหลือแถวไม่มีบัญชี
      out.push(fail('สร้างบัญชีไม่สำเร็จ: ' + (uErr?.message ?? 'unknown')));
      continue;
    }
    await admin.from('employees').update({ user_id: u.user.id }).eq('id', ins.id);
    userByPhone.set(phone, u.user.id);
    out.push({ ...base, status: 'ok', message: 'เพิ่มแล้ว', pin });
  }

  revalidatePath('/admin/employees');
  return out;
}
