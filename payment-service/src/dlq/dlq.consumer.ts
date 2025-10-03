import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib/callback_api';
import { PaymentService } from '../payment/payment.service';
import { PaymentRequestDto } from '../dto/payment-request.dto';

@Injectable()
export class DLQConsumer implements OnModuleInit {
  private readonly logger = new Logger(DLQConsumer.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentService: PaymentService,
  ) {}

  async onModuleInit() {
    // Wait a bit for main service to be ready
    setTimeout(() => {
      this.setupDLQConsumer();
    }, 5000);
  }

  private async setupDLQConsumer() {
    try {
      const rabbitmqUrl = this.configService.get<string>('rabbitmq.url')!;
      
      await new Promise<void>((resolve, reject) => {
        amqp.connect(rabbitmqUrl, (err, connection) => {
          if (err) {
            this.logger.error('Failed to connect to RabbitMQ for DLQ:', err);
            reject(err);
            return;
          }
          
          this.connection = connection;
          connection.createChannel((err, channel) => {
            if (err) {
              this.logger.error('Failed to create channel for DLQ:', err);
              reject(err);
              return;
            }
            
            this.channel = channel;
            resolve();
          });
        });
      });

      // Ensure DLQ exists
      this.channel.assertQueue('payment_dlq', {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000,
          'x-max-length': 1000,
        },
      });

      this.logger.log('Starting DLQ consumer for payment service');
      
      // Consume messages from DLQ
      this.channel.consume('payment_dlq', async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            this.logger.log(`Processing DLQ message for order: ${content.orderId || content.paymentRequest?.orderId}`);
            
            let paymentRequest: PaymentRequestDto;
            
            // Handle both formats (direct paymentRequest or nested)
            if (content.paymentRequest) {
              paymentRequest = content.paymentRequest;
            } else if (content.orderId && content.amount !== undefined) {
              paymentRequest = content as PaymentRequestDto;
            } else {
              this.logger.error('Invalid DLQ message format:', content);
              this.channel.nack(msg, false, false); // Don't requeue
              return;
            }

            // Process the payment
            const result = await this.paymentService.processPayment(paymentRequest);
            
            if (result.status === 'SUCCESS') {
              this.logger.log(`Successfully processed DLQ payment for order ${paymentRequest.orderId}`);
              this.channel.ack(msg);
              
              // Send result back to order service via regular queue
              this.sendPaymentResultToOrderService(result);
            } else {
              this.logger.warn(`DLQ payment failed for order ${paymentRequest.orderId}: ${result.message}`);
              
              // Check attempt count
              const attemptCount = content.attemptCount || 1;
              if (attemptCount >= 3) {
                this.logger.error(`Max retries reached for order ${paymentRequest.orderId}. Moving to manual intervention.`);
                this.channel.nack(msg, false, false); // Don't requeue
              } else {
                // Requeue for another attempt later
                this.channel.nack(msg, false, true);
              }
            }
          } catch (error) {
            this.logger.error('Error processing DLQ message:', error);
            this.channel.nack(msg, false, false); // Don't requeue on error
          }
        }
      });

      this.logger.log('DLQ consumer started successfully');
      
      // Process any existing messages immediately
      this.checkAndProcessDLQMessages();
    } catch (error) {
      this.logger.error('Failed to setup DLQ consumer:', error);
      // Retry setup after delay
      setTimeout(() => this.setupDLQConsumer(), 30000);
    }
  }

  private async checkAndProcessDLQMessages() {
    try {
      this.channel.checkQueue('payment_dlq', (err, ok) => {
        if (!err && ok.messageCount > 0) {
          this.logger.log(`Found ${ok.messageCount} messages in DLQ, processing...`);
        }
      });
    } catch (error) {
      this.logger.error('Error checking DLQ messages:', error);
    }
  }

  private sendPaymentResultToOrderService(result: any) {
    try {
      // Send the payment result back to a response queue that order service monitors
      const responseQueue = 'payment_response_queue';
      
      this.channel.assertQueue(responseQueue, { durable: true });
      this.channel.sendToQueue(
        responseQueue,
        Buffer.from(JSON.stringify(result)),
        { persistent: true }
      );
      
      this.logger.log(`Sent DLQ payment result to order service for order ${result.orderId}`);
    } catch (error) {
      this.logger.error('Failed to send payment result to order service:', error);
    }
  }
}