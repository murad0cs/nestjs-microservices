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

  @Post(':id/retry-payment')
  async retryPayment(@Param('id') id: string) {
    try {
      this.logger.log(`Received payment retry request for order: ${id}`);
      const result = await this.orderService.retryPayment(id);
      
      // Return appropriate status code based on payment result
      if (result.status === 'PAYMENT_SUCCESS') {
        return {
          success: true,
          data: result,
          message: 'Payment retry successful',
        };
      } else {
        // Payment failed - return 422 (Unprocessable Entity) since the request was valid but payment couldn't be processed
        throw new HttpException(
          {
            success: false,
            data: result,
            message: 'Payment retry failed',
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    } catch (error) {
      // If it's already an HttpException, re-throw it
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to retry payment for order ${id}: ${error.message}`);
      
      if (error.message.includes('not found')) {
        throw new HttpException(
          {
            success: false,
            message: error.message,
          },
          HttpStatus.NOT_FOUND,
        );
      }
      
      if (error.message.includes('already successful') || error.message.includes('Cannot retry')) {
        throw new HttpException(
          {
            success: false,
            message: error.message,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      
      throw new HttpException(
        {
          success: false,
          message: 'Failed to retry payment',
          error: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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