import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload, RmqContext, Ctx } from '@nestjs/microservices';
import { PaymentService } from './payment.service';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';

@Controller()
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @MessagePattern('process_payment')
  async processPayment(
    @Payload() paymentRequest: PaymentRequestDto,
    @Ctx() context: RmqContext,
  ): Promise<PaymentResponseDto> {
    this.logger.log(`Received payment request for order: ${paymentRequest.orderId}`);
    
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();
    
    try {
      const response = await this.paymentService.processPayment(paymentRequest);
      
      // Tell RabbitMQ we got the message successfully
      channel.ack(originalMsg);
      
      return response;
    } catch (error) {
      this.logger.error(`Error processing payment for order ${paymentRequest.orderId}: ${error.message}`);
      
      // Tell RabbitMQ this message failed and we don't want to retry it
      channel.nack(originalMsg, false, false);
      
      return {
        orderId: paymentRequest.orderId,
        paymentId: '',
        status: 'FAILED',
        message: `Payment processing error: ${error.message}`,
        processedAt: new Date(),
      };
    }
  }
}