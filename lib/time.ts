const TZ = 'Asia/Bangkok';

/** แยกวันที่/เวลาตามเขตเวลาไทยจาก epoch ms */
export function thaiParts(ms: number) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date(ms))) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${p.hour}:${p.minute}`,
    hour: Number(p.hour),
  };
}

/** 'YYYY-MM-DD' -> 'DD/MM/พ.ศ.' */
export function formatDateTH(d: string | null | undefined) {
  if (!d) return '-';
  const [y, m, dd] = d.slice(0, 10).split('-');
  return `${dd}/${m}/${Number(y) + 543}`;
}

export function formatDateTimeTH(iso: string | null | undefined) {
  if (!iso) return '-';
  const p = thaiParts(new Date(iso).getTime());
  return `${formatDateTH(p.date)} ${p.time}`;
}

export function addDays(d: string, n: number) {
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, dd + n));
  return t.toISOString().slice(0, 10);
}

export function greeting(hour: number) {
  if (hour < 12) return 'สวัสดีตอนเช้า';
  if (hour < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

/** เดือนปัจจุบัน (เวลาไทย) รูปแบบ YYYY-MM */
export function currentMonthTH() {
  return thaiParts(Date.now()).date.slice(0, 7);
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(last).padStart(2, '0')}` };
}

const TH_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
export function monthLabelTH(month: string) {
  const [y, m] = month.split('-').map(Number);
  return `${TH_MONTHS[m - 1]} ${y + 543}`;
}
