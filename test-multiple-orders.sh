#!/bin/bash

echo "Creating 5 test orders to demonstrate success/failure rates..."
echo ""

for i in 1 2 3 4 5; do
  amount=$((100 * i)).99
  
  response=$(curl -s -X POST http://localhost:3001/orders \
    -H "Content-Type: application/json" \
    -d "{
      \"productId\": \"PROD-00$i\",
      \"productName\": \"Test Product $i\",
      \"quantity\": 1,
      \"amount\": $amount,
      \"customerId\": \"CUST-$i\",
      \"customerEmail\": \"customer$i@example.com\"
    }")
  
  status=$(echo $response | jq -r '.data.status')
  product=$(echo $response | jq -r '.data.productName')
  
  if [ "$status" = "PAYMENT_SUCCESS" ]; then
    echo "[SUCCESS] $product - $status"
  else
    echo "[FAILED] $product - $status"
  fi
done

echo ""
echo "Note: Payment Service simulates ~80% success rate"