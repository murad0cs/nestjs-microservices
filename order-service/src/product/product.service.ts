import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {
    // Seed initial products on startup
    this.seedProducts();
  }

  async seedProducts(): Promise<void> {
    const count = await this.productRepository.count();
    if (count > 0) {
      this.logger.log('Products already seeded');
      return;
    }

    const products = [
      {
        productCode: 'LAPTOP-001',
        name: 'MacBook Pro M3',
        description: 'Apple MacBook Pro 14-inch with M3 chip',
        price: 1999.99,
        stockQuantity: 50,
        category: 'Electronics',
        metadata: { brand: 'Apple', warranty: '1 year' },
      },
      {
        productCode: 'PHONE-001',
        name: 'iPhone 15 Pro',
        description: 'Latest iPhone with titanium design',
        price: 1199.99,
        stockQuantity: 100,
        category: 'Electronics',
        metadata: { brand: 'Apple', color: 'Natural Titanium' },
      },
      {
        productCode: 'HEADPHONE-001',
        name: 'AirPods Pro',
        description: 'Wireless earbuds with noise cancellation',
        price: 249.99,
        stockQuantity: 200,
        category: 'Audio',
        metadata: { brand: 'Apple', batteryLife: '6 hours' },
      },
      {
        productCode: 'TABLET-001',
        name: 'iPad Air',
        description: '10.9-inch iPad Air with M1 chip',
        price: 599.99,
        stockQuantity: 75,
        category: 'Electronics',
        metadata: { brand: 'Apple', screenSize: '10.9 inch' },
      },
      {
        productCode: 'WATCH-001',
        name: 'Apple Watch Series 9',
        description: 'Advanced health and fitness tracker',
        price: 399.99,
        stockQuantity: 150,
        category: 'Wearables',
        metadata: { brand: 'Apple', size: '45mm' },
      },
      {
        productCode: 'KEYBOARD-001',
        name: 'Magic Keyboard',
        description: 'Wireless keyboard with Touch ID',
        price: 149.99,
        stockQuantity: 300,
        category: 'Accessories',
        metadata: { brand: 'Apple', connectivity: 'Bluetooth' },
      },
      {
        productCode: 'MOUSE-001',
        name: 'Magic Mouse',
        description: 'Wireless multi-touch mouse',
        price: 79.99,
        stockQuantity: 250,
        category: 'Accessories',
        metadata: { brand: 'Apple', connectivity: 'Bluetooth' },
      },
      {
        productCode: 'CABLE-001',
        name: 'USB-C Cable',
        description: '2-meter USB-C to USB-C cable',
        price: 29.99,
        stockQuantity: 500,
        category: 'Accessories',
        metadata: { length: '2m', type: 'USB-C' },
      },
    ];

    try {
      await this.productRepository.save(products);
      this.logger.log(`Seeded ${products.length} products`);
    } catch (error) {
      this.logger.error('Failed to seed products', error);
    }
  }

  async findByProductCode(productCode: string): Promise<Product> {
    const product = await this.productRepository.findOne({
      where: { productCode, isActive: true },
    });

    if (!product) {
      throw new NotFoundException(`Product with code ${productCode} not found or inactive`);
    }

    return product;
  }

  async validateAndGetProduct(productCode: string): Promise<Product> {
    const product = await this.findByProductCode(productCode);
    
    if (product.stockQuantity <= 0) {
      throw new ConflictException(`Product ${productCode} is out of stock`);
    }

    return product;
  }

  async decrementStock(productCode: string, quantity: number): Promise<void> {
    const product = await this.findByProductCode(productCode);
    
    if (product.stockQuantity < quantity) {
      throw new ConflictException(
        `Insufficient stock for product ${productCode}. Available: ${product.stockQuantity}, Requested: ${quantity}`
      );
    }

    product.stockQuantity -= quantity;
    await this.productRepository.save(product);
  }

  async incrementStock(productCode: string, quantity: number): Promise<void> {
    const product = await this.findByProductCode(productCode);
    product.stockQuantity += quantity;
    await this.productRepository.save(product);
  }

  async getAllProducts(): Promise<Product[]> {
    return this.productRepository.find({
      where: { isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  async getProductById(id: string): Promise<Product> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }
}