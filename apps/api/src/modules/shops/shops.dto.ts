import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, ValidateNested, IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';
import { ShopCategory } from '../../common/enums';
import { OpeningHours } from '../../database/entities';

export class ListShopsQuery {
  @ApiPropertyOptional() @IsOptional() @IsUUID() neighborhoodId?: string;
  @ApiPropertyOptional({ enum: ShopCategory }) @IsOptional() @IsEnum(ShopCategory) category?: ShopCategory;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
  @ApiPropertyOptional({ description: 'true pour ne voir que les commerces ouverts' }) @IsOptional() @IsIn(['true', 'false']) openOnly?: string;
}

export class CreateShopDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiProperty({ enum: ShopCategory }) @IsEnum(ShopCategory) category: ShopCategory;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty() @IsUUID() neighborhoodId: string;
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) landmarkText?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() idDocumentUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mobileMoneyNumber?: string;
  @ApiPropertyOptional({ enum: ['DAILY', 'WEEKLY'] }) @IsOptional() @IsIn(['DAILY', 'WEEKLY']) payoutFrequency?: 'DAILY' | 'WEEKLY';
  @ApiPropertyOptional() @IsOptional() @IsObject() openingHours?: OpeningHours;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() selfDelivery?: boolean;
}
export class UpdateShopDto extends PartialType(CreateShopDto) {}

/** Inscription assistée par un agent terrain : crée le compte commerçant et sa boutique. */
export class OnboardMerchantDto extends CreateShopDto {
  @ApiProperty({ example: '07 01 02 03 04' }) @IsString() ownerPhone: string;
  @ApiProperty() @IsString() @MaxLength(80) ownerName: string;
}

export class ProductDto {
  @ApiProperty() @IsString() @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) description?: string;
  @ApiProperty({ description: 'Prix en FCFA' }) @IsInt() @Min(0) @Max(10_000_000) price: number;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) section?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() available?: boolean;
}
export class UpdateProductDto extends PartialType(ProductDto) {}

export class SetOpenDto {
  @ApiProperty() @IsBoolean() isOpen: boolean;
}
export class SetAvailableDto {
  @ApiProperty() @IsBoolean() available: boolean;
}
export class BulkProductsDto {
  @ApiProperty({ type: [ProductDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ProductDto)
  products: ProductDto[];
}
export class NumberDto {
  @ApiProperty() @IsNumber() value: number;
}
