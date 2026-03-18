# Quick Start Guide

## Getting Started in 5 Minutes

### Step 1: Environment Setup

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` if needed (defaults work for local development).

### Step 2: Start All Services

```bash
# Using the setup script (recommended)
./setup.sh

# Or manually with docker-compose
docker-compose up -d
```

### Step 3: Verify Services

```bash
# Check all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 4: Test Log Ingestion

```bash
# Send test logs
curl -X POST http://localhost:3001/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{
    "logs": [
      {
        "service_name": "test-service",
        "log_level": "info",
        "message": "Hello from DLM!",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "hostname": "localhost"
      },
      {
        "service_name": "test-service",
        "log_level": "error",
        "message": "Test error message",
        "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
        "hostname": "localhost"
      }
    ]
  }'
```

### Step 5: Query Logs

```bash
# Search logs
curl "http://localhost:3002/logs?service_name=test-service&limit=10"

# Get metrics
curl "http://localhost:3002/metrics?service_id=test-service"
```

## Service URLs

| Service       | URL                      | Description                |
|---------------|--------------------------|----------------------------|
| Frontend      | http://localhost:3000    | Dashboard (TODO)           |
| Ingestion API | http://localhost:3001    | Log ingestion endpoint     |
| Analytics API | http://localhost:3002    | Data API                   |
| Nginx         | http://localhost:80      | Reverse proxy              |
| PostgreSQL    | localhost:5432           | Database                   |
| Redis         | localhost:6379           | Cache & Message Queue      |
| Elasticsearch | localhost:9200           | Log Storage                |

## Health Checks

```bash
# Check Ingestion API health
curl http://localhost:3001/health

# Check Analytics API health
curl http://localhost:3002/health

# Check Nginx health
curl http://localhost:80/health
```

## Common Commands

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f ingestion-api
docker-compose logs -f worker-service
docker-compose logs -f analytics-api

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v

# Restart services
docker-compose restart

# Rebuild services
docker-compose build
docker-compose up -d --force-recreate
```

## Default Credentials

**PostgreSQL:**
- User: `dlm_user`
- Password: `dlm_password_secure_123`
- Database: `dlm_db`

**Admin User (pre-created):**
- Email: `admin@dlm.local`
- Password: `admin123`

## Troubleshooting

### Elasticsearch Not Starting

Elasticsearch requires more memory. Increase Docker memory limit or adjust ES_JAVA_OPTS in docker-compose.yml:

```yaml
environment:
  - ES_JAVA_OPTS=-Xms256m -Xmx256m
```

Also check host system setting:
```bash
# On macOS, this is handled by Docker Desktop
# On Linux:
sudo sysctl -w vm.max_map_count=262144
```

### Port Conflicts

If ports are already in use, edit `.env` file and change the port mappings.

### Service Not Accessible

1. Check if service is running: `docker-compose ps`
2. Check service logs: `docker-compose logs <service-name>`
3. Verify network connectivity: `docker-compose exec <service> ping <target>`

## Next Steps

1. **Create API Keys**: Generate API keys for log ingestion
2. **Configure Alert Rules**: Set up alert rules in PostgreSQL
3. **Deploy Log Agents**: Install agents on your servers
4. **Build Dashboard**: Implement the frontend dashboard (TODO)

## Using the Log Agent (Node.js)

```bash
# Install agent package
npm install @dlm/log-agent

# Use in your application
node -e "
const { getAgent } = require('@dlm/log-agent');
const agent = getAgent({
  apiKey: 'your-api-key',
  serviceName: 'my-app',
  ingestionUrl: 'http://localhost:3001/logs'
});
agent.info('Application started');
"
```

## Architecture Reference

```
Log Sources → Log Agent → Ingestion API (3001) → Redis Streams
                                                          ↓
Dashboard (3000) ← Analytics API (3002) ← Workers ← Elasticsearch & PostgreSQL
```

For detailed documentation, see [README.md](README.md)
