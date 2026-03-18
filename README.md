# Distributed Log Monitoring & Alerting System (DLM)

A scalable distributed log monitoring platform similar to Datadog or ELK stack. The system collects logs from multiple servers, processes them through a data pipeline, stores them in databases, and provides a dashboard with search and alerting capabilities.

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Log Agent  │ ───► │ Ingestion API│ ───► │ Redis Stream│
└─────────────┘      └──────────────┘      └─────────────┘
                                                  │
                                                  ▼
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│  Dashboard  │ ◄─── │ Analytics API│ ◄─── │   Workers   │
└─────────────┘      └──────────────┘      └─────────────┘
                                                  │
                    ┌──────────────┐              │
                    │  PostgreSQL  │ ◄────────────┘
                    └──────────────┘
                    ┌──────────────┐
                    │Elasticsearch │ ◄────────────┘
                    └──────────────┘
```

## Core Components

### 1. **Log Agent** (`agents/log-agent`)
- Lightweight client that runs on servers
- Collects and forwards logs to ingestion API
- Supports batching and automatic retries
- Configurable flush intervals

### 2. **Ingestion API** (`services/ingestion-api`)
- Fastify-based REST API
- Receives logs from agents via `POST /logs`
- Validates and authenticates requests
- Pushes logs to Redis Streams
- Rate limiting and CORS support

### 3. **Message Queue** (Redis Streams)
- Buffers logs before processing
- Consumer groups for parallel processing
- Reliable delivery with acknowledgments

### 4. **Log Processing Workers** (`services/worker-service`)
- Consumes logs from Redis Streams
- Parses and normalizes log entries
- Stores logs in Elasticsearch
- Calculates metrics (log count, error rate)
- Stores metrics in PostgreSQL
- Triggers alerts based on rules

### 5. **Analytics API** (`services/analytics-api`)
- Provides data to dashboard
- Search logs endpoint: `GET /logs`
- Get alerts endpoint: `GET /alerts`
- Get metrics endpoint: `GET /metrics`
- WebSocket support for real-time updates

### 6. **Storage Layer**
- **Elasticsearch**: Log storage with full-text search
- **PostgreSQL**: Users, alerts, rules, metrics
- **Redis**: Caching and message queue

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)

### Installation

1. **Clone the repository**
```bash
cd DLM
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env and update values as needed
```

3. **Start all services**
```bash
docker-compose up -d
```

4. **Check service logs**
```bash
docker-compose logs -f
```

### Service Ports

| Service           | Port | Description                    |
|-------------------|------|--------------------------------|
| Frontend          | 3000 | Dashboard web interface        |
| Ingestion API     | 3001 | Log ingestion endpoint         |
| Analytics API     | 3002 | Data API for dashboard         |
| PostgreSQL        | 5432 | Relational database            |
| Redis             | 6379 | Cache and message queue        |
| Elasticsearch     | 9200 | Log storage                    |
| Nginx             | 80   | Reverse proxy                  |

## Usage Examples

### Sending Logs with Log Agent

```typescript
import { getAgent } from '@dlm/log-agent';

const agent = getAgent({
  apiKey: 'your-api-key',
  serviceName: 'my-service',
  ingestionUrl: 'http://localhost:3001/logs',
});

agent.info('Application started');
agent.error('Database connection failed', { db: 'postgres' });
agent.warn('High memory usage', { memory: 85 });
```

### Sending Logs via HTTP

```bash
curl -X POST http://localhost:3001/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "logs": [
      {
        "service_name": "my-service",
        "log_level": "info",
        "message": "User logged in",
        "timestamp": "2024-01-01T12:00:00Z",
        "hostname": "server-1",
        "metadata": { "userId": "123" }
      }
    ]
  }'
```

### Searching Logs

```bash
curl "http://localhost:3002/logs?service_name=my-service&log_level=error&limit=50"
```

### Getting Metrics

```bash
curl "http://localhost:3002/metrics?service_id=my-service&metric_name=error_rate"
```

## Configuration

### Environment Variables

See `.env.example` for all available configuration options:

- **PostgreSQL**: User, password, database, port
- **Redis**: Port, password
- **Elasticsearch**: Ports, JVM options
- **Services**: Ports, JWT secret, worker concurrency
- **Frontend**: API URLs

### Log Levels Supported

- `debug`
- `info`
- `warn`
- `error`
- `fatal`

## Development

### Running Individual Services

Each service can be run independently:

```bash
# Ingestion API
cd services/ingestion-api
npm install
npm run dev

# Worker Service
cd services/worker-service
npm install
npm run dev

# Analytics API
cd services/analytics-api
npm install
npm run dev
```

### Building for Production

```bash
docker-compose build
```

## API Documentation

### Ingestion API

#### POST /logs
Ingest log entries

**Headers:**
- `X-API-Key: <your-api-key>`

**Body:**
```json
{
  "logs": [
    {
      "service_name": "string",
      "log_level": "debug|info|warn|error|fatal",
      "message": "string",
      "timestamp": "ISO8601",
      "hostname": "string",
      "metadata": {}
    }
  ]
}
```

### Analytics API

#### GET /logs
Search and filter logs

**Query Parameters:**
- `q`: Full-text search query
- `service_name`: Filter by service
- `log_level`: Filter by level
- `start_time`: ISO8601 timestamp
- `end_time`: ISO8601 timestamp
- `limit`: Max results (default: 100, max: 1000)
- `offset`: Pagination offset

#### GET /alerts
Get triggered alerts

**Query Parameters:**
- `status`: active|acknowledged|resolved
- `service_id`: Filter by service
- `limit`: Max results

#### GET /metrics
Get aggregated metrics

**Query Parameters:**
- `service_id`: Service identifier (required)
- `metric_name`: Specific metric name
- `start_time`: ISO8601 timestamp
- `end_time`: ISO8601 timestamp
- `limit`: Max results

## Alerting System

### Creating Alert Rules

Alert rules are stored in PostgreSQL and evaluated by workers:

```sql
INSERT INTO alert_rules (
  name, rule_type, condition, severity, time_window_minutes
) VALUES (
  'High Error Rate',
  'threshold',
  '{"service_id": "my-service", "metric_name": "error_rate", "operator": ">", "value": 10}',
  'critical',
  5
);
```

### Alert Types

1. **Threshold Alerts**: Trigger when metrics exceed thresholds
2. **Pattern Alerts**: Trigger on specific log patterns (TODO)

## Security

### Authentication

- JWT tokens for user authentication
- API keys for log ingestion
- Configured via environment variables

### Best Practices

1. Change default JWT secret in production
2. Use HTTPS with SSL certificates
3. Enable Redis authentication
4. Restrict database access
5. Implement proper CORS policies

## Monitoring & Observability

Each service includes:
- Health check endpoints (`/health`)
- Structured logging with Pino
- Graceful shutdown handling

## Troubleshooting

### Common Issues

**Elasticsearch not starting:**
- Increase VM max map count: `sysctl -w vm.max_map_count=262144`
- Check Java heap size in docker-compose.yml

**Redis connection errors:**
- Verify Redis is running: `docker-compose ps`
- Check REDIS_URL environment variable

**Database connection errors:**
- Ensure PostgreSQL is healthy
- Verify DATABASE_URL format

## Future Enhancements

- [ ] Frontend dashboard implementation
- [ ] Advanced alerting (pattern matching, anomaly detection)
- [ ] Email and Slack notifications
- [ ] User management UI
- [ ] Log retention policies
- [ ] Multi-tenancy support
- [ ] Kafka integration option
- [ ] Kubernetes deployment manifests

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.
