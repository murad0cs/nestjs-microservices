import { IsNotEmpty, IsNumber, IsString, Min, IsEmail, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  productCode: string; // Changed from productId to productCode

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsEmail()
  customerEmail: string;

  // Optional fields that will be filled from product catalog
  @IsOptional()
  @IsString()
  productName?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;
}