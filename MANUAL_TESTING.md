# Manual Testing Guide for DLM

This guide shows you how to test each component of the Distributed Log Monitoring system manually.

## Prerequisites

Make sure infrastructure services are running:

```bash
cd /Users/nishant/DLM
docker-compose ps
```

You should see:
- ✅ dlm-postgres (healthy)
- ✅ dlm-redis (healthy)  
- ✅ dlm-elasticsearch (healthy)

---

## 1. Testing PostgreSQL

### Connect to PostgreSQL

```bash
docker-compose exec postgres psql -U dlm_user -d dlm_db
```

### Verify Tables Were Created

```sql
\dt
```

You should see all tables:
- users
- api_keys
- services
- alert_rules
- alerts
- alert_history
- metrics

### Check Default Admin User

```sql
SELECT email, name, role FROM users WHERE email = 'admin@dlm.local';
```

### Exit PostgreSQL

```sql
\q
```

---

## 2. Testing Redis

### Connect to Redis CLI

```bash
docker-compose exec redis redis-cli
```

### Test Redis Connection

```redis
PING
```

Expected output: `PONG`

### Check Redis Info

```redis
INFO server
```

### Exit Redis

```redis
EXIT
```

---

## 3. Testing Elasticsearch

### Check Cluster Health

```bash
curl http://localhost:9200/_cluster/health?pretty
```

Expected output should show `"status" : "green"` or `"status" : "yellow"` (yellow is OK for single-node).

### Get Elasticsearch Version

```bash
curl http://localhost:9200/
```

### List All Indices

```bash
curl http://localhost:9200/_cat/indices?v
```

Initially, this will be empty. Indices will be created when logs are ingested.

---

## 4. Testing Log Ingestion (Simulated)

Since we haven't built the application services yet, let's simulate log ingestion directly.

### Create a Test Log Entry in Redis Streams

```bash
docker-compose exec redis redis-cli XADD dlm:logs '*' data '{"id":"test-123","service_name":"test-service","log_level":"info","message":"Test log message","timestamp":"2024-01-01T12:00:00Z","hostname":"test-host","receivedAt":"2024-01-01T12:00:00Z"}'
```

### View Stream Length

```bash
docker-compose exec redis redis-cli XLEN dlm:logs
```

Should return: `(integer) 1`

### Read Messages from Stream

```bash
docker-compose exec redis redis-cli XRANGE dlm:logs - +
```

This shows all messages in the stream.

---

## 5. Creating Alert Rules

Insert an alert rule into PostgreSQL:

```bash
docker-compose exec postgres psql -U dlm_user -d dlm_db -c "
INSERT INTO alert_rules (id, name, description, user_id, rule_type, condition, severity, time_window_minutes, is_enabled, created_at, updated_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'High Error Rate Test',
  'Alert when error rate exceeds 10%',
  (SELECT id FROM users WHERE email = 'admin@dlm.local'),
  'threshold',
  '{\"service_id\": \"test-service\", \"metric_name\": \"error_rate\", \"operator\": \">\", \"value\": 10}'::jsonb,
  'warning',
  5,
  true,
  NOW(),
  NOW()
);
"
```

### Verify Alert Rule Was Created

```bash
docker-compose exec postgres psql -U dlm_user -d dlm_db -c "SELECT id, name, rule_type, severity FROM alert_rules;"
```

---

## 6. Simulating Metrics Data

Insert test metrics directly into PostgreSQL:

```bash
docker-compose exec postgres psql -U dlm_user -d dlm_db -c "
INSERT INTO metrics (service_id, metric_name, metric_value, unit, timestamp, dimensions, created_at)
VALUES 
  ('test-service', 'log_count', 100, 'count', NOW(), '{}', NOW()),
  ('test-service', 'error_count', 15, 'count', NOW(), '{}', NOW()),
  ('test-service', 'error_rate', 15.0, 'percentage', NOW(), '{}', NOW());
"
```

### Query Metrics

```bash
docker-compose exec postgres psql -U dlm_user -d dlm_db -c "SELECT metric_name, metric_value, unit FROM metrics WHERE service_id = 'test-service';"
```

---

## 7. Testing Network Connectivity

### From Application Service Perspective

Once services are running, you can test connectivity:

