import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentHttpController } from './payment-http.controller';
import { PaymentService } from './payment.service';
import { HealthController } from '../health/health.controller';
import { Payment } from '../entities/payment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment])],
  controllers: [PaymentController, PaymentHttpController, HealthController],
  providers: [PaymentService],
})
export class PaymentModule {}