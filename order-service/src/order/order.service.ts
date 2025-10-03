import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { Order } from '../entities/order.entity';
import { ProductService } from '../product/product.service';
import { DLQService } from '../dlq/dlq.service';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { firstValueFrom, timeout, catchError, of, throwError } from 'rxjs';
const CircuitBreaker = require('opossum');
import { withSpan } from '../tracing/tracing';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private paymentCircuitBreaker: any;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
    private readonly productService: ProductService,
    private readonly dlqService: DLQService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    this.initializeCircuitBreaker();
  }

  private initializeCircuitBreaker() {
    this.paymentCircuitBreaker = this.circuitBreakerService.createBreaker(
      'payment-service',
      async (paymentRequest: PaymentRequestDto) => {
        return await firstValueFrom(
          this.paymentClient
            .send<PaymentResponseDto>('process_payment', paymentRequest)
            .pipe(
              timeout(30000),
              catchError((error) => {
                throw error;
              }),
            ),
        );
      },
      {
        timeout: 30000, // 30 seconds
        errorThresholdPercentage: 50, // Open after 50% failures
        resetTimeout: 60000, // Try again after 60 seconds
        rollingCountTimeout: 10000, // Count errors over 10 seconds
        rollingCountBuckets: 10,
      },
    );
  }

  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    return withSpan('OrderService.createOrder', {
      'order.customer_id': createOrderDto.customerId,
      'order.product_code': createOrderDto.productCode,
      'order.quantity': createOrderDto.quantity,
    }, async () => {
      // Validate product exists and has stock
      const product = await this.productService.validateAndGetProduct(createOrderDto.productCode);
    
    // Check if requested quantity is available
    if (product.stockQuantity < createOrderDto.quantity) {
      throw new BadRequestException(
        `Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}, Requested: ${createOrderDto.quantity}`
      );
    }

    // Calculate total amount based on product price
    const unitPrice = product.price;
    const totalAmount = unitPrice * createOrderDto.quantity;

    // Create the order with product details
    const order = this.orderRepository.create({
      productCode: product.productCode,
      productName: product.name, // Store product name for historical record
      unitPrice: unitPrice,
      quantity: createOrderDto.quantity,
      totalAmount: totalAmount,
      customerId: createOrderDto.customerId,
      customerEmail: createOrderDto.customerEmail,
      status: 'PENDING',
    });

    let savedOrder = await this.orderRepository.save(order);
    this.logger.log(`Order created with ID: ${savedOrder.id} for product ${product.name}`);

    // Decrement stock after order creation
    await this.productService.decrementStock(product.productCode, createOrderDto.quantity);
    
    // Update status to PAYMENT_PROCESSING
    savedOrder.status = 'PAYMENT_PROCESSING';
    savedOrder = await this.orderRepository.save(savedOrder);
    
    const paymentRequest: PaymentRequestDto = {
      orderId: savedOrder.id,
      amount: totalAmount,
      customerId: createOrderDto.customerId,
      customerEmail: createOrderDto.customerEmail,
    };

    this.logger.log(`Sending payment request for order ${savedOrder.id}`);
    
    let paymentResponse: PaymentResponseDto;
    
    try {
      // Use Circuit Breaker for payment service call
      paymentResponse = await this.paymentCircuitBreaker.fire(paymentRequest);
    } catch (error) {
      // Circuit breaker opened or request failed
      if (error.message && error.message.includes('Circuit breaker')) {
        this.logger.warn(`Circuit breaker is open for order ${savedOrder.id}`);
        
        // Immediately send to DLQ when circuit is open
        await this.dlqService.sendToDeadLetterQueue(
          paymentRequest,
          new Error('Circuit breaker is open - payment service unavailable'),
          1,
        ).catch(dlqError => {
          this.logger.error('Failed to send to DLQ:', dlqError);
        });
        
        paymentResponse = {
          orderId: savedOrder.id,
          paymentId: '',
          status: 'FAILED',
          message: 'Payment service unavailable (circuit breaker open) - queued for retry',
          processedAt: new Date(),
        };
      } else {
        // Normal failure - send to DLQ
        this.logger.error(`Payment service error for order ${savedOrder.id}: ${error.message}`);
        
        await this.dlqService.sendToDeadLetterQueue(
          paymentRequest,
          error,
          1,
        ).catch(dlqError => {
          this.logger.error('Failed to send to DLQ:', dlqError);
        });
        
        paymentResponse = {
          orderId: savedOrder.id,
          paymentId: '',
          status: 'FAILED',
          message: `Critical payment error: ${error.message}`,
          processedAt: new Date(),
        };
      }
    }

    if (paymentResponse.status === 'SUCCESS') {
      savedOrder.status = 'PAYMENT_SUCCESS';
      savedOrder.paymentId = paymentResponse.paymentId;
      this.logger.log(`Payment successful for order ${savedOrder.id}, payment ID: ${paymentResponse.paymentId}`);
    } else {
      savedOrder.status = 'PAYMENT_FAILED';
      // Restore stock on payment failure
      await this.productService.incrementStock(product.productCode, createOrderDto.quantity);
      this.logger.warn(`Payment failed for order ${savedOrder.id}: ${paymentResponse.message}`);
    }

    savedOrder = await this.orderRepository.save(savedOrder);

    return savedOrder;
    }); // End of withSpan
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return this.orderRepository.findOne({ where: { id: orderId } });
  }

  async getAllOrders(): Promise<Order[]> {
    return this.orderRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async retryPayment(orderId: string): Promise<Order> {
    // Fetch the existing order
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found`);
    }

    // Check if payment can be retried
    if (order.status === 'PAYMENT_SUCCESS') {
      throw new Error(`Cannot retry payment for order ${orderId}: Payment already successful`);
    }

    if (order.status === 'PENDING') {
      throw new Error(`Cannot retry payment for order ${orderId}: Payment is still being processed`);
    }

    if (order.status === 'PAYMENT_PROCESSING') {
      throw new Error(`Cannot retry payment for order ${orderId}: Payment is currently in progress`);
    }

    // Only retry if status is PAYMENT_FAILED
    if (order.status !== 'PAYMENT_FAILED') {
      throw new Error(`Cannot retry payment for order ${orderId}: Invalid order status ${order.status}`);
    }

    // Check if product still has stock
    const product = await this.productService.validateAndGetProduct(order.productCode);
    if (product.stockQuantity < order.quantity) {
      throw new Error(
        `Cannot retry payment: Insufficient stock for product ${product.name}. Available: ${product.stockQuantity}`
      );
    }

    this.logger.log(`Retrying payment for order ${orderId}`);

    try {
      // Reserve stock again
      await this.productService.decrementStock(order.productCode, order.quantity);
      
      // Update status to PAYMENT_PROCESSING
      order.status = 'PAYMENT_PROCESSING';
      let updatedOrder = await this.orderRepository.save(order);
      
      const paymentRequest: PaymentRequestDto = {
        orderId: order.id,
        amount: order.totalAmount,
        customerId: order.customerId,
        customerEmail: order.customerEmail,
      };

      this.logger.log(`Sending retry payment request for order ${order.id}`);
      
      // Use Circuit Breaker for retry payment as well
      let paymentResponse: PaymentResponseDto;
      try {
        paymentResponse = await this.paymentCircuitBreaker.fire(paymentRequest);
      } catch (error) {
        if (error.message && error.message.includes('Circuit breaker')) {
          this.logger.warn(`Circuit breaker is open during retry for order ${order.id}`);
          paymentResponse = {
            orderId: order.id,
            paymentId: '',
            status: 'FAILED',
            message: 'Payment service unavailable (circuit breaker open)',
            processedAt: new Date(),
          };
        } else {
          this.logger.error(`Payment service error during retry for order ${order.id}: ${error.message}`);
          paymentResponse = {
            orderId: order.id,
            paymentId: '',
            status: 'FAILED',
            message: `Payment service unavailable during retry: ${error.message}`,
            processedAt: new Date(),
          };
        }
      }

      if (paymentResponse.status === 'SUCCESS') {
        updatedOrder.status = 'PAYMENT_SUCCESS';
        updatedOrder.paymentId = paymentResponse.paymentId;
        this.logger.log(`Payment retry successful for order ${order.id}, payment ID: ${paymentResponse.paymentId}`);
      } else {
        updatedOrder.status = 'PAYMENT_FAILED';
        // Restore stock on payment failure
        await this.productService.incrementStock(order.productCode, order.quantity);
        this.logger.warn(`Payment retry failed for order ${order.id}: ${paymentResponse.message}`);
      }

      updatedOrder = await this.orderRepository.save(updatedOrder);
      return updatedOrder;

    } catch (error) {
      this.logger.error(`Error during payment retry for order ${order.id}: ${error.message}`);
      order.status = 'PAYMENT_FAILED';
      // Restore stock on error
      try {
        await this.productService.incrementStock(order.productCode, order.quantity);
      } catch (stockError) {
        this.logger.error(`Failed to restore stock for product ${order.productCode}: ${stockError.message}`);
      }
      return await this.orderRepository.save(order);
    }
  }
}