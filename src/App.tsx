import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Catalog } from './pages/Catalog.tsx';
import { Welcome } from './pages/Welcome.tsx';
import { useSession } from './session.tsx';

export const SALON_NAME = 'Burber';

const NAV = [
  { to: '/styles', label: 'Styles' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/token', label: 'Token' },
];

function Soon({ title }: { title: string }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <p className="muted">Coming soon.</p>
    </section>
  );
}

/** Customer pages: need a session, share the top bar and bottom navigation. */
function Shell({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useSession();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user) return <Navigate to="/" replace />;
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">{SALON_NAME}</span>
        <span className="who">
          <span>{user.name}</span>
          <button type="button" className="link" onClick={signOut}>
            Sign out
          </button>
        </span>
      </header>
      <main>{children}</main>
      <nav className="tabbar" aria-label="Main">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/styles" element={<Shell><Soon title="Styles" /></Shell>} />
      <Route path="/catalog" element={<Shell><Catalog /></Shell>} />
      <Route path="/token" element={<Shell><Soon title="Token" /></Shell>} />
      <Route path="/review" element={<Soon title="Review" />} />
      <Route path="/staff" element={<Soon title="Staff" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
