'use client';

import { useFormState } from 'react-dom';
import { updateEmployee } from '@/app/actions/admin';
import SubmitButton from '@/components/SubmitButton';

interface Emp {
  id: string;
  company_id: string;
  employee_code: string;
  full_name: string;
  department: string | null;
  phone_number: string;
}

export default function EditForm({
  emp,
  companies,
  hasLeaves,
}: {
  emp: Emp;
  companies: { id: string; company_name: string }[];
  hasLeaves: boolean;
}) {
  const [state, action] = useFormState(updateEmployee, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={emp.id} />
      <div>
        <label className="label">บริษัท</label>
        {hasLeaves ? (
          <>
            <input type="hidden" name="company_id" value={emp.company_id} />
            <select className="input" value={emp.company_id} disabled>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">มีประวัติการลาแล้ว จึงย้ายบริษัทไม่ได้</p>
          </>
        ) : (
          <select name="company_id" className="input" defaultValue={emp.company_id} required>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div>
        <label className="label">รหัสพนักงาน</label>
        <input name="employee_code" className="input" defaultValue={emp.employee_code} required />
      </div>
      <div>
        <label className="label">ชื่อ-สกุล</label>
        <input name="full_name" className="input" defaultValue={emp.full_name} required />
      </div>
      <div>
        <label className="label">แผนก</label>
        <input name="department" className="input" defaultValue={emp.department ?? ''} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">เบอร์โทร (ใช้เข้าสู่ระบบ)</label>
        <input name="phone" className="input sm:max-w-xs" inputMode="tel" defaultValue={emp.phone_number} required />
        <p className="mt-1 text-xs text-slate-400">หากเปลี่ยนเบอร์ พนักงานต้องเข้าสู่ระบบด้วยเบอร์ใหม่ (PIN เดิมยังใช้ได้ในกรณีทั่วไป)</p>
      </div>
      <div className="sm:col-span-2">
        {state?.error && <p className="alert-error mb-3">{state.error}</p>}
        {state?.ok && <p className="alert-ok mb-3">{state.ok}</p>}
        <SubmitButton>บันทึกการแก้ไข</SubmitButton>
      </div>
    </form>
  );
}
