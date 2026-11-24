import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryCommission, DeliveryTariff, Setting } from '../../database/entities';
import { SettingsService } from './settings.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Setting, DeliveryTariff, CategoryCommission])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
