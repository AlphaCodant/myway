import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Address } from '../../database/entities';
import { AuthUser, CurrentUser } from '../../common/auth/auth.decorators';
import { fromPoint, toPoint } from '../../common/geo';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Maison' }) @IsOptional() @IsString() @MaxLength(40) label?: string;
  @ApiProperty() @IsUUID() neighborhoodId: string;
  @ApiProperty({ example: 6.1319 }) @IsLatitude() lat: number;
  @ApiProperty({ example: -5.9506 }) @IsLongitude() lng: number;
  @ApiPropertyOptional({ example: 'Après la mosquée, portail bleu' }) @IsOptional() @IsString() @MaxLength(300) landmarkText?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() landmarkId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() voiceNoteUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) plusCode?: string;
}
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export const serializeAddress = (a: Address) => ({ ...a, location: fromPoint(a.location) });

@ApiTags('Adresses du client')
@ApiBearerAuth()
@Controller('me/addresses')
export class AddressesController {
  constructor(@InjectRepository(Address) private readonly addresses: Repository<Address>) {}

  @Get()
  async list(@CurrentUser() me: AuthUser) {
    const rows = await this.addresses.find({ where: { userId: me.id }, order: { createdAt: 'DESC' } });
    return rows.map(serializeAddress);
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateAddressDto) {
    const { lat, lng, ...rest } = dto;
    const a = await this.addresses.save(this.addresses.create({ ...rest, userId: me.id, location: toPoint({ lat, lng }) }));
    return serializeAddress(a);
  }

  @Patch(':id')
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateAddressDto) {
    const a = await this.addresses.findOneBy({ id, userId: me.id });
    if (!a) throw new NotFoundException('Adresse introuvable');
    const { lat, lng, ...rest } = dto;
    Object.assign(a, rest);
    if (lat != null && lng != null) a.location = toPoint({ lat, lng });
    return serializeAddress(await this.addresses.save(a));
  }

  @Delete(':id')
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.addresses.delete({ id, userId: me.id });
    return { ok: true };
  }
}
