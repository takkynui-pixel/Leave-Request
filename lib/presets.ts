/** ชุดประเภทการลาตัวอย่าง (ตามตารางโค้ดการลา) — กดใช้แล้วแก้ไขต่อได้ */
export interface TypePreset {
  code: string;
  name: string;
  name_alt: string;
  min_days: number | null;
  max_days: number | null;
  pay_deduct: boolean;
  points_per_day: number;
}

export const SAMPLE_TYPES: TypePreset[] = [
  { code: 'AL', name: 'AL-ลาหยุดพักผ่อนประจำปี', name_alt: 'Annual Leave', min_days: 0.5, max_days: null, pay_deduct: false, points_per_day: 0 },
  { code: 'PL', name: 'PL-ลากิจ', name_alt: 'Private Business Leave', min_days: 0.5, max_days: null, pay_deduct: false, points_per_day: 0 },
  { code: 'SL', name: 'SL-ลาป่วยทั้งวัน', name_alt: 'Sick Leave', min_days: 1, max_days: null, pay_deduct: false, points_per_day: 3 },
  { code: 'SS', name: 'SS-ลาป่วยช่วงสั้น', name_alt: 'Short Sick Leave', min_days: null, max_days: null, pay_deduct: false, points_per_day: 1 },
  { code: 'SW', name: 'SW-ลาป่วยเนื่องจากงาน', name_alt: 'Work Accident', min_days: null, max_days: null, pay_deduct: false, points_per_day: 0 },
  { code: 'CC', name: 'CC-ลาเพื่อประกอบพิธีศพ บิดา มารดาของพนักงาน', name_alt: 'Funeral Leave (Family)', min_days: null, max_days: 5, pay_deduct: false, points_per_day: 0 },
  { code: 'LB', name: 'LB-ลาไม่ได้รับค่าจ้าง', name_alt: 'Unpaid Leave', min_days: 1, max_days: null, pay_deduct: true, points_per_day: 3 },
  { code: 'LA', name: 'LA-ขาดงานโดยไม่ได้รับการอนุมัติ', name_alt: 'Long Absent without approval', min_days: null, max_days: null, pay_deduct: true, points_per_day: 3 },
  { code: 'ABL', name: 'ABL-มาสาย,กลับก่อน', name_alt: 'Absent Leave', min_days: null, max_days: null, pay_deduct: true, points_per_day: 1 },
];
