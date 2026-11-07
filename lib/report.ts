import { monthRange } from '@/lib/time';
import { PART_LABEL, type DayPart } from '@/lib/types';

export interface ReportRow {
  company_id: string;
  company_name: string;
  employee_code: string;
  full_name: string;
  leave_date: string;
  leave_type: string;
  reason: string;
  total_hours: number;
  shift_name: string | null;
  day_part: DayPart;
  leave_days: number;
  start_time: string | null;
  end_time: string | null;
  leave_code: string | null;
  pay_deduct: boolean;
  points_per_day: number;
}

/** ข้อความช่วงที่ลา เช่น "ครึ่งแรกของกะ 08:00–12:30" */
export function partLabel(r: Pick<ReportRow, 'day_part' | 'start_time' | 'end_time'>) {
  const t = r.day_part !== 'full' && r.start_time ? ` ${r.start_time.slice(0, 5)}–${(r.end_time ?? '').slice(0, 5)}` : '';
  return `${PART_LABEL[r.day_part ?? 'full']}${t}`;
}

/** ดึงรายงานรายวันของเดือน (วนอ่านทีละ 1,000 แถว เพราะ PostgREST จำกัดต่อคำขอ) */
export async function fetchReport(supabase: any, month: string, companyId?: string | null) {
  const { first, last } = monthRange(month);
  const rows: ReportRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from('leave_daily_report')
      .select(
        'company_id, company_name, employee_code, full_name, leave_date, leave_type, reason, total_hours, shift_name, day_part, leave_days, start_time, end_time, leave_code, pay_deduct, points_per_day',
      )
      .gte('leave_date', first)
      .lte('leave_date', last)
      .order('company_name')
      .order('employee_code')
      .order('leave_date')
      .range(from, from + 999);
    if (companyId) q = q.eq('company_id', companyId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...(data as ReportRow[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export interface SummaryRow {
  company_name: string;
  employee_code: string;
  full_name: string;
  days: number;
  hours: number;
  byType: Record<string, number>;
}

export function summarize(rows: ReportRow[]): SummaryRow[] {
  const map = new Map<string, SummaryRow>();
  for (const r of rows) {
    const key = `${r.company_id}|${r.employee_code}`;
    let s = map.get(key);
    if (!s) {
      s = { company_name: r.company_name, employee_code: r.employee_code, full_name: r.full_name, days: 0, hours: 0, byType: {} };
      map.set(key, s);
    }
    // ลาเต็มกะ = 1 วัน, ครึ่งกะ = 0.5 วัน, ลารายชั่วโมงนับเป็นชั่วโมง (ไม่รวมในวัน)
    s.days += Number(r.leave_days);
    s.hours += Number(r.total_hours) * (r.day_part === 'hours' ? 1 : 0);
    s.byType[r.leave_type] = (s.byType[r.leave_type] ?? 0) + Number(r.leave_days);
  }
  return [...map.values()];
}

export function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV + UTF-8 BOM เพื่อให้ Excel เปิดภาษาไทยไม่เพี้ยน */
export function toCsv(header: string[], lines: unknown[][]) {
  return '﻿' + [header, ...lines].map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
