# NestJS Microservices with RabbitMQ and PostgreSQL

A production-ready microservices architecture implementation using NestJS, RabbitMQ, and PostgreSQL databases, featuring Circuit Breaker pattern, Dead Letter Queue (DLQ), Distributed Tracing, comprehensive security features, and full Docker orchestration.

## Key Production Features

### Circuit Breaker Pattern
- Prevents cascading failures between services
- Automatic circuit opening on threshold breaches (50% failure rate)
- Half-open state for recovery testing
- Manual circuit reset capability
- Real-time circuit breaker statistics
- Configurable timeout and error thresholds

### Dead Letter Queue (DLQ) - Active Retry System
- **Auto-processing design**: Messages are immediately consumed and evaluated for retry
- **Smart retry logic**: Automatically retries transient failures, skips permanent failures
- **Real-time processing**: Queue shows 0 messages as they're processed instantly
- **Retry conditions**: Retries up to 3 times within 1 hour window
- **Skip conditions**: Won't retry "Invalid" or "Insufficient funds" errors
- **Manual reprocessing**: Available via `/dlq/reprocess/:orderId` endpoint
- **Statistics monitoring**: Track processed, retried, and failed messages

### Distributed Tracing (OpenTelemetry + Jaeger)
- **Current Status**: Simplified implementation (full tracing temporarily disabled due to TypeScript compatibility)
- Jaeger UI available at http://localhost:16686
- Trace helper functions preserved for future integration
- Core service functionality unaffected
- To be restored with proper OpenTelemetry package compatibility

## Security Features

### Rate Limiting
- Configurable rate limits per endpoint
- 10 requests/second, 50 requests/10 seconds, 100 requests/minute
- Prevents API abuse and DDoS attacks
- Health endpoints excluded from rate limiting

### Security Headers (Helmet)
- Content Security Policy (CSP) enabled
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options protection
- X-Content-Type-Options: nosniff
- Prevents common web vulnerabilities

### CORS Configuration
- Configurable allowed origins via environment variables
- Credentials support for authenticated requests
- Exposed headers for rate limit information
- Proper preflight request handling

### Input Validation
- DTOs with class-validator
- Whitelist strategy - only allow defined properties
- Automatic type transformation
- SQL injection prevention via TypeORM

## Core Business Features

 **Product Catalog System** - Centralized product management with unique SKUs  
 **Inventory Management** - Real-time stock tracking with automatic updates  
 **Payment Retry System** - Retry failed payments with stock validation  
 **Price Consistency** - Product prices managed centrally, not user-provided  
 **Stock Recovery** - Automatic stock restoration on payment failures  
 **Historical Pricing** - Orders preserve prices at time of purchase

## Architecture Overview

This project implements a production-grade microservices architecture with advanced resilience and monitoring capabilities:

### Services
- **Order Service** (Port 3001): Order management with Circuit Breaker protection
- **Payment Service** (Port 3002): Payment processing with automatic retry mechanisms

### Infrastructure
- **RabbitMQ** (Ports 5672/15672): Message broker with Dead Letter Queue support
- **PostgreSQL Databases**: Isolated databases per service
  - Order Database (Port 5433): Orders, products, and inventory
  - Payment Database (Port 5434): Payment transactions and history
- **Jaeger** (Port 16686): Distributed tracing UI for request monitoring

### Resilience Patterns
- **Circuit Breaker**: Protects against cascading failures
- **Dead Letter Queue**: Handles failed messages for later processing
- **Retry Mechanism**: Automatic and manual payment retries
- **Rate Limiting**: API protection against abuse
- **Health Checks**: Service availability monitoring

### Communication Flow

