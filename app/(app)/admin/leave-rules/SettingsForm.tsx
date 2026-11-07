'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { saveLeaveSettings } from '@/app/actions/rules';
import SubmitButton from '@/components/SubmitButton';

export interface Settings {
  allow_full: boolean;
  allow_half: boolean;
  allow_hours: boolean;
  max_hours: number | null;
  note: string | null;
}

export default function SettingsForm({ companyId, settings }: { companyId: string; settings: Settings }) {
  const [state, action] = useFormState(saveLeaveSettings, undefined);
  const [hours, setHours] = useState(settings.allow_hours);

  const Box = ({ name, label, hint, checked, onChange }: { name: string; label: string; hint?: string; checked?: boolean; onChange?: (v: boolean) => void }) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm hover:bg-slate-50">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 h-4 w-4 accent-brand-600"
      />
      <span>
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </label>
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="company_id" value={companyId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Box name="allow_full" label="ลาเต็มกะ / เต็มวัน" checked={settings.allow_full} />
        <Box name="allow_half" label="ลาครึ่งกะ" hint="ครึ่งแรก / ครึ่งหลัง (ครึ่งเช้า / ครึ่งบ่าย)" checked={settings.allow_half} />
        <Box name="allow_hours" label="ลาระบุชั่วโมง" checked={settings.allow_hours} onChange={setHours} />
      </div>

      {hours && (
        <label className="flex max-w-xs items-center gap-3 text-sm">
          <span className="whitespace-nowrap text-slate-600">ลารายชั่วโมงได้ไม่เกิน</span>
          <input
            name="max_hours"
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            defaultValue={settings.max_hours ?? ''}
            placeholder="ไม่จำกัด"
            className="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          />
          <span className="text-slate-600">ชม./ครั้ง</span>
        </label>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-600">ข้อความแจ้งเตือนบนฟอร์มลา (ไม่บังคับ)</span>
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          defaultValue={settings.note ?? ''}
          placeholder="เช่น กรณีลากิจหรือลาป่วย ก่อนพักเที่ยงเกิน 4 ชั่วโมงขึ้นไป จะถือเป็นลาเต็มวัน"
          className="input"
        />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {state?.ok && <span className="text-emerald-600">✓ {state.ok}</span>}
          {state?.error && <span className="text-rose-600">{state.error}</span>}
        </div>
        <SubmitButton className="btn-primary">บันทึก</SubmitButton>
      </div>
    </form>
  );
}
