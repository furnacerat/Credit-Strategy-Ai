'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs: Array<{ href: string; label: string }> = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/report', label: 'Report' },
  { href: '/issues', label: 'Issues' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/disputes', label: 'Disputes' },
  { href: '/plan', label: 'Plan' },
  { href: '/simulation', label: 'Simulation' },
  { href: '/tracking', label: 'Tracking' }
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  if (href === '/report') return pathname.startsWith('/report');
  return pathname === href;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-400/[0.08] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-xl">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight text-white">
            Credit Strategy AI
          </Link>

          <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
            {tabs.map((t) => {
              const active = isActive(pathname, t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`rounded-2xl px-3 py-2 text-sm transition-colors ${
                    active
                      ? 'border border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                      : 'border border-transparent text-white/75 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              Profile
            </Link>
          </div>
        </div>
      </div>

      <div className="relative">{children}</div>
    </div>
  );
}
