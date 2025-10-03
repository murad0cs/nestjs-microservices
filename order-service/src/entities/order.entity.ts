import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('orders')
@Index(['customerId'])
@Index(['status'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productCode: string; // Reference to product catalog

  @Column()
  productName: string; // Denormalized for historical record

  @Column('decimal', { precision: 10, scale: 2 })
  unitPrice: number; // Price per unit at time of order

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number; // quantity * unitPrice

  @Column()
  customerId: string;

  @Column()
  customerEmail: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'PAYMENT_PROCESSING', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_QUEUED_DLQ', 'COMPLETED'],
    default: 'PENDING',
  })
  status: string;

  @Column({ nullable: true })
  paymentId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}