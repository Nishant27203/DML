# System Architecture

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      Nginx Reverse Proxy      │
                    │         (Port 80/443)         │
                    └───────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│   Frontend Dashboard  │ │    Ingestion API      │ │    Analytics API      │
│      (Port 3000)      │ │      (Port 3001)      │ │      (Port 3002)      │
│   (TODO - Not Built)  │ │   POST /logs          │ │   GET /logs           │
│                       │ │   Health: /health     │ │   GET /alerts         │
│                       │ │                       │ │   GET /metrics        │
│                       │ │                       │ │   GET /alert-rules    │
│                       │ │                       │ │   WS /ws              │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
                                    │                       ▲
                                    ▼                       │
                        ┌───────────────────────┐           │
                        │     Redis Streams     │           │
                        │   Message Queue       │           │
                        │   dlm:logs            │           │
                        └───────────────────────┘           │
                                    │                       │
                                    ▼                       │
                        ┌───────────────────────┐           │
                        │   Worker Service      │◄──────────┘
                        │   (Multiple Workers)  │
                        │   Concurrency: 5      │
                        └───────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │    Elasticsearch      │       │      PostgreSQL       │
        │    (Port 9200)        │       │      (Port 5432)      │
        │                       │       │                       │
        │  Indices:             │       │  Tables:              │
        │  dlm-logs-YYYY-MM-DD  │       │  - users              │
        │                       │       │  - api_keys           │
        │  Stores:              │       │  - services           │
        │  - All log entries    │       │  - alert_rules        │
        │  - Full-text search   │       │  - alerts             │
        │  - Time-series data   │       │  - alert_history      │
        │                       │       │  - metrics            │
        └───────────────────────┘       └───────────────────────┘
```

## Data Flow Architecture

### Log Ingestion Flow
```
┌──────────────┐
│ Application  │
└──────────────┘
       │
       │ 1. Generate logs
       ▼
┌──────────────┐
│  Log Agent   │────────────────────────────────┐
│  (Client)    │                                │
│              │ 2. Buffer logs (batch: 50)     │
│              │ 3. Flush (interval: 5s)        │
│              │ 4. Retry (max: 3, backoff)     │
└──────────────┘                                │
       │                                        │
       │ 5. HTTP POST /logs                     │
       │    Headers: X-API-Key                  │
       │    Body: { logs: [...] }               │
       ▼                                        │
┌──────────────────────────────────────────────┴──┐
│           Ingestion API (Fastify)               │
│                                                 │
│  1. Validate request (Zod)                      │
│  2. Check rate limit (100/min)                  │
│  3. Authenticate (API key)                      │
│  4. Validate log schema                         │
│  5. Publish to Redis Streams                    │
└─────────────────────────────────────────────────┘
       │
       │ 6. XADD dlm:logs
       ▼
┌─────────────────────────────────────────────────┐
│              Redis Streams                      │
│                                                 │
│  Stream: dlm:logs                               │
│  Consumer Group: dlm-workers                    │
│  Format: { id, log_data, receivedAt }           │
└─────────────────────────────────────────────────┘
```

### Log Processing Flow
```
┌─────────────────────────────────────────────────┐
│         Worker Service (Multiple Workers)       │
│                                                 │
│  Consumer Group: dlm-workers                    │
│  Concurrency: 5 workers                         │
│                                                 │
│  Processing Loop:                               │
│  1. XREADGROUP (COUNT 100, BLOCK 5s)           │
│  2. Parse logs                                  │
│  3. Add processedAt timestamp                   │
│  4. Bulk index to ES                            │
│  5. Calculate metrics                           │
│  6. Store metrics in PG                         │
│  7. Check alert rules                           │
│  8. XACK messages                               │
└─────────────────────────────────────────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌──────────────────┐  ┌──────────────────┐
│  Elasticsearch   │  │    PostgreSQL    │
│                  │  │                  │
│  Bulk Index:     │  │  Store Metrics:  │
│  - Daily indices │  │  - log_count     │
│  - Refresh: true │  │  - error_count   │
│  - Mapping:      │  │  - error_rate    │
│    * service_name│  │                  │
│    * log_level   │  │  Check Alerts:   │
│    * message     │  │  - Threshold     │
│    * timestamp   │  │  - Pattern       │
│    * metadata    │  │                  │
└──────────────────┘  └──────────────────┘
```

### Query Flow
```
┌──────────────┐
│   Dashboard  │
│   / Client   │
└──────────────┘
       │
       │ HTTP GET /logs?service=api&level=error
       │ HTTP GET /metrics?service_id=api
       │ HTTP GET /alerts?status=active
       ▼
┌─────────────────────────────────────────────────┐
│            Analytics API (Fastify)              │
│                                                 │
│  Routes:                                        │
│  - GET /logs    → Search Elasticsearch          │
│  - GET /metrics → Query PostgreSQL              │
│  - GET /alerts  → Query PostgreSQL              │
│  - WS /ws       → Real-time updates             │
│                                                 │
│  Features:                                      │
│  - Rate limiting (100/min)                      │
│  - CORS                                           │
│  - Security headers                             │
│  - JWT authentication (ready)                   │
└─────────────────────────────────────────────────┘
       │
       ├─────────────────┬─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│Elasticsearch │  │  PostgreSQL  │  │    Redis     │
│              │  │              │  │              │
│ Search logs  │  │ Get metrics  │  │  Cache       │
│ Full-text    │  │ Get alerts   │  │  Session     │
│ Aggregations │  │ Get rules    │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

## Component Interaction Matrix

