'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { submitResignation } from '@/app/actions/resign';
import SubmitButton from '@/components/SubmitButton';
import { MIN_OTHER_DETAIL, RATINGS, REASONS, TENURE } from '@/lib/resign';
import type { EmployeeRef } from '@/lib/types';

export default function ResignForm({ employees, today }: { employees: EmployeeRef[]; today: string }) {
  const [state, action] = useFormState(submitResignation, undefined);
  const [reason, setReason] = useState('');
  const other = reason === 'other';

  return (
    <form action={action} className="space-y-5">
      <section className="card space-y-4">
        {employees.length > 1 ? (
          <div>
            <label className="label">รหัสพนักงาน / บริษัท *</label>
            <select name="employee_id" className="input" required>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.company_name} · {e.employee_code} · {e.full_name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <input type="hidden" name="employee_id" value={employees[0].id} />
            <p className="text-sm text-slate-500">
              {employees[0].company_name} · <span className="font-medium text-ink">{employees[0].employee_code}</span> ·{' '}
              {employees[0].full_name}
            </p>
          </>
        )}
        <div className="max-w-xs">
          <label className="label">วันทำงานวันสุดท้าย *</label>
          <input type="date" name="last_working_date" min={today} required className="input" />
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">5. อายุงาน <span className="text-rose-500">*</span></h2>
        <div className="space-y-1">
          {TENURE.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-brand-50">
              <input type="radio" name="tenure" value={k} required className="h-4 w-4 accent-brand-600" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">6. เหตุผลการลาออก <span className="text-rose-500">*</span></h2>
        <div className="space-y-1">
          {REASONS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-brand-50">
              <input
                type="radio"
                name="reason"
                value={k}
                required
                checked={reason === k}
                onChange={() => setReason(k)}
                className="h-4 w-4 accent-brand-600"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">7. กรุณาอธิบายเหตุผลเพิ่มเติม <span className="text-rose-500">*</span></h2>
        {other && (
          <p className="mb-2 text-sm text-amber-600">
            คุณเลือก “อื่นๆ” — กรุณาระบุเหตุผลที่แท้จริงในช่องนี้ (อย่างน้อย {MIN_OTHER_DETAIL} ตัวอักษร)
          </p>
        )}
        <textarea
          name="detail"
          rows={4}
          required
          minLength={other ? MIN_OTHER_DETAIL : 1}
          maxLength={2000}
          className="input"
          placeholder="พิมพ์คำตอบของคุณ"
        />
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">8. โปรดให้คะแนนความพึงพอใจ (1–5) <span className="text-rose-500">*</span></h2>
        <div className="table-wrap">
          <table className="w-full min-w-[460px] text-sm">
            <thead>
              <tr className="text-slate-500">
                <th />
                {[5, 4, 3, 2, 1].map((n) => (
                  <th key={n} className="w-14 py-2 text-center font-medium">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RATINGS.map(([key, label], i) => (
                <tr key={key} className={i % 2 === 0 ? 'bg-slate-50' : ''}>
                  <td className="rounded-l-2xl py-3 pl-3 font-medium">{label}</td>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <td key={n} className="py-3 text-center">
                      <input
                        type="radio"
                        name={key}
                        value={n}
                        required
                        aria-label={`${label} ${n}`}
                        className="h-4 w-4 accent-brand-600"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">5 = พึงพอใจมากที่สุด · 1 = พึงพอใจน้อยที่สุด</p>
      </section>

      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="flex justify-end">
        <SubmitButton pendingText="กำลังส่ง…">ส่งแบบฟอร์มลาออก</SubmitButton>
      </div>
    </form>
  );
}
