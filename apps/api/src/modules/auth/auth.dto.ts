import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '07 01 02 03 04' }) @IsString() phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '07 01 02 03 04' }) @IsString() phone: string;
  @ApiProperty({ example: '123456' }) @IsString() @Length(6, 6) code: string;
  /** Profil demandé à la première inscription : client (défaut) ou livreur. */
  @ApiPropertyOptional({ enum: ['CLIENT', 'COURIER'] }) @IsOptional() @IsIn(['CLIENT', 'COURIER']) as?: 'CLIENT' | 'COURIER';
}

export class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() neighborhoodId?: string;
  @ApiPropertyOptional({ enum: ['fr', 'dyu', 'bet'] }) @IsOptional() @IsIn(['fr', 'dyu', 'bet']) language?: string;
}
