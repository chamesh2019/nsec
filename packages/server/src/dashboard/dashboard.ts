import { Hono } from 'hono';
import { DASHBOARD_HTML } from './html.js';

export function createDashboardRoutes(): Hono {
  const router = new Hono();

  router.get('/dashboard', (c) => {
    return c.html(DASHBOARD_HTML);
  });

  router.get('/dashboard/*', (c) => {
    return c.html(DASHBOARD_HTML);
  });

  return router;
}

export const dashboardRoutes = createDashboardRoutes;
