import { Transport, RmqOptions } from '@nestjs/microservices';

export const getRabbitMQConfig = (): RmqOptions => ({
  transport: Transport.RMQ,
  options: {
    urls: [process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672'],
    queue: process.env.RABBITMQ_QUEUE || 'payment_queue',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'dlx.exchange',
        'x-dead-letter-routing-key': 'payment.dlq',
        'x-message-ttl': 60000, // Messages expire after 60 seconds if not processed
      },
    },
    socketOptions: {
      heartbeatIntervalInSeconds: 60,
      reconnectTimeInSeconds: 5,
    },
    noAck: false,
  },
});

export const getDLQConfig = () => ({
  queue: 'payment_dlq',
  exchange: 'dlx.exchange',
  routingKey: 'payment.dlq',
  queueOptions: {
    durable: true,
    arguments: {
      'x-message-ttl': 3600000, // Keep failed messages for 1 hour
      'x-max-length': 1000, // Maximum 1000 messages in DLQ
    },
  },
});