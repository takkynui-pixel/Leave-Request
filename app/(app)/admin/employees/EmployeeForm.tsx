'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { createEmployee } from '@/app/actions/admin';
import SubmitButton from '@/components/SubmitButton';

export default function EmployeeForm({ companies }: { companies: { id: string; company_name: string }[] }) {
  const [state, action] = useFormState(createEmployee, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="label">บริษัท</label>
        <select name="company_id" className="input" required defaultValue="">
          <option value="" disabled>
            เลือกบริษัท
          </option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">รหัสพนักงาน</label>
        <input name="employee_code" className="input" required placeholder="เช่น SBA524" />
      </div>
      <div>
        <label className="label">ชื่อ-สกุล</label>
        <input name="full_name" className="input" required />
      </div>
      <div>
        <label className="label">แผนก (ถ้ามี)</label>
        <input name="department" className="input" />
      </div>
      <div>
        <label className="label">เบอร์โทร (ใช้เข้าสู่ระบบ)</label>
        <input name="phone" className="input" inputMode="tel" required placeholder="08x-xxx-xxxx" />
      </div>
      <div>
        <label className="label">PIN เริ่มต้น (ตัวเลข 6 หลัก)</label>
        <input name="pin" className="input" inputMode="numeric" maxLength={6} pattern="\d{6}" required />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        {state?.error && <p className="alert-error mb-3">{state.error}</p>}
        {state?.ok && <p className="alert-ok mb-3">{state.ok}</p>}
        <SubmitButton>เพิ่มพนักงาน</SubmitButton>
      </div>
    </form>
  );
}
