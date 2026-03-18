import { Pool } from 'pg';

export interface AlertRule {
  id: string;
  name: string;
  rule_type: 'threshold' | 'pattern';
  condition: any;
  threshold_value?: number;
  time_window_minutes: number;
  severity: string;
  is_enabled: boolean;
}

export class AlertEngine {
  private pool: Pool;
  private checkIntervalMs: number;

  constructor(databaseUrl: string, checkIntervalMs: number = 60000) {
    this.pool = new Pool({ connectionString: databaseUrl });
    this.checkIntervalMs = checkIntervalMs;
  }

  async checkAlertRules(metrics: Array<{ serviceId: string; metricName: string; value: number }>): Promise<void> {
    const rules = await this.getActiveAlertRules();

    for (const rule of rules) {
      const relevantMetrics = metrics.filter(m => m.serviceId === rule.condition?.service_id);
      
      if (rule.rule_type === 'threshold') {
        await this.checkThresholdRule(rule, relevantMetrics);
      }
    }
  }

  private async checkThresholdRule(
    rule: AlertRule,
    metrics: Array<{ serviceId: string; metricName: string; value: number }>
  ): Promise<void> {
    const targetMetric = metrics.find(
      m => m.metricName === rule.condition?.metric_name
    );

    if (!targetMetric) return;

    const { operator, value } = rule.condition;
    let triggered = false;

    switch (operator) {
      case '>':
        triggered = targetMetric.value > value;
        break;
      case '>=':
        triggered = targetMetric.value >= value;
        break;
      case '<':
        triggered = targetMetric.value < value;
        break;
      case '<=':
        triggered = targetMetric.value <= value;
        break;
      case '==':
        triggered = targetMetric.value === value;
        break;
    }

    if (triggered) {
      await this.triggerAlert(rule, targetMetric);
    }
  }

  private async triggerAlert(rule: AlertRule, metric: any): Promise<void> {
    const query = `
      INSERT INTO alerts (alert_rule_id, title, message, severity, metadata, triggered_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const title = `Alert: ${rule.name}`;
    const message = `${rule.name} triggered - ${metric.metricName} is ${metric.value}`;

    await this.pool.query(query, [
      rule.id,
      title,
      message,
      rule.severity,
      JSON.stringify({ metric, rule }),
    ]);

    console.log(`[AlertEngine] Triggered alert: ${title}`);
  }

  private async getActiveAlertRules(): Promise<AlertRule[]> {
    const result = await this.pool.query(
      'SELECT * FROM alert_rules WHERE is_enabled = true'
    );
    return result.rows;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
