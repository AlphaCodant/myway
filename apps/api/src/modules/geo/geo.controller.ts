import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { City, Landmark, Neighborhood } from '../../database/entities';
import { LandmarkType, Role } from '../../common/enums';
import { Public, Roles } from '../../common/auth/auth.decorators';
import { fromPoint, toPoint } from '../../common/geo';

export class CreateLandmarkDto {
  @ApiProperty() @IsUUID() neighborhoodId: string;
  @ApiProperty() @IsString() @MaxLength(120) name: string;
  @ApiPropertyOptional({ enum: LandmarkType }) @IsOptional() @IsEnum(LandmarkType) type?: LandmarkType;
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
}

@ApiTags('Villes, quartiers et repères')
@Controller()
export class GeoController {
  constructor(
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Neighborhood) private readonly neighborhoods: Repository<Neighborhood>,
    @InjectRepository(Landmark) private readonly landmarks: Repository<Landmark>,
  ) {}

  @Public() @Get('cities')
  async listCities() {
    const rows = await this.cities.find({ where: { active: true }, order: { name: 'ASC' } });
    return rows.map((c) => ({ id: c.id, slug: c.slug, name: c.name, center: fromPoint(c.center) }));
  }

  @Public() @Get('cities/:slug/neighborhoods')
  async listNeighborhoods(@Param('slug') slug: string) {
    const city = await this.cities.findOneBy({ slug });
    if (!city) throw new NotFoundException('Ville inconnue');
    const rows = await this.neighborhoods.find({ where: { cityId: city.id, active: true }, order: { name: 'ASC' } });
    return rows.map((n) => ({ id: n.id, name: n.name, center: fromPoint(n.center) }));
  }

  @Public() @Get('landmarks')
  async listLandmarks(@Query('neighborhoodId') neighborhoodId?: string) {
    const rows = await this.landmarks.find({ where: neighborhoodId ? { neighborhoodId } : {}, order: { name: 'ASC' } });
    return rows.map((l) => ({ id: l.id, name: l.name, type: l.type, neighborhoodId: l.neighborhoodId, location: fromPoint(l.location) }));
  }

  @ApiBearerAuth() @Roles(Role.AGENT) @Post('landmarks')
  async createLandmark(@Body() dto: CreateLandmarkDto) {
    const l = await this.landmarks.save(
      this.landmarks.create({ neighborhoodId: dto.neighborhoodId, name: dto.name, type: dto.type, location: toPoint(dto) }),
    );
    return { ...l, location: fromPoint(l.location) };
  }
}