```
                                   ┌─────────────┐
                                   │   Jaeger    │
                                   │   (Tracing) │
                                   └──────┬──────┘
                                          │ Collect Traces
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
                    ↓                     ↓                     ↓
┌──────────────────────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│     ORDER SERVICE (3001)     │  │   RabbitMQ   │  │   PAYMENT SERVICE (3002) │
│                              │  │              │  │                          │
│  ┌────────────────────────┐  │  │ ┌──────────┐ │  │  ┌────────────────────┐  │
│  │   Circuit Breaker      │  │  │ │  Payment │ │  │  │  Payment Processor │  │
│  │   - Payment Service    │──┼──┼→│  Queue   │─┼──┼→ │  - Process Payment │  │
│  │   - Fallback on Open   │  │  │ └──────────┘ │  │  │  - 80% Success     │  │
│  └────────────────────────┘  │  │              │  │  └────────────────────┘  │
│                              │  │ ┌──────────┐ │  │                          │
│  ┌────────────────────────┐  │  │ │   DLQ    │ │  │  ┌────────────────────┐  │
│  │   DLQ Handler          │←─┼──┼─│ (Active  │ │  │  │  OpenTelemetry     │  │
│  │   - Auto-consume msgs  │  │  │ │Processor)│ │  │  │  - Simplified impl │  │
│  │   - Smart retry logic  │  │  │ └──────────┘ │  │  │  - Core functions  │  │
│  └────────────────────────┘  │  │              │  │  └────────────────────┘  │
│                              │  │              │  │                          │
│  ┌────────────────────────┐  │  │              │  │  ┌────────────────────┐  │
│  │   Product Service      │  │  │              │  │  │  Security          │  │
│  │   - Inventory Mgmt     │  │  │              │  │  │  - Rate Limiting   │  │
│  │   - Stock Tracking     │  │  │              │  │  │  - Helmet Headers  │  │
│  └────────────────────────┘  │  │              │  │  │  - CORS Config     │  │
│                              │  │              │  │  └────────────────────┘  │
└──────────────┬───────────────┘  └──────────────┘  └───────────┬──────────────┘
               │                                                  │
               ↓                                                  ↓
       ┌──────────────┐                                  ┌──────────────┐
       │  PostgreSQL  │                                  │  PostgreSQL  │
       │   OrderDB    │                                  │  PaymentDB   │
       │   (5433)     │                                  │   (5434)     │
       └──────────────┘                                  └──────────────┘
```

### Enhanced Architecture Features

- **Circuit Breaker**: Protects Order Service from Payment Service failures
- **Dead Letter Queue**: Active message processor with automatic retry logic
- **Distributed Tracing**: Simplified implementation (full tracing pending restoration)
- **Rate Limiting**: API protection on all endpoints
- **Security Headers**: Comprehensive security via Helmet middleware

### DLQ Message Flow
```
Failed Payment → payment_dlq → Auto-Consumer → Evaluation
                                      ↓
                              [Retryable?]
                                ↓        ↓
                              YES       NO
                                ↓        ↓
                          retry_queue   Log & Alert
                                ↓
                          (30s delay)
                                ↓
                          payment_queue
```

### Detailed Payment Processing Flow

When an order is placed, here's the complete flow including resilience patterns:

