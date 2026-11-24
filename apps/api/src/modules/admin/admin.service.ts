import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, LessThan, Repository } from 'typeorm';
import {
  CashRemittance, CategoryCommission, City, CourierProfile, DeliveryTariff, Neighborhood, Order, PayoutRequest, Shop, Ticket, User,
} from '../../database/entities';
import {
  AccountStatus, LedgerAccount, LedgerKind, OrderStatus, PayoutStatus, Role, TicketStatus,
} from '../../common/enums';
import { fromPoint, toPoint } from '../../common/geo';
import { normalizeCiPhone } from '../../common/phone';
import { SmsService } from '../notifications/sms.service';
import { LedgerService } from '../orders/ledger.service';
import { PaymentsService } from '../payments/payments.service';
import { SettingKey, SettingsService, DEFAULT_SETTINGS } from '../settings/settings.service';
import { serializeShop } from '../shops/shops.service';
import {
  CityDto, CommissionsDto, CreateStaffDto, NeighborhoodDto, OrdersQuery, RemittanceDto, ShopAdminPatchDto, TariffsDto, UsersQuery,
} from './admin.dto';

/** Délais au-delà desquels une commande est signalée « en retard » (minutes). */
const LATE_RULES: Partial<Record<OrderStatus, number>> = {
  [OrderStatus.PENDING]: 5,
  [OrderStatus.CONFIRMED]: 30,
  [OrderStatus.READY]: 15,
  [OrderStatus.PICKED_UP]: 30,
};

