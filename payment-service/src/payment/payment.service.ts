import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { Payment } from '../entities/payment.entity';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async processPayment(paymentRequest: PaymentRequestDto): Promise<PaymentResponseDto> {
    this.logger.log(`Processing payment for order: ${paymentRequest.orderId}, amount: $${paymentRequest.amount}`);
    
    // Wait a bit to simulate real payment processing
    await this.simulatePaymentProcessing();
    
    // Always succeed for testing (set to false to test failure scenarios)
    const isSuccess = true;
    const failureReason = isSuccess ? null : this.getRandomFailureReason();
    
    // Create and save payment record
    const newPayment = new Payment();
    newPayment.orderId = paymentRequest.orderId;
    newPayment.amount = paymentRequest.amount;
    newPayment.currency = 'USD';
    newPayment.customerId = paymentRequest.customerId;
    newPayment.customerEmail = paymentRequest.customerEmail;
    newPayment.status = isSuccess ? 'SUCCESS' : 'FAILED';
    if (failureReason) {
      newPayment.failureReason = failureReason;
    }
    if (isSuccess) {
      newPayment.transactionReference = `TXN-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    
    const savedPayment = await this.paymentRepository.save(newPayment);
    
    const response: PaymentResponseDto = {
      orderId: paymentRequest.orderId,
      paymentId: savedPayment.id,
      status: savedPayment.status as 'SUCCESS' | 'FAILED',
      message: isSuccess 
        ? `Payment of $${paymentRequest.amount} processed successfully`
        : `Payment failed: ${savedPayment.failureReason}`,
      processedAt: savedPayment.createdAt,
    };
    
    if (isSuccess) {
      this.logger.log(`Payment ${savedPayment.id} completed successfully for order ${paymentRequest.orderId}`);
    } else {
      this.logger.warn(`Payment ${savedPayment.id} failed for order ${paymentRequest.orderId}: ${savedPayment.failureReason}`);
    }
    
    return response;
  }
  
  private async simulatePaymentProcessing(): Promise<void> {
    // Random delay between 500ms and 2000ms to feel more realistic
    const delay = Math.floor(Math.random() * 1500) + 500;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
  
  private getRandomFailureReason(): string {
    const reasons = [
      'Insufficient funds',
      'Card declined',
      'Invalid card number',
      'Card expired',
      'Transaction limit exceeded',
      'Payment gateway timeout',
      'Bank authorization failed',
    ];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }
  
  async getPayment(paymentId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { id: paymentId } });
  }
  
  async getAllPayments(): Promise<Payment[]> {
    return this.paymentRepository.find({
      order: { createdAt: 'DESC' },
    });
  }
}