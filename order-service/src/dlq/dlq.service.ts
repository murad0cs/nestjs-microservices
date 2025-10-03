import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib/callback_api';
import { PaymentRequestDto } from '../dto/payment-request.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';

interface FailedPaymentMessage {
  orderId: string;
  paymentRequest: PaymentRequestDto;
  failureReason: string;
  attemptCount: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
}

@Injectable()
export class DLQService implements OnModuleInit {
  private readonly logger = new Logger(DLQService.name);
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async onModuleInit() {
    await this.setupDLQ();
  }

  private async setupDLQ() {
    try {
      const rabbitmqUrl = this.configService.get<string>('rabbitmq.url')!;
      
      // Create connection to RabbitMQ using callback API
      await new Promise<void>((resolve, reject) => {
        amqp.connect(rabbitmqUrl, (err, connection) => {
          if (err) {
            reject(err);
            return;
          }
          this.connection = connection;
          connection.createChannel((err, channel) => {
            if (err) {
              reject(err);
              return;
            }
            this.channel = channel;
            resolve();
          });
        });
      });

      // Create Dead Letter Exchange
      this.channel.assertExchange('dlx.exchange', 'direct', { durable: true });

      // Create Dead Letter Queue
      this.channel.assertQueue('payment_dlq', {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000, // Keep messages for 1 hour
          'x-max-length': 1000, // Maximum 1000 messages
        },
      });

      // Bind DLQ to DLX
      this.channel.bindQueue('payment_dlq', 'dlx.exchange', 'payment.dlq');

      // Create retry queue for messages that should be retried
      this.channel.assertQueue('payment_retry_queue', {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '', // Send back to default exchange
          'x-dead-letter-routing-key': 'payment_queue', // Back to main queue
          'x-message-ttl': 30000, // Wait 30 seconds before retry
        },
      });

      this.logger.log('Dead Letter Queue setup completed');

      // Start consuming from DLQ for monitoring
      this.consumeDLQ();
    } catch (error) {
      this.logger.error('Failed to setup DLQ:', error);
    }
  }

  async sendToDeadLetterQueue(
    paymentRequest: PaymentRequestDto,
    error: Error,
    attemptCount: number = 1,
  ): Promise<void> {
    try {
      if (!this.channel) {
        await this.setupDLQ();
      }

      const failedMessage: FailedPaymentMessage = {
        orderId: paymentRequest.orderId,
        paymentRequest,
        failureReason: error.message,
        attemptCount,
        firstAttemptAt: new Date(),
        lastAttemptAt: new Date(),
      };

      // Send to DLQ
      this.channel.sendToQueue(
        'payment_dlq',
        Buffer.from(JSON.stringify(failedMessage)),
        {
          persistent: true,
          headers: {
            'x-first-death-reason': 'payment-service-unavailable',
            'x-death-count': attemptCount,
          },
        },
      );

      this.logger.warn(
        `Payment request for order ${paymentRequest.orderId} sent to DLQ. Reason: ${error.message}`,
      );

      // Update order status to indicate DLQ
      await this.orderRepository.update(
        { id: paymentRequest.orderId },
        { 
          status: 'PAYMENT_QUEUED_DLQ',
          updatedAt: new Date(),
        },
      );
    } catch (dlqError) {
      this.logger.error('Failed to send message to DLQ:', dlqError);
    }
  }

  private async consumeDLQ() {
    try {
      this.channel.consume('payment_dlq', async (msg) => {
        if (msg) {
          const content = JSON.parse(msg.content.toString());
          this.logger.log(`DLQ Message received for order: ${content.orderId}`);
          
          // Analyze the message
          const shouldRetry = this.shouldRetryPayment(content);
          
          if (shouldRetry) {
            // Send to retry queue
            await this.sendToRetryQueue(content);
            this.channel.ack(msg);
          } else {
            // Log for manual intervention
            this.logger.error(
              `Payment for order ${content.orderId} requires manual intervention. ` +
              `Failed ${content.attemptCount} times. Reason: ${content.failureReason}`,
            );
            
            // Keep in DLQ for manual processing
            this.channel.nack(msg, false, false);
          }
        }
      });
    } catch (error) {
      this.logger.error('Error consuming from DLQ:', error);
    }
  }

  private shouldRetryPayment(message: FailedPaymentMessage): boolean {
    // Retry logic
    const maxRetries = 3;
    const timeSinceFirstAttempt = Date.now() - new Date(message.firstAttemptAt).getTime();
    const maxRetryWindow = 3600000; // 1 hour

    return (
      message.attemptCount < maxRetries &&
      timeSinceFirstAttempt < maxRetryWindow &&
      !message.failureReason.includes('Invalid') && // Don't retry invalid data
      !message.failureReason.includes('Insufficient') // Don't retry insufficient funds
    );
  }

  private async sendToRetryQueue(message: FailedPaymentMessage): Promise<void> {
    try {
      const retryMessage = {
        ...message,
        attemptCount: message.attemptCount + 1,
        lastAttemptAt: new Date(),
      };

      await this.channel.sendToQueue(
        'payment_retry_queue',
        Buffer.from(JSON.stringify(retryMessage)),
        {
          persistent: true,
          expiration: '30000', // Retry after 30 seconds
        },
      );

      this.logger.log(
        `Payment for order ${message.orderId} scheduled for retry (attempt ${retryMessage.attemptCount})`,
      );
    } catch (error) {
      this.logger.error('Failed to send message to retry queue:', error);
    }
  }

  async getDeadLetterQueueStats(): Promise<any> {
    try {
      if (!this.channel) {
        return { error: 'DLQ not initialized' };
      }
      
      return new Promise((resolve) => {
        this.channel.checkQueue('payment_dlq', (err, ok) => {
          if (err) {
            this.logger.error('Failed to get DLQ stats:', err);
            resolve({ error: err.message });
          } else {
            resolve({
              messageCount: ok.messageCount,
              consumerCount: ok.consumerCount,
            });
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to get DLQ stats:', error);
      return { error: error.message };
    }
  }

  async reprocessDLQMessage(orderId: string): Promise<void> {
    // Manual reprocessing of specific DLQ message
    this.logger.log(`Manually reprocessing payment for order: ${orderId}`);
    // Implementation would fetch from DLQ and requeue to main queue
  }
}