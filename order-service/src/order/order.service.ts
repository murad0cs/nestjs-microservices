import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientProxy } from '@nestjs/microservices';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { Order } from '../entities/order.entity';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject('PAYMENT_SERVICE') private readonly paymentClient: ClientProxy,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto): Promise<Order> {
    // Create the order in database
    const order = this.orderRepository.create({
      ...createOrderDto,
      status: 'PENDING',
    });

    let savedOrder = await this.orderRepository.save(order);
    this.logger.log(`Order created with ID: ${savedOrder.id}`);

    try {
      // Update status to PAYMENT_PROCESSING
      savedOrder.status = 'PAYMENT_PROCESSING';
      savedOrder = await this.orderRepository.save(savedOrder);
      
      const paymentRequest: PaymentRequestDto = {
        orderId: savedOrder.id,
        amount: createOrderDto.amount,
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
        this.logger.warn(`Payment failed for order ${savedOrder.id}: ${paymentResponse.message}`);
      }

      savedOrder = await this.orderRepository.save(savedOrder);

    } catch (error) {
      this.logger.error(`Error processing order ${savedOrder.id}: ${error.message}`);
      savedOrder.status = 'PAYMENT_FAILED';
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
}