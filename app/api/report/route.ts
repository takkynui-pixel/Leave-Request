import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchReport, partLabel, summarize, toCsv } from '@/lib/report';
import { currentMonthTH } from '@/lib/time';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const sp = req.nextUrl.searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.get('month') ?? '') ? sp.get('month')! : currentMonthTH();
  const company = sp.get('company') || null;
  const kind = sp.get('kind') === 'summary' ? 'summary' : 'daily';

  // RLS บนวิว (security_invoker) กรองให้เห็นเฉพาะบริษัทที่มีสิทธิ์
  let rows;
  try {
    rows = await fetchReport(supabase, month, company);
  } catch (e: any) {
    return new NextResponse(e.message, { status: 500 });
  }

  let csv: string;
  if (kind === 'summary') {
    const sum = summarize(rows);
    const types = [...new Set(rows.map((r) => r.leave_type))];
    csv = toCsv(
      ['บริษัท', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'รวม (วัน)', 'รวมลารายชั่วโมง (ชม.)', ...types],
      sum.map((s) => [s.company_name, s.employee_code, s.full_name, s.days, s.hours, ...types.map((t) => s.byType[t] ?? 0)]),
    );
  } else {
    csv = toCsv(
      ['บริษัท', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'วันที่ลา', 'ประเภทการลา', 'เหตุผลการลา', 'กะ', 'ช่วงที่ลา', 'จำนวน (วัน)', 'จำนวน (ชม.)'],
      rows.map((r) => [
        r.company_name,
        r.employee_code,
        r.full_name,
        r.leave_date,
        r.leave_type,
        r.reason,
        r.shift_name ?? '',
        partLabel(r),
        r.leave_days,
        r.day_part === 'hours' ? r.total_hours : '',
      ]),
    );
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leave-${kind}-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