```
USER            ORDER SERVICE         CIRCUIT BREAKER      RABBITMQ         PAYMENT SERVICE      JAEGER
 |                    |                      |                 |                  |                |
 |--POST /orders----->|                      |                 |                  |                |
 |                    |                      |                 |                  |                |
 |                 [Start Trace Span]--------|-----------------|------------------|--------------->|
 |                    |                      |                 |                  |                |
 |                 Validate Input            |                 |                  |                |
 |                 Check Product             |                 |                  |                |
 |                 Check Stock               |                 |                  |                |
 |                 Create Order              |                 |                  |                |
 |                 Save to DB                |                 |                  |                |
 |                 (PENDING)                 |                 |                  |                |
 |                    |                      |                 |                  |                |
 |                    |--Check Circuit------->|                 |                  |                |
 |                    |                      |                 |                  |                |
 |                    |<--Circuit CLOSED------|                 |                  |                |
 |                    |                      |                 |                  |                |
 |                    |--Send Payment Request-|------->payment_queue              |                |
 |                    |   (with timeout)      |                 |                  |                |
 |                    |                      |                 |                  |                |
 |                    |                      |                 |----Message------>|                |
 |                    |                      |                 |                  |                |
 |                    |                      |                 |              [Span: Process Payment]->|
 |                    |                      |                 |              Validate Request      |
 |                    |                      |                 |              Process Payment       |
 |                    |                      |                 |              (500-2000ms delay)    |
 |                    |                      |                 |              (80% success rate)    |
 |                    |                      |                 |              Save to DB            |
 |                    |                      |                 |                  |                |
 |                    |                      |                 |<--Payment Result-|                |
 |                    |                      |                 |                  |                |
 |                    |<------Response--------|--------Success/Failure           |                |
 |                    |                      |                 |                  |                |
 |                    |--Update Circuit------>|                 |                  |                |
 |                    |  (success/failure)    |                 |                  |                |
 |                    |                      |                 |                  |                |
 |                 Update Order Status        |                 |                  |                |
 |                 Update Stock               |                 |                  |                |
 |                 Update DB                  |                 |                  |                |
 |                    |                      |                 |                  |                |
 |                 [End Trace Span]-----------|-----------------|------------------|--------------->|
 |                    |                      |                 |                  |                |
 |<--Order Response---|                      |                 |                  |                |
 |                    |                      |                 |                  |                |

IF PAYMENT FAILS OR TIMEOUT:
 |                    |                      |                 |                  |                |
 |                    |--Circuit Records----->|                 |                  |                |
 |                    |    Failure            |                 |                  |                |
 |                    |                      |                 |                  |                |
 |                    |------Send to DLQ------|------->payment_dlq               |                |
 |                    |                      |                 |                  |                |
 |                    |                      |                 |--Auto Consume--->|                |
 |                    |                      |                 | (Immediate)      |                |
 |                    |                      |                 |                  |                |
 |                    |                      |                 |<-Evaluate Retry--|                |
 |                    |                      |                 |                  |                |
 |                    |                      |                 |--If Retryable--->|                |
 |                    |                      |                 |  Send to Retry   |                |
 |                    |                      |                 |  Queue (30s)     |                |
 |                    |                      |                 |                  |                |
 
IF CIRCUIT OPEN:
 |                    |                      |                 |                  |                |
 |                    |--Check Circuit------->|                 |                  |                |
 |                    |                      |                 |                  |                |
 |                    |<--Circuit OPEN--------|                 |                  |                |
 |                    |   (Fallback Response) |                 |                  |                |
 |                    |                      |                 |                  |                |
 |<--503 Service------|                      |                 |                  |                |
 |   Unavailable      |                      |                 |                  |                |
```

#### Step-by-Step Process with Resilience:

1. **Request Initiation & Tracing**: 
   - User sends POST request to create order
   - OpenTelemetry creates root trace span
   - Request tracked across all services

2. **Validation & Stock Check**:
   - Input validation with class-validator
   - Product existence verification
   - Stock availability check

3. **Order Persistence**:
   - Order saved to PostgreSQL with PENDING status
   - Transaction ensures data consistency

4. **Circuit Breaker Check**:
   - Verifies payment service circuit state
   - If OPEN: Returns fallback response immediately
   - If CLOSED/HALF-OPEN: Proceeds with payment

5. **Payment Request via RabbitMQ**:
   - Message sent to payment_queue with timeout
   - Circuit breaker wraps the call
   - Dead Letter Queue configured for failures

6. **Payment Processing**:
   - Payment Service receives message
   - Creates child trace span
   - Simulates processing (500-2000ms)
   - 80% success rate simulation

7. **Response Handling**:
   - Success: Updates order to PAYMENT_SUCCESS
   - Failure: Updates order to PAYMENT_FAILED
   - Timeout: Message routed to DLQ

8. **Circuit Breaker Update**:
   - Records success/failure metrics
   - Updates circuit state if threshold breached
   - Triggers state transitions (CLOSED→OPEN→HALF-OPEN)

