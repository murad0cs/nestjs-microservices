import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DLQService } from './dlq.service';
import { DLQController } from './dlq.controller';
import { Order } from '../entities/order.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Order]),
  ],
  controllers: [DLQController],
  providers: [DLQService],
  exports: [DLQService],
})
export class DLQModule {}