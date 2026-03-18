import { Client as ElasticClient } from '@elastic/elasticsearch';
import { Pool } from 'pg';

export interface LogQueryParams {
  query?: string;
  service_name?: string;
  log_level?: string;
  hostname?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export class ElasticsearchService {
  private client: ElasticClient;

  constructor(elasticsearchUrl: string) {
    this.client = new ElasticClient({ node: elasticsearchUrl });
  }

  async searchLogs(params: LogQueryParams): Promise<any> {
    const indexPattern = 'dlm-logs-*';
    
    const boolQuery: any = {
      bool: {
        filter: [] as any[],
      },
    };

    // Add time range filter
    if (params.startTime || params.endTime) {
      boolQuery.bool.filter.push({
        range: {
          timestamp: {
            ...(params.startTime && { gte: params.startTime }),
            ...(params.endTime && { lte: params.endTime }),
          },
        },
      });
    }

    // Add service filter
    if (params.service_name) {
      boolQuery.bool.filter.push({
        term: { service_name: params.service_name },
      });
    }

    // Add log level filter
    if (params.log_level) {
      boolQuery.bool.filter.push({
        term: { log_level: params.log_level },
      });
    }

    // Add hostname filter
    if (params.hostname) {
      boolQuery.bool.filter.push({
        term: { hostname: params.hostname },
      });
    }

    // Add full-text search
    if (params.query) {
      boolQuery.bool.must = [
        {
          multi_match: {
            query: params.query,
            fields: ['message', 'service_name'],
          },
        },
      ];
    }

    const searchQuery = {
      index: indexPattern,
      body: {
        query: boolQuery,
        sort: [{ timestamp: 'desc' }],
        from: params.offset || 0,
        size: params.limit || 100,
      },
    };

    const result = await this.client.search(searchQuery);
    
    return {
      logs: result.body.hits.hits.map((hit: any) => hit._source),
      total: result.body.hits.total.value,
    };
  }

  async getMetrics(
    metricName: string,
    serviceId: string,
    startTime: string,
    endTime: string
  ): Promise<any[]> {
    const result = await this.client.search({
      index: 'dlm-logs-*',
      body: {
        query: {
          bool: {
            filter: [
              {
                range: {
                  timestamp: {
                    gte: startTime,
                    lte: endTime,
                  },
                },
              },
              {
                term: { service_name: serviceId },
              },
            ],
          },
        },
        aggs: {
          metrics_over_time: {
            date_histogram: {
              field: 'timestamp',
              calendar_interval: 'hour',
            },
            aggs: {
              log_count: { value_count: { field: '_index' } },
              error_count: {
                filter: {
                  terms: { log_level: ['error', 'fatal'] },
                },
              },
            },
          },
        },
        size: 0,
      },
    });

    return result.body.aggregations.metrics_over_time.buckets;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
