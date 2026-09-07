import { createRoute, redirect } from '@tanstack/react-router';
import { rootRoute } from './__root.tsx';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/projects' });
  },
  component: () => null,
});
