import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('payments')
@Index(['orderId'])
@Index(['status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column()
  currency: string;

  @Column()
  customerId: string;

  @Column()
  customerEmail: string;

  @Column({
    type: 'enum',
    enum: ['SUCCESS', 'FAILED', 'PENDING'],
    default: 'PENDING',
  })
  status: string;

  @Column({ nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  transactionReference: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}