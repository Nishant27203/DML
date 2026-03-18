import axios, { AxiosInstance } from 'axios';
import { LogEntry, AgentConfig } from './types';

export class LogSender {
  private client: AxiosInstance;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.ingestionUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
    });
  }

  async send(logs: LogEntry[]): Promise<boolean> {
    if (logs.length === 0) return true;

    let retries = 0;
    while (retries < this.config.maxRetries) {
      try {
        await this.client.post('', { logs });
        return true;
      } catch (error) {
        retries++;
        if (retries >= this.config.maxRetries) {
          console.error('[LogAgent] Failed to send logs after max retries:', error);
          return false;
        }
        await this.sleep(this.config.retryDelayMs * retries); // Exponential backoff
      }
    }
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
