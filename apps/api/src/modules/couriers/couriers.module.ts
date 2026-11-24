import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CourierProfile, Order, PayoutRequest, User } from '../../database/entities';
import { OrdersModule } from '../orders/orders.module';
import { CouriersController } from './couriers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CourierProfile, User, Order, PayoutRequest]), OrdersModule],
  controllers: [CouriersController],
})
export class CouriersModule {}
