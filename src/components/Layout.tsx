import { NavLink, Outlet, useLocation } from 'react-router-dom';

const tabs = [
  { to: '/', label: '账目', icon: '📒' },
  { to: '/rankings', label: '排行', icon: '🏆' },
  { to: '/clients', label: '客户', icon: '👥' },
  { to: '/settings', label: '设置', icon: '⚙️' },
];

export default function Layout() {
  const { pathname } = useLocation();
  const hideNav = /^\/(records\/(new|[^/]+)|clients\/(new|[^/]+\/edit))$/.test(pathname);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col bg-slate-100">
      <main className="flex-1 pb-24 pt-2.5">{<Outlet />}</main>
      {!hideNav && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="grid grid-cols-4">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                    isActive ? 'text-teal-700' : 'text-slate-500'
                  }`
                }
              >
                <span className="text-xl leading-none">{t.icon}</span>
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
