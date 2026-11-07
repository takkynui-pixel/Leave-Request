'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { updateShift } from '@/app/actions/admin';
import SubmitButton from '@/components/SubmitButton';
import TimeField from '@/components/TimeField';

interface ShiftRow {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  open_time: string;
  close_time: string;
  half1_start: string | null;
  half1_end: string | null;
  half2_start: string | null;
  half2_end: string | null;
  active?: boolean;
}

const hm = (t: string | null) => (t ? t.slice(0, 5) : '');
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fromMin = (n: number) => {
  const x = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid items-center gap-x-4 gap-y-1 border-t border-slate-100 py-3.5 sm:grid-cols-[132px_1fr]">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        {hint && <p className="text-xs text-slate-400">{hint}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}

function Range({
  a,
  b,
  onA,
  onB,
  nameA,
  nameB,
}: {
  a: string;
  b: string;
  onA: (v: string) => void;
  onB: (v: string) => void;
  nameA: string;
  nameB: string;
}) {
  return (
    <>
      <TimeField name={nameA} value={a} onChange={onA} />
      <span className="text-sm text-slate-400">ถึง</span>
      <TimeField name={nameB} value={b} onChange={onB} />
    </>
  );
}

export default function ShiftForm({ shift, companyMode = false }: { shift: ShiftRow; companyMode?: boolean }) {
  const [state, action] = useFormState(updateShift, undefined);

  const [v, setV] = useState({
    start: hm(shift.start_time),
    end: hm(shift.end_time),
    open: hm(shift.open_time),
    close: hm(shift.close_time),
    h1s: hm(shift.half1_start),
    h1e: hm(shift.half1_end),
    h2s: hm(shift.half2_start),
    h2e: hm(shift.half2_end),
  });
  const set = (k: keyof typeof v) => (val: string) => setV((p) => ({ ...p, [k]: val }));
  const [custom, setCustom] = useState(!!shift.half1_start);

  const crosses = toMin(v.end) <= toMin(v.start);

  function toggleCustom(on: boolean) {
    if (on && !v.h1s) {
      // ค่าตั้งต้น = ตัดครึ่งเวลากะ แล้วให้ปรับต่อ
      const len = ((toMin(v.end) - toMin(v.start)) % 1440 + 1440) % 1440 || 1440;
      const mid = fromMin(toMin(v.start) + len / 2);
      setV((p) => ({ ...p, h1s: p.start, h1e: mid, h2s: mid, h2e: p.end }));
    }
    setCustom(on);
  }

  return (
    <form action={action} className={`card flex flex-col ${companyMode && shift.active === false ? 'opacity-70' : ''}`}>
      <input type="hidden" name="id" value={shift.id} />
      {companyMode && <input type="hidden" name="has_active" value="1" />}

      <div className="mb-3 flex items-center gap-3">
        <input
          name="name"
          defaultValue={shift.name}
          required
          aria-label="ชื่อกะ"
          className="min-w-0 flex-1 rounded-xl border border-transparent bg-slate-50 px-3 py-2 text-lg font-semibold outline-none transition hover:border-slate-200 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
        />
        {crosses && <span className="badge whitespace-nowrap bg-indigo-50 text-indigo-600">ข้ามเที่ยงคืน</span>}
      </div>

      <Row label="เวลาทำงาน">
        <Range a={v.start} b={v.end} onA={set('start')} onB={set('end')} nameA="start" nameB="end" />
      </Row>

      <Row label="ยื่นลาวันนี้ได้" hint="ลาล่วงหน้าวันอื่นยื่นได้ตลอด">
        <Range a={v.open} b={v.close} onA={set('open')} onB={set('close')} nameA="open" nameB="close" />
      </Row>

      <Row label="ลาครึ่งกะ">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={custom}
            onChange={(e) => toggleCustom(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          <span>{custom ? 'ตั้งเวลาเอง (เช่น มีช่วงพักคั่น)' : 'ตัดครึ่งเวลากะให้อัตโนมัติ'}</span>
        </label>
      </Row>

      {custom && (
        <>
          <Row label="ครึ่งแรก">
            <Range a={v.h1s} b={v.h1e} onA={set('h1s')} onB={set('h1e')} nameA="h1s" nameB="h1e" />
          </Row>
          <Row label="ครึ่งหลัง">
            <Range a={v.h2s} b={v.h2e} onA={set('h2s')} onB={set('h2e')} nameA="h2s" nameB="h2e" />
          </Row>
        </>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-4 text-sm">
          {companyMode && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={shift.active !== false} className="h-4 w-4 accent-brand-600" />
              เปิดใช้กะนี้
            </label>
          )}
          {state?.ok && <span className="text-emerald-600">✓ {state.ok}</span>}
          {state?.error && <span className="text-rose-600">{state.error}</span>}
        </div>
        <SubmitButton className="btn-primary">บันทึก</SubmitButton>
      </div>
    </form>
  );
}
