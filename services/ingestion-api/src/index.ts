import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { MessageQueue } from './queue';
import { ingestLogsHandler } from './handlers';

const PORT = parseInt(process.env.PORT || '3001', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // Register plugins
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  await server.register(helmet, {
    contentSecurityPolicy: false, // Configure as needed
  });

  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Initialize message queue
  const messageQueue = new MessageQueue(REDIS_URL);
  (server as any).messageQueue = messageQueue;

  // Health check endpoint
  server.get('/health', async () => {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  });

  // Logs ingestion endpoint
  server.post('/logs', ingestLogsHandler);

  // Graceful shutdown
  const closeListeners = ['SIGINT', 'SIGTERM'];
  closeListeners.forEach(signal => {
    process.on(signal, async () => {
      server.log.info(`Shutting down on ${signal}`);
      await messageQueue.close();
      await server.close();
      process.exit(0);
    });
  });

  return server;
}

const start = async () => {
  const server = await buildServer();

  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    server.log.info(`Ingestion API listening on http://0.0.0.0:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
