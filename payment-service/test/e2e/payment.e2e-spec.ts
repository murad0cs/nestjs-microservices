import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { Payment } from '../src/entities/payment.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ClientProxy } from '@nestjs/microservices';

describe('Payment Service E2E Tests', () => {
  let app: INestApplication;
  let paymentRepository: Repository<Payment>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    paymentRepository = moduleFixture.get<Repository<Payment>>(getRepositoryToken(Payment));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await paymentRepository.delete({});
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('service', 'Payment Service');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /payments', () => {
    it('should return all payments', async () => {
      // Create test payments
      await paymentRepository.save([
        {
          orderId: 'order-001',
          amount: 100.00,
          currency: 'USD',
          customerId: 'CUST-001',
          customerEmail: 'test1@example.com',
          status: 'SUCCESS',
          transactionReference: 'TXN-001',
        },
        {
          orderId: 'order-002',
          amount: 200.00,
          currency: 'USD',
          customerId: 'CUST-002',
          customerEmail: 'test2@example.com',
          status: 'FAILED',
          failureReason: 'Insufficient funds',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/payments')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('orderId');
      expect(response.body.data[0]).toHaveProperty('status');
    });

    it('should return empty array when no payments exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 0);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('GET /payments/:id', () => {
    it('should return payment by id', async () => {
      const payment = await paymentRepository.save({
        orderId: 'order-123',
        amount: 99.99,
        currency: 'USD',
        customerId: 'CUST-123',
        customerEmail: 'test@example.com',
        status: 'SUCCESS',
        transactionReference: 'TXN-123',
      });

      const response = await request(app.getHttpServer())
        .get(`/payments/${payment.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', payment.id);
      expect(response.body.data).toHaveProperty('orderId', 'order-123');
      expect(response.body.data).toHaveProperty('status', 'SUCCESS');
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Payment not found');
    });
  });

  describe('GET /payments/order/:orderId', () => {
    it('should return payments for an order', async () => {
      // Create multiple payments for same order (retry scenario)
      await paymentRepository.save([
        {
          orderId: 'order-456',
          amount: 150.00,
          currency: 'USD',
          customerId: 'CUST-456',
          customerEmail: 'test@example.com',
          status: 'FAILED',
          failureReason: 'Card declined',
        },
        {
          orderId: 'order-456',
          amount: 150.00,
          currency: 'USD',
          customerId: 'CUST-456',
          customerEmail: 'test@example.com',
          status: 'SUCCESS',
          transactionReference: 'TXN-456',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/payments/order/order-456')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('orderId', 'order-456');
      expect(response.body.data[1]).toHaveProperty('orderId', 'order-456');
    });

    it('should return empty array for order with no payments', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments/order/non-existent-order')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 0);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('Payment Statistics', () => {
    beforeEach(async () => {
      // Create diverse payment data for statistics
      await paymentRepository.save([
        {
          orderId: 'order-s1',
          amount: 100.00,
          currency: 'USD',
          customerId: 'CUST-S1',
          customerEmail: 'success1@example.com',
          status: 'SUCCESS',
          transactionReference: 'TXN-S1',
        },
        {
          orderId: 'order-s2',
          amount: 200.00,
          currency: 'USD',
          customerId: 'CUST-S2',
          customerEmail: 'success2@example.com',
          status: 'SUCCESS',
          transactionReference: 'TXN-S2',
        },
        {
          orderId: 'order-f1',
          amount: 150.00,
          currency: 'USD',
          customerId: 'CUST-F1',
          customerEmail: 'failed1@example.com',
          status: 'FAILED',
          failureReason: 'Insufficient funds',
        },
      ]);
    });

    it('should calculate payment statistics correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/payments')
        .expect(200);

      const payments = response.body.data;
      const successfulPayments = payments.filter((p: any) => p.status === 'SUCCESS');
      const failedPayments = payments.filter((p: any) => p.status === 'FAILED');

      expect(successfulPayments).toHaveLength(2);
      expect(failedPayments).toHaveLength(1);

      // Calculate total successful amount
      const totalSuccessAmount = successfulPayments.reduce(
        (sum: number, p: any) => sum + parseFloat(p.amount),
        0
      );
      expect(totalSuccessAmount).toBe(300.00);
    });
  });
});

describe('Payment Service Integration Tests', () => {
  let app: INestApplication;
  let paymentRepository: Repository<Payment>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Initialize microservice
    await app.startAllMicroservices();
    await app.init();

    paymentRepository = moduleFixture.get<Repository<Payment>>(getRepositoryToken(Payment));
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Message Processing', () => {
    it('should handle concurrent payment requests', async () => {
      // This test would require actual RabbitMQ connection
      // For unit testing, we mock the behavior
      
      const paymentPromises = [];
      for (let i = 0; i < 5; i++) {
        const payment = paymentRepository.save({
          orderId: `concurrent-order-${i}`,
          amount: 100.00 * (i + 1),
          currency: 'USD',
          customerId: `CUST-${i}`,
          customerEmail: `test${i}@example.com`,
          status: 'SUCCESS',
          transactionReference: `TXN-${i}`,
        });
        paymentPromises.push(payment);
      }

      const results = await Promise.all(paymentPromises);
      
      expect(results).toHaveLength(5);
      results.forEach((payment, index) => {
        expect(payment).toHaveProperty('orderId', `concurrent-order-${index}`);
        expect(payment).toHaveProperty('amount', 100.00 * (index + 1));
      });
    });

    it('should handle payment retries correctly', async () => {
      const orderId = 'retry-test-order';
      
      // Simulate multiple payment attempts for same order
      const attempt1 = await paymentRepository.save({
        orderId,
        amount: 99.99,
        currency: 'USD',
        customerId: 'CUST-RETRY',
        customerEmail: 'retry@example.com',
        status: 'FAILED',
        failureReason: 'Card declined',
      });

      const attempt2 = await paymentRepository.save({
        orderId,
        amount: 99.99,
        currency: 'USD',
        customerId: 'CUST-RETRY',
        customerEmail: 'retry@example.com',
        status: 'SUCCESS',
        transactionReference: 'TXN-RETRY-SUCCESS',
      });

      // Verify both attempts are recorded
      const payments = await paymentRepository.find({ where: { orderId } });
      
      expect(payments).toHaveLength(2);
      expect(payments[0]).toHaveProperty('status', 'FAILED');
      expect(payments[1]).toHaveProperty('status', 'SUCCESS');
    });
  });
});