9. **Dead Letter Queue Auto-Processing**:
   - Failed messages sent to payment_dlq
   - DLQ consumer immediately processes message
   - Evaluates retry eligibility (< 3 attempts, < 1 hour, not permanent failure)
   - If retryable: sends to retry_queue with 30s delay
   - If not: logs for manual intervention
   - Queue shows 0 messages due to immediate consumption

10. **Trace Completion**:
    - All spans sent to Jaeger
    - Complete request flow visible
    - Performance metrics captured

## Features

- **Microservices Architecture**: Two independent NestJS services
- **Product Catalog Management**: Centralized product inventory with stock tracking
- **Database Persistence**: PostgreSQL databases with TypeORM for data storage
- **RabbitMQ Integration**: Reliable message passing with request/response pattern
- **Payment Retry System**: Retry failed payments with stock validation
- **Inventory Management**: Automatic stock tracking with increment/decrement on order status
- **Error Handling**: Comprehensive error handling with retry logic
- **Structured Logging**: Winston logger with file and console outputs
- **Docker Support**: Full containerization with health checks
- **Data Validation**: DTOs with class-validator for input validation
- **Configuration Management**: Environment-based configuration
- **Health Checks**: Built-in health endpoints for monitoring
- **Database Migrations**: TypeORM with auto-sync for development

## Prerequisites

### For Docker Setup (Recommended):
- **Docker Desktop** (includes Docker Compose)
- **Git** for cloning the repository
- **4GB RAM minimum** (6GB recommended)
- **Available ports**: 3001, 3002, 5433, 5434, 5672, 15672, 16686

### For Local Development (Optional):
- Node.js 18+ and npm
- PostgreSQL 15+
- RabbitMQ 3.12+
- Jaeger (optional for tracing)

## Testing

### Running Tests

The project includes comprehensive unit, integration, and E2E tests organized by category:

```bash
# Run all tests for both services
./run-tests.sh

# Run specific test categories:
cd order-service
npm run test              # All tests
npm run test:unit         # Only unit tests
npm run test:integration  # Only integration tests  
npm run test:e2e          # Only E2E tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report

cd payment-service
npm run test              # All tests
npm run test:unit         # Only unit tests
npm run test:integration  # Only integration tests
npm run test:e2e          # Only E2E tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
```

### Test Organization

Tests are organized by category for better maintainability:

```
order-service/test/
├── unit/                      # Isolated component tests
│   ├── order.controller.spec.ts
│   ├── order.service.spec.ts
│   └── product.service.spec.ts
├── integration/               # Service interaction tests
│   └── order-payment.integration.spec.ts
└── e2e/                      # API endpoint tests
    └── order.e2e-spec.ts

payment-service/test/
├── unit/                      # Isolated component tests
│   └── payment.service.spec.ts
├── integration/               # Service interaction tests
└── e2e/                      # API endpoint tests
    └── payment.e2e-spec.ts
```

### Test Coverage

The test suite includes:

- **Unit Tests**: Service logic, controllers, and business rules
  - Order creation and validation
  - Product stock management
  - Payment processing logic
  - Error handling scenarios
  
- **Integration Tests**: Inter-service communication
  - RabbitMQ message processing
  - Stock management coordination
  - Database transactions
  
- **E2E Tests**: Full API endpoint testing
  - Order creation flow
  - Payment retry functionality
  - Product catalog endpoints
  - Health check endpoints

### Running Tests in Docker

```bash
# Run tests in Docker containers
docker-compose exec order-service npm run test
docker-compose exec payment-service npm run test

# Run E2E tests
docker-compose exec order-service npm run test:e2e
docker-compose exec payment-service npm run test:e2e
```

## Installation & Setup

### Quick Start with Docker (Recommended - Zero Local Dependencies)

```bash
# 1. Clone the repository
git clone <repository-url>
cd nestjs-microservices

# 2. Start all services with Docker Compose
docker-compose up --build

# 3. Wait ~1 minute for all services to be healthy
# 4. Test the system is running
curl http://localhost:3001/orders/health/check
```

