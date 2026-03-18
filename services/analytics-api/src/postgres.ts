import { Pool } from 'pg';

export class PostgresService {
  private pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  async getUserByEmail(email: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  async getAlerts(params: {
    status?: string;
    serviceId?: string;
    limit?: number;
  }): Promise<any[]> {
    const query = `
      SELECT a.*, ar.name as rule_name, ar.severity as rule_severity
      FROM alerts a
      JOIN alert_rules ar ON a.alert_rule_id = ar.id
      WHERE 1=1
        ${params.status ? 'AND a.status = $1' : ''}
        ${params.serviceId ? 'AND a.service_id = $2' : ''}
      ORDER BY a.triggered_at DESC
      LIMIT $${params.status && params.serviceId ? 3 : params.status ? 2 : params.serviceId ? 2 : 1}
    `;

    const values = [];
    if (params.status) values.push(params.status);
    if (params.serviceId) values.push(params.serviceId);
    values.push(params.limit || 50);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async getMetrics(params: {
    serviceId: string;
    metricName?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): Promise<any[]> {
    const query = `
      SELECT * FROM metrics
      WHERE service_id = $1
        ${params.metricName ? 'AND metric_name = $2' : ''}
        ${params.startTime ? 'AND timestamp >= $' + (params.metricName ? 3 : 2) : ''}
        ${params.endTime ? 'AND timestamp <= $' + (params.metricName ? (params.startTime ? 4 : 3) : params.startTime ? 3 : 2) : ''}
      ORDER BY timestamp DESC
      LIMIT $${params.metricName ? (params.startTime ? (params.endTime ? 5 : 4) : params.endTime ? 4 : 3) : params.startTime ? (params.endTime ? 4 : 3) : params.endTime ? 3 : 2}
    `;

    const values = [params.serviceId];
    if (params.metricName) values.push(params.metricName);
    if (params.startTime) values.push(params.startTime);
    if (params.endTime) values.push(params.endTime);
    values.push(params.limit || 1000);

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async createAlert(data: {
    alertRuleId: string;
    serviceId?: string;
    title: string;
    message: string;
    severity: string;
    metadata?: any;
  }): Promise<any> {
    const query = `
      INSERT INTO alerts (alert_rule_id, service_id, title, message, severity, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await this.pool.query(query, [
      data.alertRuleId,
      data.serviceId || null,
      data.title,
      data.message,
      data.severity,
      JSON.stringify(data.metadata || {}),
    ]);

    return result.rows[0];
  }

  async getAlertRules(params?: { userId?: string; serviceId?: string }): Promise<any[]> {
    let query = 'SELECT * FROM alert_rules WHERE is_enabled = true';
    const values: any[] = [];

    if (params?.userId) {
      values.push(params.userId);
      query += ` AND user_id = $${values.length}`;
    }

    if (params?.serviceId) {
      values.push(params.serviceId);
      query += ` AND (service_id = $${values.length} OR service_id IS NULL)`;
    }

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
