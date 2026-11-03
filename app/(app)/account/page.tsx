import { getContext } from '@/lib/auth';
import { formatPhone } from '@/lib/phone';
import PinForm from './PinForm';

export default async function AccountPage() {
  const ctx = await getContext();
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <section className="card">
        <h1 className="card-title">บัญชีของฉัน</h1>
        <p className="mt-1 text-sm text-slate-500">{ctx.displayName}</p>
        {ctx.employees.length > 0 && (
          <ul className="mt-4 divide-y divide-slate-100 text-sm">
            {ctx.employees.map((e) => (
              <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                <span>
                  {e.company_name} · <b>{e.employee_code}</b>
                </span>
                <span className="text-slate-400">{formatPhone(e.phone_number)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="card-title">เปลี่ยน PIN</h2>
        <PinForm />
      </section>
    </div>
  );
}
