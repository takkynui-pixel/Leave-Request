'use client';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

const sel =
  'cursor-pointer appearance-none bg-transparent px-1.5 py-2 text-center text-sm font-medium tabular-nums outline-none';

/**
 * ช่องเลือกเวลาแบบ 24 ชั่วโมง (ไม่มี AM/PM) — ชั่วโมง : นาที (ทุก 5 นาที)
 * ส่งค่า "HH:MM" ผ่าน hidden input ในฟอร์ม
 */
export default function TimeField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [h = '00', m = '00'] = (value || '00:00').split(':');
  const minutes = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();

  return (
    <span className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-1.5 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
      <input type="hidden" name={name} value={`${h}:${m}`} />
      <select aria-label="ชั่วโมง" className={sel} value={h} onChange={(e) => onChange(`${e.target.value}:${m}`)}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
      <span className="text-slate-400">:</span>
      <select aria-label="นาที" className={sel} value={m} onChange={(e) => onChange(`${h}:${e.target.value}`)}>
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </span>
  );
}
