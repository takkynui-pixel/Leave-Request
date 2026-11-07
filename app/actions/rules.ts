'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { SAMPLE_TYPES } from '@/lib/presets';
import type { FormState } from './auth';

type Res = { error?: string; ok?: boolean };

async function assertAdminOf(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase.rpc('is_admin_of_company', { cid: companyId });
  if (data !== true) throw new Error('ไม่มีสิทธิ์ดำเนินการ');
  return supabase;
}

function refresh() {
  revalidatePath('/admin/leave-rules');
  revalidatePath('/leave/new');
  revalidatePath('/');
}

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim();
  return s === '' ? null : Number(s);
};

// ---------- ประเภทการลา ----------
export async function saveLeaveType(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const company_id = String(fd.get('company_id') ?? '');
    const id = String(fd.get('id') ?? '');
    const code = String(fd.get('code') ?? '').trim().toUpperCase();
    const name = String(fd.get('name') ?? '').trim();
    const name_alt = String(fd.get('name_alt') ?? '').trim() || null;
    const min_days = num(fd.get('min_days'));
    const max_days = num(fd.get('max_days'));
    const points = num(fd.get('points_per_day')) ?? 0;

    if (!company_id) return { error: 'ไม่พบบริษัท' };
    if (!/^[A-Z0-9_-]{1,12}$/.test(code)) return { error: 'รหัสใช้ตัวอักษรอังกฤษ/ตัวเลข ไม่เกิน 12 ตัว เช่น AL, SL' };
    if (!name) return { error: 'กรุณากรอกชื่อประเภทการลา' };
    if ([min_days, max_days, points].some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return { error: 'ตัวเลขไม่ถูกต้อง' };
    if (max_days !== null && max_days <= 0) return { error: 'จำนวนวันสูงสุดต้องมากกว่า 0 (เว้นว่างถ้าไม่จำกัด)' };
    if (min_days !== null && max_days !== null && min_days > max_days) return { error: 'ขั้นต่ำต้องไม่เกินสูงสุด' };
    if (points > 9.9) return { error: 'แต้มต่อวันต้องไม่เกิน 9.9' };

    const supabase = await assertAdminOf(company_id);
    const row = {
      code,
      name,
      name_alt,
      min_days,
      max_days,
      points_per_day: points,
      pay_deduct: fd.get('pay_deduct') === 'on',
      requires_attachment: fd.get('requires_attachment') === 'on',
      active: fd.get('active') === 'on' || !id, // สร้างใหม่ = เปิดใช้
    };

    if (id) {
      const { data, error } = await supabase.from('leave_types').update(row).eq('id', id).eq('company_id', company_id).select('id');
      if (error) return { error: error.code === '23505' ? 'รหัสนี้ถูกใช้แล้วในบริษัทนี้' : error.message };
      if (!data?.length) return { error: 'ไม่พบรายการ' };
    } else {
      const { data: last } = await supabase
        .from('leave_types')
        .select('sort_order')
        .eq('company_id', company_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      const { error } = await supabase
        .from('leave_types')
        .insert({ ...row, company_id, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
      if (error) return { error: error.code === '23505' ? 'รหัสนี้ถูกใช้แล้วในบริษัทนี้' : error.message };
    }
    refresh();
    return { ok: id ? 'บันทึกแล้ว' : 'เพิ่มประเภทการลาแล้ว' };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** เริ่มชุดเฉพาะบริษัท: คัดลอกจากชุดมาตรฐาน หรือใช้ชุดตัวอย่าง (AL, PL, SL, …) */
export async function seedCompanyTypes(companyId: string, preset: 'default' | 'sample'): Promise<Res> {
  try {
    const supabase = await assertAdminOf(companyId);
    let items: any[];
    if (preset === 'sample') {
      items = SAMPLE_TYPES.map((t, i) => ({ ...t, requires_attachment: false, sort_order: i + 1 }));
    } else {
      const { data } = await supabase
        .from('leave_types')
        .select('code, name, name_alt, min_days, max_days, pay_deduct, points_per_day, requires_attachment, sort_order')
        .is('company_id', null)
        .eq('active', true)
        .order('sort_order');
      items = data ?? [];
    }
    const { data: existing } = await supabase.from('leave_types').select('id, code').eq('company_id', companyId);
    const byCode = new Map((existing ?? []).map((r: any) => [r.code, r.id]));
    for (const it of items) {
      const row = { ...it, company_id: companyId, active: true };
      const { error } = byCode.has(it.code)
        ? await supabase.from('leave_types').update(row).eq('id', byCode.get(it.code))
        : await supabase.from('leave_types').insert(row);
      if (error) return { error: error.message };
    }
    refresh();
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

/** กลับไปใช้ชุดมาตรฐาน: ปิดใช้ประเภทการลาเฉพาะบริษัท (ใบลาเดิมยังอยู่ครบ) */
export async function resetCompanyTypes(companyId: string): Promise<Res> {
  try {
    const supabase = await assertAdminOf(companyId);
    const { error } = await supabase.from('leave_types').update({ active: false }).eq('company_id', companyId);
    if (error) return { error: error.message };
    refresh();
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ---------- ช่วงที่ลา ----------
export async function saveLeaveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  try {
    const company_id = String(fd.get('company_id') ?? '');
    const allow_full = fd.get('allow_full') === 'on';
    const allow_half = fd.get('allow_half') === 'on';
    const allow_hours = fd.get('allow_hours') === 'on';
    const max_hours = num(fd.get('max_hours'));
    const note = String(fd.get('note') ?? '').trim() || null;

    if (!company_id) return { error: 'ไม่พบบริษัท' };
    if (!allow_full && !allow_half && !allow_hours) return { error: 'ต้องเปิดอย่างน้อย 1 แบบ' };
    if (max_hours !== null && (!Number.isFinite(max_hours) || max_hours <= 0 || max_hours > 24)) return { error: 'จำนวนชั่วโมงสูงสุดไม่ถูกต้อง' };
    if (note && note.length > 500) return { error: 'ข้อความแจ้งเตือนยาวเกิน 500 ตัวอักษร' };

    const supabase = await assertAdminOf(company_id);
    const { error } = await supabase
      .from('company_leave_settings')
      .upsert({ company_id, allow_full, allow_half, allow_hours, max_hours: allow_hours ? max_hours : null, note });
    if (error) return { error: error.message };
    refresh();
    return { ok: 'บันทึกแล้ว' };
  } catch (e: any) {
    return { error: e.message };
  }
}

// ---------- กะของบริษัท ----------
export async function seedCompanyShifts(companyId: string): Promise<Res> {
  try {
    const supabase = await assertAdminOf(companyId);
    const { data: base } = await supabase
      .from('shifts')
      .select('name, start_time, end_time, open_time, close_time, half1_start, half1_end, half2_start, half2_end, sort_order')
      .is('company_id', null)
      .eq('active', true)
      .order('sort_order');
    for (const b of base ?? []) {
      const { error } = await supabase
        .from('shifts')
        .insert({ ...b, company_id: companyId, code: 'c' + randomBytes(5).toString('hex'), active: true });
      if (error) return { error: error.message };
    }
    refresh();
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function addCompanyShift(companyId: string): Promise<Res> {
  try {
    const supabase = await assertAdminOf(companyId);
    const { data: last } = await supabase
      .from('shifts')
      .select('sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: false })
      .limit(1);
    const { error } = await supabase.from('shifts').insert({
      company_id: companyId,
      code: 'c' + randomBytes(5).toString('hex'),
      name: 'กะใหม่',
      start_time: '08:00',
      end_time: '17:00',
      open_time: '05:00',
      close_time: '10:00',
      sort_order: (last?.[0]?.sort_order ?? 0) + 1,
    });
    if (error) return { error: error.message };
    refresh();
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function resetCompanyShifts(companyId: string): Promise<Res> {
  try {
    const supabase = await assertAdminOf(companyId);
    const { error } = await supabase.from('shifts').update({ active: false }).eq('company_id', companyId);
    if (error) return { error: error.message };
    refresh();
    return { ok: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