**That's it!** No need to install Node.js, PostgreSQL, RabbitMQ, or any dependencies locally.

#### Services will be available at:
- **Order Service**: http://localhost:3001
- **Payment Service**: http://localhost:3002  
- **RabbitMQ Management**: http://localhost:15672 (username: `admin`, password: `admin123`)
- **Jaeger UI**: http://localhost:16686
- **PostgreSQL Order DB**: localhost:5433 (user: `orderuser`, password: `orderpass123`)
- **PostgreSQL Payment DB**: localhost:5434 (user: `paymentuser`, password: `paymentpass123`)

#### Docker Commands:
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove all data
docker-compose down -v

# Rebuild after code changes
docker-compose up --build
```

#### Verify all services are healthy:
```bash
# Check health endpoints
curl http://localhost:3001/orders/health/check
curl http://localhost:3002/health

# Check Circuit Breaker stats
curl http://localhost:3001/circuit-breaker/stats

# Check DLQ stats  
curl http://localhost:3001/dlq/stats
```

### Option 2: Run Locally

1. Start infrastructure services using Docker:

```bash
# Start Jaeger for distributed tracing
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 14268:14268 \
  jaegertracing/all-in-one:latest
```

2. Start other infrastructure services:
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

### Circuit Breaker Endpoints

#### Get Circuit Breaker Statistics
**GET** `/circuit-breaker/stats`

Response:
```json
[
  {
    "name": "payment-service",
    "state": "closed",
    "stats": {
      "failures": 2,
      "successes": 48,
      "rejections": 0,
      "timeouts": 1,
      "fallbacks": 0,
      "percentiles": {
        "0.5": 150,
        "0.9": 250,
        "0.99": 500
      }
    },
    "enabled": true,
    "volumeThreshold": 10
  }
]
```

#### Get Stats for Specific Circuit
**GET** `/circuit-breaker/stats/:name`

#### Reset Circuit Breaker
**POST** `/circuit-breaker/reset/:name`

### Dead Letter Queue Endpoints

#### Get DLQ Statistics
**GET** `/dlq/stats`

Response:
```json
{
  "queueName": "payment_dlq",
  "messageCount": 3,
  "oldestMessageAge": "5 minutes",
  "processingStats": {
    "totalProcessed": 10,
    "successfulRetries": 7,
    "permanentFailures": 3
  }
}
```

#### Reprocess DLQ Message
**POST** `/dlq/reprocess/:orderId`

Response:
```json
{
  "success": true,
  "message": "Order reprocessed successfully",
  "data": {...order details...}
}
```

### Product Catalog Endpoints

#### Get All Products
**GET** `/products`

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-here",
      "productCode": "LAPTOP-001",
      "name": "MacBook Pro M3",
      "description": "Apple MacBook Pro 14-inch with M3 chip",
      "price": 1999.99,
      "currency": "USD",
      "stockQuantity": 50,
      "isActive": true,
      "category": "Electronics",
      "metadata": {"brand": "Apple", "warranty": "1 year"}
    }
  ],
  "count": 8
}
```

#### Get Product by Code
**GET** `/products/code/:productCode`

#### Get Product by ID
**GET** `/products/:id`

### Order Service Endpoints

#### Create Order
**POST** `/orders`

Request Body (Simplified with Product Catalog):
```json
{
  "productCode": "LAPTOP-001",
  "quantity": 2,
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
    "productCode": "LAPTOP-001",
    "productName": "MacBook Pro M3",
    "unitPrice": 1999.99,
    "quantity": 2,
    "totalAmount": 3999.98,
    "customerId": "CUST-123",
    "customerEmail": "customer@example.com",
    "status": "PAYMENT_SUCCESS",
    "paymentId": "payment-uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:01.000Z"
  }
}
```

#### Retry Payment
**POST** `/orders/:id/retry-payment`

