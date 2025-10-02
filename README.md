# NestJS Microservices with RabbitMQ and PostgreSQL

A professional microservices architecture implementation using NestJS, RabbitMQ, and PostgreSQL databases, demonstrating inter-service communication, data persistence, error handling, and Docker orchestration.

## Architecture Overview

This project consists of two microservices that communicate via RabbitMQ with persistent PostgreSQL databases:

- **Order Service** (Port 3001): Handles order creation and initiates payment requests
- **Payment Service** (Port 3002): Processes payments and returns responses
- **RabbitMQ** (Ports 5672/15672): Message broker for inter-service communication
- **PostgreSQL Databases**: Separate databases for each service for data persistence
  - Order Database (Port 5433): Stores order information
  - Payment Database (Port 5434): Stores payment transactions

### Communication Flow
```
Client → Order Service → RabbitMQ → Payment Service
         ↑                              ↓
         ←── Response via RabbitMQ ────←
         
         Order Service ←→ PostgreSQL (orderdb)
         Payment Service ←→ PostgreSQL (paymentdb)
```

### Detailed Payment Processing Flow

When an order is placed, here's exactly how the payment processing works:

```
USER                ORDER SERVICE              RABBITMQ              PAYMENT SERVICE
 |                       |                        |                         |
 |--POST /orders-------->|                        |                         |
 |                       |                        |                         |
 |                    Create Order                |                         |
 |                    Save to DB                  |                         |
 |                    (PENDING)                   |                         |
 |                       |                        |                         |
 |                    Send Payment ------>payment_queue                     |
 |                    Request                     |                         |
 |                       |                        |                         |
 |                    Wait for                   |------Message----------->|
 |                    Response                    |                         |
 |                       |                        |                    Process Payment
 |                       |                        |                    Save to DB
 |                       |                        |                    (Simulate 500-2000ms)
 |                       |                        |                    (80% success rate)
 |                       |                        |                         |
 |                       |<-------Response--------|<-----Payment Result-----|
 |                       |                        |                         |
 |                  Update Order                  |                         |
 |                  Update DB                     |                         |
 |                  (SUCCESS/FAILED)              |                         |
 |                       |                        |                         |
 |<---Order Response-----|                        |                         |
 |                       |                        |                         |
```

#### Step-by-Step Process:
1. **Order Creation**: User sends POST request to create order
2. **Database Persistence**: Order is saved to PostgreSQL with pending status
3. **Payment Request**: Order Service sends payment request to RabbitMQ queue
4. **Message Processing**: Payment Service picks up message from queue
5. **Payment Simulation**: Payment Service simulates processing (500-2000ms delay)
6. **Success/Failure**: Randomly determines success (80%) or failure (20%)
7. **Payment Storage**: Payment result saved to PostgreSQL database
8. **Response**: Payment result sent back through RabbitMQ
9. **Order Update**: Order Service updates order status in database
10. **Client Response**: Final order status returned to user

## Features

- **Microservices Architecture**: Two independent NestJS services
- **Database Persistence**: PostgreSQL databases with TypeORM for data storage
- **RabbitMQ Integration**: Reliable message passing with request/response pattern
- **Error Handling**: Comprehensive error handling with retry logic
- **Structured Logging**: Winston logger with file and console outputs
- **Docker Support**: Full containerization with health checks
- **Data Validation**: DTOs with class-validator for input validation
- **Configuration Management**: Environment-based configuration
- **Health Checks**: Built-in health endpoints for monitoring
- **Database Migrations**: TypeORM with auto-sync for development

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- Git

## Installation & Setup

### Option 1: Run with Docker (Recommended)

1. Clone the repository:
```bash
git clone <repository-url>
cd nestjs-microservices
```

2. Build and start all services:
```bash
docker-compose up --build
```

This will start:
- PostgreSQL Order Database: postgres://localhost:5433
- PostgreSQL Payment Database: postgres://localhost:5434
- RabbitMQ Management UI: http://localhost:15672 (admin/admin123)
- Order Service: http://localhost:3001
- Payment Service: http://localhost:3002

### Option 2: Run Locally

1. Start infrastructure services using Docker:
```bash
# Start RabbitMQ
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  rabbitmq:3.12-management-alpine

# Start Order Database
docker run -d --name postgres-order \
  -p 5433:5432 \
  -e POSTGRES_DB=orderdb \
  -e POSTGRES_USER=orderuser \
  -e POSTGRES_PASSWORD=orderpass123 \
  postgres:15-alpine

# Start Payment Database  
docker run -d --name postgres-payment \
  -p 5434:5432 \
  -e POSTGRES_DB=paymentdb \
  -e POSTGRES_USER=paymentuser \
  -e POSTGRES_PASSWORD=paymentpass123 \
  postgres:15-alpine
```

2. Install dependencies for both services:
```bash
# Order Service
cd order-service
npm install
npm run build

# Payment Service
cd ../payment-service
npm install
npm run build
```

3. Start both services in separate terminals:

Terminal 1 - Order Service:
```bash
cd order-service
npm run start:dev
```

