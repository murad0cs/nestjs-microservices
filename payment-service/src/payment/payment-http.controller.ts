import { Controller, Get, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Controller('payments')
export class PaymentHttpController {
  private readonly logger = new Logger(PaymentHttpController.name);

  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  async getAllPayments(@Query('status') status?: string) {
    this.logger.log(`Fetching all payments${status ? ` with status: ${status}` : ''}`);
    
    const payments = await this.paymentService.getAllPayments();
    
    // Filter by status if provided
    const filteredPayments = status 
      ? payments.filter(p => p.status === status.toUpperCase())
      : payments;
    
    return {
      success: true,
      data: filteredPayments,
      count: filteredPayments.length,
      summary: {
        total: payments.length,
        successful: payments.filter(p => p.status === 'SUCCESS').length,
        failed: payments.filter(p => p.status === 'FAILED').length,
        totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0).toFixed(2),
      }
    };
  }

  @Get(':id')
  async getPaymentById(@Param('id') id: string) {
    const payment = await this.paymentService.getPayment(id);
    
    if (!payment) {
      throw new HttpException(
        {
          success: false,
          message: 'Payment not found',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    
    return {
      success: true,
      data: payment,
    };
  }

  @Get('order/:orderId')
  async getPaymentByOrderId(@Param('orderId') orderId: string) {
    this.logger.log(`Fetching payment for order: ${orderId}`);
    
    const payments = await this.paymentService.getAllPayments();
    const payment = payments.find(p => p.orderId === orderId);
    
    if (!payment) {
      throw new HttpException(
        {
          success: false,
          message: `No payment found for order ${orderId}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }
    
    return {
      success: true,
      data: payment,
    };
  }

  @Get('stats/summary')
  async getPaymentStats() {
    const payments = await this.paymentService.getAllPayments();
    
    const stats = {
      totalPayments: payments.length,
      successfulPayments: payments.filter(p => p.status === 'SUCCESS').length,
      failedPayments: payments.filter(p => p.status === 'FAILED').length,
      successRate: payments.length > 0 
        ? ((payments.filter(p => p.status === 'SUCCESS').length / payments.length) * 100).toFixed(2) + '%'
        : '0%',
      totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0).toFixed(2),
      successfulAmount: payments.filter(p => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0).toFixed(2),
      averageAmount: payments.length > 0 
        ? (payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0) / payments.length).toFixed(2)
        : 0,
      failureReasons: payments
        .filter(p => p.status === 'FAILED' && p.failureReason)
        .reduce((acc, p) => {
          acc[p.failureReason!] = (acc[p.failureReason!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
    };
    
    return {
      success: true,
      data: stats,
    };
  }
}