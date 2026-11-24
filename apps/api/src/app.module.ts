import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from './common/auth/auth.guard';
import { buildDataSourceOptions } from './database/data-source';
import { User } from './database/entities';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CouriersModule } from './modules/couriers/couriers.module';
import { GeoModule } from './modules/geo/geo.module';
import { HealthController } from './health.controller';
import { MerchantModule } from './modules/merchant/merchant.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrdersModule } from './modules/orders/orders.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ShopsModule } from './modules/shops/shops.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UploadsController } from './modules/uploads/uploads.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ useFactory: () => buildDataSourceOptions(process.env) }),
    TypeOrmModule.forFeature([User]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        secret: c.get('JWT_SECRET', 'dev-secret'),
        signOptions: { expiresIn: c.get('JWT_EXPIRES_IN', '30d') },
      }),
    }),
    ScheduleModule.forRoot(),
    NotificationsModule,
    SettingsModule,
    AuthModule,
    GeoModule,
    AddressesModule,
    ShopsModule,
    OrdersModule,
    CouriersModule,
    MerchantModule,
    TicketsModule,
    AdminModule,
  ],
  controllers: [HealthController, UploadsController],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
