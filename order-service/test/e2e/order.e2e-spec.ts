import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { Order } from '../src/entities/order.entity';
import { Product } from '../src/entities/product.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('Order Service E2E Tests', () => {
  let app: INestApplication;
  let orderRepository: Repository<Order>;
  let productRepository: Repository<Product>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    orderRepository = moduleFixture.get<Repository<Order>>(getRepositoryToken(Order));
    productRepository = moduleFixture.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await orderRepository.delete({});
    await productRepository.delete({});
    
    // Seed a test product
    await productRepository.save({
      productCode: 'TEST-001',
      name: 'Test Product',
      description: 'Test product for E2E testing',
      price: 99.99,
      currency: 'USD',
      stockQuantity: 10,
      isActive: true,
      category: 'Test',
    });
  });

  describe('POST /orders', () => {
    it('should create an order successfully', async () => {
      const createOrderDto = {
        productCode: 'TEST-001',
        quantity: 2,
        customerId: 'CUST-E2E',
        customerEmail: 'e2e@test.com',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('productCode', 'TEST-001');
      expect(response.body.data).toHaveProperty('quantity', 2);
      expect(response.body.data).toHaveProperty('totalAmount', 199.98);
      expect(response.body.data).toHaveProperty('status');
    });

    it('should fail when product does not exist', async () => {
      const createOrderDto = {
        productCode: 'NON-EXISTENT',
        quantity: 1,
        customerId: 'CUST-E2E',
        customerEmail: 'e2e@test.com',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should fail when insufficient stock', async () => {
      const createOrderDto = {
        productCode: 'TEST-001',
        quantity: 100, // More than available
        customerId: 'CUST-E2E',
        customerEmail: 'e2e@test.com',
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .send(createOrderDto)
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Insufficient stock');
    });

    it('should validate required fields', async () => {
      const invalidDto = {
        productCode: 'TEST-001',
        // Missing required fields
      };

      await request(app.getHttpServer())
        .post('/orders')
        .send(invalidDto)
        .expect(400);
    });
  });

  describe('GET /orders/:id', () => {
    it('should retrieve an order by id', async () => {
      // First create an order
      const order = await orderRepository.save({
        productCode: 'TEST-001',
        productName: 'Test Product',
        unitPrice: 99.99,
        quantity: 1,
        totalAmount: 99.99,
        customerId: 'CUST-E2E',
        customerEmail: 'e2e@test.com',
        status: 'PAYMENT_SUCCESS',
      });

      const response = await request(app.getHttpServer())
        .get(`/orders/${order.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id', order.id);
      expect(response.body.data).toHaveProperty('productCode', 'TEST-001');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Order not found');
    });
  });

  describe('GET /orders', () => {
    it('should retrieve all orders', async () => {
      // Create multiple orders
      await orderRepository.save([
        {
          productCode: 'TEST-001',
          productName: 'Test Product',
          unitPrice: 99.99,
          quantity: 1,
          totalAmount: 99.99,
          customerId: 'CUST-1',
          customerEmail: 'test1@example.com',
          status: 'PAYMENT_SUCCESS',
        },
        {
          productCode: 'TEST-001',
          productName: 'Test Product',
          unitPrice: 99.99,
          quantity: 2,
          totalAmount: 199.98,
          customerId: 'CUST-2',
          customerEmail: 'test2@example.com',
          status: 'PAYMENT_FAILED',
        },
      ]);

      const response = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.data).toHaveLength(2);
    });

    it('should return empty array when no orders exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 0);
      expect(response.body.data).toEqual([]);
    });
  });

  describe('POST /orders/:id/retry-payment', () => {
    it('should retry payment for failed order', async () => {
      // Create a failed order
      const order = await orderRepository.save({
        productCode: 'TEST-001',
        productName: 'Test Product',
        unitPrice: 99.99,
        quantity: 1,
        totalAmount: 99.99,
        customerId: 'CUST-E2E',
        customerEmail: 'e2e@test.com',
        status: 'PAYMENT_FAILED',
      });

      const response = await request(app.getHttpServer())
        .post(`/orders/${order.id}/retry-payment`)
        .expect((res) => {
          // Can be either 200 (success) or 422 (failed)
          expect([200, 422]).toContain(res.status);
        });

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('id', order.id);
    });

    it('should return 400 when retrying already successful payment', async () => {
      // Create a successful order
      const order = await orderRepository.save({
        productCode: 'TEST-001',
        productName: 'Test Product',
        unitPrice: 99.99,
        quantity: 1,
        totalAmount: 99.99,
        customerId: 'CUST-E2E',
        customerEmail: 'e2e@test.com',
        status: 'PAYMENT_SUCCESS',
        paymentId: 'payment-123',
      });

      const response = await request(app.getHttpServer())
        .post(`/orders/${order.id}/retry-payment`)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('Payment already successful');
    });

    it('should return 404 for non-existent order', async () => {
      const response = await request(app.getHttpServer())
        .post('/orders/00000000-0000-0000-0000-000000000000/retry-payment')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('GET /orders/health/check', () => {
    it('should return health status', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/health/check')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('service', 'Order Service');
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});

describe('Product Endpoints E2E Tests', () => {
  let app: INestApplication;
  let productRepository: Repository<Product>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    productRepository = moduleFixture.get<Repository<Product>>(getRepositoryToken(Product));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean and seed products
    await productRepository.delete({});
    await productRepository.save([
      {
        productCode: 'PROD-001',
        name: 'Product 1',
        description: 'Description 1',
        price: 100.00,
        currency: 'USD',
        stockQuantity: 50,
        isActive: true,
        category: 'Category1',
      },
      {
        productCode: 'PROD-002',
        name: 'Product 2',
        description: 'Description 2',
        price: 200.00,
        currency: 'USD',
        stockQuantity: 30,
        isActive: true,
        category: 'Category2',
      },
    ]);
  });

  describe('GET /products', () => {
    it('should return all products', async () => {
      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('count', 2);
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('GET /products/:id', () => {
    it('should return product by id', async () => {
      const product = await productRepository.findOne({ where: { productCode: 'PROD-001' } });
      
      const response = await request(app.getHttpServer())
        .get(`/products/${product.id}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('productCode', 'PROD-001');
    });

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/products/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /products/code/:productCode', () => {
    it('should return product by code', async () => {
      const response = await request(app.getHttpServer())
        .get('/products/code/PROD-001')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('name', 'Product 1');
    });

    it('should return 404 for non-existent product code', async () => {
      await request(app.getHttpServer())
        .get('/products/code/NON-EXISTENT')
        .expect(404);
    });
  });
});