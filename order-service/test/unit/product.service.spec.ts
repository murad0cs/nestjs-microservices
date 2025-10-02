import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from '../entities/product.entity';

describe('ProductService', () => {
  let service: ProductService;
  let repository: Repository<Product>;

  const mockProduct = {
    id: 'product-123',
    productCode: 'LAPTOP-001',
    name: 'MacBook Pro M3',
    description: 'High-performance laptop',
    price: 1999.99,
    currency: 'USD',
    stockQuantity: 10,
    isActive: true,
    category: 'Electronics',
    metadata: { brand: 'Apple' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: {
            count: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
    repository = module.get<Repository<Product>>(getRepositoryToken(Product));
  });

  describe('onModuleInit', () => {
    it('should seed products when database is empty', async () => {
      jest.spyOn(repository, 'count').mockResolvedValue(0);
      jest.spyOn(repository, 'create').mockImplementation((entity) => entity as any);
      jest.spyOn(repository, 'save').mockResolvedValue(mockProduct as any);

      await service.onModuleInit();

      expect(repository.count).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalledTimes(8); // 8 seed products
    });

    it('should not seed products when database has data', async () => {
      jest.spyOn(repository, 'count').mockResolvedValue(5);

      await service.onModuleInit();

      expect(repository.count).toHaveBeenCalled();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('validateAndGetProduct', () => {
    it('should return product when it exists', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await service.validateAndGetProduct('LAPTOP-001');

      expect(result).toEqual(mockProduct);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { productCode: 'LAPTOP-001' } });
    });

    it('should throw NotFoundException when product not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.validateAndGetProduct('NON-EXISTENT')).rejects.toThrow(
        new NotFoundException('Product with code NON-EXISTENT not found')
      );
    });
  });

  describe('decrementStock', () => {
    it('should decrement stock successfully', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);
      jest.spyOn(repository, 'save').mockResolvedValue({ ...mockProduct, stockQuantity: 8 } as any);

      await service.decrementStock('LAPTOP-001', 2);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: 8 })
      );
    });

    it('should throw error when insufficient stock', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      await expect(service.decrementStock('LAPTOP-001', 15)).rejects.toThrow(
        new BadRequestException('Insufficient stock for product LAPTOP-001')
      );
    });

    it('should throw error when product not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.decrementStock('NON-EXISTENT', 1)).rejects.toThrow(
        new NotFoundException('Product with code NON-EXISTENT not found')
      );
    });
  });

  describe('incrementStock', () => {
    it('should increment stock successfully', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);
      jest.spyOn(repository, 'save').mockResolvedValue({ ...mockProduct, stockQuantity: 15 } as any);

      await service.incrementStock('LAPTOP-001', 5);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({ stockQuantity: 15 })
      );
    });

    it('should throw error when product not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.incrementStock('NON-EXISTENT', 1)).rejects.toThrow(
        new NotFoundException('Product with code NON-EXISTENT not found')
      );
    });
  });

  describe('findByProductCode', () => {
    it('should find product by code', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await service.findByProductCode('LAPTOP-001');

      expect(result).toEqual(mockProduct);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { productCode: 'LAPTOP-001' } });
    });

    it('should throw error when product not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.findByProductCode('NON-EXISTENT')).rejects.toThrow(
        new NotFoundException('Product with code NON-EXISTENT not found')
      );
    });
  });

  describe('getProductById', () => {
    it('should find product by id', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockProduct as any);

      const result = await service.getProductById('product-123');

      expect(result).toEqual(mockProduct);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'product-123' } });
    });

    it('should throw error when product not found', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);

      await expect(service.getProductById('non-existent')).rejects.toThrow(
        new NotFoundException('Product with ID non-existent not found')
      );
    });
  });

  describe('getAllProducts', () => {
    it('should return all products', async () => {
      const products = [mockProduct, { ...mockProduct, id: 'product-456', productCode: 'PHONE-001' }];
      jest.spyOn(repository, 'find').mockResolvedValue(products as any);

      const result = await service.getAllProducts();

      expect(result).toEqual(products);
      expect(repository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
    });
  });
});