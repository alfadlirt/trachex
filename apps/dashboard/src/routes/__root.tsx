import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname === '/') {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/projects" className="font-semibold text-zinc-900">
            Trachex
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-500">
            <Link to="/projects" className="hover:text-zinc-900">
              Projects
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});
