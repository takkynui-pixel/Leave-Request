'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { saveLeaveType } from '@/app/actions/rules';
import SubmitButton from '@/components/SubmitButton';

export interface TypeRow {
  id: string;
  code: string;
  name: string;
  name_alt: string | null;
  min_days: number | null;
  max_days: number | null;
  pay_deduct: boolean;
  points_per_day: number;
  requires_attachment: boolean;
  active: boolean;
}

const field =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100';

function Num({ label, name, value, step = '0.5', hint }: { label: string; name: string; value?: number | null; step?: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input name={name} type="number" min="0" step={step} defaultValue={value ?? ''} placeholder={hint} className={field} />
    </label>
  );
}

export default function TypeForm({ companyId, row }: { companyId: string; row?: TypeRow }) {
  const [state, action] = useFormState(saveLeaveType, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && !row) ref.current?.reset(); // เพิ่มใหม่สำเร็จ → ล้างฟอร์ม
  }, [state, row]);

  return (
    <form
      ref={ref}
      action={action}
      className={`rounded-3xl border p-4 ${row && !row.active ? 'border-dashed border-slate-200 bg-slate-50 opacity-70' : 'border-slate-100 bg-white'}`}
    >
      <input type="hidden" name="company_id" value={companyId} />
      {row && <input type="hidden" name="id" value={row.id} />}

      <div className="grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">รหัส</span>
          <input name="code" defaultValue={row?.code} required maxLength={12} placeholder="AL" className={`${field} font-semibold uppercase`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">ชื่อ (ภาษาไทย)</span>
          <input name="name" defaultValue={row?.name} required placeholder="AL-ลาหยุดพักผ่อนประจำปี" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">ชื่ออังกฤษ (ไม่บังคับ)</span>
          <input name="name_alt" defaultValue={row?.name_alt ?? ''} placeholder="Annual Leave" className={field} />
        </label>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Num label="ขั้นต่ำต่อครั้ง (วัน)" name="min_days" value={row?.min_days} hint="ไม่จำกัด" />
        <Num label="สูงสุดต่อครั้ง (วัน)" name="max_days" value={row?.max_days} hint="ไม่จำกัด" />
        <Num label="หักแต้ม / วัน" name="points_per_day" value={row?.points_per_day ?? 0} step="0.5" />
        <div className="col-span-2 flex flex-col justify-end gap-1.5 text-sm sm:col-span-1">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="pay_deduct" defaultChecked={row?.pay_deduct} className="h-4 w-4 accent-brand-600" />
            หักค่าจ้าง
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="requires_attachment" defaultChecked={row?.requires_attachment} className="h-4 w-4 accent-brand-600" />
            ต้องแนบเอกสาร
          </label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-4 text-sm">
          {row && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={row.active} className="h-4 w-4 accent-brand-600" />
              เปิดใช้
            </label>
          )}
          {state?.ok && <span className="text-emerald-600">✓ {state.ok}</span>}
          {state?.error && <span className="text-rose-600">{state.error}</span>}
        </div>
        <SubmitButton className="btn-primary btn-sm">{row ? 'บันทึก' : '+ เพิ่มประเภทการลา'}</SubmitButton>
      </div>
    </form>
  );
}
