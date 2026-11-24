import { Controller, ForbiddenException, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, Shop, User } from '../../database/entities';
import { AuthUser, CurrentUser } from '../../common/auth/auth.decorators';

/**
 * Appel masqué : renvoie un numéro relais + un code de session pour joindre l'autre partie
 * sans exposer les numéros. Au MVP c'est un bouchon : le numéro relais et la mise en relation
 * réelle seront fournis par l'opérateur de téléphonie choisi (numéro virtuel / SVI).
 */
@ApiTags('Appels masqués')
@ApiBearerAuth()
@Controller('orders/:id/call')
export class CallsController {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  @Post(':target')
  async call(@CurrentUser() me: AuthUser, @Param('id') id: string, @Param('target') target: 'client' | 'courier' | 'shop') {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException('Commande introuvable');
    const shop = await this.shops.findOneByOrFail({ id: order.shopId });
    const parties = [order.clientId, order.courierId, shop.ownerId].filter(Boolean);
    if (!parties.includes(me.id) && me.role !== 'ADMIN') throw new ForbiddenException();
    const targetId = target === 'client' ? order.clientId : target === 'courier' ? order.courierId : shop.ownerId;
    if (!targetId) throw new NotFoundException('Aucun interlocuteur pour cet appel');
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    return {
      relayNumber: process.env.CALL_RELAY_NUMBER ?? '+2252720000000',
      sessionPin: pin,
      instructions: `Appelle le numéro relais puis tape le code ${pin} pour joindre ton interlocuteur.`,
    };
  }
}
