#!/bin/bash

echo "Docker Environment Check for NestJS Microservices"
echo "=================================================="

# Check Docker
if command -v docker &> /dev/null; then
    echo "[OK] Docker installed: $(docker --version)"
else
    echo "[ERROR] Docker is not installed"
    exit 1
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    echo "[OK] Docker Compose installed: $(docker-compose --version)"
else
    echo "[ERROR] Docker Compose is not installed"
    exit 1
fi

# Check Docker daemon
if docker info &> /dev/null; then
    echo "[OK] Docker daemon is running"
else
    echo "[ERROR] Docker daemon is not running"
    exit 1
fi

# Check required ports
echo ""
echo "Checking port availability..."
ports=(3001 3002 5433 5434 5672 15672 16686 14268)
all_clear=true

for port in "${ports[@]}"; do
    if lsof -i:$port &> /dev/null || netstat -an | grep -q ":$port "; then
        echo "[WARNING] Port $port is already in use"
        all_clear=false
    fi
done

if [ "$all_clear" = true ]; then
    echo "[OK] All required ports are available"
fi

echo ""
echo "Environment check complete."
echo ""
echo "To start the services, run:"
echo "  docker-compose up --build"
echo ""
echo "Services will be available at:"
echo "  - Order Service: http://localhost:3001"
echo "  - Payment Service: http://localhost:3002"
echo "  - RabbitMQ Management: http://localhost:15672 (admin/admin123)"
echo "  - Jaeger UI: http://localhost:16686"