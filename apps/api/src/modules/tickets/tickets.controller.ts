import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { Ticket } from '../../database/entities';
import { Role, TicketStatus } from '../../common/enums';
import { AuthUser, CurrentUser } from '../../common/auth/auth.decorators';
import { RealtimeGateway } from '../notifications/realtime.gateway';

export class CreateTicketDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiProperty({ example: 'Produit manquant' }) @IsString() @MaxLength(120) subject: string;
  @ApiProperty() @IsString() @MaxLength(2000) message: string;
}
export class TicketMessageDto {
  @ApiProperty() @IsString() @MaxLength(2000) text: string;
}

/** Réclamations et signalements (client, commerçant ou livreur). */
@ApiTags('Support : réclamations')
@ApiBearerAuth()
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly realtime: RealtimeGateway,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
  ) {}

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateTicketDto) {
    const t = await this.tickets.save(
      this.tickets.create({
        userId: me.id, orderId: dto.orderId ?? null, subject: dto.subject,
        messages: [{ authorId: me.id, authorRole: me.role, text: dto.message, at: new Date().toISOString() }],
      }),
    );
    this.realtime.toAdmins('ticket.new', { ticketId: t.id, subject: t.subject });
    return t;
  }

  @Get('mine')
  mine(@CurrentUser() me: AuthUser) {
    return this.tickets.find({ where: { userId: me.id }, order: { createdAt: 'DESC' } });
  }

  @Post(':id/messages')
  async message(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: TicketMessageDto) {
    const t = await this.tickets.findOneBy({ id });
    if (!t) throw new NotFoundException('Réclamation introuvable');
    if (t.userId !== me.id && me.role !== Role.ADMIN) throw new ForbiddenException();
    t.messages = [...t.messages, { authorId: me.id, authorRole: me.role, text: dto.text, at: new Date().toISOString() }];
    if (me.role === Role.ADMIN && t.status === TicketStatus.OPEN) t.status = TicketStatus.IN_PROGRESS;
    const saved = await this.tickets.save(t);
    if (me.role === Role.ADMIN) this.realtime.toUser(t.userId, 'ticket.updated', { ticketId: t.id });
    else this.realtime.toAdmins('ticket.updated', { ticketId: t.id });
    return saved;
  }
}
