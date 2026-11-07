import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';
import ShiftForm from '../settings/ShiftForm';
import TypeForm, { type TypeRow } from './TypeForm';
import SettingsForm, { type Settings } from './SettingsForm';
import ActionButton from './ActionButton';
import {
  addCompanyShift,
  resetCompanyShifts,
  resetCompanyTypes,
  seedCompanyShifts,
  seedCompanyTypes,
} from '@/app/actions/rules';
import type { Company } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SHIFT_COLS = 'id, name, start_time, end_time, open_time, close_time, half1_start, half1_end, half2_start, half2_end, active';

export default async function LeaveRulesPage({ searchParams }: { searchParams: { company?: string } }) {
  const ctx = await requireAdmin();
  const supabase = createClient();

  const { data: companies } = await supabase.from('companies').select('id, company_name').order('company_name');
  const comps = ((companies ?? []) as Company[]).filter((c) => ctx.isSuper || ctx.adminCompanyIds.includes(c.id));
  if (comps.length === 0) {
    return <p className="card text-center text-slate-500">ยังไม่มีบริษัท — เพิ่มบริษัทที่เมนู “ตั้งค่า” ก่อน</p>;
  }
  const company = comps.find((c) => c.id === searchParams.company) ?? comps[0];

  const [typesRes, defTypesRes, shiftsRes, defShiftsRes, setRes] = await Promise.all([
    supabase.from('leave_types').select('*').eq('company_id', company.id).order('sort_order'),
    supabase.from('leave_types').select('code, name').is('company_id', null).eq('active', true).order('sort_order'),
    supabase.from('shifts').select(SHIFT_COLS).eq('company_id', company.id).order('sort_order'),
    supabase.from('shifts').select('name, start_time, end_time, open_time, close_time').is('company_id', null).eq('active', true).order('sort_order'),
    supabase.from('company_leave_settings').select('*').eq('company_id', company.id).maybeSingle(),
  ]);

  const types = (typesRes.data ?? []) as TypeRow[];
  const customTypes = types.some((t) => t.active);
  const shifts = (shiftsRes.data ?? []) as any[];
  const customShifts = shifts.some((s) => s.active);
  const settings: Settings = {
    allow_full: setRes.data?.allow_full ?? true,
    allow_half: setRes.data?.allow_half ?? true,
    allow_hours: setRes.data?.allow_hours ?? true,
    max_hours: setRes.data?.max_hours ?? null,
    note: setRes.data?.note ?? null,
  };
  const hm = (t: string) => t.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-600">เงื่อนไขการลา</h1>
          <p className="mt-0.5 text-sm text-slate-500">ตั้งประเภทการลา ช่วงที่ลา และกะ แยกตามบริษัท</p>
        </div>
        {comps.length > 1 && (
          <form method="get" className="w-full sm:w-72">
            <label className="label">บริษัท</label>
            <AutoSubmitSelect name="company" defaultValue={company.id} className="input">
              {comps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        )}
      </div>
      {comps.length === 1 && <p className="-mt-3 text-sm font-medium text-slate-600">{company.company_name}</p>}

      {/* ---------------- ประเภทการลา ---------------- */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="card-title">ประเภทการลา</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {customTypes ? (
                <>ใช้ <b className="text-brand-600">ชุดเฉพาะของ {company.company_name}</b> — พนักงานเห็นเฉพาะรายการที่ “เปิดใช้”</>
              ) : (
                <>ตอนนี้ใช้ <b className="text-brand-600">ชุดมาตรฐาน</b> ร่วมกับบริษัทอื่น</>
              )}
            </p>
          </div>
          {customTypes && (
            <ActionButton
              action={resetCompanyTypes.bind(null, company.id)}
              confirm="กลับไปใช้ชุดมาตรฐาน? (ประเภทการลาเฉพาะบริษัทจะถูกปิดใช้ ใบลาเดิมยังอยู่ครบ)"
              className="btn-ghost btn-sm"
            >
              กลับไปใช้ชุดมาตรฐาน
            </ActionButton>
          )}
        </div>

        {!customTypes && (
          <>
            <ul className="flex flex-wrap gap-2 text-sm">
              {(defTypesRes.data ?? []).map((t: any) => (
                <li key={t.code} className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  {t.name}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
              <ActionButton action={seedCompanyTypes.bind(null, company.id, 'sample')} className="btn-primary btn-sm">
                ใช้ชุดตัวอย่าง (AL, PL, SL, SS, SW, CC, LB, LA, ABL)
              </ActionButton>
              <ActionButton action={seedCompanyTypes.bind(null, company.id, 'default')}>
                ตั้งชุดเฉพาะ โดยคัดลอกจากชุดมาตรฐาน
              </ActionButton>
            </div>
            <p className="text-xs text-slate-400">กดแล้วแก้ไข เพิ่ม หรือปิดรายการได้ — ไม่กระทบบริษัทอื่น</p>
          </>
        )}

        {customTypes && (
          <div className="space-y-3">
            {types.map((t) => (
              <TypeForm key={t.id + String(t.active)} companyId={company.id} row={t} />
            ))}
            <TypeForm companyId={company.id} />
            <p className="text-xs text-slate-400">
              ขั้นต่ำ/สูงสุด ระบบ <b>บังคับ</b> ตอนพนักงานยื่นลา · หักค่าจ้างและหักแต้ม <b>แสดงในรายงาน</b> ให้ฝ่ายบุคคลใช้ (ระบบไม่คำนวณเงินให้)
            </p>
          </div>
        )}
      </section>

      {/* ---------------- ช่วงที่ลา ---------------- */}
      <section className="card space-y-4">
        <div>
          <h2 className="card-title">ช่วงที่ลา</h2>
          <p className="mt-0.5 text-sm text-slate-500">ตัวเลือกที่พนักงานของบริษัทนี้เลือกได้ตอนยื่นใบลา</p>
        </div>
        <SettingsForm key={company.id} companyId={company.id} settings={settings} />
      </section>

      {/* ---------------- กะและเวลายื่นลา ---------------- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 px-1">
          <div>
            <h2 className="card-title">กะทำงานและเวลายื่นลา</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {customShifts ? (
                <>ใช้ <b className="text-brand-600">กะเฉพาะของ {company.company_name}</b> · เวลาแบบ 24 ชั่วโมง (เวลาไทย)</>
              ) : (
                <>ตอนนี้ใช้ <b className="text-brand-600">กะมาตรฐาน</b> ร่วมกับบริษัทอื่น</>
              )}
            </p>
          </div>
          {customShifts && (
            <div className="flex flex-wrap gap-2">
              <ActionButton action={addCompanyShift.bind(null, company.id)}>+ เพิ่มกะ</ActionButton>
              <ActionButton
                action={resetCompanyShifts.bind(null, company.id)}
                confirm="กลับไปใช้กะมาตรฐาน? (กะเฉพาะบริษัทจะถูกปิดใช้ ใบลาเดิมยังอยู่ครบ)"
                className="btn-ghost btn-sm"
              >
                กลับไปใช้กะมาตรฐาน
              </ActionButton>
            </div>
          )}
        </div>

        {!customShifts ? (
          <div className="card space-y-4">
            <ul className="space-y-1 text-sm text-slate-600">
              {(defShiftsRes.data ?? []).map((s: any) => (
                <li key={s.name}>
                  <b>{s.name}</b> · ทำงาน {hm(s.start_time)}–{hm(s.end_time)} น. · ยื่นลาวันนี้ได้ {hm(s.open_time)}–{hm(s.close_time)} น.
                </li>
              ))}
            </ul>
            <ActionButton action={seedCompanyShifts.bind(null, company.id)} className="btn-primary btn-sm">
              ตั้งกะเฉพาะบริษัทนี้ (คัดลอกจากกะมาตรฐาน)
            </ActionButton>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {shifts.map((sh) => (
              <ShiftForm key={sh.id} shift={sh} companyMode />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
