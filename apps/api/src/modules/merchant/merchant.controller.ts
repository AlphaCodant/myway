import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsInt, Min } from 'class-validator';
import { Between, In, Repository } from 'typeorm';
import { Order, PayoutRequest } from '../../database/entities';
import { LedgerAccount, OrderStatus, PayoutStatus, Role } from '../../common/enums';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { LedgerService } from '../orders/ledger.service';
import { SettingsService } from '../settings/settings.service';
import { ShopsService } from '../shops/shops.service';

export class PayoutDto {
  @ApiProperty() @IsInt() @Min(500) amount: number;
}

@ApiTags('Commerçant : tableau de bord et reversements')
@ApiBearerAuth()
@Roles(Role.MERCHANT)
@Controller('merchant')
export class MerchantController {
  constructor(
    private readonly shops: ShopsService,
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(PayoutRequest) private readonly payouts: Repository<PayoutRequest>,
  ) {}

  private async stats(shopId: string, from: Date, to: Date) {
    const rows = await this.orders.find({ where: { shopId, createdAt: Between(from, to) }, select: ['status', 'subtotal', 'commission'] });
    const delivered = rows.filter((o) => o.status === OrderStatus.DELIVERED);
    return {
      orders: rows.length,
      delivered: delivered.length,
      cancelled: rows.filter((o) => o.status === OrderStatus.CANCELLED).length,
      sales: delivered.reduce((s, o) => s + o.subtotal, 0),
      commission: delivered.reduce((s, o) => s + o.commission, 0),
    };
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() me: AuthUser) {
    const shop = await this.shops.findOwned(me.id);
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const week = new Date(today);
    week.setDate(week.getDate() - ((week.getDay() + 6) % 7)); // lundi
    const [todayStats, weekStats, balance, pendingOrders, commissionPercent, history, payouts] = await Promise.all([
      this.stats(shop.id, today, now),
      this.stats(shop.id, week, now),
      this.ledger.balance(LedgerAccount.SHOP, shop.id),
      this.orders.count({ where: { shopId: shop.id, status: In([OrderStatus.PENDING, OrderStatus.AWAITING_CLIENT]) } }),
      this.settings.commissionPercent(shop),
      this.ledger.history(LedgerAccount.SHOP, shop.id, 30),
      this.payouts.find({ where: { accountType: LedgerAccount.SHOP, accountId: shop.id }, order: { createdAt: 'DESC' }, take: 10 }),
    ]);
    return {
      shopId: shop.id,
      isOpen: shop.isOpen,
      today: todayStats,
      week: weekStats,
      balance, // positif : la plateforme doit cet argent au commerçant ; négatif : commissions dues
      pendingOrders,
      commissionPercent,
      commissionFreeUntil: shop.commissionFreeUntil,
      history,
      payouts,
    };
  }

  @Post('payouts')
  async requestPayout(@CurrentUser() me: AuthUser, @Body() dto: PayoutDto) {
    const shop = await this.shops.findOwned(me.id);
    if (!shop.mobileMoneyNumber) throw new BadRequestException('Ajoute ton numéro Mobile Money');
    const balance = await this.ledger.balance(LedgerAccount.SHOP, shop.id);
    const pending = (await this.payouts.sum('amount', { accountId: shop.id, status: PayoutStatus.REQUESTED })) ?? 0;
    if (dto.amount > balance - pending) throw new BadRequestException('Montant supérieur au solde disponible');
    return this.payouts.save(
      this.payouts.create({ accountType: LedgerAccount.SHOP, accountId: shop.id, amount: dto.amount, mobileMoneyNumber: shop.mobileMoneyNumber }),
    );
  }
}
