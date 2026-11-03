'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { phoneToEmail } from '@/lib/phone';

export type FormState = { error?: string; ok?: string } | undefined;

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get('id') ?? '').trim();
  const pin = String(fd.get('pin') ?? '');
  if (!id || !pin) return { error: 'กรุณากรอกเบอร์โทรและรหัส PIN' };

  // พนักงานเข้าด้วยเบอร์โทร / แอดมินเข้าด้วยอีเมลได้
  const email = id.includes('@') ? id.toLowerCase() : phoneToEmail(id);
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: pin });
  if (error) return { error: 'เบอร์โทรหรือ PIN ไม่ถูกต้อง' };
  redirect('/');
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function changePin(_prev: FormState, fd: FormData): Promise<FormState> {
  const pin = String(fd.get('pin') ?? '');
  const confirm = String(fd.get('confirm') ?? '');
  if (pin.length < 6) return { error: 'PIN ต้องมีอย่างน้อย 6 ตัว' };
  if (pin !== confirm) return { error: 'PIN ทั้งสองช่องไม่ตรงกัน' };

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({ password: pin, data: { must_change_pin: false } });
  if (error) return { error: 'เปลี่ยน PIN ไม่สำเร็จ: ' + error.message };
  return { ok: 'เปลี่ยน PIN เรียบร้อยแล้ว' };
}
