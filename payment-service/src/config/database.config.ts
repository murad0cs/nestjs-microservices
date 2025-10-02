import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'paymentuser',
  password: process.env.DB_PASSWORD || 'paymentpass123',
  database: process.env.DB_DATABASE || 'paymentdb',
  entities: [Payment],
  synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables in dev
  logging: process.env.NODE_ENV === 'development',
  migrations: [],
  migrationsRun: false,
});