import { Client as ElasticClient } from '@elastic/elasticsearch';

interface LogDocument {
  id: string;
  service_name: string;
  log_level: string;
  message: string;
  timestamp: string;
  hostname: string;
  metadata?: Record<string, any>;
  receivedAt: string;
  processedAt: string;
}

export class LogStorage {
  private client: ElasticClient;
  private indexPrefix: string = 'dlm-logs';

  constructor(elasticsearchUrl: string) {
    this.client = new ElasticClient({
      node: elasticsearchUrl,
    });
  }

  async storeLogs(logs: Array<{ id: string } & Record<string, any>>): Promise<void> {
    if (logs.length === 0) return;

    const indexName = `${this.indexPrefix}-${this.getCurrentDate()}`;
    
    // Create index if it doesn't exist
    await this.createIndexIfNotExists(indexName);

    const body = logs.flatMap(log => [
      { index: { _index: indexName } },
      log,
    ]);

    await this.client.bulk({ refresh: true, body });
  }

  private async createIndexIfNotExists(indexName: string): Promise<void> {
    try {
      await this.client.indices.get({ index: indexName });
    } catch (error: any) {
      if (error.statusCode === 404) {
        await this.client.indices.create({
          index: indexName,
          body: {
            mappings: {
              properties: {
                id: { type: 'keyword' },
                service_name: { type: 'keyword' },
                log_level: { type: 'keyword' },
                message: { type: 'text', analyzer: 'standard' },
                timestamp: { type: 'date' },
                hostname: { type: 'keyword' },
                metadata: { type: 'object', enabled: true },
                receivedAt: { type: 'date' },
                processedAt: { type: 'date' },
              },
            },
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              'index.lifecycle.name': 'dlm-logs-policy',
              'index.lifecycle.rollover_alias': 'dlm-logs',
            },
          },
        });
      } else {
        throw error;
      }
    }
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
