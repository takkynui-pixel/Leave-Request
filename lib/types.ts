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
  leave_types: { name: string; code: string } | null;
  employees?: { employee_code: string; full_name: string } | null;
  companies?: { company_name: string } | null;
}
