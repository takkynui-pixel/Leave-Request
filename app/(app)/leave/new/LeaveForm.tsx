'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { addDays, formatDateTH, thaiParts } from '@/lib/time';
import { PART_LABEL, type DayPart, type EmployeeRef, type LeaveOptions, type LeaveType, type Shift } from '@/lib/types';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'application/pdf'];

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (n: number) => {
  const x = ((n % 1440) + 1440) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`;
};
/** ความยาวกะเป็นนาที (ข้ามเที่ยงคืนได้) */
const shiftLen = (s: Shift) => {
  const d = toMin(s.end) - toMin(s.start);
  return d > 0 ? d : d + 1440;
};

const PARTS: DayPart[] = ['full', 'first_half', 'second_half', 'hours'];

/** เงื่อนไขของประเภทการลา เช่น "ขั้นต่ำ 1 วัน · สูงสุด 5 วัน · หักค่าจ้าง · หัก 3 แต้ม/วัน" */
function typeRules(t: LeaveType) {
  const out: string[] = [];
  if (t.min_days != null) out.push(`ขั้นต่ำ ${Number(t.min_days)} วัน`);
  if (t.max_days != null) out.push(`สูงสุด ${Number(t.max_days)} วัน`);
  if (t.pay_deduct) out.push('หักค่าจ้าง');
  if (Number(t.points_per_day) > 0) out.push(`หัก ${Number(t.points_per_day)} แต้ม/วัน`);
  return out.join(' · ');
}

const partsOf = (o: LeaveOptions): DayPart[] =>
  PARTS.filter((p) => (p === 'full' ? o.settings.allow_full : p === 'hours' ? o.settings.allow_hours : o.settings.allow_half));

export default function LeaveForm({
  employees,
  options,
  serverEpochMs,
}: {
  employees: EmployeeRef[];
  options: Record<string, LeaveOptions>;
  serverEpochMs: number;
}) {
  const router = useRouter();

  // นาฬิกาอ้างอิงเวลาเซิร์ฟเวอร์: offset = เวลาเซิร์ฟเวอร์ - เวลาเครื่องผู้ใช้ ณ ตอนโหลดหน้า
  const [offset] = useState(() => serverEpochMs - Date.now());
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => thaiParts(Date.now() + offset), [tick, offset]);
  const inWindow = (s: Shift) => now.time >= s.open && now.time <= s.close;

  const [employeeId, setEmployeeId] = useState(employees[0].id);
  const emp = employees.find((e) => e.id === employeeId)!;
  // ตัวเลือกของบริษัทที่เลือก (ประเภทการลา/กะ/ช่วงที่ลา ต่างกันตามบริษัท)
  const opt = options[emp.company_id];
  const { shifts, types, settings } = opt;
  const parts = partsOf(opt);

  // เริ่มต้น: เลือกกะที่กำลังเปิดรับอยู่ ถ้าไม่มี → กะแรก และตั้งวันลาเป็นพรุ่งนี้
  const [shiftId, setShiftId] = useState(() => (shifts.find(inWindow) ?? shifts[0])?.id ?? '');
  const shift = shifts.find((s) => s.id === shiftId);
  const [typeId, setTypeId] = useState('');
  const [part, setPart] = useState<DayPart>(parts[0] ?? 'full');
  const [start, setStart] = useState(() => (shifts.some(inWindow) ? now.date : addDays(now.date, 1)));
  const [end, setEnd] = useState(start);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const type = types.find((t) => t.id === typeId);
  const needFile = !!type?.requires_attachment;
  const backdated = start < now.date;
  const badRange = end < start;
  const crossesMidnight = shift ? toMin(shift.end) <= toMin(shift.start) : false;

  // ครึ่งกะ = ตามเวลาที่แอดมินตั้งไว้ (ถ้าไม่ได้ตั้ง ตัดครึ่งเวลากะ)
  const half = shift ? shiftLen(shift) / 2 : 0;
  const mid = shift ? fromMin(toMin(shift.start) + half) : '';
  const firstHalf = shift ? `${shift.half1_start ?? shift.start}–${shift.half1_end ?? mid}` : '';
  const secondHalf = shift ? `${shift.half2_start ?? mid}–${shift.half2_end ?? shift.end}` : '';

  // ลาเป็นชั่วโมง: ต้องอยู่ในช่วงกะ (เวลาหลังเที่ยงคืนของกะดึกนับเป็นวันถัดไป)
  let hoursErr = '';
  let hoursValue = 0;
  if (part === 'hours' && shift) {
    if (!startTime || !endTime) hoursErr = 'กรุณาระบุเวลาเริ่มและเวลาสิ้นสุด';
    else if (startTime === endTime) hoursErr = 'เวลาเริ่มและเวลาสิ้นสุดต้องไม่เท่ากัน';
    else {
      let s = toMin(startTime) - toMin(shift.start);
      if (s < 0) s += 1440;
      const dur = (toMin(endTime) - toMin(startTime) + 1440) % 1440;
      hoursValue = Math.round((dur / 60) * 10) / 10;
      if (s + dur > shiftLen(shift)) hoursErr = `เวลาที่ลาต้องอยู่ในช่วง${shift.name} (${shift.start}–${shift.end} น.)`;
    }
  }

  const days = badRange ? 0 : Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
  const amount = part === 'full' ? `${days} วัน` : part === 'hours' ? `${hoursValue} ชั่วโมง` : '0.5 วัน';

  // เงื่อนไขของบริษัท/ประเภทการลา (ฐานข้อมูลตรวจซ้ำอีกชั้น)
  const daysEq = part === 'full' ? days : part === 'hours' ? (shift ? hoursValue / (shiftLen(shift) / 60) : 0) : 0.5;
  let ruleErr = '';
  if (type && !(part === 'hours' && !!hoursErr)) {
    if (type.min_days != null && daysEq < Number(type.min_days)) ruleErr = `ประเภท “${type.name}” ต้องลาขั้นต่ำ ${Number(type.min_days)} วันต่อครั้ง`;
    else if (type.max_days != null && daysEq > Number(type.max_days)) ruleErr = `ประเภท “${type.name}” ลาได้สูงสุด ${Number(type.max_days)} วันต่อครั้ง`;
  }
  if (!ruleErr && part === 'hours' && settings.max_hours != null && hoursValue > Number(settings.max_hours))
    ruleErr = `ลารายชั่วโมงได้ไม่เกิน ${Number(settings.max_hours)} ชั่วโมงต่อครั้ง`;

  const windowBlock =
    shift && start === now.date && !inWindow(shift)
      ? `การลา${shift.name}ของวันนี้ ยื่นได้เฉพาะเวลา ${shift.open}–${shift.close} น. (ตอนนี้ ${now.time} น.) ` +
        'กรุณาติดต่อ Admin หรือหัวหน้างาน หรือเลือกวันลาเป็นวันถัดไป'
      : '';
  const blocker = backdated ? 'ไม่สามารถแจ้งลาย้อนหลังได้ กรุณาติดต่อ Admin' : windowBlock || (badRange ? 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม' : '') || ruleErr;

  const canSubmit =
    !busy && !blocker && !!typeId && !!shiftId && reason.trim().length > 0 && (!needFile || !!file) && !hoursErr;

  function changeEmployee(id: string) {
    const e2 = employees.find((e) => e.id === id)!;
    const o2 = options[e2.company_id];
    setEmployeeId(id);
    setShiftId((o2.shifts.find(inWindow) ?? o2.shifts[0])?.id ?? '');
    setTypeId('');
    setPart(partsOf(o2)[0] ?? 'full');
    setFile(null);
    setError('');
  }

  function pickPart(p: DayPart) {
    setPart(p);
    if (p !== 'full') setEnd(start); // ครึ่งกะ/ชั่วโมง = วันเดียว
  }

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
      shift_id: shiftId,
      day_part: part,
      start_date: start,
      end_date: part === 'full' ? end : start,
      start_time: part === 'hours' ? startTime : null,
      end_time: part === 'hours' ? endTime : null,
      reason: reason.trim(),
      attachment_path: path,
    });

    if (insErr) {
      if (path) await supabase.storage.from('leave-documents').remove([path]);
      setBusy(false);
      return setError(insErr.message); // ข้อความภาษาไทยจาก trigger
    }
    router.push('/?submitted=1');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <section className="card space-y-5">
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-brand-700">ลาของ “วันนี้” ยื่นได้เฉพาะช่วงเวลาของแต่ละกะ</span>
            <span className="text-slate-500">
              ตอนนี้ {now.time} น. ({formatDateTH(now.date)})
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5 text-slate-600">
            {shifts.map((s) => (
              <li key={s.id}>
                {s.name}: {s.open}–{s.close} น.{' '}
                <span className={inWindow(s) ? 'font-medium text-emerald-600' : 'text-slate-400'}>
                  ({inWindow(s) ? 'เปิดรับอยู่' : 'ปิดอยู่'})
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-slate-400">ลาล่วงหน้าวันอื่นยื่นได้ตลอดเวลา</p>
        </div>

        {employees.length > 1 && (
          <div>
            <label className="label">บริษัท / รหัสพนักงาน</label>
            <select className="input" value={employeeId} onChange={(e) => changeEmployee(e.target.value)}>
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
          <label className="label">
            กะที่ลา <span className="text-rose-500">*</span>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {shifts.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                  shiftId === s.id
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 ring-4 ring-brand-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="shift"
                  className="accent-brand-600"
                  checked={shiftId === s.id}
                  onChange={() => setShiftId(s.id)}
                />
                <span className="flex-1">
                  {s.name}
                  <span className="ml-2 font-normal text-slate-400">
                    {s.start}–{s.end} น.
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {(shifts.length === 0 || types.length === 0) && (
          <p className="alert-error">บริษัทนี้ยังไม่ได้ตั้งค่า{shifts.length === 0 ? 'กะ' : 'ประเภทการลา'} กรุณาติดต่อฝ่ายบุคคล</p>
        )}

        {settings.note && <p className="whitespace-pre-wrap rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">{settings.note}</p>}

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
                <span className="flex-1">
                  {t.name}
                  {t.name_alt && <span className="ml-2 text-xs font-normal text-slate-400">{t.name_alt}</span>}
                  {typeRules(t) && <span className="mt-0.5 block text-xs font-normal text-slate-400">{typeRules(t)}</span>}
                </span>
                {t.requires_attachment && <span title="ต้องแนบเอกสาร">📎</span>}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">ช่วงที่ลา</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {parts.map((p) => (
              <label
                key={p}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                  part === p
                    ? 'border-brand-500 bg-brand-50 font-medium text-brand-700 ring-4 ring-brand-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input type="radio" name="part" className="accent-brand-600" checked={part === p} onChange={() => pickPart(p)} />
                <span className="flex-1">
                  {PART_LABEL[p]}
                  {p === 'first_half' && <span className="ml-2 font-normal text-slate-400">{firstHalf}</span>}
                  {p === 'second_half' && <span className="ml-2 font-normal text-slate-400">{secondHalf}</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{part === 'full' ? 'ตั้งแต่วันที่' : 'วันที่ลา'}</label>
            <input
              type="date"
              className="input"
              value={start}
              min={now.date}
              onChange={(e) => {
                setStart(e.target.value);
                if (part !== 'full' || end < e.target.value) setEnd(e.target.value);
              }}
              required
            />
          </div>
          {part === 'full' && (
            <div>
              <label className="label">ถึงวันที่</label>
              <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
            </div>
          )}
        </div>

        {crossesMidnight && (
          <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {shift?.name} เริ่ม {shift?.start} น. และต่อเนื่องถึง {shift?.end} น. ของวันถัดไป — <b>ให้เลือก “วันที่เริ่มกะ” เป็นวันที่ลา</b>{' '}
            (เช่น ลากะดึกที่เริ่มคืนวันที่ 5 ให้เลือกวันที่ 5)
          </p>
        )}

        {part === 'hours' && shift && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">เวลาเริ่มลา</label>
              <input type="time" className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </div>
            <div>
              <label className="label">เวลาสิ้นสุด</label>
              <input type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </div>
            <p className="text-xs text-slate-400 sm:col-span-2">
              ต้องอยู่ในช่วง{shift.name} ({shift.start}–{shift.end} น.){crossesMidnight && ' ข้ามเที่ยงคืนได้ เช่น 23:00 ถึง 02:00'}
            </p>
            {hoursErr && startTime && endTime && <p className="alert-error sm:col-span-2">{hoursErr}</p>}
          </div>
        )}

        <p className="text-sm text-slate-500">
          จำนวนที่ลา: <b className="text-ink">{amount}</b>
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

        {type && (
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
