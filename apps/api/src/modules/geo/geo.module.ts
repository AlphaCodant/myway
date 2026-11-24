import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City, Landmark, Neighborhood } from '../../database/entities';
import { GeoController } from './geo.controller';

@Module({ imports: [TypeOrmModule.forFeature([City, Neighborhood, Landmark])], controllers: [GeoController] })
export class GeoModule {}
