import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { Shop, User } from '../../database/entities';
import { Role } from '../../common/enums';

/**
 * Temps réel (Socket.IO). Le client se connecte avec { auth: { token } } et rejoint
 * automatiquement ses salons : user:<id>, shop:<id> (commerçant), admins (admin).
 * Événements émis : order.updated, order.new, offer.new, offer.cancelled, courier.position.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');
  @WebSocketServer() server: Server;

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = (socket.handshake.auth?.token as string) ?? '';
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.users.findOneByOrFail({ id: sub });
      socket.join(`user:${user.id}`);
      if (user.role === Role.ADMIN) socket.join('admins');
      if (user.role === Role.MERCHANT) {
        const shops = await this.shops.find({ where: { ownerId: user.id }, select: ['id'] });
        shops.forEach((s) => socket.join(`shop:${s.id}`));
      }
    } catch {
      socket.emit('error', 'Authentification requise');
      socket.disconnect(true);
    }
  }

  toUser(userId: string, event: string, data: unknown) {
    this.server?.to(`user:${userId}`).emit(event, data);
  }
  toShop(shopId: string, event: string, data: unknown) {
    this.server?.to(`shop:${shopId}`).emit(event, data);
  }
  toAdmins(event: string, data: unknown) {
    this.server?.to('admins').emit(event, data);
  }
}
