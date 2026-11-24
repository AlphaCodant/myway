import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../database/entities';
import { TicketsController } from './tickets.controller';

@Module({ imports: [TypeOrmModule.forFeature([Ticket])], controllers: [TicketsController] })
export class TicketsModule {}
