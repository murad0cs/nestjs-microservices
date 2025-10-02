import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('products')
@Unique(['productCode'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  productCode: string; // SKU or product code (e.g., 'LAPTOP-001')

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column('int', { default: 0 })
  stockQuantity: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  category: string;

  @Column('simple-json', { nullable: true })
  metadata: Record<string, any>; // Additional product attributes

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}