| Component         | Communicates With                          | Protocol        | Purpose                    |
|-------------------|-------------------------------------------|-----------------|----------------------------|
| Log Agent         | Ingestion API                              | HTTP POST       | Send logs                  |
| Ingestion API     | Redis                                      | Redis Protocol  | Publish to streams         |
| Ingestion API     | PostgreSQL                                 | SQL             | Validate API keys (future) |
| Worker Service    | Redis                                      | Redis Protocol  | Consume from streams       |
| Worker Service    | Elasticsearch                              | HTTP REST       | Store logs                 |
| Worker Service    | PostgreSQL                                 | SQL             | Store metrics              |
| Analytics API     | Elasticsearch                              | HTTP REST       | Search logs                |
| Analytics API     | PostgreSQL                                 | SQL             | Get metrics/alerts         |
| Analytics API     | Redis                                      | Redis Protocol  | WebSocket pub/sub          |
| Frontend          | Analytics API                              | HTTP/WebSocket  | Display data               |
| Nginx             | All services                               | HTTP            | Reverse proxy              |

## Deployment Architecture

### Docker Compose Services

```yaml
Services (11 total):
├── Infrastructure (3)
│   ├── postgres      - PostgreSQL 15 database
│   ├── redis         - Redis 7 cache & streams
│   └── elasticsearch - Elasticsearch 8 search engine
│
├── Application Services (3)
│   ├── ingestion-api  - Log ingestion REST API
│   ├── worker-service - Log processing workers
│   └── analytics-api  - Data query REST API
│
├── Frontend (1)
│   └── frontend      - Next.js dashboard (TODO)
│
├── Reverse Proxy (1)
│   └── nginx         - Nginx reverse proxy
│
└── Agents (External)
    └── log-agent     - Deployed on client servers
```

### Network Topology

```
Docker Network: dlm-network (bridge)

┌─────────────────────────────────────────────────────┐
│                 dlm-network                         │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ postgres │  │  redis   │  │elastic   │         │
│  │  :5432   │  │  :6379   │  │  :9200   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│       ▲               ▲                ▲           │
│       │               │                │           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ingestion │  │  worker  │  │analytics │         │
│  │  :3001   │  │  N/A     │  │  :3002   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│       ▲                               │           │
│       │                               │           │
│  ┌──────────────────────────────────┐│           │
│  │            nginx                 ││           │
│  │            :80                   ││           │
│  └──────────────────────────────────┘│           │
│                                      │           │
└──────────────────────────────────────┼───────────┘
                                       │
                            ┌──────────▼──────────┐
                            │     frontend        │
                            │        :3000        │
                            └─────────────────────┘

External Access:
- Port 80 (HTTP) → Nginx
- Port 5432 → PostgreSQL (dev only)
- Port 6379 → Redis (dev only)
- Port 9200 → Elasticsearch (dev only)
```

## Scaling Strategy

### Horizontal Scaling

```
Log Sources → [Agent] ─┬─→ [Ingestion API #1] ─┐
                       ├─→ [Ingestion API #2] ─┼─→ [Redis Streams]
                       └─→ [Ingestion API #N] ─┘
                                                    │
                     ┌──────────────────────────────┼──────────────┐
                     │                              │              │
              ┌──────▼──────┐                ┌──────▼──────┐       │
              │ Worker #1   │                │ Worker #2   │       │
              │ (5 threads) │                │ (5 threads) │  ...  │
              └─────────────┘                └─────────────┘       │
                                                                   │
                     ┌─────────────────────────────────────────────┘
                     │
              ┌──────▼──────┐
              │Elasticsearch│
              │  Cluster    │
              └─────────────┘
              
              ┌──────▼──────┐
              │ PostgreSQL  │
              │  Primary +  │
              │  Replicas   │
              └─────────────┘
```

### Scaling Parameters

| Component         | Scale Factor           | Configuration              |
|-------------------|------------------------|----------------------------|
| Ingestion API     | Horizontal (load balancer) | Multiple instances     |
| Worker Service    | Vertical + Horizontal  | WORKER_CONCURRENCY, replicas |
| Redis             | Vertical               | Memory, CPU                |
| Elasticsearch     | Horizontal             | Nodes, shards              |
| PostgreSQL        | Vertical               | Connections, memory        |

## Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
└─────────────────────────────────────────────────────────────┘

Layer 1: Network Security
├── Nginx rate limiting
├── Docker network isolation
└── Port exposure control

Layer 2: Authentication
├── API keys for log ingestion
├── JWT for user authentication
└── Service-to-service auth (future)

Layer 3: Authorization
├── Role-based access control (users)
├── API key permissions
└── Resource-level access (future)

Layer 4: Data Security
├── Input validation (Zod)
├── SQL injection prevention
├── XSS prevention (Helmet)
└── CORS policy

Layer 5: Infrastructure
├── Non-root containers
├── Read-only filesystems (future)
└── Secrets management (env vars)
```

## Monitoring Points

```
Health Checks:
├── /health endpoints on all APIs
├── Database connectivity
├── Redis connectivity
├── Elasticsearch cluster health
└── Stream consumer lag

Metrics to Monitor:
├── Log ingestion rate
├── Processing latency
├── Error rates
├── Queue depth
├── API response times
├── Database query performance
└── Elasticsearch indexing rate

Alerts:
├── High error rate
├── Queue backlog
├── Service downtime
├── Slow queries
└── Resource exhaustion
```

This architecture supports:
- ✅ High throughput (1000s of logs/sec)
- ✅ Horizontal scaling
- ✅ Fault tolerance
- ✅ Low-latency queries
- ✅ Data durability
- ✅ Security best practices
