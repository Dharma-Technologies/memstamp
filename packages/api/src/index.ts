import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { config } from './config.js';
import { stampRoutes } from './routes/stamps.js';
import { agentRoutes } from './routes/agents.js';
import { batchRoutes } from './routes/batch.js';
import { problemResponse } from './errors.js';
import { closeDatabase } from './db/index.js';

async function main() {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, { origin: true });
  app.register(helmet, { contentSecurityPolicy: false });

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.register(stampRoutes);
  app.register(agentRoutes);
  app.register(batchRoutes);

  app.setNotFoundHandler((request, reply) => {
    problemResponse(reply, 404, 'Not Found', `Route ${request.method} ${request.url} not found`);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const status = error.statusCode ?? 500;
    problemResponse(reply, status, 'Internal Server Error', error.message);
  });

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down`);
    await app.close();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`memstamp API listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
