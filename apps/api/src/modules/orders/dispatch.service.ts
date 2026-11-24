import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository } from 'typeorm';
import { CourierProfile, DeliveryOffer, Order, Shop } from '../../database/entities';
import { AccountStatus, DeliveryMode, DispatchStatus, OfferStatus, OrderStatus, Role } from '../../common/enums';
import { fromPoint } from '../../common/geo';
import { RealtimeGateway } from '../notifications/realtime.gateway';
import { SettingsService } from '../settings/settings.service';

/** Statuts pendant lesquels une commande occupe son livreur. */
export const COURIER_BUSY_STATUSES = [OrderStatus.CONFIRMED, OrderStatus.READY, OrderStatus.PICKED_UP];
/** Un livreur sans position récente est considéré hors ligne. */
const POSITION_MAX_AGE_MS = 3 * 60 * 1000;

/**
 * Affectation des livreurs (MVP) : la course est proposée au livreur disponible le plus proche
 * du commerce ; sans réponse en 30 secondes (ou s'il refuse), elle passe au suivant.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger('Dispatch');

  constructor(
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeGateway,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(DeliveryOffer) private readonly offers: Repository<DeliveryOffer>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
  ) {}

  async start(order: Order) {
    if (order.deliveryMode !== DeliveryMode.PLATFORM || order.courierId) return;
    await this.orders.update({ id: order.id }, { dispatchStatus: DispatchStatus.SEARCHING });
    await this.offerNext(order.id);
  }

  /** Cherche le prochain livreur et lui propose la course. Renvoie l'offre créée ou null. */
  async offerNext(orderId: string): Promise<DeliveryOffer | null> {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    if (order.dispatchStatus !== DispatchStatus.SEARCHING && order.dispatchStatus !== DispatchStatus.NO_COURIER) return null;
    if (!COURIER_BUSY_STATUSES.includes(order.status) || order.courierId) return null;
    const pending = await this.offers.findOneBy({ orderId, status: OfferStatus.OFFERED });
    if (pending) return pending;

    const shop = await this.shops.findOneByOrFail({ id: order.shopId });
    const [radius, ceiling, timeout, share] = await Promise.all([
      this.settings.get('dispatchRadiusMeters'),
      this.settings.get('courierCashCeiling'),
      this.settings.get('offerTimeoutSeconds'),
      this.settings.get('courierSharePercent'),
    ]);
    const shopPos = fromPoint(shop.location)!;

    const candidate = await this.couriers
      .createQueryBuilder('c')
      .innerJoin('c.user', 'u')
      .select('c.userId', 'userId')
      .addSelect(`ST_Distance(c.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`, 'distance')
      .where('c.online = true AND c.location IS NOT NULL')
      .andWhere('u.status = :active AND u.role = :role', { active: AccountStatus.ACTIVE, role: Role.COURIER })
      .andWhere('c.lastSeenAt > :fresh', { fresh: new Date(Date.now() - POSITION_MAX_AGE_MS) })
      .andWhere('c.cashHeld < :ceiling', { ceiling })
      .andWhere(`ST_DWithin(c.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :radius)`, { radius })
      // pas déjà occupé par une autre commande
      .andWhere(`NOT EXISTS (SELECT 1 FROM orders o WHERE o."courierId" = c."userId" AND o.status IN (:...busy))`, {
        busy: COURIER_BUSY_STATUSES,
      })
      // pas d'offre en cours ailleurs
      .andWhere(`NOT EXISTS (SELECT 1 FROM delivery_offers f WHERE f."courierId" = c."userId" AND f.status = 'OFFERED')`)
      // pas déjà sollicité pour cette commande dans les 5 dernières minutes
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM delivery_offers f WHERE f."courierId" = c."userId" AND f."orderId" = :orderId AND f."createdAt" > :recent)`,
        { orderId, recent: new Date(Date.now() - 5 * 60 * 1000) },
      )
      .setParameters({ lat: shopPos.lat, lng: shopPos.lng })
      .orderBy('distance', 'ASC')
      .limit(1)
      .getRawOne<{ userId: string; distance: string }>();

    if (!candidate) {
      if (order.dispatchStatus !== DispatchStatus.NO_COURIER) {
        await this.orders.update({ id: orderId }, { dispatchStatus: DispatchStatus.NO_COURIER });
        const payload = { orderId, reference: order.reference, dispatchStatus: DispatchStatus.NO_COURIER };
        this.realtime.toShop(order.shopId, 'order.updated', payload);
        this.realtime.toUser(order.clientId, 'order.updated', payload);
        this.realtime.toAdmins('order.no_courier', payload);
      }
      return null;
    }

    if (order.dispatchStatus === DispatchStatus.NO_COURIER) {
      await this.orders.update({ id: orderId }, { dispatchStatus: DispatchStatus.SEARCHING });
    }
    const offer = await this.offers.save(
      this.offers.create({
        orderId,
        courierId: candidate.userId,
        distanceMeters: Math.round(Number(candidate.distance)) + (order.distanceMeters ?? 0),
        estimatedEarning: Math.round((order.deliveryFee * share) / 100),
        expiresAt: new Date(Date.now() + timeout * 1000),
      }),
    );
    this.realtime.toUser(candidate.userId, 'offer.new', await this.describeOffer(offer));
    return offer;
  }

  async describeOffer(offer: DeliveryOffer) {
    const order = await this.orders.findOneByOrFail({ id: offer.orderId });
    const shop = await this.shops.findOneByOrFail({ id: order.shopId });
    return {
      offerId: offer.id,
      orderId: order.id,
      reference: order.reference,
      expiresAt: offer.expiresAt,
      distanceMeters: offer.distanceMeters,
      estimatedEarning: offer.estimatedEarning,
      shop: { name: shop.name, location: fromPoint(shop.location), landmark: shop.landmarkText },
      dropoff: { location: fromPoint(order.deliveryLocation), landmark: order.deliveryLandmark },
      cashToCollect: order.paymentStatus === 'PAID' ? 0 : order.total,
    };
  }

  async pendingOffersFor(courierId: string) {
    const rows = await this.offers.find({ where: { courierId, status: OfferStatus.OFFERED } });
    return Promise.all(rows.filter((o) => o.expiresAt > new Date()).map((o) => this.describeOffer(o)));
  }

  async accept(courierId: string, offerId: string) {
    const offer = await this.offers.findOneBy({ id: offerId, courierId });
    if (!offer) throw new NotFoundException('Proposition introuvable');
    if (offer.status !== OfferStatus.OFFERED || offer.expiresAt < new Date()) {
      throw new BadRequestException('Cette course n’est plus disponible');
    }
    // Mise à jour conditionnelle : un seul livreur peut prendre la course.
    const res = await this.orders
      .createQueryBuilder()
      .update(Order)
      .set({ courierId, dispatchStatus: DispatchStatus.ASSIGNED })
      .where('id = :id AND "courierId" IS NULL AND "dispatchStatus" = :s', { id: offer.orderId, s: DispatchStatus.SEARCHING })
      .execute();
    if (!res.affected) {
      await this.offers.update({ id: offerId }, { status: OfferStatus.EXPIRED });
      throw new BadRequestException('Cette course a déjà été prise');
    }
    await this.offers.update({ id: offerId }, { status: OfferStatus.ACCEPTED });
    return this.orders.findOneByOrFail({ id: offer.orderId });
  }

  async decline(courierId: string, offerId: string) {
    const offer = await this.offers.findOneBy({ id: offerId, courierId, status: OfferStatus.OFFERED });
    if (!offer) throw new NotFoundException('Proposition introuvable');
    await this.offers.update({ id: offerId }, { status: OfferStatus.DECLINED });
    await this.offerNext(offer.orderId);
    return { ok: true };
  }

  /** Annule la recherche (commande annulée, passage en livraison par le commerçant ou en retrait). */
  async stop(orderId: string) {
    const open = await this.offers.find({ where: { orderId, status: OfferStatus.OFFERED } });
    if (open.length) {
      await this.offers.update({ id: In(open.map((o) => o.id)) }, { status: OfferStatus.EXPIRED });
      open.forEach((o) => this.realtime.toUser(o.courierId, 'offer.cancelled', { offerId: o.id }));
    }
  }

  /** Réaffectation manuelle par l'admin. */
  async forceAssign(orderId: string, courierId: string) {
    const order = await this.orders.findOneByOrFail({ id: orderId });
    if (!COURIER_BUSY_STATUSES.includes(order.status)) throw new BadRequestException('Commande non réaffectable');
    const courier = await this.couriers.findOne({ where: { userId: courierId }, relations: { user: true } });
    if (!courier || courier.user.status !== AccountStatus.ACTIVE) throw new ForbiddenException('Livreur non valide');
    await this.stop(orderId);
    const previous = order.courierId;
    await this.orders.update(
      { id: orderId },
      { courierId, deliveryMode: DeliveryMode.PLATFORM, dispatchStatus: DispatchStatus.ASSIGNED },
    );
    if (previous && previous !== courierId) this.realtime.toUser(previous, 'order.unassigned', { orderId });
    this.realtime.toUser(courierId, 'order.assigned', { orderId });
    return this.orders.findOneByOrFail({ id: orderId });
  }

  /**
   * Tâche périodique : expire les offres sans réponse, passe au livreur suivant,
   * et relance la recherche pour les commandes restées sans livreur.
   */
  async tick() {
    const expired = await this.offers.find({ where: { status: OfferStatus.OFFERED, expiresAt: LessThan(new Date()) } });
    for (const offer of expired) {
      await this.offers.update({ id: offer.id }, { status: OfferStatus.EXPIRED });
      this.realtime.toUser(offer.courierId, 'offer.cancelled', { offerId: offer.id, reason: 'expired' });
      await this.offerNext(offer.orderId);
    }
    const waiting = await this.orders.find({
      where: { dispatchStatus: In([DispatchStatus.NO_COURIER, DispatchStatus.SEARCHING]), status: In(COURIER_BUSY_STATUSES) },
      select: ['id'],
    });
    for (const o of waiting) await this.offerNext(o.id);
  }
}
