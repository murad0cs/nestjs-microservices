#!/bin/bash

echo "Starting RabbitMQ container..."
docker run -d --name rabbitmq-local \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3.12-management-alpine

echo "Waiting for RabbitMQ to be ready..."
sleep 10

echo ""
echo "RabbitMQ started successfully!"
echo "Management UI: http://localhost:15672 (admin/admin123)"
echo ""
echo "Now start the services in separate terminals:"
echo "Terminal 1: cd order-service && npm run start:dev"
echo "Terminal 2: cd payment-service && npm run start:dev"