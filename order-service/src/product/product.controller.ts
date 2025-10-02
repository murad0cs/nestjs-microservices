import { Controller, Get, Param, Logger } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('products')
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(private readonly productService: ProductService) {}

  @Get()
  async getAllProducts() {
    const products = await this.productService.getAllProducts();
    return {
      success: true,
      data: products,
      count: products.length,
    };
  }

  @Get(':id')
  async getProductById(@Param('id') id: string) {
    const product = await this.productService.getProductById(id);
    return {
      success: true,
      data: product,
    };
  }

  @Get('code/:productCode')
  async getProductByCode(@Param('productCode') productCode: string) {
    const product = await this.productService.findByProductCode(productCode);
    return {
      success: true,
      data: product,
    };
  }
}