Terminal 2 - Payment Service:
```bash
cd payment-service
npm run start:dev
```

## API Documentation

### Order Service Endpoints

#### Create Order
**POST** `/orders`

Request Body:
```json
{
  "productId": "PROD-001",
  "productName": "Laptop",
  "quantity": 1,
  "amount": 999.99,
  "customerId": "CUST-123",
  "customerEmail": "customer@example.com"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "productId": "PROD-001",
    "productName": "Laptop",
    "quantity": 1,
    "amount": 999.99,
    "customerId": "CUST-123",
    "customerEmail": "customer@example.com",
    "status": "PAYMENT_SUCCESS",
    "paymentId": "payment-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:01.000Z"
  }
}
```

#### Get Order by ID
**GET** `/orders/:id`

#### Get All Orders
**GET** `/orders`

#### Health Check
**GET** `/orders/health/check`

### Payment Service Endpoints

#### Get All Payments
**GET** `/payments`

Query Parameters:
- `status` (optional): Filter by payment status (SUCCESS/FAILED)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "payment-uuid",
      "orderId": "order-uuid",
      "amount": 999.99,
      "currency": "USD",
      "customerId": "CUST-123",
      "customerEmail": "customer@example.com",
      "status": "SUCCESS",
      "transactionReference": "TXN-123456789",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 1,
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0,
    "totalAmount": 999.99
  }
}
```

#### Get Payment by ID
**GET** `/payments/:id`

#### Get Payment by Order ID
**GET** `/payments/order/:orderId`

#### Get Payment Statistics
**GET** `/payments/stats/summary`

#### Health Check
**GET** `/health`

## Database Schema

### Orders Table (orderdb)
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productId VARCHAR NOT NULL,
  productName VARCHAR NOT NULL,
  quantity INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  customerId VARCHAR NOT NULL,
  customerEmail VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  paymentId VARCHAR,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_customerId ON orders(customerId);
CREATE INDEX idx_orders_status ON orders(status);
```

### Payments Table (paymentdb)
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orderId VARCHAR UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR NOT NULL,
  customerId VARCHAR NOT NULL,
  customerEmail VARCHAR NOT NULL,
  status VARCHAR NOT NULL,
  failureReason VARCHAR,
  transactionReference VARCHAR,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_orderId ON payments(orderId);
CREATE INDEX idx_payments_status ON payments(status);
```

## Testing the System

### Using cURL

1. Create an order:
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD-001",
    "productName": "Laptop",
    "quantity": 1,
    "amount": 999.99,
    "customerId": "CUST-123",
    "customerEmail": "customer@example.com"
  }'
```

2. Check order status:
```bash
curl http://localhost:3001/orders/{order-id}
```

3. Get all orders:
```bash
curl http://localhost:3001/orders
```

4. Get all payments:
```bash
curl http://localhost:3002/payments
```

5. Get payment statistics:
```bash
curl http://localhost:3002/payments/stats/summary
```

### Using Postman

A complete Postman collection is included in the repository:

1. Import `NestJS-Microservices.postman_collection.json`
2. Import `NestJS-Microservices.postman_environment.json`
3. Select "NestJS Microservices - Local" environment
4. Run requests to test all endpoints

See `POSTMAN_GUIDE.md` for detailed instructions.

## Monitoring

### Database Access

Connect to PostgreSQL databases:
```bash
# Order Database
psql -h localhost -p 5433 -U orderuser -d orderdb

# Payment Database  
psql -h localhost -p 5434 -U paymentuser -d paymentdb
```

View data directly:
```bash
# Check orders
docker exec postgres-order psql -U orderuser -d orderdb -c "SELECT * FROM orders;"

# Check payments
docker exec postgres-payment psql -U paymentuser -d paymentdb -c "SELECT * FROM payments;"
```

### RabbitMQ Management

Access the RabbitMQ Management UI at http://localhost:15672
- Username: `admin`
- Password: `admin123`

Monitor:
- Queue depth
- Message rates
- Connection status

### Service Logs

Docker logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f order-service
docker-compose logs -f payment-service
docker-compose logs -f postgres-order
docker-compose logs -f postgres-payment
```

Local logs are stored in:
- `order-service/logs/order-service.log`
- `payment-service/logs/payment-service.log`

## Project Structure

```
nestjs-microservices/
├── order-service/
│   ├── src/
│   │   ├── config/
│   │   │   ├── configuration.ts
│   │   │   └── database.config.ts
│   │   ├── dto/
│   │   │   ├── create-order.dto.ts
│   │   │   ├── payment-request.dto.ts
│   │   │   └── payment-response.dto.ts
│   │   ├── entities/
│   │   │   └── order.entity.ts
│   │   ├── order/
│   │   │   ├── order.controller.ts
│   │   │   ├── order.module.ts
│   │   │   └── order.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .env
│   └── package.json
├── payment-service/
│   ├── src/
│   │   ├── config/
│   │   │   ├── configuration.ts
│   │   │   └── database.config.ts
│   │   ├── dto/
│   │   │   ├── payment-request.dto.ts
│   │   │   └── payment-response.dto.ts
│   │   ├── entities/
│   │   │   └── payment.entity.ts
│   │   ├── payment/
│   │   │   ├── payment.controller.ts
│   │   │   ├── payment-http.controller.ts
│   │   │   ├── payment.module.ts
│   │   │   └── payment.service.ts
│   │   ├── health/
│   │   │   └── health.controller.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── .env
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Configuration

