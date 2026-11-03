'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addDays, formatDateTH, thaiParts } from '@/lib/time';
import type { EmployeeRef, LeaveType } from '@/lib/types';

export interface CutoffWindow {
  serverEpochMs: number;
  cutoff: string; // HH:MM
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'application/pdf'];

export default function LeaveForm({
  employees,
  types,
  windows,
}: {
  employees: EmployeeRef[];
  types: LeaveType[];
  windows: Record<string, CutoffWindow>;
}) {
  const router = useRouter();

  const [employeeId, setEmployeeId] = useState(employees[0].id);
  const emp = employees.find((e) => e.id === employeeId)!;
  const win = windows[emp.company_id];

  // นาฬิกาอ้างอิงเวลาเซิร์ฟเวอร์: offset = เวลาเซิร์ฟเวอร์ - เวลาเครื่องผู้ใช้ ณ ตอนโหลดหน้า
  const [offset] = useState(() => win.serverEpochMs - Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => thaiParts(Date.now() + offset), [tick, offset]);

  const afterCutoff = now.time > win.cutoff;
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState(afterCutoff ? addDays(now.date, 1) : now.date);
  const [end, setEnd] = useState(afterCutoff ? addDays(now.date, 1) : now.date);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const type = types.find((t) => t.id === typeId);
  const needFile = !!type?.requires_attachment;
  const backdated = start < now.date;
  const pastCutoff = start === now.date && afterCutoff;
  const badRange = end < start;
  const sameDay = start === end;

  const days = badRange ? 0 : Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;

  const blocker = backdated
    ? 'ไม่สามารถแจ้งลาย้อนหลังได้ กรุณาติดต่อ Admin'
    : pastCutoff
      ? `เกินกำหนดเวลาส่งแจ้งลาของวันนี้ (${win.cutoff} น.) กรุณาติดต่อ Admin หรือหัวหน้างาน`
      : badRange
        ? 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม'
        : '';

  const canSubmit =
    !busy && !blocker && !!typeId && reason.trim().length > 0 && (!needFile || !!file) &&
    (startTime === '') === (endTime === '');

  function pickFile(f: File | null) {
    setError('');
    if (f) {
      if (!ALLOWED.includes(f.type)) return setError('รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF');
      if (f.size > MAX_BYTES) return setError('ไฟล์ต้องมีขนาดไม่เกิน 5MB');
    }
    setFile(f);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    const supabase = createClient();

    let path: string | null = null;
    if (file) {
      const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
      path = `${employeeId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('leave-documents')
        .upload(path, file, { contentType: file.type });
      if (upErr) {
        setBusy(false);
        return setError('อัปโหลดไฟล์ไม่สำเร็จ: ' + upErr.message);
      }
    }

    const { error: insErr } = await supabase.from('leave_requests').insert({
      employee_id: employeeId,
      leave_type_id: typeId,
      start_date: start,
      end_date: end,
      start_time: sameDay && startTime ? startTime : null,
      end_time: sameDay && endTime ? endTime : null,
      reason: reason.trim(),
      attachment_path: path,
    });

    if (insErr) {
      if (path) await supabase.storage.from('leave-documents').remove([path]);
      setBusy(false);
      return setError(insErr.message); // ข้อความภาษาไทยจาก trigger (เช่น เกินเวลา cut-off)
    }
    router.push('/?submitted=1');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm">
          <span className="font-medium text-brand-700">ยื่นลาของวันนี้ได้ถึง {win.cutoff} น.</span>
          <span className="text-slate-500">
            เวลาปัจจุบัน {now.time} น. ({formatDateTH(now.date)})
          </span>
        </div>

        {employees.length > 1 && (
          <div>
            <label className="label">บริษัท / รหัสพนักงาน</label>
            <select className="input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.company_name} — {e.employee_code}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-slate-400">ชื่อ-สกุล</p>
            <p className="font-medium">{emp.full_name}</p>
          </div>
          <div>
            <p className="text-slate-400">รหัสพนักงาน</p>
            <p className="font-medium">{emp.employee_code}</p>
          </div>
          <div>
            <p className="text-slate-400">บริษัท</p>
            <p className="font-medium">{emp.company_name}</p>
          </div>
        </div>

        <div>
          <label className="label">ประเภทการลา</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {types.map((t) => (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                  typeId === t.id
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 ring-4 ring-brand-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  className="accent-brand-600"
                  checked={typeId === t.id}
                  onChange={() => setTypeId(t.id)}
                />
                <span className="flex-1">{t.name}</span>
                {t.requires_attachment && <span title="ต้องแนบเอกสาร">📎</span>}
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">ตั้งแต่วันที่</label>
            <input
              type="date"
              className="input"
              value={start}
              min={now.date}
              onChange={(e) => {
                setStart(e.target.value);
                if (end < e.target.value) setEnd(e.target.value);
              }}
              required
            />
          </div>
          <div>
            <label className="label">ถึงวันที่</label>
            <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
          </div>
        </div>

        {sameDay && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">เวลาเริ่ม (ลาเป็นชั่วโมง — ไม่บังคับ)</label>
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label className="label">เวลาสิ้นสุด</label>
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        )}

        <p className="text-sm text-slate-500">
          จำนวนวันลา: <b className="text-ink">{days} วัน</b>
          {!!startTime && !!endTime && sameDay && ' (คำนวณเป็นชั่วโมงตามเวลาที่ระบุ)'}
        </p>

        <div>
          <label className="label">
            เหตุผลการลา <span className="text-rose-500">*</span>
          </label>
          <textarea
            className="input min-h-[96px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="เช่น ไปพบแพทย์ / ธุระส่วนตัว"
            required
          />
        </div>

        {(needFile || type) && (
          <div>
            <label className="label">
              แนบเอกสาร / ใบรับรองแพทย์ {needFile ? <span className="text-rose-500">* จำเป็น</span> : '(ถ้ามี)'}
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="input file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-slate-400">JPG, PNG หรือ PDF ขนาดไม่เกิน 5MB (ถ่ายรูปจากมือถือได้)</p>
          </div>
        )}
      </section>

      {blocker && <p className="alert-error font-medium">{blocker}</p>}
      {error && <p className="alert-error">{error}</p>}

      <div className="flex justify-end gap-3">
        <button type="button" className="btn-ghost" onClick={() => router.push('/')}>
          ยกเลิก
        </button>
        <button type="submit" className="btn-primary !px-8" disabled={!canSubmit}>
          {busy ? 'กำลังส่ง…' : 'ส่งใบลา'}
        </button>
      </div>
    </form>
  );
}
