#!/bin/bash

echo "🚀 Testing Your Distributed Log Monitoring System"
echo "=================================================="
echo ""

# Health check
echo "1. Checking Ingestion API health..."
curl -s http://localhost:3001/health | jq .
echo ""

# Send test log
echo "2. Sending test log..."
RESPONSE=$(curl -s -X POST http://localhost:3001/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key" \
  -d '{
    "logs": [{
      "service_name": "test-app",
      "log_level": "info",
      "message": "Hello from DLM!",
      "timestamp": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'",
      "hostname": "localhost"
    }]
  }')

echo "$RESPONSE" | jq .
echo ""

# Check queue
echo "3. Redis Stream length:"
docker-compose exec redis redis-cli XLEN dlm:logs 2>/dev/null
echo ""

# Wait for processing
sleep 2

# Check Elasticsearch
echo "4. Logs in Elasticsearch:"
LOG_COUNT=$(curl -s "http://localhost:9200/dlm-logs-*/_search?size=0" | jq '.hits.total.value')
echo "Total logs indexed: $LOG_COUNT"
echo ""

echo "✅ Test complete!"
echo ""
echo "📊 Service Status:"
docker-compose ps --format "table {{.Name}}\t{{.Status}}"
echo ""
echo "🎉 Your system is running!"
echo ""
echo "Next steps:"
echo "  - View logs: docker-compose logs -f"
echo "  - Send more logs: curl -X POST http://localhost:3001/logs ..."
echo "  - Query Elasticsearch: curl 'http://localhost:9200/dlm-logs-*/_search?pretty'"
echo "  - Stop services: docker-compose down"
