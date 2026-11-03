'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { createCompany } from '@/app/actions/admin';
import SubmitButton from '@/components/SubmitButton';

export default function CompanyForm() {
  const [state, action] = useFormState(createCompany, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="mt-5 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-5">
      <div className="min-w-[220px] flex-1">
        <label className="label">เพิ่มบริษัทลูกค้า</label>
        <input name="company_name" className="input" placeholder="ชื่อบริษัท" required />
      </div>
      <div>
        <label className="label">เวลาปิดรับ</label>
        <input type="time" name="time" defaultValue="10:00" className="input" required />
      </div>
      <SubmitButton>เพิ่มบริษัท</SubmitButton>
      {state?.error && <p className="alert-error w-full">{state.error}</p>}
      {state?.ok && <p className="alert-ok w-full">{state.ok}</p>}
    </form>
  );
}
