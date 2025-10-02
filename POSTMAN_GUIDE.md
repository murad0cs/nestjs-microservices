# Postman Collection Guide

## Import Instructions

1. **Open Postman**
2. **Import the Collection**:
   - Click "Import" button in Postman
   - Select `NestJS-Microservices.postman_collection.json`
   - Click "Import"

3. **Import the Environment**:
   - Click "Import" again
   - Select `NestJS-Microservices.postman_environment.json`
   - Click "Import"

4. **Select the Environment**:
   - In the top-right corner, select "NestJS Microservices - Local" from the environment dropdown

## Quick Start

### Prerequisites
Make sure the services are running:
```bash
docker-compose up -d
```

### Test Sequence

1. **Health Checks** - Verify services are running:
   - `Order Service > Health Check - Order Service`
   - `Payment Service > Health Check - Payment Service`

2. **Create Your First Order**:
   - Run `Order Service > Create Order - Success Scenario`
   - Check the response - note the order ID and payment status

3. **Retrieve Order Details**:
   - The order ID is automatically saved to the `orderId` variable
   - Run `Order Service > Get Order by ID`

4. **View All Orders**:
   - Run `Order Service > Get All Orders`

## Collection Structure

### Order Service (9 requests)
| Request | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| Create Order - Success Scenario | POST | `/orders` | Creates order with valid data |
| Create Order - Multiple Products | POST | `/orders` | Order with quantity > 1 |
| Create Order - Small Amount | POST | `/orders` | Tests small payment amounts |
| Create Order - Invalid Data | POST | `/orders` | Tests validation (missing fields) |
| Create Order - Invalid Email | POST | `/orders` | Tests email validation |
| Get Order by ID | GET | `/orders/{{orderId}}` | Retrieves specific order |
| Get Non-Existent Order | GET | `/orders/non-existent-id` | Tests 404 error handling |
| Get All Orders | GET | `/orders` | Lists all orders |
| Health Check | GET | `/orders/health/check` | Service health status |

### Payment Service (7 requests)
| Request | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| Health Check | GET | `/health` | Service health status |
| Get All Payments | GET | `/payments` | All payments with statistics |
| Get Successful Payments | GET | `/payments?status=SUCCESS` | Filter successful payments |
| Get Failed Payments | GET | `/payments?status=FAILED` | Filter failed payments |
| Get Payment by ID | GET | `/payments/{{paymentId}}` | Specific payment details |
| Get Payment by Order ID | GET | `/payments/order/{{orderId}}` | Payment for specific order |
| Get Payment Statistics | GET | `/payments/stats/summary` | Comprehensive statistics |

### Load Testing (1 request)
| Request | Method | Endpoint | Description |
|---------|--------|----------|-------------|
| Create 10 Orders | POST | `/orders` | For use with Collection Runner |

## Testing Scenarios

### 1. Basic Flow Test
Run these requests in sequence:
1. Health Check - Order Service
2. Health Check - Payment Service
3. Create Order - Success Scenario
4. Get Order by ID
5. Get Payment by Order ID
6. Get All Orders
7. Get All Payments
8. Get Payment Statistics

### 2. Validation Testing
Test the validation rules:
1. Create Order - Invalid Data (should return 400)
2. Create Order - Invalid Email (should return 400)
3. Get Non-Existent Order (should return 404)

### 3. Load Testing
Use Postman Collection Runner:
1. Select the collection
2. Choose "Load Testing > Create 10 Orders - Load Test"
3. Set iterations to 10-20
4. Set delay to 500ms between requests
5. Run and observe:
   - ~80% success rate for payments
   - Response times
   - Any errors

## Environment Variables

| Variable | Default Value | Description |
|----------|--------------|-------------|
| `baseUrl` | http://localhost:3001 | Order Service URL |
| `paymentServiceUrl` | http://localhost:3002 | Payment Service URL |
| `orderId` | (dynamic) | Auto-set from create order |
| `rabbitmqUrl` | http://localhost:15672 | RabbitMQ Management UI |
| `rabbitmqUser` | admin | RabbitMQ username |
| `rabbitmqPassword` | admin123 | RabbitMQ password |
| `successCount` | 0 | Load test success counter |
| `failureCount` | 0 | Load test failure counter |

## Response Examples

### Successful Order Creation
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "productId": "PROD-001",
    "productName": "MacBook Pro M3",
    "quantity": 1,
    "amount": 2499.99,
    "customerId": "CUST-123",
    "customerEmail": "john.doe@example.com",
    "status": "PAYMENT_SUCCESS",
    "paymentId": "payment-uuid",
    "createdAt": "2025-01-01T10:00:00.000Z",
    "updatedAt": "2025-01-01T10:00:02.000Z"
  }
}
```

### Failed Payment
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "status": "PAYMENT_FAILED",
    "message": "Payment failed: Insufficient funds"
  }
}
```

### Validation Error
```json
{
  "statusCode": 400,
  "message": [
    "productName should not be empty",
    "amount must be a positive number"
  ],
  "error": "Bad Request"
}
```

## Test Assertions

Each request includes automated tests:

- **Status Code Checks**: Verifies correct HTTP status codes
- **Response Structure**: Validates JSON response format
- **Business Logic**: Checks success flags and data presence
- **Error Handling**: Confirms proper error messages

## Tips

1. **Random Data**: The collection uses Postman dynamic variables:
   - `{{$randomInt}}` - Random integer
   - `{{$randomEmail}}` - Random email address

2. **Order ID Tracking**: After creating an order, the ID is automatically saved to `{{orderId}}` for subsequent requests

3. **Payment Success Rate**: The Payment Service simulates ~80% success rate, so some orders will fail - this is expected behavior

4. **Debugging**: Check the Postman Console (View > Show Postman Console) for detailed request/response logs

5. **Collection Runner**: Use for automated testing:
   - Select folder or entire collection
   - Set iterations and delay
   - Review results in the Runner tab

## Workflow Automation

### Pre-request Scripts
- Generates random test data
- Sets dynamic variables

### Test Scripts
- Validates responses
- Saves variables for chaining requests
- Counts success/failure rates

## Performance Testing

For performance testing:
1. Use Collection Runner with 50-100 iterations
2. Monitor:
   - Average response time
   - Success rate (~80% expected)
   - Error patterns
3. Check RabbitMQ Management UI for queue metrics
4. Review service logs for any issues

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Ensure services are running: `docker-compose up -d` |
| 404 on health check | Check service ports (3001, 3002) |
| No response | Verify Docker containers are healthy |
| Variable not set | Manually set in Environment tab |

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [RabbitMQ Management](http://localhost:15672) (admin/admin123)
- [Postman Learning Center](https://learning.postman.com)

---

**Note**: This collection is designed to thoroughly test all aspects of the NestJS microservices system, including success scenarios, error handling, and load testing capabilities.