@Injectable()
export class AdminService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    private readonly sms: SmsService,
    private readonly payments: PaymentsService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(City) private readonly cities: Repository<City>,
    @InjectRepository(Neighborhood) private readonly neighborhoods: Repository<Neighborhood>,
    @InjectRepository(DeliveryTariff) private readonly tariffs: Repository<DeliveryTariff>,
    @InjectRepository(CategoryCommission) private readonly commissions: Repository<CategoryCommission>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(CashRemittance) private readonly remittances: Repository<CashRemittance>,
    @InjectRepository(PayoutRequest) private readonly payouts: Repository<PayoutRequest>,
  ) {}

  // ── Comptes ──
  listUsers(q: UsersQuery) {
    const where: any = {};
    if (q.role) where.role = q.role;
    if (q.status) where.status = q.status;
    if (q.q) return this.users.find({ where: [{ ...where, phone: ILike(`%${q.q}%`) }, { ...where, name: ILike(`%${q.q}%`) }], take: 200 });
    return this.users.find({ where, order: { createdAt: 'DESC' }, take: 200 });
  }

  async setUserStatus(id: string, status: AccountStatus, reason?: string) {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('Compte introuvable');
    await this.users.update({ id }, { status });
    if (status === AccountStatus.SUSPENDED && user.role === Role.COURIER) {
      await this.couriers.update({ userId: id }, { online: false });
    }
    if (status === AccountStatus.SUSPENDED && user.role === Role.MERCHANT) {
      await this.shops.update({ ownerId: id }, { isOpen: false });
    }
    if (status === AccountStatus.ACTIVE && user.status === AccountStatus.PENDING) {
      await this.sms.send(user.phone, 'Ton compte est validé. Bienvenue sur la plateforme !');
    }
    if (status === AccountStatus.SUSPENDED && reason) await this.sms.send(user.phone, `Ton compte est suspendu : ${reason}`);
    return this.users.findOneByOrFail({ id });
  }

  async createStaff(dto: CreateStaffDto) {
    const phone = normalizeCiPhone(dto.phone);
    const existing = await this.users.findOneBy({ phone });
    if (existing) {
      await this.users.update({ id: existing.id }, { role: dto.role, name: dto.name, status: AccountStatus.ACTIVE });
      return this.users.findOneByOrFail({ id: existing.id });
    }
    return this.users.save(this.users.create({ phone, name: dto.name, role: dto.role, status: AccountStatus.ACTIVE }));
  }

  async listShops(status?: AccountStatus) {
    const rows = await this.shops.find({ where: status ? { status } : {}, relations: { owner: true }, order: { createdAt: 'DESC' } });
    return rows.map((s) => ({
      ...serializeShop(s),
      idDocumentUrl: s.idDocumentUrl,
      mobileMoneyNumber: s.mobileMoneyNumber,
      owner: { id: s.owner.id, name: s.owner.name, phone: s.owner.phone, status: s.owner.status },
    }));
  }

  /** Valider un commerce valide aussi le compte du commerçant. */
  async setShopStatus(id: string, status: AccountStatus) {
    const shop = await this.shops.findOneBy({ id });
    if (!shop) throw new NotFoundException('Commerce introuvable');
    await this.shops.update({ id }, { status, ...(status !== AccountStatus.ACTIVE ? { isOpen: false } : {}) });
    if (status === AccountStatus.ACTIVE) {
      const owner = await this.users.findOneByOrFail({ id: shop.ownerId });
      if (owner.status === AccountStatus.PENDING) await this.setUserStatus(owner.id, AccountStatus.ACTIVE);
    }
    return serializeShop(await this.shops.findOneByOrFail({ id }));
  }

  async patchShop(id: string, dto: ShopAdminPatchDto) {
    const patch: Partial<Shop> = {};
    if (dto.commissionRateOverride !== undefined) patch.commissionRateOverride = dto.commissionRateOverride;
    if (dto.commissionFreeUntil !== undefined) patch.commissionFreeUntil = dto.commissionFreeUntil ? new Date(dto.commissionFreeUntil) : null;
    if (dto.selfDelivery !== undefined) patch.selfDelivery = dto.selfDelivery;
    await this.shops.update({ id }, patch);
    return serializeShop(await this.shops.findOneByOrFail({ id }));
  }

  async listCouriers(status?: AccountStatus) {
    const rows = await this.couriers.find({ relations: { user: true }, where: status ? { user: { status } } : {} });
    const ceiling = await this.settings.get('courierCashCeiling');
    return rows.map((c) => ({
      ...c,
      location: fromPoint(c.location),
      user: { id: c.user.id, name: c.user.name, phone: c.user.phone, status: c.user.status },
      cashBlocked: c.cashHeld >= ceiling,
    }));
  }

  // ── Supervision ──
  async listOrders(q: OrdersQuery) {
    const qb = this.orders.createQueryBuilder('o').leftJoinAndSelect('o.items', 'i').orderBy('o.createdAt', 'DESC').take(q.limit ?? 100);
    if (q.status) qb.andWhere('o.status = :s', { s: q.status });
    if (q.neighborhoodId) qb.andWhere('o.neighborhoodId = :n', { n: q.neighborhoodId });
    if (q.shopId) qb.andWhere('o.shopId = :shop', { shop: q.shopId });
    let rows = await qb.getMany();
    const withLate = rows.map((o) => ({ ...o, deliveryLocation: fromPoint(o.deliveryLocation), late: this.isLate(o) }));
    return q.late === 'true' ? withLate.filter((o) => o.late) : withLate;
  }

  isLate(o: Order): boolean {
    const limit = LATE_RULES[o.status];
    if (!limit) return false;
    const since = { PENDING: o.createdAt, CONFIRMED: o.confirmedAt, READY: o.readyAt, PICKED_UP: o.pickedUpAt }[o.status as string] ?? o.updatedAt;
    return Date.now() - new Date(since).getTime() > limit * 60000;
  }

  /** Carte en direct : livreurs en service et commandes en cours. */
  async live() {
    const [couriers, orders] = await Promise.all([
      this.couriers.find({ where: { online: true }, relations: { user: true } }),
      this.orders.find({
        where: { status: In([OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY, OrderStatus.PICKED_UP, OrderStatus.AWAITING_CLIENT]) },
      }),
    ]);
    const shops = await this.shops.findBy({ id: In([...new Set(orders.map((o) => o.shopId))]) });
    const shopPos = new Map(shops.map((s) => [s.id, { name: s.name, location: fromPoint(s.location) }]));
    return {
      couriers: couriers.map((c) => ({
        id: c.userId, name: c.user.name, vehicle: c.vehicle, location: fromPoint(c.location), lastSeenAt: c.lastSeenAt, cashHeld: c.cashHeld,
      })),
      orders: orders.map((o) => ({
        id: o.id, reference: o.reference, status: o.status, dispatchStatus: o.dispatchStatus, courierId: o.courierId,
        shop: shopPos.get(o.shopId), dropoff: fromPoint(o.deliveryLocation), late: this.isLate(o), createdAt: o.createdAt,
      })),
    };
  }

  // ── Zones et tarifs ──
  async upsertCity(dto: CityDto, id?: string) {
    const city = id ? await this.cities.findOneByOrFail({ id }) : this.cities.create();
    Object.assign(city, { slug: dto.slug, name: dto.name, active: dto.active ?? city.active ?? false });
    if (dto.lat != null && dto.lng != null) city.center = toPoint({ lat: dto.lat, lng: dto.lng });
    return this.cities.save(city);
  }

  allCities() {
    return this.cities.find({ relations: { neighborhoods: true }, order: { name: 'ASC' } });
  }

  async upsertNeighborhood(dto: NeighborhoodDto, id?: string) {
    const n = id ? await this.neighborhoods.findOneByOrFail({ id }) : this.neighborhoods.create();
    Object.assign(n, { cityId: dto.cityId, name: dto.name, active: dto.active ?? n.active ?? true });
    if (dto.lat != null && dto.lng != null) n.center = toPoint({ lat: dto.lat, lng: dto.lng });
    return this.neighborhoods.save(n);
  }

  getTariffs(cityId: string) {
    return this.tariffs.find({ where: { cityId }, order: { maxDistanceMeters: 'ASC' } });
  }

  async setTariffs(cityId: string, dto: TariffsDto) {
    await this.cities.findOneByOrFail({ id: cityId });
    await this.db.transaction(async (m) => {
      await m.delete(DeliveryTariff, { cityId });
      await m.save(dto.tiers.map((t) => m.create(DeliveryTariff, { ...t, cityId })));
    });
    return this.getTariffs(cityId);
  }

  getCommissions() {
    return this.commissions.find({ order: { category: 'ASC' } });
  }

  async setCommissions(dto: CommissionsDto) {
    for (const item of dto.items) await this.commissions.upsert(item, ['category']);
    return this.getCommissions();
  }

  async setSetting(key: string, value: unknown) {
    if (!(key in DEFAULT_SETTINGS)) throw new BadRequestException('Paramètre inconnu');
    await this.settings.set(key as SettingKey, value);
    return this.settings.all();
  }

  // ── Support ──
  listTickets(status?: TicketStatus) {
    return this.tickets.find({ where: status ? { status } : {}, order: { createdAt: 'DESC' }, take: 200 });
  }

  async resolveTicket(adminId: string, id: string, refundAmount?: number, message?: string) {
    const t = await this.tickets.findOneBy({ id });
    if (!t) throw new NotFoundException('Réclamation introuvable');
    if (refundAmount && t.orderId) {
      const order = await this.orders.findOneByOrFail({ id: t.orderId });
      if (refundAmount > order.total) throw new BadRequestException('Remboursement supérieur au montant de la commande');
      await this.payments.refund(order.id, refundAmount);
    }
    if (message) t.messages = [...t.messages, { authorId: adminId, authorRole: Role.ADMIN, text: message, at: new Date().toISOString() }];
    t.status = TicketStatus.RESOLVED;
    t.resolvedAt = new Date();
    t.refundAmount = refundAmount ?? null;
    return this.tickets.save(t);
  }

  // ── Finances ──
  async balances() {
    const shopRows = await this.db.query(
      `SELECT s.id, s.name, s."mobileMoneyNumber", s."payoutFrequency", COALESCE(SUM(e.amount), 0)::int AS balance
       FROM shops s LEFT JOIN ledger_entries e ON e."accountType" = 'SHOP' AND e."accountId" = s.id
       GROUP BY s.id ORDER BY balance DESC`,
    );
    const courierRows = await this.db.query(
      `SELECT c."userId" AS id, u.name, u.phone, c."cashHeld", c."mobileMoneyNumber", COALESCE(SUM(e.amount), 0)::int AS balance
       FROM courier_profiles c JOIN users u ON u.id = c."userId"
       LEFT JOIN ledger_entries e ON e."accountType" = 'COURIER' AND e."accountId" = c."userId"
       GROUP BY c."userId", u.name, u.phone ORDER BY c."cashHeld" DESC`,
    );
    return { shops: shopRows, couriers: courierRows };
  }

  /** Le livreur remet ses espèces : on diminue son encours (débloque les courses sous le plafond). */
  async recordRemittance(adminId: string, dto: RemittanceDto) {
    const c = await this.couriers.findOneBy({ userId: dto.courierId });
    if (!c) throw new NotFoundException('Livreur introuvable');
    if (dto.amount > c.cashHeld) throw new BadRequestException(`Le livreur ne détient que ${c.cashHeld} FCFA`);
    await this.db.transaction(async (m) => {
      await m.decrement(CourierProfile, { userId: dto.courierId }, 'cashHeld', dto.amount);
      await m.save(m.create(CashRemittance, { courierId: dto.courierId, amount: dto.amount, recordedBy: adminId, note: dto.note ?? null }));
    });
    return this.couriers.findOneByOrFail({ userId: dto.courierId });
  }

  listPayouts(status?: PayoutStatus) {
    return this.payouts.find({ where: status ? { status } : {}, order: { createdAt: 'DESC' }, take: 200 });
  }

  async payPayout(adminId: string, id: string, providerRef?: string) {
    const p = await this.payouts.findOneBy({ id, status: PayoutStatus.REQUESTED });
    if (!p) throw new NotFoundException('Demande introuvable ou déjà traitée');
    await this.ledger.record(p.accountType, p.accountId, LedgerKind.PAYOUT, -p.amount, null, providerRef ?? null);
    Object.assign(p, { status: PayoutStatus.PAID, providerRef: providerRef ?? null, processedBy: adminId, processedAt: new Date() });
    return this.payouts.save(p);
  }

  async rejectPayout(adminId: string, id: string) {
    const p = await this.payouts.findOneBy({ id, status: PayoutStatus.REQUESTED });
    if (!p) throw new NotFoundException('Demande introuvable ou déjà traitée');
    Object.assign(p, { status: PayoutStatus.REJECTED, processedBy: adminId, processedAt: new Date() });
    return this.payouts.save(p);
  }

  /** Export comptable des commandes (CSV, séparateur « ; » pour Excel en français). */
  async exportCsv(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
    const end = to ? new Date(new Date(to).getTime() + 86400000) : new Date();
    const rows = await this.db.query(
      `SELECT o.reference, o."createdAt", o."deliveredAt", o.status, s.name AS shop, n.name AS quartier, o."paymentMethod",
              o."paymentStatus", o."deliveryMode", o.subtotal, o."deliveryFee", o.total, o.commission, o."courierEarning", o."cancellationFee"
       FROM orders o JOIN shops s ON s.id = o."shopId" LEFT JOIN neighborhoods n ON n.id = o."neighborhoodId"
       WHERE o."createdAt" >= $1 AND o."createdAt" < $2 ORDER BY o."createdAt"`,
      [start, end],
    );
    const header = [
      'reference', 'createdAt', 'deliveredAt', 'status', 'shop', 'quartier', 'paymentMethod', 'paymentStatus', 'deliveryMode',
      'subtotal', 'deliveryFee', 'total', 'commission', 'courierEarning', 'cancellationFee',
    ];
    const esc = (v: unknown) => {
      const s = v instanceof Date ? v.toISOString() : v == null ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [header.join(';'), ...rows.map((r: any) => header.map((h) => esc(r[h])).join(';'))].join('\n');
  }

  // ── Tableaux de bord ──
  async dashboard(days = 7) {
    const since = new Date(Date.now() - days * 86400000);
    since.setHours(0, 0, 0, 0);
    const perDay = await this.db.query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS orders,
              COUNT(*) FILTER (WHERE o.status = 'DELIVERED')::int AS delivered,
              COUNT(*) FILTER (WHERE o.status IN ('CANCELLED','RETURNED'))::int AS cancelled,
              COALESCE(SUM(o.subtotal) FILTER (WHERE o.status = 'DELIVERED'), 0)::int AS gmv,
              COALESCE(SUM(o.commission + o."deliveryFee" - o."courierEarning") FILTER (WHERE o.status = 'DELIVERED' AND o."deliveryMode" = 'PLATFORM'), 0)::int
                + COALESCE(SUM(o.commission) FILTER (WHERE o.status = 'DELIVERED' AND o."deliveryMode" <> 'PLATFORM'), 0)::int AS revenue,
              ROUND(AVG(EXTRACT(EPOCH FROM (o."deliveredAt" - o."createdAt")) / 60) FILTER (WHERE o.status = 'DELIVERED'))::int AS "avgDeliveryMinutes"
       FROM orders o WHERE o."createdAt" >= $1 GROUP BY 1 ORDER BY 1`,
      [since],
    );
    const perNeighborhood = await this.db.query(
      `SELECT n.name AS quartier, COUNT(*)::int AS orders,
              COUNT(*) FILTER (WHERE o.status = 'DELIVERED')::int AS delivered,
              COALESCE(SUM(o.subtotal) FILTER (WHERE o.status = 'DELIVERED'), 0)::int AS gmv
       FROM orders o LEFT JOIN neighborhoods n ON n.id = o."neighborhoodId"
       WHERE o."createdAt" >= $1 GROUP BY n.name ORDER BY orders DESC`,
      [since],
    );
    const totals = perDay.reduce(
      (t: any, d: any) => ({
        orders: t.orders + d.orders, delivered: t.delivered + d.delivered, cancelled: t.cancelled + d.cancelled,
        gmv: t.gmv + d.gmv, revenue: t.revenue + d.revenue,
      }),
      { orders: 0, delivered: 0, cancelled: 0, gmv: 0, revenue: 0 },
    );
    const [activeShops, onlineCouriers, pendingAccounts, openTickets] = await Promise.all([
      this.shops.count({ where: { status: AccountStatus.ACTIVE } }),
      this.couriers.count({ where: { online: true } }),
      this.users.count({ where: { status: AccountStatus.PENDING } }),
      this.tickets.count({ where: { status: In([TicketStatus.OPEN, TicketStatus.IN_PROGRESS]) } }),
    ]);
    return {
      since,
      totals: { ...totals, cancellationRate: totals.orders ? Math.round((totals.cancelled / totals.orders) * 1000) / 10 : 0 },
      perDay,
      perNeighborhood,
      activeShops,
      onlineCouriers,
      pendingAccounts,
      openTickets,
    };
  }
}
