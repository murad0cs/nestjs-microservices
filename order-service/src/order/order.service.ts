import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { Order } from '../entities/order.entity';
import { ProductService } from '../product/product.service';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
    private readonly productService: ProductService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
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

    try {
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
      
      const paymentResponse = await firstValueFrom(
        this.paymentClient
          .send<PaymentResponseDto>('process_payment', paymentRequest)
          .pipe(
            timeout(30000),
            catchError((error) => {
              this.logger.error(`Payment service error for order ${savedOrder.id}: ${error.message}`);
              return of({
                orderId: savedOrder.id,
                paymentId: '',
                status: 'FAILED' as const,
                message: `Payment service unavailable: ${error.message}`,
                processedAt: new Date(),
              });
            }),
          ),
      );

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

    } catch (error) {
      this.logger.error(`Error processing order ${savedOrder.id}: ${error.message}`);
      savedOrder.status = 'PAYMENT_FAILED';
      // Restore stock on error
      try {
        await this.productService.incrementStock(product.productCode, createOrderDto.quantity);
      } catch (stockError) {
        this.logger.error(`Failed to restore stock for product ${product.productCode}: ${stockError.message}`);
      }
      savedOrder = await this.orderRepository.save(savedOrder);
    }

    return savedOrder;
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
      
      const paymentResponse = await firstValueFrom(
        this.paymentClient
          .send<PaymentResponseDto>('process_payment', paymentRequest)
          .pipe(
            timeout(30000),
            catchError((error) => {
              this.logger.error(`Payment service error during retry for order ${order.id}: ${error.message}`);
              return of({
                orderId: order.id,
                paymentId: '',
                status: 'FAILED' as const,
                message: `Payment service unavailable during retry: ${error.message}`,
                processedAt: new Date(),
              });
            }),
          ),
      );

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