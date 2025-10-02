import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { CreateOrderDto } from '../dto/create-order.dto';

describe('OrderController', () => {
  let controller: OrderController;
  let service: OrderService;

  const mockOrder = {
    id: 'order-123',
    productCode: 'LAPTOP-001',
    productName: 'MacBook Pro M3',
    unitPrice: 1999.99,
    quantity: 1,
    totalAmount: 1999.99,
    customerId: 'CUST-123',
    customerEmail: 'test@example.com',
    status: 'PAYMENT_SUCCESS',
    paymentId: 'payment-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        {
          provide: OrderService,
          useValue: {
            createOrder: jest.fn(),
            getOrder: jest.fn(),
            getAllOrders: jest.fn(),
            retryPayment: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrderController>(OrderController);
    service = module.get<OrderService>(OrderService);
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      productCode: 'LAPTOP-001',
      quantity: 1,
      customerId: 'CUST-123',
      customerEmail: 'test@example.com',
    };

    it('should create an order successfully', async () => {
      jest.spyOn(service, 'createOrder').mockResolvedValue(mockOrder as any);

      const result = await controller.createOrder(createOrderDto);

      expect(result).toEqual({
        success: true,
        data: mockOrder,
      });
      expect(service.createOrder).toHaveBeenCalledWith(createOrderDto);
    });

    it('should handle service errors', async () => {
      jest.spyOn(service, 'createOrder').mockRejectedValue(new Error('Service error'));

      await expect(controller.createOrder(createOrderDto)).rejects.toThrow(HttpException);
    });
  });

  describe('getOrder', () => {
    it('should return an order by id', async () => {
      jest.spyOn(service, 'getOrder').mockResolvedValue(mockOrder as any);

      const result = await controller.getOrder('order-123');

      expect(result).toEqual({
        success: true,
        data: mockOrder,
      });
      expect(service.getOrder).toHaveBeenCalledWith('order-123');
    });

    it('should throw 404 when order not found', async () => {
      jest.spyOn(service, 'getOrder').mockResolvedValue(null);

      await expect(controller.getOrder('non-existent')).rejects.toThrow(
        new HttpException(
          {
            success: false,
            message: 'Order not found',
          },
          HttpStatus.NOT_FOUND
        )
      );
    });
  });

  describe('getAllOrders', () => {
    it('should return all orders', async () => {
      const orders = [mockOrder, { ...mockOrder, id: 'order-456' }];
      jest.spyOn(service, 'getAllOrders').mockResolvedValue(orders as any);

      const result = await controller.getAllOrders();

      expect(result).toEqual({
        success: true,
        data: orders,
        count: 2,
      });
      expect(service.getAllOrders).toHaveBeenCalled();
    });
  });

  describe('retryPayment', () => {
    it('should successfully retry payment', async () => {
      const successOrder = { ...mockOrder, status: 'PAYMENT_SUCCESS' };
      jest.spyOn(service, 'retryPayment').mockResolvedValue(successOrder as any);

      const result = await controller.retryPayment('order-123');

      expect(result).toEqual({
        success: true,
        data: successOrder,
        message: 'Payment retry successful',
      });
      expect(service.retryPayment).toHaveBeenCalledWith('order-123');
    });

    it('should return 422 when payment retry fails', async () => {
      const failedOrder = { ...mockOrder, status: 'PAYMENT_FAILED' };
      jest.spyOn(service, 'retryPayment').mockResolvedValue(failedOrder as any);

      await expect(controller.retryPayment('order-123')).rejects.toThrow(
        new HttpException(
          {
            success: false,
            data: failedOrder,
            message: 'Payment retry failed',
          },
          HttpStatus.UNPROCESSABLE_ENTITY
        )
      );
    });

    it('should return 404 when order not found', async () => {
      jest.spyOn(service, 'retryPayment').mockRejectedValue(new Error('Order with ID order-123 not found'));

      await expect(controller.retryPayment('order-123')).rejects.toThrow(
        new HttpException(
          {
            success: false,
            message: 'Order with ID order-123 not found',
          },
          HttpStatus.NOT_FOUND
        )
      );
    });

    it('should return 400 for invalid retry attempts', async () => {
      jest.spyOn(service, 'retryPayment').mockRejectedValue(new Error('Cannot retry payment for order order-123: Payment already successful'));

      await expect(controller.retryPayment('order-123')).rejects.toThrow(
        new HttpException(
          {
            success: false,
            message: 'Cannot retry payment for order order-123: Payment already successful',
          },
          HttpStatus.BAD_REQUEST
        )
      );
    });
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      const result = controller.healthCheck();

      expect(result).toHaveProperty('status', 'OK');
      expect(result).toHaveProperty('service', 'Order Service');
      expect(result).toHaveProperty('timestamp');
    });
  });
});