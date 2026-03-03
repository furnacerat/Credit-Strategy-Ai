import Link from 'next/link';

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="nav__link" href={href}>
      {label}
    </Link>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topnav">
        <div className="topnav__inner">
          <div className="topnav__left">
            <Link className="home" href="/" aria-label="Home">
              <span className="home__mark" />
            </Link>
            <nav className="nav" aria-label="Primary">
              <NavLink href="/" label="Overview" />
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/upload" label="Upload" />
            </nav>
          </div>

          <div className="topnav__center" aria-label="Search">
            <div className="search">
              <span className="search__icon" aria-hidden="true">⌕</span>
              <input className="search__input" placeholder="Search" disabled />
              <span className="search__chip" aria-hidden="true">⌁</span>
            </div>
          </div>

          <div className="topnav__right">
            <Link className="btn" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="stage">
        <div className="stage__inner">{children}</div>
      </main>
    </div>
  );
}
