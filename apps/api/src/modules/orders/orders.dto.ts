import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { DeliveryMode, OrderStatus, PaymentMethod } from '../../common/enums';

export class OrderItemInput {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsInt() @Min(1) @Max(99) quantity: number;
}

export class CreateOrderDto {
  /** Identifiant fourni par l'app pour éviter les doublons quand le réseau coupe (envoi hors ligne rejoué). */
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) clientRequestId?: string;
  @ApiProperty() @IsUUID() shopId: string;
  @ApiProperty({ type: [OrderItemInput] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderItemInput)
  items: OrderItemInput[];
  @ApiProperty({ enum: DeliveryMode }) @IsEnum(DeliveryMode) deliveryMode: DeliveryMode;
  @ApiPropertyOptional({ description: 'Obligatoire sauf en retrait au commerce' }) @IsOptional() @IsUUID() addressId?: string;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class QuoteDto {
  @ApiProperty() @IsUUID() shopId: string;
  @ApiProperty({ type: [OrderItemInput] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => OrderItemInput)
  items: OrderItemInput[];
  @ApiProperty({ enum: DeliveryMode }) @IsEnum(DeliveryMode) deliveryMode: DeliveryMode;
  @ApiPropertyOptional() @IsOptional() @IsUUID() addressId?: string;
}

export class CancelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

export class SubstitutionInput {
  @ApiProperty() @IsUUID() itemId: string;
  /** Produit de remplacement ; absent = l'article est retiré. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() substituteProductId?: string;
}
export class ProposeSubstitutionsDto {
  @ApiProperty({ type: [SubstitutionInput] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SubstitutionInput)
  substitutions: SubstitutionInput[];
}

export class RespondSubstitutionsDto {
  @ApiProperty({ description: 'true : accepte les remplacements ; false : annule la commande (gratuit)' }) @IsBoolean() accept: boolean;
}

export class DeliverDto {
  @ApiProperty({ example: '4821' }) @IsString() @Length(4, 4) code: string;
}

export class RateDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) shopScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(5) courierScore?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) comment?: string;
}

export class CorrectLocationDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
}

export class ListOrdersQuery {
  @ApiPropertyOptional({ enum: OrderStatus }) @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}
