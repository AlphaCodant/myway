import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, PayoutRequest } from '../../database/entities';
import { OrdersModule } from '../orders/orders.module';
import { ShopsModule } from '../shops/shops.module';
import { MerchantController } from './merchant.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, PayoutRequest]), OrdersModule, ShopsModule],
  controllers: [MerchantController],
})
export class MerchantModule {}