```bash
# Test database connection
docker-compose exec ingestion-api ping postgres

# Test Redis connection  
docker-compose exec worker-service ping redis

# Test Elasticsearch connection
docker-compose exec analytics-api curl http://elasticsearch:9200/_cluster/health
```

---

## 8. Viewing Logs

### View All Service Logs

```bash
docker-compose logs -f
```

### View Specific Service Logs

```bash
# PostgreSQL logs
docker-compose logs -f postgres

# Redis logs
docker-compose logs -f redis

# Elasticsearch logs
docker-compose logs -f elasticsearch
```

---

## 9. Database Queries Cheat Sheet

### Count Records in Each Table

```sql
-- Users count
SELECT COUNT(*) as user_count FROM users;

-- Services count
SELECT COUNT(*) as service_count FROM services;

-- Alert rules count
SELECT COUNT(*) as rule_count FROM alert_rules;

-- Alerts count
SELECT COUNT(*) as alert_count FROM alerts;

-- Metrics count
SELECT COUNT(*) as metric_count FROM metrics;
```

### View Recent Alerts

```sql
SELECT 
  a.id,
  a.title,
  a.message,
  a.severity,
  a.status,
  a.triggered_at,
  ar.name as rule_name
FROM alerts a
JOIN alert_rules ar ON a.alert_rule_id = ar.id
ORDER BY a.triggered_at DESC
LIMIT 10;
```

### View Metrics by Service

```sql
SELECT 
  service_id,
  metric_name,
  AVG(metric_value) as avg_value,
  MAX(metric_value) as max_value,
  MIN(metric_value) as min_value,
  COUNT(*) as data_points
FROM metrics
GROUP BY service_id, metric_name
ORDER BY service_id, metric_name;
```

---

## 10. Cleanup and Reset

### Remove All Data

```bash
# Stop all services and remove volumes
docker-compose down -v

# Restart fresh
docker-compose up -d
```

### Reset Individual Components

```bash
# Clear Redis streams
docker-compose exec redis redis-cli FLUSHALL

# Truncate all PostgreSQL tables
docker-compose exec postgres psql -U dlm_user -d dlm_db -c "
TRUNCATE TABLE metrics, alerts, alert_history, alert_rules, services, api_keys RESTART IDENTITY CASCADE;
"
```

---

## 11. Performance Testing

### Generate Load on Redis

```bash
# Add 1000 log entries to Redis Stream
for i in {1..1000}; do
  docker-compose exec redis redis-cli XADD dlm:logs '*' data "{\"id\":\"log-$i\",\"message\":\"Test log $i\"}"
done

# Check stream length
docker-compose exec redis redis-cli XLEN dlm:logs
```

### Elasticsearch Indexing Test

Once the worker service is running, monitor indexing performance:

```bash
# Check index stats
curl http://localhost:9200/dlm-logs-*/_stats?pretty
```

---

## Expected Results Summary

| Component | Test | Expected Result |
|-----------|------|-----------------|
| PostgreSQL | Connection | Successfully connect via psql |
| PostgreSQL | Tables | 7 tables created |
| Redis | PING | Returns PONG |
| Redis | Streams | Can add/read messages |
| Elasticsearch | Health | Status green or yellow |
| Elasticsearch | Indices | Empty initially, creates on log ingestion |
| Network | Connectivity | Services can reach each other |

---

## Troubleshooting Tips

### PostgreSQL Issues

```bash
# Check if PostgreSQL is ready
docker-compose exec postgres pg_isready -U dlm_user

# View initialization logs
docker-compose logs postgres | grep init
```

### Redis Issues

```bash
# Check Redis memory
docker-compose exec redis redis-cli INFO memory

# Monitor Redis commands
docker-compose exec redis redis-cli MONITOR
```

### Elasticsearch Issues

```bash
# Check cluster allocation
curl http://localhost:9200/_cluster/allocation/explain?pretty

# Check node info
curl http://localhost:9200/_nodes?pretty
```

### Network Issues

```bash
# Test DNS resolution within Docker network
docker-compose exec postgres ping redis

# Check network configuration
docker network inspect dlm_dlm-network
```

---

## Next Steps

After verifying infrastructure works:

1. Build and start application services
2. Test actual log ingestion via API
3. Verify workers process logs correctly
4. Test analytics API queries
5. Create and trigger alert rules

All infrastructure components are now ready for the application layer! 🎉
