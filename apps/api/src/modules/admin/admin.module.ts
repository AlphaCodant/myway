import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CashRemittance, CategoryCommission, City, CourierProfile, DeliveryTariff, Neighborhood, Order, PayoutRequest, Shop, Ticket, User,
} from '../../database/entities';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsModule } from '../payments/payments.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User, Shop, CourierProfile, Order, City, Neighborhood, DeliveryTariff, CategoryCommission, Ticket, CashRemittance, PayoutRequest,
    ]),
    OrdersModule,
    PaymentsModule,
  ],
  providers: [AdminService],
  controllers: [AdminController],
})
export class AdminModule {}
