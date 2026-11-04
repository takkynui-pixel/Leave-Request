export type LeaveStatus = 'submitted' | 'approved' | 'rejected' | 'cancelled';

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  submitted: 'รออนุมัติ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
  cancelled: 'ยกเลิก',
};

export const STATUS_CLASS: Record<LeaveStatus, string> = {
  submitted: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-600',
  cancelled: 'bg-slate-100 text-slate-500',
};

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  requires_attachment: boolean;
}

export interface Company {
  id: string;
  company_name: string;
  leave_cutoff_time: string;
}

export interface EmployeeRef {
  id: string;
  company_id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  phone_number: string;
  company_name: string;
}

export type DayPart = 'full' | 'first_half' | 'second_half' | 'hours';

export const PART_LABEL: Record<DayPart, string> = {
  full: 'เต็มกะ',
  first_half: 'ครึ่งแรกของกะ',
  second_half: 'ครึ่งหลังของกะ',
  hours: 'ระบุชั่วโมง',
};

export interface Shift {
  id: string;
  code: string;
  name: string;
  start: string; // HH:MM
  end: string;
  open: string; // เริ่มรับแจ้งลาของวันนี้
  close: string; // ปิดรับแจ้งลาของวันนี้
}

const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

/** ข้อความช่วงที่ลา เช่น "กะเช้า · ครึ่งแรกของกะ (08:00–12:30)" */
export function partText(r: {
  day_part?: DayPart | null;
  start_time?: string | null;
  end_time?: string | null;
  shifts?: { name: string } | null;
}) {
  const part = r.day_part ?? 'full';
  const times = part !== 'full' && r.start_time ? ` (${hm(r.start_time)}–${hm(r.end_time)})` : '';
  const shift = r.shifts?.name ? `${r.shifts.name} · ` : '';
  return `${shift}${PART_LABEL[part]}${times}`;
}

export function leaveAmount(r: { total_days: number | string; total_hours: number | string }) {
  return Number(r.total_days) > 0 ? `${Number(r.total_days)} วัน` : `${Number(r.total_hours)} ชม.`;
}

export interface LeaveRow {
  id: string;
  employee_id: string;
  company_id: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  total_days: number;
  total_hours: number;
  reason: string;
  attachment_path: string | null;
  status: LeaveStatus;
  submitted_at: string;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  admin_remark: string | null;
  day_part: DayPart;
  shift_id: string | null;
  shifts?: { name: string } | null;
  leave_types: { name: string; code: string } | null;
  employees?: { employee_code: string; full_name: string } | null;
  companies?: { company_name: string } | null;
}
