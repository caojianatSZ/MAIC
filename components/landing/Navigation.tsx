import Link from 'next/link';

export function Navigation() {
  return (
    <nav role="navigation" aria-label="主导航">
      <div className="container">
        <Link href="/" className="nav-brand">
          学迹
        </Link>
        <ul className="nav-links">
          <li>
            <Link href="/">首页</Link>
          </li>
          <li>
            <Link href="/features">功能</Link>
          </li>
          <li>
            <Link href="/privacy">隐私</Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
