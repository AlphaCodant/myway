import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomInt } from 'crypto';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import {
  Address, CourierProfile, Neighborhood, Order, OrderEvent, OrderItem, Product, Rating, Shop, User,
} from '../../database/entities';
import {
  AccountStatus, DeliveryMode, DispatchStatus, ItemStatus, LedgerAccount, LedgerKind, OrderStatus, PaymentMethod, PaymentStatus,
  RatingTarget, Role,
} from '../../common/enums';
import { fromPoint, haversineMeters, toPoint } from '../../common/geo';
import { AuthUser } from '../../common/auth/auth.decorators';
import { RealtimeGateway } from '../notifications/realtime.gateway';
import { SmsService } from '../notifications/sms.service';
import { PaymentsService } from '../payments/payments.service';
import { SettingsService } from '../settings/settings.service';
import { DispatchService } from './dispatch.service';
import { LedgerService } from './ledger.service';
import { CreateOrderDto, OrderItemInput, ProposeSubstitutionsDto, QuoteDto, RateDto } from './orders.dto';

const REF_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ACTIVE_STATUSES = [
  OrderStatus.AWAITING_PAYMENT, OrderStatus.PENDING, OrderStatus.AWAITING_CLIENT, OrderStatus.CONFIRMED, OrderStatus.READY,
  OrderStatus.PICKED_UP,
];
const fcfa = (n: number) => `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger('Orders');

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly settings: SettingsService,
    private readonly dispatch: DispatchService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly realtime: RealtimeGateway,
    private readonly sms: SmsService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
    @InjectRepository(OrderEvent) private readonly events: Repository<OrderEvent>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Address) private readonly addresses: Repository<Address>,
    @InjectRepository(Neighborhood) private readonly neighborhoods: Repository<Neighborhood>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    @InjectRepository(Rating) private readonly ratings: Repository<Rating>,
  ) {}

  // ───────────────────────────── Devis et création ─────────────────────────────

  private async price(userId: string, dto: QuoteDto) {
    const shop = await this.shops.findOneBy({ id: dto.shopId });
    if (!shop || shop.status !== AccountStatus.ACTIVE) throw new NotFoundException('Commerce introuvable');
    if (!shop.isOpen) throw new BadRequestException('Ce commerce est fermé pour le moment');
    if (dto.deliveryMode === DeliveryMode.MERCHANT && !shop.selfDelivery) {
      throw new BadRequestException('Ce commerce ne livre pas lui-même');
    }
    const lines = await this.resolveItems(shop.id, dto.items);
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

    let address: Address | null = null;
    let distanceMeters: number | null = null;
    let deliveryFee = 0;
    if (dto.deliveryMode !== DeliveryMode.PICKUP) {
      if (!dto.addressId) throw new BadRequestException('Choisis une adresse de livraison');
      address = await this.addresses.findOneBy({ id: dto.addressId, userId });
      if (!address) throw new NotFoundException('Adresse introuvable');
      distanceMeters = Math.round(haversineMeters(fromPoint(shop.location)!, fromPoint(address.location)!));
      const nb = await this.neighborhoods.findOneByOrFail({ id: shop.neighborhoodId });
      const fee = await this.settings.deliveryFee(nb.cityId, distanceMeters);
      if (fee == null) throw new BadRequestException('Adresse hors de la zone de livraison de ce commerce');
      deliveryFee = fee;
    }
    return { shop, lines, subtotal, address, distanceMeters, deliveryFee, total: subtotal + deliveryFee };
  }

  private async resolveItems(shopId: string, inputs: OrderItemInput[]) {
    const ids = [...new Set(inputs.map((i) => i.productId))];
    const products = await this.products.findBy({ id: In(ids), shopId, archived: false });
    const byId = new Map(products.map((p) => [p.id, p]));
    return inputs.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new BadRequestException('Un produit du panier n’existe plus');
      if (!p.available) throw new BadRequestException(`« ${p.name} » est en rupture de stock`);
      return { productId: p.id, name: p.name, unitPrice: p.price, quantity: i.quantity };
    });
  }

  async quote(userId: string, dto: QuoteDto) {
    const q = await this.price(userId, dto);
    return { items: q.lines, subtotal: q.subtotal, deliveryFee: q.deliveryFee, total: q.total, distanceMeters: q.distanceMeters };
  }

  async create(client: AuthUser, dto: CreateOrderDto) {
    if (dto.clientRequestId) {
      const dup = await this.events.findOneBy({ type: 'CREATED', note: `req:${dto.clientRequestId}`, actorId: client.id });
      if (dup) return this.getForUser(client, dup.orderId);
    }
    const q = await this.price(client.id, dto);
    const isCash = dto.paymentMethod === PaymentMethod.CASH;
    const order = await this.orders.save(
      this.orders.create({
        reference: await this.newReference(),
        clientId: client.id,
        shopId: q.shop.id,
        status: isCash ? OrderStatus.PENDING : OrderStatus.AWAITING_PAYMENT,
        deliveryMode: dto.deliveryMode,
        paymentMethod: dto.paymentMethod,
        subtotal: q.subtotal,
        deliveryFee: q.deliveryFee,
        total: q.total,
        addressId: q.address?.id ?? null,
        neighborhoodId: q.address?.neighborhoodId ?? q.shop.neighborhoodId,
        deliveryLocation: q.address?.location ?? null,
        deliveryLandmark: q.address?.landmarkText ?? null,
        deliveryVoiceNoteUrl: q.address?.voiceNoteUrl ?? null,
        deliveryPhotoUrl: q.address?.photoUrl ?? null,
        distanceMeters: q.distanceMeters,
        note: dto.note ?? null,
        deliveryCode: String(randomInt(0, 10000)).padStart(4, '0'),
        items: q.lines.map((l) => this.items.create(l)),
      }),
    );
    await this.log(order.id, 'CREATED', client.id, dto.clientRequestId ? `req:${dto.clientRequestId}` : null);

    let payment = null;
    if (isCash) {
      await this.notifyNewOrder(order);
    } else {
      payment = await this.payments.initiate(order, client.phone);
    }
    const full = await this.getForUser(client, order.id);
    return { ...full, payment: payment && { id: payment.id, checkoutUrl: payment.checkoutUrl, providerRef: payment.providerRef } };
  }

  private async newReference() {
    for (;;) {
      let s = '';
      for (let i = 0; i < 5; i++) s += REF_ALPHABET[randomInt(0, REF_ALPHABET.length)];
      const ref = `GAG-${s}`;
      if (!(await this.orders.existsBy({ reference: ref }))) return ref;
    }
  }

  private async notifyNewOrder(order: Order) {
    const shop = await this.shops.findOneByOrFail({ id: order.shopId });
    this.realtime.toShop(order.shopId, 'order.new', { orderId: order.id, reference: order.reference, total: order.total });
    const owner = await this.users.findOneByOrFail({ id: shop.ownerId });
    await this.sms.send(owner.phone, `Nouvelle commande ${order.reference} (${fcfa(order.subtotal)}). Ouvre l'application pour la confirmer.`);
  }

  // ───────────────────────────── Lecture ─────────────────────────────

  private async load(id: string, withCode = false) {
    const qb = this.orders.createQueryBuilder('o').leftJoinAndSelect('o.items', 'i').where('o.id = :id', { id });
    if (withCode) qb.addSelect('o.deliveryCode');
    const order = await qb.getOne();
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }

  private async role(user: AuthUser, order: Order): Promise<'client' | 'merchant' | 'courier' | 'admin'> {
    if (user.role === Role.ADMIN) return 'admin';
    if (order.clientId === user.id) return 'client';
    if (order.courierId === user.id) return 'courier';
    const shop = await this.shops.findOneBy({ id: order.shopId, ownerId: user.id });
    if (shop) return 'merchant';
    throw new ForbiddenException('Cette commande ne te concerne pas');
  }

  async serialize(order: Order, viewer: 'client' | 'merchant' | 'courier' | 'admin') {
    const shop = await this.shops.findOneBy({ id: order.shopId });
    const courier = order.courierId ? await this.users.findOneBy({ id: order.courierId }) : null;
    const courierProfile = order.courierId ? await this.couriers.findOneBy({ userId: order.courierId }) : null;
    const events = await this.events.find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } });
    const { deliveryCode, deliveryLocation, ...rest } = order;
    return {
      ...rest,
      deliveryLocation: fromPoint(deliveryLocation),
      // Seul le client voit le code de remise (et l'admin pour le support).
      ...(viewer === 'client' || viewer === 'admin' ? { deliveryCode } : {}),
      shop: shop && { id: shop.id, name: shop.name, location: fromPoint(shop.location), landmarkText: shop.landmarkText, photoUrl: shop.photoUrl },
      courier: courier && {
        id: courier.id,
        name: courier.name,
        vehicle: courierProfile?.vehicle,
        // La position n'est montrée que pendant la course.
        location: order.status === OrderStatus.PICKED_UP || viewer === 'admin' ? fromPoint(courierProfile?.location) : null,
      },
      timeline: events.map((e) => ({ type: e.type, at: e.createdAt })),
    };
  }

  async getForUser(user: AuthUser, id: string) {
    const order = await this.load(id, true);
    return this.serialize(order, await this.role(user, order));
  }

  async listForClient(clientId: string, limit = 30) {
    const rows = await this.orders.find({ where: { clientId }, relations: { items: true }, order: { createdAt: 'DESC' }, take: limit });
    return Promise.all(rows.map((o) => this.serialize(o, 'merchant')));
  }

  async listForShop(shopId: string, status?: OrderStatus, limit = 50) {
    const where = status ? { shopId, status } : { shopId, status: In(ACTIVE_STATUSES.filter((s) => s !== OrderStatus.AWAITING_PAYMENT)) };
    const rows = await this.orders.find({ where, relations: { items: true }, order: { createdAt: 'DESC' }, take: limit });
    return Promise.all(rows.map((o) => this.serialize(o, 'merchant')));
  }

  async listForCourier(courierId: string, activeOnly: boolean) {
    const where = activeOnly ? { courierId, status: In(ACTIVE_STATUSES) } : { courierId };
    const rows = await this.orders.find({ where, relations: { items: true }, order: { createdAt: 'DESC' }, take: 50 });
    return Promise.all(rows.map((o) => this.serialize(o, 'courier')));
  }

  // ───────────────────────────── Paiement ─────────────────────────────

  async onPaymentResult(orderId: string, status: PaymentStatus) {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    if (order.status !== OrderStatus.AWAITING_PAYMENT) return;
    if (status === PaymentStatus.PAID) {
      await this.orders.update({ id: orderId }, { status: OrderStatus.PENDING, paymentStatus: PaymentStatus.PAID });
      await this.log(orderId, 'PAID', null);
      await this.notifyNewOrder(order);
    } else if (status === PaymentStatus.FAILED) {
      await this.orders.update(
        { id: orderId },
        { status: OrderStatus.CANCELLED, paymentStatus: PaymentStatus.FAILED, cancelledAt: new Date(), cancelReason: 'Paiement échoué' },
      );
      await this.log(orderId, 'PAYMENT_FAILED', null);
    }
    await this.broadcast(orderId);
  }

  // ───────────────────────────── Commerçant ─────────────────────────────

  private async asMerchant(user: AuthUser, id: string) {
    const order = await this.load(id);
    const r = await this.role(user, order);
    if (r !== 'merchant' && r !== 'admin') throw new ForbiddenException('Réservé au commerçant');
    return order;
  }

  async accept(user: AuthUser, id: string) {
    const order = await this.asMerchant(user, id);
    this.expect(order, [OrderStatus.PENDING]);
    await this.confirm(order, user.id);
    return this.getForUser(user, id);
  }

  private async confirm(order: Order, actorId: string) {
    await this.orders.update({ id: order.id }, { status: OrderStatus.CONFIRMED, confirmedAt: new Date() });
    await this.log(order.id, 'CONFIRMED', actorId);
    const client = await this.users.findOneByOrFail({ id: order.clientId });
    await this.sms.send(client.phone, `Ta commande ${order.reference} est confirmée et en préparation.`);
    order.status = OrderStatus.CONFIRMED;
    if (order.deliveryMode === DeliveryMode.PLATFORM) await this.dispatch.start(order);
    await this.broadcast(order.id);
  }

  async reject(user: AuthUser, id: string, reason?: string) {
    const order = await this.asMerchant(user, id);
    this.expect(order, [OrderStatus.PENDING, OrderStatus.AWAITING_CLIENT]);
    await this.cancelInternal(order, user.id, reason ?? 'Refusée par le commerçant', 0);
    return this.getForUser(user, id);
  }

  async proposeSubstitutions(user: AuthUser, id: string, dto: ProposeSubstitutionsDto) {
    const order = await this.asMerchant(user, id);
    this.expect(order, [OrderStatus.PENDING]);
    for (const s of dto.substitutions) {
      const item = order.items.find((i) => i.id === s.itemId);
      if (!item) throw new BadRequestException('Article introuvable dans la commande');
      if (s.substituteProductId) {
        const p = await this.products.findOneBy({ id: s.substituteProductId, shopId: order.shopId, archived: false });
        if (!p || !p.available) throw new BadRequestException('Produit de remplacement indisponible');
        Object.assign(item, { status: ItemStatus.SUBSTITUTION_PROPOSED, substituteProductId: p.id, substituteName: p.name, substituteUnitPrice: p.price });
      } else {
        Object.assign(item, { status: ItemStatus.SUBSTITUTION_PROPOSED, substituteProductId: null, substituteName: null, substituteUnitPrice: null });
      }
    }
    const newSubtotal = this.subtotalAfterSubstitution(order.items);
    // Commande déjà payée : on ne peut pas encaisser plus que le montant payé.
    if (order.paymentStatus === PaymentStatus.PAID && newSubtotal > order.subtotal) {
      throw new BadRequestException('Commande déjà payée : le remplacement ne peut pas coûter plus cher');
    }
    await this.items.save(order.items);
    await this.orders.update({ id }, { status: OrderStatus.AWAITING_CLIENT });
    await this.log(id, 'SUBSTITUTION_PROPOSED', user.id);
    const client = await this.users.findOneByOrFail({ id: order.clientId });
    await this.sms.send(client.phone, `Commande ${order.reference} : un produit manque, le commerçant te propose un remplacement. Ouvre l'application pour répondre.`);
    await this.broadcast(id);
    return this.getForUser(user, id);
  }

  private subtotalAfterSubstitution(items: OrderItem[]) {
    return items.reduce((sum, i) => {
      if (i.status === ItemStatus.SUBSTITUTION_PROPOSED || i.status === ItemStatus.SUBSTITUTED) {
        return sum + (i.substituteProductId ? (i.substituteUnitPrice ?? 0) * i.quantity : 0);
      }
      if (i.status === ItemStatus.REMOVED) return sum;
      return sum + i.unitPrice * i.quantity;
    }, 0);
  }

  async markReady(user: AuthUser, id: string) {
    const order = await this.asMerchant(user, id);
    this.expect(order, [OrderStatus.CONFIRMED]);
    await this.orders.update({ id }, { status: OrderStatus.READY, readyAt: new Date() });
    await this.log(id, 'READY', user.id);
    if (order.deliveryMode === DeliveryMode.PICKUP) {
      const client = await this.users.findOneByOrFail({ id: order.clientId });
      await this.sms.send(client.phone, `Ta commande ${order.reference} est prête. Passe la récupérer avec ton code de retrait.`);
    }
    await this.broadcast(id);
    return this.getForUser(user, id);
  }

  /** « Je livre moi-même » : le commerçant prend la livraison (par exemple si aucun livreur n'est disponible). */
  async merchantSelfDeliver(user: AuthUser, id: string) {
    const order = await this.asMerchant(user, id);
    this.expect(order, [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY]);
    if (order.deliveryMode === DeliveryMode.PICKUP) throw new BadRequestException('Le client vient retirer cette commande');
    if (order.courierId) throw new BadRequestException('Un livreur a déjà pris la course');
    await this.dispatch.stop(id);
    await this.orders.update({ id }, { deliveryMode: DeliveryMode.MERCHANT, dispatchStatus: DispatchStatus.NONE });
    await this.log(id, 'SELF_DELIVERY', user.id);
    await this.broadcast(id);
    return this.getForUser(user, id);
  }

  // ───────────────────────────── Client ─────────────────────────────

  private async asClient(user: AuthUser, id: string) {
    const order = await this.load(id, true);
    if (order.clientId !== user.id && user.role !== Role.ADMIN) throw new ForbiddenException();
    return order;
  }

  async respondSubstitutions(user: AuthUser, id: string, accept: boolean) {
    const order = await this.asClient(user, id);
    this.expect(order, [OrderStatus.AWAITING_CLIENT]);
    if (!accept) {
      await this.cancelInternal(order, user.id, 'Remplacement refusé par le client', 0);
      return this.getForUser(user, id);
    }
    for (const i of order.items) {
      if (i.status === ItemStatus.SUBSTITUTION_PROPOSED) i.status = i.substituteProductId ? ItemStatus.SUBSTITUTED : ItemStatus.REMOVED;
    }
    await this.items.save(order.items);
    const subtotal = this.subtotalAfterSubstitution(order.items);
    if (subtotal === 0) {
      await this.cancelInternal(order, user.id, 'Plus aucun article disponible', 0);
      return this.getForUser(user, id);
    }
    const refund = order.paymentStatus === PaymentStatus.PAID ? order.subtotal - subtotal : 0;
    await this.orders.update({ id }, { subtotal, total: subtotal + order.deliveryFee });
    await this.log(id, 'SUBSTITUTION_ACCEPTED', user.id);
    if (refund > 0) await this.payments.refund(id, refund);
    await this.confirm({ ...order, subtotal, total: subtotal + order.deliveryFee } as Order, user.id);
    return this.getForUser(user, id);
  }

  /** Aucun livreur disponible : le client choisit de venir retirer la commande (frais de livraison annulés). */
  async switchToPickup(user: AuthUser, id: string) {
    const order = await this.asClient(user, id);
    this.expect(order, [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY]);
    if (order.courierId) throw new BadRequestException('Un livreur a déjà pris ta commande');
    await this.dispatch.stop(id);
    const refund = order.paymentStatus === PaymentStatus.PAID ? order.deliveryFee : 0;
    await this.orders.update(
      { id },
      { deliveryMode: DeliveryMode.PICKUP, dispatchStatus: DispatchStatus.NONE, deliveryFee: 0, total: order.subtotal },
    );
    if (refund) await this.payments.refund(id, refund);
    await this.log(id, 'SWITCHED_TO_PICKUP', user.id);
    await this.broadcast(id);
    return this.getForUser(user, id);
  }

  /** Annulation par le client : gratuite avant la confirmation du commerçant, payante ensuite. */
  async cancelByClient(user: AuthUser, id: string, reason?: string) {
    const order = await this.asClient(user, id);
    const free = [OrderStatus.AWAITING_PAYMENT, OrderStatus.PENDING, OrderStatus.AWAITING_CLIENT];
    const paid = [OrderStatus.CONFIRMED, OrderStatus.READY];
    if (order.status === OrderStatus.PICKED_UP) {
      throw new BadRequestException('Le livreur est déjà en route : contacte le support pour annuler');
    }
    this.expect(order, [...free, ...paid]);
    const fee = paid.includes(order.status) ? Math.min(await this.settings.get('cancellationFeeAfterConfirm'), order.total) : 0;
    await this.cancelInternal(order, user.id, reason ?? 'Annulée par le client', fee);
    return this.getForUser(user, id);
  }

  /** Annulation par l'équipe support (frais éventuels fixés par l'admin). */
  async adminCancel(admin: AuthUser, id: string, reason: string, fee: number) {
    const order = await this.load(id);
    if ([OrderStatus.DELIVERED, OrderStatus.CANCELLED, OrderStatus.RETURNED].includes(order.status)) {
      throw new BadRequestException('Commande déjà terminée');
    }
    await this.cancelInternal(order, admin.id, reason, Math.min(fee, order.total));
    return this.getForUser(admin, id);
  }

  async cancelInternal(order: Order, actorId: string, reason: string, fee: number) {
    await this.dispatch.stop(order.id);
    await this.orders.update(
      { id: order.id },
      { status: OrderStatus.CANCELLED, cancelledAt: new Date(), cancelReason: reason, cancelledBy: actorId, cancellationFee: fee },
    );
    if (order.paymentStatus === PaymentStatus.PAID) {
      await this.payments.refund(order.id, order.total - fee);
      await this.orders.update({ id: order.id }, { paymentStatus: PaymentStatus.REFUNDED });
    }
    if (fee > 0) {
      // Les frais d'annulation dédommagent le commerçant qui a commencé la préparation.
      await this.ledger.record(LedgerAccount.SHOP, order.shopId, LedgerKind.CANCELLATION_FEE, fee, order.id, reason);
    }
    await this.log(order.id, 'CANCELLED', actorId, reason);
    const client = await this.users.findOneByOrFail({ id: order.clientId });
    await this.sms.send(client.phone, `Ta commande ${order.reference} est annulée. ${reason}.`);
    await this.broadcast(order.id);
  }

  async rate(user: AuthUser, id: string, dto: RateDto) {
    const order = await this.asClient(user, id);
    this.expect(order, [OrderStatus.DELIVERED]);
    if (dto.shopScore) {
      await this.saveRating(order, user.id, RatingTarget.SHOP, order.shopId, dto.shopScore, dto.comment);
      await this.refreshAverage(RatingTarget.SHOP, order.shopId);
    }
    if (dto.courierScore && order.courierId) {
      await this.saveRating(order, user.id, RatingTarget.COURIER, order.courierId, dto.courierScore, dto.comment);
      await this.refreshAverage(RatingTarget.COURIER, order.courierId);
    }
    return { ok: true };
  }

  private async saveRating(order: Order, raterId: string, targetType: RatingTarget, targetId: string, score: number, comment?: string) {
    const existing = await this.ratings.findOneBy({ orderId: order.id, targetType });
    if (existing) throw new BadRequestException('Tu as déjà noté cette commande');
    await this.ratings.save(this.ratings.create({ orderId: order.id, raterId, targetType, targetId, score, comment: comment ?? null }));
  }

  private async refreshAverage(targetType: RatingTarget, targetId: string) {
    const row = await this.ratings
      .createQueryBuilder('r')
      .select('AVG(r.score)', 'avg')
      .addSelect('COUNT(*)', 'count')
      .where('r.targetType = :t AND r.targetId = :id', { t: targetType, id: targetId })
      .getRawOne();
    const patch = { ratingAvg: Number(Number(row.avg).toFixed(2)), ratingCount: Number(row.count) };
    if (targetType === RatingTarget.SHOP) await this.shops.update({ id: targetId }, patch);
    else await this.couriers.update({ userId: targetId }, patch);
  }

  // ───────────────────────────── Livreur ─────────────────────────────

  /** Qui remet la commande : le livreur (plateforme), le commerçant (livraison par ses soins ou retrait). */
  private async asDeliverer(user: AuthUser, id: string) {
    const order = await this.load(id, true);
    const r = await this.role(user, order);
    const ok =
      r === 'admin' ||
      (order.deliveryMode === DeliveryMode.PLATFORM && r === 'courier') ||
      (order.deliveryMode !== DeliveryMode.PLATFORM && r === 'merchant');
    if (!ok) throw new ForbiddenException('Tu ne livres pas cette commande');
    return order;
  }

  async acceptOffer(user: AuthUser, offerId: string) {
    const order = await this.dispatch.accept(user.id, offerId);
    await this.log(order.id, 'COURIER_ASSIGNED', user.id);
    await this.broadcast(order.id);
    return this.getForUser(user, order.id);
  }

  /** Affectation (ou réaffectation) forcée par l'admin, tracée dans l'historique de la commande. */
  async adminAssign(admin: AuthUser, id: string, courierId: string) {
    await this.dispatch.forceAssign(id, courierId);
    await this.log(id, 'COURIER_FORCED', admin.id, courierId);
    await this.broadcast(id);
    return this.getForUser(admin, id);
  }

  async pickUp(user: AuthUser, id: string) {
    const order = await this.asDeliverer(user, id);
    if (order.deliveryMode === DeliveryMode.PICKUP) throw new BadRequestException('Commande à retirer au commerce');
    this.expect(order, [OrderStatus.CONFIRMED, OrderStatus.READY]);
    await this.orders.update({ id }, { status: OrderStatus.PICKED_UP, pickedUpAt: new Date() });
    await this.log(id, 'PICKED_UP', user.id);
    const client = await this.users.findOneByOrFail({ id: order.clientId });
    const cash = order.paymentStatus === PaymentStatus.PAID ? '' : ` Prépare ${fcfa(order.total)}.`;
    await this.sms.send(
      client.phone,
      `Ta commande ${order.reference} est en route.${cash} Donne le code ${order.deliveryCode} au livreur à la remise.`,
    );
    await this.broadcast(id);
    return this.getForUser(user, id);
  }

  async callAttempt(user: AuthUser, id: string) {
    const order = await this.asDeliverer(user, id);
    this.expect(order, [OrderStatus.PICKED_UP]);
    await this.orders.update(
      { id },
      { clientCallAttempts: order.clientCallAttempts + 1, firstCallAttemptAt: order.firstCallAttemptAt ?? new Date() },
    );
    await this.log(id, 'CLIENT_CALL_ATTEMPT', user.id);
    return this.getForUser(user, id);
  }

  /** Remise au client contre le code à 4 chiffres ; calcule les montants dus à chacun. */
  async deliver(user: AuthUser, id: string, code: string) {
    const order = await this.asDeliverer(user, id);
    const allowed = order.deliveryMode === DeliveryMode.PICKUP ? [OrderStatus.CONFIRMED, OrderStatus.READY] : [OrderStatus.PICKED_UP];
    this.expect(order, allowed);
    if (code !== order.deliveryCode) throw new BadRequestException('Code de remise incorrect');

    const shop = await this.shops.findOneByOrFail({ id: order.shopId });
    const rate = await this.settings.commissionPercent(shop);
    const commission = Math.round((order.subtotal * rate) / 100);
    const share = await this.settings.get('courierSharePercent');
    const courierEarning = order.deliveryMode === DeliveryMode.PLATFORM ? Math.round((order.deliveryFee * share) / 100) : 0;
    const cash = order.paymentStatus !== PaymentStatus.PAID;

    await this.db.transaction(async (m) => {
      await m.update(Order, { id }, {
        status: OrderStatus.DELIVERED, deliveredAt: new Date(), commission, courierEarning, paymentStatus: PaymentStatus.PAID,
      });
      await this.ledger.record(LedgerAccount.SHOP, shop.id, LedgerKind.SALE, order.subtotal, id, null, m);
      await this.ledger.record(LedgerAccount.SHOP, shop.id, LedgerKind.COMMISSION, -commission, id, `${rate} %`, m);
      if (order.deliveryMode === DeliveryMode.MERCHANT) {
        await this.ledger.record(LedgerAccount.SHOP, shop.id, LedgerKind.DELIVERY_FEE, order.deliveryFee, id, null, m);
      }
      if (order.deliveryMode === DeliveryMode.PLATFORM && order.courierId) {
        await this.ledger.record(LedgerAccount.COURIER, order.courierId, LedgerKind.DELIVERY_EARNING, courierEarning, id, null, m);
        if (cash) await m.increment(CourierProfile, { userId: order.courierId }, 'cashHeld', order.total);
      } else if (cash) {
        // Le commerçant a encaissé lui-même : la somme est déjà dans sa caisse.
        await this.ledger.record(LedgerAccount.SHOP, shop.id, LedgerKind.CASH_COLLECTED, -order.total, id, null, m);
      }
    });
    await this.log(id, 'DELIVERED', user.id);
    const client = await this.users.findOneByOrFail({ id: order.clientId });
    await this.sms.send(client.phone, `Commande ${order.reference} livrée. Merci ! Note ton commerçant et ton livreur dans l'application.`);
    await this.broadcast(id);
    return this.getForUser(user, id);
  }

  /** Client injoignable : après 3 appels et 10 minutes d'attente, le colis retourne au commerce. */
  async returnToShop(user: AuthUser, id: string) {
    const order = await this.asDeliverer(user, id);
    this.expect(order, [OrderStatus.PICKED_UP]);
    const [attempts, waitMin] = await Promise.all([
      this.settings.get('unreachableCallAttempts'), this.settings.get('unreachableWaitMinutes'),
    ]);
    const waited = order.firstCallAttemptAt ? (Date.now() - order.firstCallAttemptAt.getTime()) / 60000 : 0;
    if (user.role !== Role.ADMIN && (order.clientCallAttempts < attempts || waited < waitMin)) {
      throw new BadRequestException(`Appelle le client ${attempts} fois et attends ${waitMin} minutes avant de retourner le colis`);
    }
    const share = await this.settings.get('courierSharePercent');
    const courierEarning = order.deliveryMode === DeliveryMode.PLATFORM ? Math.round((order.deliveryFee * share) / 100) : 0;
    await this.orders.update({ id }, { status: OrderStatus.RETURNED, cancellationFee: order.deliveryFee, courierEarning, cancelledAt: new Date() });
    if (courierEarning && order.courierId) {
      await this.ledger.record(LedgerAccount.COURIER, order.courierId, LedgerKind.DELIVERY_EARNING, courierEarning, id, 'Course retour');
    }
    if (order.paymentStatus === PaymentStatus.PAID) await this.payments.refund(id, order.total - order.deliveryFee);
    await this.log(id, 'RETURNED', user.id, 'Client injoignable');
    await this.broadcast(id);
    return this.getForUser(user, id);
  }

  /** Après une livraison réussie, le livreur peut corriger le point GPS de l'adresse. */
  async correctLocation(user: AuthUser, id: string, lat: number, lng: number) {
    const order = await this.asDeliverer(user, id);
    this.expect(order, [OrderStatus.DELIVERED]);
    if (order.addressId) await this.addresses.update({ id: order.addressId }, { location: toPoint({ lat, lng }), gpsCorrected: true });
    await this.log(id, 'GPS_CORRECTED', user.id);
    return { ok: true };
  }

  // ───────────────────────────── Tâches périodiques ─────────────────────────────

  /** Rappel automatique au commerçant si la commande n'est pas acceptée à temps. */
  async remindMerchants() {
    const minutes = await this.settings.get('merchantReminderMinutes');
    const late = await this.orders.find({
      where: { status: OrderStatus.PENDING, merchantReminderSentAt: IsNull(), updatedAt: LessThan(new Date(Date.now() - minutes * 60000)) },
    });
    for (const o of late) {
      const shop = await this.shops.findOneByOrFail({ id: o.shopId });
      const owner = await this.users.findOneByOrFail({ id: shop.ownerId });
      await this.sms.send(owner.phone, `Rappel : la commande ${o.reference} attend ta confirmation depuis ${minutes} minutes.`);
      this.realtime.toShop(o.shopId, 'order.reminder', { orderId: o.id, reference: o.reference });
      this.realtime.toAdmins('order.late', { orderId: o.id, reference: o.reference });
      await this.orders.update({ id: o.id }, { merchantReminderSentAt: new Date() });
    }
  }

  // ───────────────────────────── Utilitaires ─────────────────────────────

  private expect(order: Order, statuses: OrderStatus[]) {
    if (!statuses.includes(order.status)) {
      throw new BadRequestException(`Action impossible : la commande est au statut ${order.status}`);
    }
  }

  private async log(orderId: string, type: string, actorId: string | null, note: string | null = null) {
    await this.events.save(this.events.create({ orderId, type, actorId, note }));
  }

  /** Prévient en temps réel toutes les parties de la commande. */
  async broadcast(orderId: string) {
    const o = await this.orders.findOneByOrFail({ id: orderId });
    const payload = {
      orderId, reference: o.reference, status: o.status, dispatchStatus: o.dispatchStatus, deliveryMode: o.deliveryMode, courierId: o.courierId,
    };
    this.realtime.toUser(o.clientId, 'order.updated', payload);
    this.realtime.toShop(o.shopId, 'order.updated', payload);
    if (o.courierId) this.realtime.toUser(o.courierId, 'order.updated', payload);
    this.realtime.toAdmins('order.updated', payload);
  }
}
