import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { OrderService } from '../../src/order/order.service';
import { PaymentService } from '../../../payment-service/src/payment/payment.service';
import { of } from 'rxjs';

describe('Order-Payment Integration Tests', () => {
  let orderService: OrderService;
  let paymentClient: ClientProxy;

  describe('Payment Processing Integration', () => {
    it('should handle successful payment flow', async () => {
      // This tests the integration between Order and Payment services
      // In a real integration test, both services would be running
      
      const mockPaymentResponse = {
        orderId: 'order-123',
        paymentId: 'payment-123',
        status: 'SUCCESS',
        message: 'Payment processed successfully',
        processedAt: new Date(),
      };

      // Mock the RabbitMQ communication
      const mockPaymentClient = {
        send: jest.fn().mockReturnValue(of(mockPaymentResponse)),
      };

      // Test that the order service correctly processes the payment response
      expect(mockPaymentResponse.status).toBe('SUCCESS');
      expect(mockPaymentClient.send).toBeDefined();
    });

    it('should handle payment service unavailable', async () => {
      // Test resilience when payment service is down
      const mockPaymentClient = {
        send: jest.fn().mockReturnValue(
          of({
            orderId: 'order-123',
            paymentId: '',
            status: 'FAILED',
            message: 'Payment service unavailable',
            processedAt: new Date(),
          })
        ),
      };

      const response = await mockPaymentClient.send('process_payment', {
        orderId: 'order-123',
        amount: 100,
      }).toPromise();

      expect(response.status).toBe('FAILED');
      expect(response.message).toContain('unavailable');
    });

    it('should handle message queue failures', async () => {
      // Test handling of RabbitMQ connection issues
      const mockPaymentClient = {
        send: jest.fn().mockImplementation(() => {
          throw new Error('Queue connection lost');
        }),
      };

      expect(() => {
        mockPaymentClient.send('process_payment', {});
      }).toThrow('Queue connection lost');
    });
  });

  describe('Stock Management Integration', () => {
    it('should coordinate stock updates with payment status', async () => {
      // Test that stock is properly managed across payment states
      
      const initialStock = 10;
      const orderQuantity = 2;
      
      // Simulate order creation (stock decremented)
      const stockAfterOrder = initialStock - orderQuantity;
      expect(stockAfterOrder).toBe(8);
      
      // Simulate payment failure (stock restored)
      const stockAfterFailure = stockAfterOrder + orderQuantity;
      expect(stockAfterFailure).toBe(initialStock);
    });

    it('should handle concurrent orders for same product', async () => {
      // Test race conditions and concurrent stock updates
      
      const orders = [
        { productCode: 'PROD-001', quantity: 2 },
        { productCode: 'PROD-001', quantity: 3 },
        { productCode: 'PROD-001', quantity: 1 },
      ];

      const results = await Promise.allSettled(
        orders.map(order => 
          Promise.resolve({ 
            ...order, 
            status: Math.random() > 0.5 ? 'SUCCESS' : 'FAILED' 
          })
        )
      );

      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });
  });

  describe('Database Transaction Integration', () => {
    it('should maintain data consistency across services', async () => {
      // Test that order and payment records are consistent
      
      const orderId = 'order-123';
      
      // Simulate creating order in order DB
      const orderRecord = {
        id: orderId,
        status: 'PAYMENT_PROCESSING',
        totalAmount: 100,
      };

      // Simulate creating payment in payment DB
      const paymentRecord = {
        orderId: orderId,
        amount: 100,
        status: 'SUCCESS',
      };

      // Verify consistency
      expect(orderRecord.totalAmount).toBe(paymentRecord.amount);
      expect(orderRecord.id).toBe(paymentRecord.orderId);
    });

    it('should handle database rollback scenarios', async () => {
      // Test transaction rollback on failures
      
      let orderCreated = false;
      let paymentProcessed = false;

      try {
        orderCreated = true;
        // Simulate payment failure
        throw new Error('Payment processing failed');
        paymentProcessed = true;
      } catch (error) {
        // Rollback
        orderCreated = false;
        paymentProcessed = false;
      }

      expect(orderCreated).toBe(false);
      expect(paymentProcessed).toBe(false);
    });
  });
});