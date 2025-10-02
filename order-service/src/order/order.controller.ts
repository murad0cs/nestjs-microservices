import { Controller, Post, Get, Body, Param, HttpException, HttpStatus, Logger, UseInterceptors, ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from '../dto/create-order.dto';

@Controller('orders')
@UseInterceptors(ClassSerializerInterceptor)
export class OrderController {
  private readonly logger = new Logger(OrderController.name);

  constructor(private readonly orderService: OrderService) {}

  @Post()
  async createOrder(@Body(new ValidationPipe()) createOrderDto: CreateOrderDto) {
    try {
      this.logger.log(`Received order creation request for product: ${createOrderDto.productName}`);
      const order = await this.orderService.createOrder(createOrderDto);
      return {
        success: true,
        data: order,
      };
    } catch (error) {
      this.logger.error(`Failed to create order: ${error.message}`);
      throw new HttpException(
        {
          success: false,
          message: 'Failed to create order',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const order = await this.orderService.getOrder(id);
    if (!order) {
      throw new HttpException(
        {
          success: false,
          message: 'Order not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      success: true,
      data: order,
    };
  }

  @Get()
  async getAllOrders() {
    const orders = await this.orderService.getAllOrders();
    return {
      success: true,
      data: orders,
      count: orders.length,
    };
  }

  @Get('health/check')
  healthCheck() {
    return {
      status: 'OK',
      service: 'Order Service',
      timestamp: new Date().toISOString(),
    };
  }
}