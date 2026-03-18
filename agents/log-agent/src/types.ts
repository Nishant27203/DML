export interface LogEntry {
  service_name: string;
  log_level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: string;
  hostname: string;
  metadata?: Record<string, any>;
}

export interface AgentConfig {
  ingestionUrl: string;
  apiKey: string;
  serviceName: string;
  batchSize: number;
  flushIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  enabled: boolean;
}

export const defaultConfig: AgentConfig = {
  ingestionUrl: process.env.INGESTION_URL || 'http://localhost:3001/logs',
  apiKey: process.env.AGENT_API_KEY || '',
  serviceName: process.env.SERVICE_NAME || 'unknown-service',
  batchSize: parseInt(process.env.BATCH_SIZE || '50', 10),
  flushIntervalMs: parseInt(process.env.FLUSH_INTERVAL_MS || '5000', 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000', 10),
  enabled: process.env.AGENT_ENABLED !== 'false',
};
