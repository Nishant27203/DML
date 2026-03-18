import { Pool } from 'pg';

export interface MetricData {
  serviceName: string;  // Changed from serviceId
  metricName: string;
  metricValue: number;
  unit?: string;
  timestamp: Date;
  dimensions?: Record<string, any>;
}

export class MetricsRepository {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  async storeMetrics(metrics: MetricData[]): Promise<void> {
    if (metrics.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO metrics (service_name, metric_name, metric_value, unit, timestamp, dimensions, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `;

      for (const metric of metrics) {
        await client.query(query, [
          metric.serviceName,
          metric.metricName,
          metric.metricValue,
          metric.unit || null,
          metric.timestamp,
          JSON.stringify(metric.dimensions || {}),
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
