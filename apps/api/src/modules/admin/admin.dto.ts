import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { AccountStatus, OrderStatus, Role, ShopCategory } from '../../common/enums';

export class StatusDto {
  @ApiProperty({ enum: AccountStatus }) @IsEnum(AccountStatus) status: AccountStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
export class UsersQuery {
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
  @ApiPropertyOptional({ enum: AccountStatus }) @IsOptional() @IsEnum(AccountStatus) status?: AccountStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
}
export class CreateStaffDto {
  @ApiProperty() @IsString() phone: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: [Role.ADMIN, Role.AGENT] }) @IsIn([Role.ADMIN, Role.AGENT]) role: Role.ADMIN | Role.AGENT;
}
export class ShopAdminPatchDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(50) commissionRateOverride?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() commissionFreeUntil?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() selfDelivery?: boolean;
}
export class OrdersQuery {
  @ApiPropertyOptional({ enum: OrderStatus }) @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() neighborhoodId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() shopId?: string;
  @ApiPropertyOptional({ description: 'true : commandes en retard uniquement' }) @IsOptional() @IsIn(['true', 'false']) late?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}
export class AssignDto {
  @ApiProperty() @IsUUID() courierId: string;
}
export class AdminCancelDto {
  @ApiProperty() @IsString() @MaxLength(300) reason: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) fee?: number;
}
export class CityDto {
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;
}
export class NeighborhoodDto {
  @ApiProperty() @IsUUID() cityId: string;
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;
}
export class TariffTier {
  @ApiProperty() @IsInt() @Min(1) maxDistanceMeters: number;
  @ApiProperty() @IsInt() @Min(0) fee: number;
}
export class TariffsDto {
  @ApiProperty({ type: [TariffTier] }) @IsArray() @ValidateNested({ each: true }) @Type(() => TariffTier) tiers: TariffTier[];
}
export class CommissionItem {
  @ApiProperty({ enum: ShopCategory }) @IsEnum(ShopCategory) category: ShopCategory;
  @ApiProperty() @IsNumber() @Min(0) @Max(50) ratePercent: number;
}
export class CommissionsDto {
  @ApiProperty({ type: [CommissionItem] }) @IsArray() @ValidateNested({ each: true }) @Type(() => CommissionItem) items: CommissionItem[];
}
export class SettingDto {
  @ApiProperty() value: unknown;
}
export class RemittanceDto {
  @ApiProperty() @IsUUID() courierId: string;
  @ApiProperty() @IsInt() @Min(1) amount: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
export class PayoutPayDto {
  @ApiPropertyOptional({ description: 'Référence de la transaction Mobile Money' }) @IsOptional() @IsString() providerRef?: string;
}
export class ResolveTicketDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) refundAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) message?: string;
}
export class PeriodQuery {
  @ApiPropertyOptional({ example: '2027-01-01' }) @IsOptional() @IsString() from?: string;
  @ApiPropertyOptional({ example: '2027-01-31' }) @IsOptional() @IsString() to?: string;
}
