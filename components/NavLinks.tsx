'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 py-1 sm:justify-center">
      {links.map((l) => {
        const active = l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded-full px-5 py-3 text-sm font-medium transition ${
              active
                ? 'bg-brand-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-[#f1f4fa] text-ink hover:bg-brand-50'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
