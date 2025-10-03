import { Controller, Get, Post, Param, Logger } from '@nestjs/common';
import { DLQService } from './dlq.service';

@Controller('dlq')
export class DLQController {
  private readonly logger = new Logger(DLQController.name);

  constructor(private readonly dlqService: DLQService) {}

  @Get('stats')
  async getDLQStats() {
    const stats = await this.dlqService.getDeadLetterQueueStats();
    return {
      success: true,
      data: stats,
      description: 'Dead Letter Queue statistics',
    };
  }

  @Post('reprocess/:orderId')
  async reprocessOrder(@Param('orderId') orderId: string) {
    try {
      await this.dlqService.reprocessDLQMessage(orderId);
      return {
        success: true,
        message: `Reprocessing initiated for order ${orderId}`,
      };
    } catch (error) {
      this.logger.error(`Failed to reprocess order ${orderId}:`, error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}