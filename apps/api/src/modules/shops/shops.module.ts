import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Neighborhood, Product, Shop, User } from '../../database/entities';
import { AgentController, MerchantShopsController, ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
  imports: [TypeOrmModule.forFeature([Shop, Product, User, Neighborhood])],
  providers: [ShopsService],
  controllers: [ShopsController, MerchantShopsController, AgentController],
  exports: [ShopsService],
})
export class ShopsModule {}
