export default () => ({
  port: parseInt(process.env.PORT || '3002', 10),
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
    queue: process.env.RABBITMQ_QUEUE || 'payment_queue',
  },
});