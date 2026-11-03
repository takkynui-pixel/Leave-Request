'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { createAdmin } from '@/app/actions/admin';
import SubmitButton from '@/components/SubmitButton';

export default function AdminForm({ companies }: { companies: { id: string; company_name: string }[] }) {
  const [state, action] = useFormState(createAdmin, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
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
        <label className="label">ชื่อแอดมิน (แสดงในช่องลงนามอนุมัติ)</label>
        <input name="full_name" className="input" required />
      </div>
      <div>
        <label className="label">อีเมลเข้าสู่ระบบ</label>
        <input type="email" name="email" className="input" required />
      </div>
      <div>
        <label className="label">รหัสผ่านเริ่มต้น (8 ตัวขึ้นไป)</label>
        <input type="text" name="password" className="input" minLength={8} required autoComplete="off" />
      </div>
      <div className="sm:col-span-2">
        {state?.error && <p className="alert-error mb-3">{state.error}</p>}
        {state?.ok && <p className="alert-ok mb-3">{state.ok}</p>}
        <SubmitButton>เพิ่มแอดมิน</SubmitButton>
      </div>
    </form>
  );
}
