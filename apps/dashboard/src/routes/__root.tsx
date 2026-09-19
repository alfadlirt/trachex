import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname === '/') {
    return <Outlet />;
  }

  return (
    <div className="dashboard-shell min-h-screen bg-zinc-950 text-zinc-900">
      <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-4 text-zinc-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/projects" className="text-lg font-semibold tracking-tight text-zinc-100">
            Trachex<span className="ml-2 text-xs font-normal text-zinc-500">evidence desk</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-zinc-400">
            <Link
              to="/projects"
              className="rounded px-2 py-2 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              Projects
            </Link>
            <Link
              to="/"
              className="hidden rounded px-2 py-2 hover:bg-zinc-900 hover:text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300 sm:block"
            >
              About Trachex
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});