Response:
```json
{
  "success": true,
  "data": {...order details...},
  "message": "Payment retry successful"
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

### Products Table (orderdb)
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productCode VARCHAR UNIQUE NOT NULL,
  name VARCHAR NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR DEFAULT 'USD',
  stockQuantity INTEGER DEFAULT 0,
  isActive BOOLEAN DEFAULT true,
  category VARCHAR,
  metadata JSONB,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_products_productCode ON products(productCode);
```

### Orders Table (orderdb)
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  productCode VARCHAR NOT NULL,
  productName VARCHAR NOT NULL,
  unitPrice DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  totalAmount DECIMAL(10,2) NOT NULL,
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

## Product Catalog

The system automatically seeds the following products on startup:

| Product Code | Name | Price | Stock | Category |
|-------------|------|-------|-------|----------|
| LAPTOP-001 | MacBook Pro M3 | $1999.99 | 50 | Electronics |
| PHONE-001 | iPhone 15 Pro | $1199.99 | 100 | Electronics |
| HEADPHONE-001 | AirPods Pro | $249.99 | 200 | Audio |
| TABLET-001 | iPad Air | $599.99 | 75 | Electronics |
| WATCH-001 | Apple Watch Series 9 | $399.99 | 150 | Wearables |
| KEYBOARD-001 | Magic Keyboard | $149.99 | 300 | Accessories |
| MOUSE-001 | Magic Mouse | $79.99 | 250 | Accessories |
| CABLE-001 | USB-C Cable | $29.99 | 500 | Accessories |

## Testing the System

### Using cURL

1. View available products:
```bash
curl http://localhost:3001/products
```

2. Create an order (using product code):
```bash
curl -X POST http://localhost:3001/orders \
  -H "Content-Type: application/json" \
  -d '{
    "productCode": "LAPTOP-001",
    "quantity": 2,
    "customerId": "CUST-123",
    "customerEmail": "customer@example.com"
  }'
```

3. Check order status:
```bash
curl http://localhost:3001/orders/{order-id}
```

4. Retry a failed payment:
```bash
curl -X POST http://localhost:3001/orders/{order-id}/retry-payment
```

5. Get all orders:
```bash
curl http://localhost:3001/orders
```

6. Get all payments:
```bash
curl http://localhost:3002/payments
```

7. Get payment statistics:
```bash
curl http://localhost:3002/payments/stats/summary
```

### Using Postman

A comprehensive Postman collection is included in the repository:

1. Import `NestJS-Microservices.postman_collection.json`
   - Contains all endpoints including Circuit Breaker, DLQ, and Security tests
   - Organized by feature categories
   - Includes failure scenario testing and load tests
2. Import `NestJS-Microservices.postman_environment.json`
3. Select "NestJS Microservices - Local" environment
4. The collection includes:
   - Product Catalog endpoints
   - Order creation with product codes
   - Payment retry functionality
   - Payment monitoring endpoints
   - Test scenarios and load testing
   - Full order flow testing

See `POSTMAN_GUIDE.md` for detailed instructions.

## Monitoring and Observability

### Distributed Tracing with Jaeger

Access Jaeger UI at http://localhost:16686

1. **View Service Map**:
   - Navigate to "System Architecture" → "DAG" tab
   - See service dependencies and call patterns

2. **Search Traces**:
   - Select service: "order-service" or "payment-service"
   - Filter by operation, duration, or tags
   - Click on traces to see detailed spans

3. **Analyze Performance**:
   - Identify slow operations
   - Find bottlenecks in request flow
   - Track error rates across services

4. **Custom Spans**:
   - Business operations are tracked with custom spans
   - Database queries and RabbitMQ messages are instrumented

### Circuit Breaker Monitoring

```bash
# Real-time circuit breaker status
curl http://localhost:3001/circuit-breaker/stats

# Watch circuit state changes
watch -n 1 'curl -s http://localhost:3001/circuit-breaker/stats | jq .'
```

Circuit States:
- **Closed**: Normal operation
- **Open**: Requests are being rejected
- **Half-Open**: Testing with limited requests

