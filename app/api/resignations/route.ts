import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCsv } from '@/lib/report';
import { RATINGS, reasonLabel, tenureLabel } from '@/lib/resign';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const sp = req.nextUrl.searchParams;
  // RLS: แอดมินเห็นเฉพาะบริษัทตน; พนักงานทั่วไปจะได้เฉพาะของตัวเอง
  let q = supabase
    .from('resignations')
    .select('*, employees(employee_code, full_name), companies(company_name)')
    .order('submitted_at', { ascending: false });
  if (sp.get('company')) q = q.eq('company_id', sp.get('company')!);
  if (sp.get('status')) q = q.eq('status', sp.get('status')!);
  const { data, error } = await q;
  if (error) return new NextResponse(error.message, { status: 500 });

  const csv = toCsv(
    [
      'บริษัท', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'วันทำงานวันสุดท้าย', 'อายุงาน', 'เหตุผลการลาออก', 'อธิบายเพิ่มเติม',
      ...RATINGS.map(([, l]) => `คะแนน: ${l}`), 'สถานะ', 'ส่งเมื่อ',
    ],
    (data ?? []).map((r: any) => [
      r.companies?.company_name ?? '',
      r.employees?.employee_code ?? '',
      r.employees?.full_name ?? '',
      r.last_working_date,
      tenureLabel(r.tenure),
      reasonLabel(r.reason),
      r.detail,
      ...RATINGS.map(([k]) => r[k]),
      r.status === 'acknowledged' ? 'รับทราบแล้ว' : 'รอรับทราบ',
      r.submitted_at,
    ]),
  );
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="resignations.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
