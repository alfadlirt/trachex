import { createRouter } from '@tanstack/react-router';
import { rootRoute } from './routes/__root.tsx';
import { indexRoute } from './routes/index.tsx';
import { ticketCanvasRoute } from './routes/projects.$projectId.tickets.$ticketKey.tsx';
import { projectTicketsRoute } from './routes/projects.$projectId.tsx';
import { projectsRoute } from './routes/projects.tsx';

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute.addChildren([projectTicketsRoute.addChildren([ticketCanvasRoute])]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
