import Link from 'next/link';
import { getContext } from '@/lib/auth';
import { logout } from '@/app/actions/auth';
import NavLinks from '@/components/NavLinks';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getContext();

  const links = ctx.isAdmin
    ? [
        { href: '/', label: 'ภาพรวม' },
        { href: '/admin/requests', label: 'ใบลา' },
        { href: '/admin/employees', label: 'พนักงาน' },
        { href: '/admin/leave-rules', label: 'เงื่อนไขการลา' },
        { href: '/admin/resignations', label: 'ลาออก' },
        { href: '/admin/reports', label: 'รายงาน' },
        ...(ctx.isSuper ? [{ href: '/admin/settings', label: 'ตั้งค่า' }] : []),
      ]
    : [
        { href: '/', label: 'ภาพรวม' },
        { href: '/leave/new', label: 'ยื่นใบลา' },
        { href: '/resign', label: 'ลาออก' },
        { href: '/account', label: 'บัญชีของฉัน' },
      ];

  return (
    <div className="shell">
      <header className="flex items-center gap-3 rounded-[28px] bg-white p-2 pl-4 shadow-soft sm:pl-6">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/vta-logo.png" alt="VTA Service" className="h-9 w-auto sm:h-11" />
        </Link>
        <NavLinks links={links} />
        <div className="flex shrink-0 items-center gap-2">
          {ctx.isAdmin && (
            <Link href="/account" className="hidden text-xs text-slate-500 hover:text-brand-600 md:block">
              บัญชี
            </Link>
          )}
          <form action={logout}>
            <button className="hidden rounded-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 sm:block" type="submit">
              ออกจากระบบ
            </button>
          </form>
          <div
            title={ctx.displayName}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-base font-semibold text-white"
          >
            {ctx.displayName.trim().charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {ctx.mustChangePin && (
        <Link
          href="/account"
          className="mt-4 block rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 hover:bg-amber-100"
        >
          คุณยังใช้ PIN เริ่มต้นอยู่ — แตะที่นี่เพื่อเปลี่ยน PIN ใหม่ของคุณเอง
        </Link>
      )}

      <main className="mt-6 sm:mt-8">{children}</main>

      <form action={logout} className="mt-8 text-center sm:hidden">
        <button className="text-xs text-slate-400" type="submit">
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}
