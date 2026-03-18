import { LogEntry, AgentConfig, defaultConfig } from './types';
import { LogBuffer } from './buffer';
import { LogSender } from './sender';

export class LogAgent {
  private config: AgentConfig;
  private buffer: LogBuffer;
  private sender: LogSender;
  private flushTimer: NodeJS.Timeout | null = null;
  private hostname: string;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.buffer = new LogBuffer(this.config.batchSize);
    this.sender = new LogSender(this.config);
    this.hostname = process.env.HOSTNAME || 'localhost';

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  log(
    level: LogEntry['log_level'],
    message: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enabled || !this.config.apiKey) {
      return;
    }

    const entry: LogEntry = {
      service_name: this.config.serviceName,
      log_level: level,
      message,
      timestamp: new Date().toISOString(),
      hostname: this.hostname,
      metadata,
    };

    const shouldFlush = this.buffer.add(entry);
    if (shouldFlush) {
      this.flush();
    }
  }

  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  error(message: string, metadata?: Record<string, any>): void {
    this.log('error', message, metadata);
  }

  fatal(message: string, metadata?: Record<string, any>): void {
    this.log('fatal', message, metadata);
  }

  async flush(): Promise<void> {
    if (this.buffer.isEmpty()) {
      return;
    }

    const logs = this.buffer.flush();
    const success = await this.sender.send(logs);

    if (!success) {
      // Re-add logs to buffer on failure
      logs.forEach(log => this.buffer.add(log));
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, this.config.flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Export singleton instance for convenience
let globalAgent: LogAgent | null = null;

export function getAgent(config?: Partial<AgentConfig>): LogAgent {
  if (!globalAgent) {
    globalAgent = new LogAgent(config);
  }
  return globalAgent;
}
