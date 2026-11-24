import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order, Shop, SmsMessage, User } from '../../database/entities';
import { RealtimeGateway } from './realtime.gateway';
import { SmsService } from './sms.service';
import { CallsController } from './calls.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SmsMessage, User, Shop, Order])],
  providers: [SmsService, RealtimeGateway],
  controllers: [CallsController],
  exports: [SmsService, RealtimeGateway],
})
export class NotificationsModule {}
