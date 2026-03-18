import Redis from 'ioredis';
import { LogStorage } from './storage';
import { MetricsRepository, MetricData } from './metrics';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
const DATABASE_URL = process.env.DATABASE_URL || '';
const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);
const CONSUMER_GROUP = 'dlm-workers';
const CONSUMER_NAME = `worker-${process.pid}`;
const STREAM_KEY = 'dlm:logs';

class WorkerService {
  private redis: Redis;
  private logStorage: LogStorage;
  private metricsRepo: MetricsRepository;
  private isRunning = false;

  constructor() {
    this.redis = new Redis(REDIS_URL);
    this.logStorage = new LogStorage(ELASTICSEARCH_URL);
    this.metricsRepo = new MetricsRepository(DATABASE_URL);
  }

  async start(): Promise<void> {
    console.log('[Worker] Starting worker service...');
    
    // Initialize consumer group
    await this.initializeConsumerGroup();
    
    this.isRunning = true;
    
    // Start multiple workers based on concurrency
    for (let i = 0; i < WORKER_CONCURRENCY; i++) {
      this.processLogs();
    }
  }

  private async initializeConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '$', 'MKSTREAM');
      console.log('[Worker] Consumer group created');
    } catch (error: any) {
      if (error.message?.includes('BUSYGROUP')) {
        console.log('[Worker] Consumer group already exists');
      } else {
        throw error;
      }
    }
  }

  private async processLogs(): Promise<void> {
    while (this.isRunning) {
      try {
        // Read messages from stream
        const result = await this.redis.xreadgroup(
          'GROUP',
          CONSUMER_GROUP,
          CONSUMER_NAME,
          'COUNT',
          BATCH_SIZE.toString(),
          'BLOCK',
          '5000',
          'STREAMS',
          STREAM_KEY,
          '>'
        ) as [string, [string, string][]][] | null;

        if (!result || result.length === 0) {
          continue;
        }

        const messages: [string, any][] = result[0][1] as [string, any][];
        if (messages.length === 0) {
          continue;
        }

        console.log(`[Worker] Processing ${messages.length} logs`);

        // Process and store logs
        const logs = messages.map(([id, data]: [string, any]) => {
          // Data comes as { data: '{"id":"...","service_name":"..."}' }
          const logData = typeof data === 'string' ? JSON.parse(data) : data;
          const actualData = logData.data ? JSON.parse(logData.data) : logData;
          
          return {
            id,
            ...actualData,
            processedAt: new Date().toISOString(),
          };
        });

        // Store in Elasticsearch
        await this.logStorage.storeLogs(logs);

        // Calculate and store metrics
        await this.calculateAndStoreMetrics(logs);

        // Acknowledge messages
        const messageIds = messages.map(([id]: [string, any]) => id);
        await this.redis.xack(STREAM_KEY, CONSUMER_GROUP, ...messageIds);

      } catch (error) {
        console.error('[Worker] Error processing logs:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async calculateAndStoreMetrics(logs: any[]): Promise<void> {
    const timestamp = new Date();
    const metrics: MetricData[] = [];

    // Group by service
    const serviceMap = new Map<string, typeof logs>();
    logs.forEach(log => {
      const service = log.service_name;
      if (!serviceMap.has(service)) {
        serviceMap.set(service, []);
      }
      serviceMap.get(service)!.push(log);
    });

    // Calculate metrics per service
    for (const [serviceName, serviceLogs] of Array.from(serviceMap.entries())) {
      // Total log count
      metrics.push({
        serviceName: serviceName,
        metricName: 'log_count',
        metricValue: serviceLogs.length,
        unit: 'count',
        timestamp,
        dimensions: { hostname: serviceLogs[0]?.hostname },
      });

      // Error count
      const errorCount = serviceLogs.filter(
        log => ['error', 'fatal'].includes(log.log_level)
      ).length;

      metrics.push({
        serviceName: serviceName,
        metricName: 'error_count',
        metricValue: errorCount,
        unit: 'count',
        timestamp,
        dimensions: { hostname: serviceLogs[0]?.hostname },
      });

      // Error rate (percentage)
      const errorRate = (errorCount / serviceLogs.length) * 100;
      metrics.push({
        serviceName: serviceName,
        metricName: 'error_rate',
        metricValue: errorRate,
        unit: 'percentage',
        timestamp,
        dimensions: { hostname: serviceLogs[0]?.hostname },
      });
    }

    await this.metricsRepo.storeMetrics(metrics);
  }

  async stop(): Promise<void> {
    console.log('[Worker] Stopping worker service...');
    this.isRunning = false;
    
    await this.logStorage.close();
    await this.metricsRepo.close();
    await this.redis.quit();
  }
}

// Start the worker
const worker = new WorkerService();

worker.start().catch(error => {
  console.error('[Worker] Failed to start:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => worker.stop());
process.on('SIGTERM', () => worker.stop());
