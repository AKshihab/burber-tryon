import type { ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Catalog } from './pages/Catalog.tsx';
import { Review } from './pages/Review.tsx';
import { Staff } from './pages/Staff.tsx';
import { Styles } from './pages/Styles.tsx';
import { Token } from './pages/Token.tsx';
import { TryOn } from './pages/TryOn.tsx';
import { Welcome } from './pages/Welcome.tsx';
import { OfflineNotice, useSession } from './session.tsx';
import { TokenWatchProvider, TurnBanner } from './tokenWatch.tsx';

export const SALON_NAME = 'Burber';

const NAV = [
  { to: '/styles', label: 'Styles' },
  { to: '/try-on', label: 'Try on' },
  { to: '/catalog', label: 'Catalog' },
  { to: '/token', label: 'Token' },
];

/** Customer pages: need a session, share the top bar and bottom navigation. */
function Shell({ children }: { children: ReactNode }) {
  const { user, loading, offline, signOut } = useSession();
  if (loading) return <p className="center muted">Loading…</p>;
  if (!user && offline) return <OfflineNotice />;
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
      <TokenWatchProvider>
        <main>
          <TurnBanner />
          {children}
        </main>
      </TokenWatchProvider>
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
      <Route path="/styles" element={<Shell><Styles /></Shell>} />
      <Route path="/try-on" element={<Shell><TryOn /></Shell>} />
      <Route path="/catalog" element={<Shell><Catalog /></Shell>} />
      <Route path="/token" element={<Shell><Token /></Shell>} />
      <Route path="/review" element={<Review />} />
      <Route path="/staff" element={<Staff />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