### Dead Letter Queue Monitoring

```bash
# Check DLQ message count
curl http://localhost:3001/dlq/stats

# RabbitMQ Management UI
# Navigate to http://localhost:15672
# Check "payment_dlq" queue for failed messages
```

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
│   │   ├── circuit-breaker/
│   │   │   ├── circuit-breaker.controller.ts
│   │   │   ├── circuit-breaker.module.ts
│   │   │   └── circuit-breaker.service.ts
│   │   ├── config/
│   │   │   ├── configuration.ts
│   │   │   └── database.config.ts
│   │   ├── dlq/
│   │   │   ├── dlq.controller.ts
│   │   │   ├── dlq.module.ts
│   │   │   └── dlq.service.ts
│   │   ├── dto/
│   │   │   ├── create-order.dto.ts
│   │   │   ├── payment-request.dto.ts
│   │   │   └── payment-response.dto.ts
│   │   ├── entities/
│   │   │   ├── order.entity.ts
│   │   │   └── product.entity.ts
│   │   ├── order/
│   │   │   ├── order.controller.ts
│   │   │   ├── order.module.ts
│   │   │   └── order.service.ts
│   │   ├── product/
│   │   │   ├── product.controller.ts
│   │   │   └── product.service.ts
│   │   ├── tracing/
│   │   │   └── tracing.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
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
│   │   ├── tracing/
│   │   │   └── tracing.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── test/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── Dockerfile
│   ├── .env
│   └── package.json
├── docker-compose.yml
├── README.md
├── NestJS-Microservices.postman_collection.json
├── NestJS-Microservices.postman_environment.json
├── POSTMAN_GUIDE.md
└── run-tests.sh
```

## Configuration

### Environment Variables

#### Order Service
- `PORT`: Service port (default: 3001)
- `RABBITMQ_URL`: RabbitMQ connection URL (default: amqp://admin:admin123@localhost:5672)
- `RABBITMQ_QUEUE`: Queue name (default: payment_queue)
- `RABBITMQ_DLQ`: Dead letter queue name (default: payment_dlq)
- `DB_HOST`: PostgreSQL host (default: localhost)
- `DB_PORT`: PostgreSQL port (default: 5433)
- `DB_USERNAME`: Database username (default: orderuser)
- `DB_PASSWORD`: Database password (default: orderpass123)
- `DB_DATABASE`: Database name (default: orderdb)
- `JAEGER_ENDPOINT`: Jaeger collector endpoint (default: http://localhost:14268/api/traces)
- `OTEL_DEBUG`: Enable OpenTelemetry debug logging (default: false)
- `CORS_ORIGINS`: Allowed CORS origins (default: http://localhost:3000)
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
- `JAEGER_ENDPOINT`: Jaeger collector endpoint (default: http://localhost:14268/api/traces)
- `OTEL_DEBUG`: Enable OpenTelemetry debug logging (default: false)
- `CORS_ORIGINS`: Allowed CORS origins (default: http://localhost:3000)
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

## Error Handling and Resilience

The system implements multiple layers of resilience:

### Circuit Breaker Protection
- Prevents cascading failures when services are unavailable
- Automatically opens circuit after 50% failure threshold
- Provides fallback responses during outages
- Self-healing with automatic recovery attempts

### Dead Letter Queue Processing
- Failed messages are automatically routed to DLQ
- Configurable retry attempts (default: 3)
- Manual reprocessing capability for stuck messages
- Preserves message history for debugging

### Connection Management
- Automatic reconnection to RabbitMQ with exponential backoff
- Database connection pooling with automatic recovery
- Health checks for early problem detection
- Graceful shutdown handling

### Error Categories
1. **Transient Failures**: Automatically retried with backoff
2. **Circuit Breaker Trips**: Fallback responses provided
3. **Payment Failures**: Routed to DLQ for later processing
4. **Validation Errors**: Immediate rejection with details
5. **Timeout Errors**: Configurable timeouts with circuit breaker protection
6. **Service Unavailability**: Graceful degradation with cached responses

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

### Core Framework
- **NestJS**: Progressive Node.js framework with TypeScript
- **TypeScript**: Type-safe JavaScript for robust development

### Data Layer
- **PostgreSQL**: Production-grade relational database
- **TypeORM**: Advanced ORM with migration support

### Messaging & Communication
- **RabbitMQ**: Enterprise message broker with DLQ support
- **amqplib**: Advanced AMQP 0-9-1 client

### Resilience & Monitoring
- **Opossum**: Circuit breaker implementation
- **OpenTelemetry**: Distributed tracing instrumentation
- **Jaeger**: Trace collection and visualization

### Security
- **Helmet**: Security headers middleware
- **@nestjs/throttler**: Rate limiting protection
- **class-validator**: Input validation and sanitization

### Development & Testing
- **Jest**: Testing framework with coverage
- **Supertest**: HTTP assertion library
- **Docker & Docker Compose**: Container orchestration
- **Winston**: Structured logging with rotation

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## Important System Behaviors

### DLQ Auto-Processing
The Dead Letter Queue shows 0 messages because it's an **active processor**, not a storage queue:
- Messages are immediately consumed when they arrive
- Evaluated for retry eligibility in milliseconds
- Automatically sent to retry queue or logged for manual intervention
- This is by design for self-healing capability

### Circuit Breaker Fallback
When payment service is down:
- Circuit breaker opens after timeout (30 seconds)
- Returns fallback response immediately for subsequent requests
- Order status becomes `PAYMENT_FAILED`
- Messages are sent to DLQ for automatic retry
- Circuit enters half-open state after reset timeout

### Payment Service Simulation
- 80% success rate (configurable in payment.service.ts)
- Random 500-2000ms processing delay
- Simulated failure reasons for testing

## Troubleshooting

### Common Issues

1. **Services not appearing in Jaeger**
   - Ensure Jaeger is running: `docker ps | grep jaeger`
   - Check JAEGER_ENDPOINT in service logs
   - Wait 30 seconds after starting services

2. **Circuit Breaker always open**
   - Check payment service health: `curl http://localhost:3002/health`
   - Reset circuit manually: `curl -X POST http://localhost:3001/circuit-breaker/reset/payment-service`
   - Review error threshold settings

