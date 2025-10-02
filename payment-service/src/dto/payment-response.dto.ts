export class PaymentResponseDto {
  orderId: string;
  paymentId: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  processedAt: Date;
}