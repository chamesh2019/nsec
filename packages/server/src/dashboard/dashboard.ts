import type { FastifyPluginAsync } from 'fastify';
import { DASHBOARD_HTML } from './html.js';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/dashboard', async (request, reply) => {
    reply.type('text/html; charset=utf-8');
    return DASHBOARD_HTML;
  });

  fastify.get('/dashboard/*', async (request, reply) => {
    reply.type('text/html; charset=utf-8');
    return DASHBOARD_HTML;
  });
};
