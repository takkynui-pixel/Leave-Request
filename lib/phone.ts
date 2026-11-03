/** เบอร์ไทย -> ตัวเลขล้วนรูปแบบ 0xxxxxxxxx (รับ +66 / 66 / มีขีดหรือเว้นวรรคได้) */
export function normalizePhone(input: string) {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('66') && d.length === 11) d = '0' + d.slice(2);
  return d;
}

export function isValidPhone(p: string) {
  return /^0\d{8,9}$/.test(p);
}

/** Supabase Auth ใช้อีเมลสังเคราะห์แทนเบอร์โทร (ไม่ต้องจ่ายค่า SMS) */
export function phoneToEmail(input: string) {
  return `${normalizePhone(input)}@phone.vta-leave.app`;
}

export function formatPhone(p: string | null | undefined) {
  if (!p) return '-';
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  if (p.length === 9) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
}
