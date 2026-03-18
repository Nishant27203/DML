import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Server } from 'socket.io';
import { ElasticsearchService } from './elasticsearch';
import { PostgresService } from './postgres';

const PORT = parseInt(process.env.PORT || '3002', 10);
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const DATABASE_URL = process.env.DATABASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: { level: process.env.LOG_LEVEL || 'info' },
  });

  // Register plugins
  await server.register(cors, { origin: true, credentials: true });
  await server.register(helmet);
  await server.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  // Initialize services
  const esService = new ElasticsearchService(ELASTICSEARCH_URL);
  const pgService = new PostgresService(DATABASE_URL);

  // Store services in server instance
  (server as any).esService = esService;
  (server as any).pgService = pgService;

  // Health check
  server.get('/health', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  }));

  // GET /logs - Search logs
  server.get('/logs', async (request, reply) => {
    try {
      const query: any = request.query;
      const params = {
        query: query.q,
        service_name: query.service_name,
        log_level: query.log_level,
        hostname: query.hostname,
        startTime: query.start_time,
        endTime: query.end_time,
        limit: Math.min(parseInt(query.limit) || 100, 1000),
        offset: parseInt(query.offset) || 0,
      };

      const result = await esService.searchLogs(params);
      return reply.send(result);
    } catch (error: any) {
      request.log.error(error, 'Error searching logs');
      return reply.status(500).send({ error: 'Failed to search logs' });
    }
  });

  // GET /alerts - Get alerts
  server.get('/alerts', async (request, reply) => {
    try {
      const query: any = request.query;
      const alerts = await pgService.getAlerts({
        status: query.status,
        serviceId: query.service_id,
        limit: parseInt(query.limit) || 50,
      });
      return reply.send(alerts);
    } catch (error: any) {
      request.log.error(error, 'Error fetching alerts');
      return reply.status(500).send({ error: 'Failed to fetch alerts' });
    }
  });

  // GET /metrics - Get metrics
  server.get('/metrics', async (request, reply) => {
    try {
      const query: any = request.query;
      
      if (!query.service_id) {
        return reply.status(400).send({ error: 'service_id is required' });
      }

      const metrics = await pgService.getMetrics({
        serviceId: query.service_id,
        metricName: query.metric_name,
        startTime: query.start_time,
        endTime: query.end_time,
        limit: parseInt(query.limit) || 1000,
      });

      return reply.send(metrics);
    } catch (error: any) {
      request.log.error(error, 'Error fetching metrics');
      return reply.status(500).send({ error: 'Failed to fetch metrics' });
    }
  });

  // GET /alert-rules - Get alert rules
  server.get('/alert-rules', async (request, reply) => {
    try {
      const rules = await pgService.getAlertRules();
      return reply.send(rules);
    } catch (error: any) {
      request.log.error(error, 'Error fetching alert rules');
      return reply.status(500).send({ error: 'Failed to fetch alert rules' });
    }
  });

  // WebSocket setup with Socket.IO
  await server.register(require('@fastify/websocket'));
  
  server.get('/ws', { websocket: true }, (connection, req) => {
    connection.socket.on('message', message => {
      connection.socket.send(`Echo: ${message}`);
    });

    connection.socket.on('subscribe', (data: any) => {
      console.log('Client subscribed to:', data);
    });
  });

  // Graceful shutdown
  const closeSignals = ['SIGINT', 'SIGTERM'];
  closeSignals.forEach(signal => {
    process.on(signal, async () => {
      server.log.info(`Shutting down on ${signal}`);
      await esService.close();
      await pgService.close();
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
    server.log.info(`Analytics API listening on http://0.0.0.0:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
