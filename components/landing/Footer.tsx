import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 py-12 text-center">
      <div className="container">
        <p className="text-slate-400 text-xs mb-4">
          &copy; 2026 学迹 · 弘知出品
        </p>
        <nav className="flex justify-center gap-4" aria-label="底部导航">
          <Link
            href="/privacy"
            className="text-slate-500 no-underline text-xs hover:text-primary"
          >
            隐私政策
          </Link>
          <Link
            href="/terms"
            className="text-slate-500 no-underline text-xs hover:text-primary"
          >
            用户协议
          </Link>
          <a
            href="mailto:hello@hz-college.com"
            className="text-slate-500 no-underline text-xs hover:text-primary"
          >
            联系我们
          </a>
        </nav>
      </div>
    </footer>
  );
}
