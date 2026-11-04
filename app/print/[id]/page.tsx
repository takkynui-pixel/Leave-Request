import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDateTH, formatDateTimeTH } from '@/lib/time';
import { formatPhone } from '@/lib/phone';
import PrintButton from '@/components/PrintButton';
import { PART_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

const TYPE_ORDER = [
  ['annual', 'ลาพักผ่อนประจำปี'],
  ['sick_no_cert', 'ลาป่วย (ไม่มีใบรับรองแพทย์)'],
  ['personal', 'ลากิจส่วนตัว'],
  ['personal_paid', 'ลากิจได้รับค่าจ้าง (แนบเอกสาร)'],
  ['sick_cert', 'ลาป่วย (มีใบรับรองแพทย์)'],
  ['other', 'ลาอื่นๆ'],
] as const;

const box = (on: boolean) => (on ? '☑' : '☐');

export default async function PrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('leave_requests')
    .select(
      '*, leave_types(code, name), shifts(name), employees(employee_code, full_name, department, phone_number), companies(company_name)',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!data) notFound();

  const r: any = data;
  const emp = Array.isArray(r.employees) ? r.employees[0] : r.employees;
  const comp = Array.isArray(r.companies) ? r.companies[0] : r.companies;
  const lt = Array.isArray(r.leave_types) ? r.leave_types[0] : r.leave_types;
  const shift = Array.isArray(r.shifts) ? r.shifts[0] : r.shifts;
  const approved = r.status === 'approved';
  const rejected = r.status === 'rejected';

  return (
    <div className="p-3 sm:p-6">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between">
        <p className="text-sm text-slate-500">ตัวอย่างก่อนพิมพ์ (A4) — เลือก “บันทึกเป็น PDF” ได้จากหน้าต่างพิมพ์</p>
        <PrintButton />
      </div>

      <div className="paper">
        <table>
          <tbody>
            <tr>
              <td colSpan={2} style={{ borderBottom: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/vta-logo.png" alt="VTA Service" style={{ height: 44 }} />
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, borderTop: 0 }}>
                ใบลา
              </td>
            </tr>
            <tr>
              <td style={{ width: '56%' }}>
                <p>
                  <b>ชื่อ-สกุล:</b> {emp?.full_name}
                </p>
                <p>
                  <b>รหัสพนักงาน:</b> {emp?.employee_code} &nbsp;&nbsp; <b>แผนก:</b> {emp?.department || '-'}
                </p>
                <p>
                  <b>บริษัทลูกค้า:</b> {comp?.company_name}
                </p>
                <p style={{ marginTop: 8 }}>
                  <b>ประเภทการลา:</b>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 10px' }}>
                  {TYPE_ORDER.map(([code, label]) => (
                    <span key={code}>
                      {box(lt?.code === code)} {label}
                    </span>
                  ))}
                </div>
                <p style={{ marginTop: 8 }}>
                  <b>เอกสารแนบ:</b> {r.attachment_path ? '📎 มี (เก็บในระบบ)' : '-'}
                </p>
              </td>
              <td>
                <p>
                  <b>วันที่:</b> {formatDateTH(r.start_date)}
                </p>
                <p>
                  <b>ถึงวันที่:</b> {formatDateTH(r.end_date)}
                </p>
                <p>
                  <b>จำนวน:</b> {Number(r.total_days)} วัน {Number(r.total_hours)} ชั่วโมง
                </p>
                <p>
                  <b>กะ:</b> {shift?.name ?? '-'} &nbsp; <b>ช่วงที่ลา:</b> {PART_LABEL[(r.day_part as keyof typeof PART_LABEL) ?? 'full']}
                </p>
                <p>
                  <b>เวลา:</b> {r.start_time ? r.start_time.slice(0, 5) : '-'} ถึง {r.end_time ? r.end_time.slice(0, 5) : '-'}
                </p>
                <p style={{ marginTop: 8 }}>
                  <b>เหตุผลการลา:</b>
                </p>
                <p>{r.reason}</p>
              </td>
            </tr>
            <tr>
              <td>
                <b>ลายเซ็นผู้ขอลา:</b> {emp?.full_name}
                <br />
                <b>วันที่ยื่นเรื่อง:</b> {formatDateTimeTH(r.submitted_at)}
              </td>
              <td>
                <b>เบอร์โทรศัพท์:</b> {formatPhone(emp?.phone_number)}
              </td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>ผู้บังคับบัญชา {comp?.company_name}</td>
              <td style={{ textAlign: 'center', fontWeight: 700 }}>ผู้บังคับบัญชาของ VTA</td>
            </tr>
            <tr>
              <td style={{ height: 150 }}>
                <p>☐ รับทราบ</p>
                <p style={{ marginTop: 40 }}>ลงชื่อ ................................................ หัวหน้างาน (Leader)</p>
                <p style={{ marginTop: 14 }}>ลงชื่อ ................................................ หัวหน้าแผนก (Super)</p>
              </td>
              <td>
                <p>
                  {box(approved)} อนุมัติ &nbsp;&nbsp; {box(rejected)} ไม่อนุมัติ
                </p>
                <p>
                  <b>เหตุผล:</b> {r.admin_remark || '-'}
                </p>
                <p style={{ marginTop: 28 }}>
                  ลงชื่อ <b>{r.reviewed_by_name ?? '................................'}</b> ผู้จัดการฝ่ายบุคคล
                </p>
                <p>
                  <b>วันที่อนุมัติ:</b> {r.reviewed_at ? formatDateTimeTH(r.reviewed_at) : '................'}
                </p>
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ fontSize: 12 }}>
                <b>หมายเหตุ:</b> กรณีที่ผู้บังคับบัญชาลงชื่ออนุมัติเรียบร้อยแล้ว ให้นำเอกสารส่งงานบุคคล บริษัท วีทีเอ เซอร์วิส จำกัด
                ในวันถัดไปทันที หรือไม่เกิน 3 วัน
              </td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: 6, fontSize: 10, color: '#666' }}>HR-009/Rev.-02 · พิมพ์จากระบบแจ้งลาออนไลน์</p>
      </div>
    </div>
  );
}
