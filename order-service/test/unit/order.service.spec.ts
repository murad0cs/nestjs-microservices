import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from '../entities/order.entity';
import { ProductService } from '../product/product.service';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';

describe('OrderService', () => {
  let service: OrderService;
  let orderRepository: Repository<Order>;
  let productService: ProductService;
  let paymentClient: ClientProxy;

  const mockOrder = {
    id: 'order-123',
    productCode: 'LAPTOP-001',
    productName: 'MacBook Pro M3',
    unitPrice: 1999.99,
    quantity: 1,
    totalAmount: 1999.99,
    customerId: 'CUST-123',
    customerEmail: 'test@example.com',
    status: 'PENDING',
    paymentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProduct = {
    id: 'product-123',
    productCode: 'LAPTOP-001',
    name: 'MacBook Pro M3',
    price: 1999.99,
    stockQuantity: 10,
  };

  const mockPaymentResponse: PaymentResponseDto = {
    orderId: 'order-123',
    paymentId: 'payment-123',
    status: 'SUCCESS',
    message: 'Payment successful',
    processedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: ProductService,
          useValue: {
            validateAndGetProduct: jest.fn(),
            decrementStock: jest.fn(),
            incrementStock: jest.fn(),
          },
        },
        {
          provide: 'PAYMENT_SERVICE',
          useValue: {
            send: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    productService = module.get<ProductService>(ProductService);
    paymentClient = module.get<ClientProxy>('PAYMENT_SERVICE');
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      productCode: 'LAPTOP-001',
      quantity: 1,
      customerId: 'CUST-123',
      customerEmail: 'test@example.com',
    };

    it('should create an order successfully with payment success', async () => {
      jest.spyOn(productService, 'validateAndGetProduct').mockResolvedValue(mockProduct as any);
      jest.spyOn(productService, 'decrementStock').mockResolvedValue(undefined);
      jest.spyOn(orderRepository, 'create').mockReturnValue(mockOrder as any);
      jest.spyOn(orderRepository, 'save').mockResolvedValue(mockOrder as any);
      jest.spyOn(paymentClient, 'send').mockReturnValue(of(mockPaymentResponse));

      const result = await service.createOrder(createOrderDto);

      expect(result).toBeDefined();
      expect(productService.validateAndGetProduct).toHaveBeenCalledWith('LAPTOP-001');
      expect(productService.decrementStock).toHaveBeenCalledWith('LAPTOP-001', 1);
      expect(orderRepository.save).toHaveBeenCalled();
      expect(paymentClient.send).toHaveBeenCalledWith('process_payment', expect.any(Object));
    });

    it('should throw error when insufficient stock', async () => {
      const lowStockProduct = { ...mockProduct, stockQuantity: 0 };
      jest.spyOn(productService, 'validateAndGetProduct').mockResolvedValue(lowStockProduct as any);

      await expect(service.createOrder(createOrderDto)).rejects.toThrow(BadRequestException);
      expect(productService.decrementStock).not.toHaveBeenCalled();
      expect(orderRepository.save).not.toHaveBeenCalled();
    });

    it('should restore stock when payment fails', async () => {
      const failedPaymentResponse: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'FAILED',
        message: 'Payment failed',
      };

      jest.spyOn(productService, 'validateAndGetProduct').mockResolvedValue(mockProduct as any);
      jest.spyOn(productService, 'decrementStock').mockResolvedValue(undefined);
      jest.spyOn(productService, 'incrementStock').mockResolvedValue(undefined);
      jest.spyOn(orderRepository, 'create').mockReturnValue(mockOrder as any);
      jest.spyOn(orderRepository, 'save').mockResolvedValue(mockOrder as any);
      jest.spyOn(paymentClient, 'send').mockReturnValue(of(failedPaymentResponse));

      const result = await service.createOrder(createOrderDto);

      expect(result.status).toBe('PAYMENT_FAILED');
      expect(productService.incrementStock).toHaveBeenCalledWith('LAPTOP-001', 1);
    });

    it('should handle payment service timeout', async () => {
      jest.spyOn(productService, 'validateAndGetProduct').mockResolvedValue(mockProduct as any);
      jest.spyOn(productService, 'decrementStock').mockResolvedValue(undefined);
      jest.spyOn(productService, 'incrementStock').mockResolvedValue(undefined);
      jest.spyOn(orderRepository, 'create').mockReturnValue(mockOrder as any);
      jest.spyOn(orderRepository, 'save').mockResolvedValue(mockOrder as any);
      jest.spyOn(paymentClient, 'send').mockReturnValue(
        throwError(() => new Error('Timeout'))
      );

      const result = await service.createOrder(createOrderDto);

      expect(result.status).toBe('PAYMENT_FAILED');
      expect(productService.incrementStock).toHaveBeenCalledWith('LAPTOP-001', 1);
    });
  });

  describe('getOrder', () => {
    it('should return an order by id', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(mockOrder as any);

      const result = await service.getOrder('order-123');

      expect(result).toEqual(mockOrder);
      expect(orderRepository.findOne).toHaveBeenCalledWith({ where: { id: 'order-123' } });
    });

    it('should return null if order not found', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(null);

      const result = await service.getOrder('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAllOrders', () => {
    it('should return all orders sorted by creation date', async () => {
      const orders = [mockOrder, { ...mockOrder, id: 'order-456' }];
      jest.spyOn(orderRepository, 'find').mockResolvedValue(orders as any);

      const result = await service.getAllOrders();

      expect(result).toEqual(orders);
      expect(orderRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('retryPayment', () => {
    const failedOrder = { ...mockOrder, status: 'PAYMENT_FAILED' };

    it('should successfully retry payment', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(failedOrder as any);
      jest.spyOn(orderRepository, 'save').mockResolvedValue(failedOrder as any);
      jest.spyOn(productService, 'validateAndGetProduct').mockResolvedValue(mockProduct as any);
      jest.spyOn(productService, 'decrementStock').mockResolvedValue(undefined);
      jest.spyOn(paymentClient, 'send').mockReturnValue(of(mockPaymentResponse));

      const result = await service.retryPayment('order-123');

      expect(result.status).toBe('PAYMENT_SUCCESS');
      expect(productService.decrementStock).toHaveBeenCalledWith('LAPTOP-001', 1);
      expect(paymentClient.send).toHaveBeenCalledWith('process_payment', expect.any(Object));
    });

    it('should throw error when order not found', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(null);

      await expect(service.retryPayment('non-existent')).rejects.toThrow('Order with ID non-existent not found');
    });

    it('should throw error when payment already successful', async () => {
      const successOrder = { ...mockOrder, status: 'PAYMENT_SUCCESS' };
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(successOrder as any);

      await expect(service.retryPayment('order-123')).rejects.toThrow('Cannot retry payment for order order-123: Payment already successful');
    });

    it('should throw error when insufficient stock for retry', async () => {
      const lowStockProduct = { ...mockProduct, stockQuantity: 0 };
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(failedOrder as any);
      jest.spyOn(productService, 'validateAndGetProduct').mockResolvedValue(lowStockProduct as any);

      await expect(service.retryPayment('order-123')).rejects.toThrow('Cannot retry payment: Insufficient stock');
    });

    it('should restore stock when retry payment fails', async () => {
      const failedPaymentResponse: PaymentResponseDto = {
        ...mockPaymentResponse,
        status: 'FAILED',
      };

      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(failedOrder as any);
      jest.spyOn(orderRepository, 'save').mockResolvedValue(failedOrder as any);
      jest.spyOn(productService, 'validateAndGetProduct').mockResolvedValue(mockProduct as any);
      jest.spyOn(productService, 'decrementStock').mockResolvedValue(undefined);
      jest.spyOn(productService, 'incrementStock').mockResolvedValue(undefined);
      jest.spyOn(paymentClient, 'send').mockReturnValue(of(failedPaymentResponse));

      const result = await service.retryPayment('order-123');

      expect(result.status).toBe('PAYMENT_FAILED');
      expect(productService.incrementStock).toHaveBeenCalledWith('LAPTOP-001', 1);
    });
  });
});