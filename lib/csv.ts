import { isValidPhone, normalizePhone } from '@/lib/phone';

/** อ่าน CSV/TSV (วางจาก Excel ได้) รองรับ "…" ครอบข้อความ และ BOM */
export function parseDelimited(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delim = firstLine.includes('\t') ? '\t' : firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** ถอดรหัสไฟล์: UTF-8 ก่อน ถ้าไม่ใช่ (CSV ธรรมดาจาก Excel ไทย) ใช้ windows-874 */
export function decodeFile(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-874').decode(buf);
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.()]/g, '');

const ALIASES: Record<string, string[]> = {
  company: ['บริษัท', 'บริษัทลูกค้า', 'company', 'companyname'],
  code: ['รหัสพนักงาน', 'รหัส', 'employeecode', 'code', 'empcode', 'empid', 'employeeid'],
  name: ['ชื่อ-สกุล', 'ชื่อสกุล', 'ชื่อนามสกุล', 'ชื่อ', 'fullname', 'name'],
  phone: ['เบอร์โทร', 'เบอร์โทรศัพท์', 'เบอร์', 'โทรศัพท์', 'phone', 'phonenumber', 'tel', 'mobile'],
  department: ['แผนก', 'department', 'dept'],
  pin: ['pin', 'พิน', 'รหัสผ่าน', 'password'],
};
const DEFAULT_ORDER = ['code', 'name', 'phone', 'department', 'pin'];

export interface ParsedRow {
  line: number;
  companyId: string;
  companyName: string;
  code: string;
  name: string;
  phone: string;
  department: string;
  pin: string;
  error?: string;
}

export function buildRows(
  text: string,
  companies: { id: string; company_name: string }[],
  defaultCompanyId: string,
): { rows: ParsedRow[]; hasCompanyColumn: boolean } {
  const table = parseDelimited(text);
  if (table.length === 0) return { rows: [], hasCompanyColumn: false };

  // หา header
  const head = table[0].map(norm);
  const colOf: Record<string, number> = {};
  for (const [key, names] of Object.entries(ALIASES)) {
    const idx = head.findIndex((h) => names.map(norm).includes(h));
    if (idx >= 0) colOf[key] = idx;
  }
  const hasHeader = Object.keys(colOf).length >= 2;
  let body = table;
  let map = colOf;
  if (hasHeader) body = table.slice(1);
  else map = Object.fromEntries(DEFAULT_ORDER.map((k, i) => [k, i]));

  const byName = new Map(companies.map((c) => [norm(c.company_name), c]));
  const get = (r: string[], k: string) => (map[k] !== undefined ? (r[map[k]] ?? '').trim() : '');

  const rows = body.map((r, i): ParsedRow => {
    const line = i + (hasHeader ? 2 : 1);
    const companyName = get(r, 'company');
    let companyId = defaultCompanyId;
    let error: string | undefined;
    if (map.company !== undefined) {
      const c = byName.get(norm(companyName));
      if (c) companyId = c.id;
      else {
        companyId = '';
        error = `ไม่พบบริษัท "${companyName}"`;
      }
    } else if (!defaultCompanyId) error = 'กรุณาเลือกบริษัท';

    let phone = normalizePhone(get(r, 'phone'));
    // Excel มักตัดเลข 0 หน้าเบอร์มือถือทิ้ง (812345678 → 0812345678)
    if (/^[689]\d{8}$/.test(phone)) phone = '0' + phone;

    const row: ParsedRow = {
      line,
      companyId,
      companyName,
      code: get(r, 'code'),
      name: get(r, 'name'),
      phone,
      department: get(r, 'department'),
      pin: get(r, 'pin'),
    };
    if (!error) {
      if (!row.code) error = 'ไม่มีรหัสพนักงาน';
      else if (!row.name) error = 'ไม่มีชื่อ-สกุล';
      else if (!isValidPhone(phone)) error = 'เบอร์โทรไม่ถูกต้อง';
      else if (row.pin && !/^\d{6}$/.test(row.pin)) error = 'PIN ต้องเป็นตัวเลข 6 หลัก (เว้นว่างเพื่อสุ่มให้)';
    }
    row.error = error;
    return row;
  });

  // รหัส/เบอร์ซ้ำกันภายในไฟล์เดียวกัน (บริษัทเดียวกัน)
  const seenCode = new Set<string>();
  const seenPhone = new Set<string>();
  for (const r of rows) {
    if (r.error) continue;
    const kc = `${r.companyId}|${r.code.toLowerCase()}`;
    const kp = `${r.companyId}|${r.phone}`;
    if (seenCode.has(kc)) r.error = 'รหัสพนักงานซ้ำในไฟล์';
    else if (seenPhone.has(kp)) r.error = 'เบอร์โทรซ้ำในไฟล์';
    seenCode.add(kc);
    seenPhone.add(kp);
  }
  return { rows, hasCompanyColumn: map.company !== undefined };
}
