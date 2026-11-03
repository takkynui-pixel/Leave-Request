'use client';

import { useMemo, useState } from 'react';
import { buildRows, decodeFile, type ParsedRow } from '@/lib/csv';
import { importEmployeeRows, type ImportResult } from '@/app/actions/import';
import { csvCell } from '@/lib/report';

const CHUNK = 25;

export default function ImportForm({ companies }: { companies: { id: string; company_name: string }[] }) {
  const [companyId, setCompanyId] = useState(companies.length === 1 ? companies[0].id : '');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [results, setResults] = useState<ImportResult[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [fatal, setFatal] = useState('');

  const parsed = useMemo(() => buildRows(text, companies, companyId), [text, companies, companyId]);
  const good = parsed.rows.filter((r) => !r.error);
  const bad = parsed.rows.filter((r) => r.error);
  const running = progress !== null && progress.done < progress.total;

  async function onFile(f: File | undefined) {
    setResults([]);
    setProgress(null);
    if (!f) return;
    setFileName(f.name);
    setText(decodeFile(await f.arrayBuffer()));
  }

  async function run() {
    setFatal('');
    setResults([]);
    const rows: ParsedRow[] = good;
    setProgress({ done: 0, total: rows.length });
    const all: ImportResult[] = [];
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK).map((r) => ({
          line: r.line,
          companyId: r.companyId,
          code: r.code,
          name: r.name,
          phone: r.phone,
          department: r.department,
          pin: r.pin,
        }));
        const res = await importEmployeeRows(slice);
        all.push(...res);
        setResults([...all]);
        setProgress({ done: Math.min(i + CHUNK, rows.length), total: rows.length });
      }
    } catch (e: any) {
      setFatal(e?.message ?? 'เกิดข้อผิดพลาด การนำเข้าหยุดกลางคัน — ตรวจสอบผลด้านล่างแล้วนำเข้าเฉพาะแถวที่เหลือ');
    }
  }

  function downloadResults() {
    const head = ['แถวในไฟล์', 'รหัสพนักงาน', 'ชื่อ-สกุล', 'เบอร์โทร', 'ผล', 'PIN เริ่มต้น', 'หมายเหตุ'];
    const label = { ok: 'สำเร็จ', skip: 'ข้าม', error: 'ผิดพลาด' } as const;
    const lines = results.map((r) => [r.line, r.code, r.name, r.phone, label[r.status as 'ok' | 'skip' | 'error'], r.pin, r.message]);
    const csv = '﻿' + [head, ...lines].map((l) => l.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-result.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  const skipCount = results.filter((r) => r.status === 'skip').length;
  const errCount = results.filter((r) => r.status === 'error').length;
  const finished = progress !== null && progress.done === progress.total;

  return (
    <div className="space-y-5">
      <section className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">
              บริษัท {parsed.hasCompanyColumn && <span className="text-slate-400">(ไฟล์มีคอลัมน์บริษัท — ใช้ตามไฟล์)</span>}
            </label>
            <select
              className="input"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              disabled={parsed.hasCompanyColumn}
            >
              <option value="">เลือกบริษัท</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">ไฟล์ CSV {fileName && <span className="text-slate-400">· {fileName}</span>}</label>
            <input
              type="file"
              accept=".csv,.txt,.tsv,text/csv"
              onChange={(e) => onFile(e.target.files?.[0])}
              className="input file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
            />
          </div>
        </div>
        <div>
          <label className="label">หรือวางข้อมูลจาก Excel ที่นี่</label>
          <textarea
            className="input min-h-[120px] font-mono text-xs"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResults([]);
              setProgress(null);
            }}
            placeholder={'รหัสพนักงาน\tชื่อ-สกุล\tเบอร์โทร\tแผนก\tPIN\nSBA001\tสมชาย ใจดี\t0812345678\tผลิต\t'}
          />
        </div>
      </section>

      {parsed.rows.length > 0 && !finished && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="card-title">
              ตรวจสอบข้อมูล: พร้อมนำเข้า <span className="text-emerald-600">{good.length}</span> แถว
              {bad.length > 0 && (
                <>
                  {' '}· ผิดพลาด <span className="text-rose-600">{bad.length}</span> แถว (จะถูกข้าม)
                </>
              )}
            </h2>
            <button className="btn-primary" disabled={running || good.length === 0} onClick={run}>
              {running ? `กำลังนำเข้า… ${progress!.done}/${progress!.total}` : `นำเข้า ${good.length} คน`}
            </button>
          </div>
          <div className="table-wrap mt-3 max-h-[420px] overflow-y-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>แถว</th>
                  <th>รหัส</th>
                  <th>ชื่อ-สกุล</th>
                  <th>เบอร์โทร</th>
                  <th>แผนก</th>
                  <th>ตรวจสอบ</th>
                </tr>
              </thead>
              <tbody>
                {[...bad, ...good].slice(0, 200).map((r) => (
                  <tr key={r.line}>
                    <td className="text-slate-400">{r.line}</td>
                    <td className="font-medium">{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.phone}</td>
                    <td>{r.department}</td>
                    <td className={r.error ? 'text-rose-600' : 'text-emerald-600'}>{r.error ?? 'พร้อม'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parsed.rows.length > 200 && <p className="mt-2 text-xs text-slate-400">แสดง 200 แถวแรก (แถวที่ผิดพลาดแสดงก่อน)</p>}
        </section>
      )}

      {fatal && <p className="alert-error">{fatal}</p>}

      {results.length > 0 && (
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="card-title">
              ผลการนำเข้า: สำเร็จ {okCount} · ข้าม {skipCount} · ผิดพลาด {errCount}
            </h2>
            <button className="btn-outline" onClick={downloadResults}>
              ⬇ ดาวน์โหลดผลลัพธ์ (มี PIN)
            </button>
          </div>
          <p className="mt-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            ไฟล์ผลลัพธ์มี PIN เริ่มต้นของพนักงาน — เก็บไว้เป็นความลับและลบหลังแจ้งพนักงานแล้ว (ระบบจะบังคับเตือนให้พนักงานเปลี่ยน PIN เอง)
          </p>
          <div className="table-wrap mt-3 max-h-[420px] overflow-y-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>แถว</th>
                  <th>รหัส</th>
                  <th>ชื่อ-สกุล</th>
                  <th>PIN</th>
                  <th>ผล</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.line}>
                    <td className="text-slate-400">{r.line}</td>
                    <td className="font-medium">{r.code}</td>
                    <td>{r.name}</td>
                    <td className="font-mono">{r.pin}</td>
                    <td
                      className={
                        r.status === 'ok' ? 'text-emerald-600' : r.status === 'skip' ? 'text-amber-600' : 'text-rose-600'
                      }
                    >
                      {r.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
