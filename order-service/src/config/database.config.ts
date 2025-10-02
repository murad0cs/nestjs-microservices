import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Order } from '../entities/order.entity';

export const getDatabaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'orderuser',
  password: process.env.DB_PASSWORD || 'orderpass123',
  database: process.env.DB_DATABASE || 'orderdb',
  entities: [Order],
  synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables in dev
  logging: process.env.NODE_ENV === 'development',
  migrations: [],
  migrationsRun: false,
});