### Environment Variables

#### Order Service
- `PORT`: Service port (default: 3001)
- `RABBITMQ_URL`: RabbitMQ connection URL (default: amqp://admin:admin123@localhost:5672)
- `RABBITMQ_QUEUE`: Queue name (default: payment_queue)
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5433)
- `DB_USERNAME`: Database username (default: orderuser)
- `DB_PASSWORD`: Database password (default: orderpass123)
- `DB_DATABASE`: Database name (default: orderdb)
- `NODE_ENV`: Environment (development/production)

#### Payment Service
- `PORT`: Service port (default: 3002)
- `RABBITMQ_URL`: RabbitMQ connection URL (default: amqp://admin:admin123@localhost:5672)
- `RABBITMQ_QUEUE`: Queue name (default: payment_queue)
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5434)
- `DB_USERNAME`: Database username (default: paymentuser)
- `DB_PASSWORD`: Database password (default: paymentpass123)
- `DB_DATABASE`: Database name (default: paymentdb)
- `NODE_ENV`: Environment (development/production)

## Payment Processing Details

### How Payment Service Works

The Payment Service simulates a real payment gateway with the following characteristics:

1. **Processing Time**: Random delay between 500ms to 2000ms
2. **Success Rate**: Approximately 80% of payments succeed
3. **Failure Reasons**: Randomly selected from:
   - Insufficient funds
   - Card declined
   - Invalid card number
   - Card expired
   - Transaction limit exceeded
   - Payment gateway timeout
   - Bank authorization failed

### Message Flow
1. Order Service publishes payment request to `payment_queue`
2. Payment Service consumes message from queue
3. Processes payment (simulated) and saves to database
4. Sends response back through RabbitMQ
5. Order Service receives response and updates order status in database

### Order Status Lifecycle
- `PENDING` → Initial state when order is created
- `PAYMENT_PROCESSING` → Payment request sent to Payment Service
- `PAYMENT_SUCCESS` → Payment completed successfully
- `PAYMENT_FAILED` → Payment was rejected or failed

## Error Handling

The system implements comprehensive error handling:

1. **Connection Failures**: Automatic reconnection to RabbitMQ with exponential backoff
2. **Database Failures**: TypeORM handles connection pooling and reconnection
3. **Payment Failures**: Simulated random failures (20% failure rate) for testing
4. **Timeout Handling**: 30-second timeout for payment processing
5. **Validation Errors**: Input validation with detailed error messages
6. **Service Unavailability**: Graceful degradation when Payment Service is down
7. **Message Acknowledgment**: Manual ACK/NACK to ensure message reliability

## Security Considerations

For production deployment:

1. Use strong passwords for RabbitMQ and PostgreSQL
2. Implement authentication/authorization (JWT, OAuth2)
3. Use TLS for RabbitMQ and database connections
4. Add rate limiting
5. Implement API Gateway
6. Use secrets management (Vault, K8s Secrets)
7. Add request signing between services
8. Enable database SSL/TLS connections
9. Implement database user permissions properly
10. Use prepared statements (handled by TypeORM)

## Performance Considerations

- Services use connection pooling for RabbitMQ and PostgreSQL
- Database indexes on frequently queried columns (customerId, status, orderId)
- TypeORM query optimization with lazy loading
- Heartbeat monitoring prevents stale connections
- Docker health checks ensure service availability
- Logging is asynchronous to prevent blocking
- Database connection pooling configured for optimal performance

## Database Backup and Restore

### Backup
```bash
# Backup order database
docker exec postgres-order pg_dump -U orderuser orderdb > orderdb_backup.sql

# Backup payment database
docker exec postgres-payment pg_dump -U paymentuser paymentdb > paymentdb_backup.sql
```

### Restore
```bash
# Restore order database
docker exec -i postgres-order psql -U orderuser orderdb < orderdb_backup.sql

# Restore payment database  
docker exec -i postgres-payment psql -U paymentuser paymentdb < paymentdb_backup.sql
```

## Cleanup

Stop and remove all containers and volumes:
```bash
docker-compose down -v
```

Remove images:
```bash
docker-compose down --rmi all
```

Clean up everything including volumes:
```bash
docker system prune -a --volumes
```

## Technologies Used

- **NestJS**: Progressive Node.js framework
- **PostgreSQL**: Relational database for data persistence
- **TypeORM**: Object-Relational Mapping for database operations
- **RabbitMQ**: Message broker for microservice communication
- **Docker**: Containerization platform
- **Winston**: Logging library
- **class-validator**: Input validation
- **TypeScript**: Type-safe JavaScript
- **amqplib**: RabbitMQ client library

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

Built using NestJS, RabbitMQ, and PostgreSQL

---
