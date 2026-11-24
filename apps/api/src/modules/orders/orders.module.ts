import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Address, CourierProfile, DeliveryOffer, LedgerEntry, Neighborhood, Order, OrderEvent, OrderItem, Product, Rating, Shop, User,
} from '../../database/entities';
import { PaymentsModule } from '../payments/payments.module';
import { ShopsModule } from '../shops/shops.module';
import { DispatchService } from './dispatch.service';
import { LedgerService } from './ledger.service';
import { CourierOrdersController, MerchantOrdersController, OrdersController, PaymentsController } from './orders.controller';
import { OrdersScheduler } from './orders.scheduler';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order, OrderItem, OrderEvent, DeliveryOffer, Shop, Product, Address, Neighborhood, User, CourierProfile, Rating, LedgerEntry,
    ]),
    PaymentsModule,
    ShopsModule,
  ],
  providers: [OrdersService, DispatchService, LedgerService, OrdersScheduler],
  controllers: [OrdersController, MerchantOrdersController, CourierOrdersController, PaymentsController],
  exports: [OrdersService, DispatchService, LedgerService],
})
export class OrdersModule {}
