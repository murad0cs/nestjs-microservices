import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DLQConsumer } from './dlq.consumer';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    ConfigModule,
    PaymentModule,
  ],
  providers: [DLQConsumer],
  exports: [DLQConsumer],
})
export class DLQModule {}