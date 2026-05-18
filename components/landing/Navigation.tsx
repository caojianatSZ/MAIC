'use client';

import Link from 'next/link';

export function Navigation() {
  return (
    <nav
      className="sticky top-0 z-100 bg-slate-50/85 backdrop-blur-md border-b border-slate-200"
      role="navigation"
      aria-label="主导航"
    >
      <div className="flex items-center justify-between h-16">
        <Link
          href="/"
          className="font-black text-2xl text-primary no-underline"
          style={{ letterSpacing: '-0.02em' }}
        >
          学迹
        </Link>
        <ul className="flex gap-8 list-none m-0">
          <li>
            <Link
              href="/"
              className="text-sm text-slate-600 no-underline transition-colors duration-150 font-medium hover:text-primary"
            >
              首页
            </Link>
          </li>
          <li>
            <Link
              href="/features"
              className="text-sm text-slate-600 no-underline transition-colors duration-150 font-medium hover:text-primary"
            >
              功能
            </Link>
          </li>
          <li>
            <Link
              href="/privacy"
              className="text-sm text-slate-600 no-underline transition-colors duration-150 font-medium hover:text-primary"
            >
              隐私
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
