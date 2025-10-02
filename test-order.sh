#!/bin/bash

echo "Creating test order..."
echo ""

curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "productName": "MacBook Pro",
    "quantity": 1,
    "amount": 2499.99,
    "customerId": "CUST-123",
    "customerEmail": "john.doe@example.com"
  }' | json_pp

echo ""
echo "Order created successfully!"