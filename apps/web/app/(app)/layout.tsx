import Link from 'next/link';

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="nav__link" href={href}>
      {label}
    </Link>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <header className="topnav">
        <div className="topnav__inner">
          <div className="topnav__left">
            <Link className="home" href="/dashboard" aria-label="Dashboard">
              <span className="home__mark" />
            </Link>
            <nav className="nav" aria-label="Primary">
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/upload" label="Upload" />
            </nav>
          </div>

          <div className="topnav__center" aria-label="Search">
            <div className="search">
              <span className="search__icon" aria-hidden="true">⌕</span>
              <input className="search__input" placeholder="Search reports, creditors…" disabled />
              <span className="search__chip" aria-hidden="true">⌁</span>
            </div>
          </div>

          <div className="topnav__right">
            <button className="iconbtn" type="button" aria-label="Filters" disabled>
              <span aria-hidden="true">⎚</span>
            </button>
            <button className="iconbtn" type="button" aria-label="Notifications" disabled>
              <span aria-hidden="true">◌</span>
            </button>
            <div className="profile" aria-label="Profile">
              <span className="avatar" aria-hidden="true" />
              <div className="profile__meta">
                <span className="profile__name">Your account</span>
                <span className="profile__sub">Client portal</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="stage">
        <div className="stage__inner">{children}</div>
      </main>
    </div>
  );
}
