import Redis from 'ioredis';
import { LogEntry } from './schemas';

export class MessageQueue {
  private redis: Redis;
  private streamName: string = 'dlm:logs';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async publish(logs: LogEntry[]): Promise<void> {
    if (logs.length === 0) return;

    for (const log of logs) {
      const entry = {
        id: crypto.randomUUID(),
        ...log,
        receivedAt: new Date().toISOString(),
      };
      
      await this.redis.xadd(this.streamName, '*', 'data', JSON.stringify(entry));
    }
  }

  async getQueueLength(): Promise<number> {
    return await this.redis.xlen(this.streamName);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
