'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { MIN_OTHER_DETAIL, RATINGS, REASONS, TENURE } from '@/lib/resign';
import type { FormState } from './auth';

// ---------- พนักงานส่งแบบฟอร์มลาออก (ทุกข้อบังคับ) ----------
export async function submitResignation(_prev: FormState, fd: FormData): Promise<FormState> {
  const employee_id = String(fd.get('employee_id') ?? '');
  const tenure = String(fd.get('tenure') ?? '');
  const reason = String(fd.get('reason') ?? '');
  const detail = String(fd.get('detail') ?? '').trim();
  const last = String(fd.get('last_working_date') ?? '');

  if (!employee_id) return { error: 'ไม่พบข้อมูลพนักงาน' };
  if (!TENURE.some(([k]) => k === tenure)) return { error: 'กรุณาเลือกอายุงาน (ข้อ 5)' };
  if (!REASONS.some(([k]) => k === reason)) return { error: 'กรุณาเลือกเหตุผลการลาออก (ข้อ 6)' };
  if (!detail) return { error: 'กรุณาอธิบายเหตุผลเพิ่มเติม (ข้อ 7)' };
  if (reason === 'other' && detail.length < MIN_OTHER_DETAIL)
    return { error: `เลือก "อื่นๆ" กรุณาอธิบายเหตุผลในข้อ 7 อย่างน้อย ${MIN_OTHER_DETAIL} ตัวอักษร` };

  const ratings: Record<string, number> = {};
  for (const [key] of RATINGS) {
    const v = Number(fd.get(key));
    if (!Number.isInteger(v) || v < 1 || v > 5) return { error: 'กรุณาให้คะแนนความพึงพอใจให้ครบทุกหัวข้อ (ข้อ 8)' };
    ratings[key] = v;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) return { error: 'กรุณาระบุวันทำงานวันสุดท้าย' };

  const supabase = createClient();
  const { error } = await supabase
    .from('resignations')
    .insert({ employee_id, tenure, reason, detail, last_working_date: last, ...ratings });
  if (error) {
    if (error.code === '23505') return { error: 'คุณส่งแบบฟอร์มลาออกไปแล้ว' };
    if (error.code === '42501') return { error: 'ไม่มีสิทธิ์ส่งแบบฟอร์มสำหรับรหัสพนักงานนี้' };
    return { error: error.message };
  }
  revalidatePath('/resign');
  revalidatePath('/admin/resignations');
  return { ok: 'ส่งแบบฟอร์มลาออกเรียบร้อยแล้ว' };
}

// ---------- แอดมินกดรับทราบ ----------
export async function acknowledgeResignation(id: string): Promise<{ error?: string; ok?: boolean }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('resignations')
    .update({ status: 'acknowledged' })
    .eq('id', id)
    .eq('status', 'submitted')
    .select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'ไม่พบรายการที่รอรับทราบ (อาจถูกดำเนินการไปแล้ว)' };
  revalidatePath('/admin/resignations');
  return { ok: true };
}
