export const TENURE: [string, string][] = [
  ['lt1m', 'ไม่เกิน 1 เดือน'],
  ['1to4m', 'มากกว่า 1 เดือน ถึง 4 เดือน (ทดลองงาน)'],
  ['4to6m', 'มากกว่า 4 เดือน ถึง 6 เดือน'],
  ['6mto1y', 'มากกว่า 6 เดือน ถึง 1 ปี'],
  ['1to3y', 'มากกว่า 1 ปี ถึง 3 ปี'],
  ['3to5y', 'มากกว่า 3 ปี ถึง 5 ปี'],
  ['5to10y', 'มากกว่า 5 ปี ถึง 10 ปี'],
  ['gt10y', 'มากกว่า 10 ปี'],
];

export const REASONS: [string, string][] = [
  ['pay', 'ค่าตอบแทน'],
  ['job_nature', 'ลักษณะงาน'],
  ['career_growth', 'ความก้าวหน้าในอาชีพ'],
  ['supervisor', 'หัวหน้างาน'],
  ['coworkers', 'เพื่อนร่วมงาน'],
  ['environment', 'สภาพแวดล้อมในการทำงาน'],
  ['working_time', 'เวลาทำงาน / การเข้างาน'],
  ['travel', 'การเดินทาง'],
  ['family', 'ครอบครัว'],
  ['health', 'สุขภาพ'],
  ['study', 'ศึกษาต่อ'],
  ['contract_end', 'สิ้นสุดสัญญาจ้าง'],
  ['probation_fail', 'ส่งคืนซัพ/ไม่ผ่านทดลองงาน'],
  ['convert_te', 'ปรับเป็นพนักงาน TE'],
  ['other', 'อื่นๆ (ระบุในข้อ 7)'],
];

export const RATINGS: [string, string][] = [
  ['rating_pay', 'ค่าตอบแทนและสวัสดิการ'],
  ['rating_job', 'ลักษณะงาน'],
  ['rating_team', 'หัวหน้างานและเพื่อนร่วมงาน'],
  ['rating_env', 'สภาพแวดล้อมในการทำงาน'],
  ['rating_career', 'ความก้าวหน้าในอาชีพ'],
];

export const tenureLabel = (c: string) => TENURE.find(([k]) => k === c)?.[1] ?? c;
export const reasonLabel = (c: string) => REASONS.find(([k]) => k === c)?.[1] ?? c;

export const MIN_OTHER_DETAIL = 10;

export interface ResignationRow {
  id: string;
  employee_id: string;
  company_id: string;
  tenure: string;
  reason: string;
  detail: string;
  rating_pay: number;
  rating_job: number;
  rating_team: number;
  rating_env: number;
  rating_career: number;
  last_working_date: string;
  status: 'submitted' | 'acknowledged';
  acknowledged_name: string | null;
  acknowledged_at: string | null;
  submitted_at: string;
  employees?: { employee_code: string; full_name: string } | null;
  companies?: { company_name: string } | null;
}
