#!/bin/bash

# DLM Setup and Startup Script

set -e

echo "🚀 Distributed Log Monitoring System - Setup"
echo "============================================"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please update values as needed."
    echo ""
fi

# Check Docker availability
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "🐳 Starting Docker services..."
echo ""

# Start all services
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo ""
echo "📊 Service Status:"
echo "----------------"
docker-compose ps

echo ""
echo "🔍 Checking service health..."

# Check PostgreSQL
if docker-compose exec -T postgres pg_isready -U dlm_user &> /dev/null; then
    echo "✅ PostgreSQL is ready"
else
    echo "⚠️  PostgreSQL is not ready yet"
fi

# Check Redis
if docker-compose exec -T redis redis-cli ping &> /dev/null; then
    echo "✅ Redis is ready"
else
    echo "⚠️  Redis is not ready yet"
fi

# Check Elasticsearch (may take longer)
echo "⏳ Elasticsearch may take 30-60 seconds to start..."

echo ""
echo "📝 Next Steps:"
echo "------------"
echo "1. View logs: docker-compose logs -f"
echo "2. Stop services: docker-compose down"
echo "3. Access services:"
echo "   - Frontend: http://localhost:3000"
echo "   - Ingestion API: http://localhost:3001"
echo "   - Analytics API: http://localhost:3002"
echo "   - Nginx: http://localhost:80"
echo ""
echo "📚 See README.md for usage examples and API documentation"
echo ""
echo "✨ Setup complete!"