3. **Messages stuck in DLQ**
   - Check DLQ stats: `curl http://localhost:3001/dlq/stats`
   - Reprocess manually: `curl -X POST http://localhost:3001/dlq/reprocess/{orderId}`
   - Check RabbitMQ Management UI for queue status

4. **Rate limiting errors**
   - Default limits: 10 req/sec, 50 req/10sec, 100 req/min
   - Adjust limits in app.module.ts if needed
   - Health endpoints are excluded from limits

5. **Database connection errors**
   - Verify PostgreSQL containers are running
   - Check credentials in .env files
   - Ensure ports 5433/5434 are not in use

## Performance Tuning

### Circuit Breaker Settings
```typescript
// Adjust in circuit-breaker.service.ts
const defaultOptions = {
  timeout: 30000,              // Request timeout
  errorThresholdPercentage: 50, // Open circuit threshold
  resetTimeout: 30000,         // Recovery attempt interval
  rollingCountTimeout: 10000,  // Statistics window
};
```

### Connection Pools
```typescript
// Database connections in database.config.ts
extra: {
  max: 20,           // Maximum connections
  min: 5,            // Minimum connections
  idleTimeoutMillis: 30000,
}
```

### Rate Limiting
```typescript
// Adjust in app.module.ts
ThrottlerModule.forRoot([
  { ttl: 1000, limit: 10 },    // Per second
  { ttl: 10000, limit: 50 },   // Per 10 seconds
  { ttl: 60000, limit: 100 },  // Per minute
]);
```

## Author

A microservices demonstration project built with NestJS, RabbitMQ, and PostgreSQL, showcasing production-ready patterns including Circuit Breaker, Dead Letter Queue, and distributed tracing.

---
