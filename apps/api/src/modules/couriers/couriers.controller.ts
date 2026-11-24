import { BadRequestException, Body, Controller, ForbiddenException, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { IsBoolean, IsEnum, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Min } from 'class-validator';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { CourierProfile, Order, PayoutRequest, User } from '../../database/entities';
import { AccountStatus, LedgerAccount, LedgerKind, OrderStatus, PayoutStatus, Role, VehicleType } from '../../common/enums';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { fromPoint, toPoint } from '../../common/geo';
import { LedgerService } from '../orders/ledger.service';
import { SettingsService } from '../settings/settings.service';

export class CourierProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional({ enum: VehicleType }) @IsOptional() @IsEnum(VehicleType) vehicle?: VehicleType;
  @ApiPropertyOptional() @IsOptional() @IsString() idDocumentUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() licenseUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() registrationUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() emergencyContact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mobileMoneyNumber?: string;
}
export class OnlineDto {
  @ApiProperty() @IsBoolean() online: boolean;
}
export class PositionDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
}
export class WithdrawDto {
  @ApiProperty() @IsInt() @Min(500) amount: number;
}

const startOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

@ApiTags('Livreur : profil, disponibilité, portefeuille')
@ApiBearerAuth()
@Roles(Role.COURIER)
@Controller('courier')
export class CouriersController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly settings: SettingsService,
    @InjectRepository(CourierProfile) private readonly profiles: Repository<CourierProfile>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(PayoutRequest) private readonly payouts: Repository<PayoutRequest>,
  ) {}

  private async profile(userId: string) {
    let p = await this.profiles.findOneBy({ userId });
    if (!p) p = await this.profiles.save(this.profiles.create({ userId }));
    return p;
  }

  @Get('profile')
  async get(@CurrentUser() me: AuthUser) {
    const [p, u] = await Promise.all([this.profile(me.id), this.users.findOneByOrFail({ id: me.id })]);
    return { ...p, location: fromPoint(p.location), name: u.name, phone: u.phone, status: u.status };
  }

  /** Dépôt des pièces : pièce d'identité, permis et carte grise (moto), photo, contact d'urgence. */
  @Patch('profile')
  async update(@CurrentUser() me: AuthUser, @Body() dto: CourierProfileDto) {
    const { name, ...rest } = dto;
    if (name) await this.users.update({ id: me.id }, { name });
    await this.profile(me.id);
    await this.profiles.update({ userId: me.id }, rest);
    return this.get(me);
  }

  /** « En service / hors service ». La position n'est partagée qu'en service. */
  @Post('online')
  async online(@CurrentUser() me: AuthUser, @Body() dto: OnlineDto) {
    const user = await this.users.findOneByOrFail({ id: me.id });
    if (dto.online && user.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Ton compte doit être validé par l’équipe avant de prendre des courses');
    }
    const p = await this.profile(me.id);
    const ceiling = await this.settings.get('courierCashCeiling');
    await this.profiles.update({ userId: me.id }, { online: dto.online, ...(dto.online ? {} : { location: null }) });
    return { online: dto.online, cashHeld: p.cashHeld, cashCeiling: ceiling, blocked: p.cashHeld >= ceiling };
  }

  /** Position envoyée toutes les 15 à 30 secondes par l'application. */
  @Post('position')
  async position(@CurrentUser() me: AuthUser, @Body() dto: PositionDto) {
    const p = await this.profile(me.id);
    if (!p.online) throw new BadRequestException('Passe en service pour partager ta position');
    await this.profiles.update({ userId: me.id }, { location: toPoint(dto), lastSeenAt: new Date() });
    return { ok: true };
  }

  @Get('wallet')
  async wallet(@CurrentUser() me: AuthUser) {
    const p = await this.profile(me.id);
    const ceiling = await this.settings.get('courierCashCeiling');
    const [balance, earnedToday, deliveriesToday, history] = await Promise.all([
      this.ledger.balance(LedgerAccount.COURIER, me.id),
      this.ledger.sumSince(LedgerAccount.COURIER, me.id, [LedgerKind.DELIVERY_EARNING], startOfDay()),
      this.orders.count({ where: { courierId: me.id, status: In([OrderStatus.DELIVERED]), deliveredAt: MoreThanOrEqual(startOfDay()) } }),
      this.ledger.history(LedgerAccount.COURIER, me.id, 30),
    ]);
    return {
      earningsBalance: balance, // gains à retirer
      earnedToday,
      deliveriesToday,
      cashHeld: p.cashHeld, // espèces à reverser
      cashCeiling: ceiling,
      blocked: p.cashHeld >= ceiling,
      history,
    };
  }

  /** Retrait Mobile Money des gains (traité par l'équipe finance). */
  @Post('withdraw')
  async withdraw(@CurrentUser() me: AuthUser, @Body() dto: WithdrawDto) {
    const p = await this.profile(me.id);
    if (!p.mobileMoneyNumber) throw new BadRequestException('Ajoute ton numéro Mobile Money dans ton profil');
    const balance = await this.ledger.balance(LedgerAccount.COURIER, me.id);
    const pending = await this.payouts.sum('amount', { accountId: me.id, status: PayoutStatus.REQUESTED });
    if (dto.amount > balance - (pending ?? 0)) throw new BadRequestException('Montant supérieur à tes gains disponibles');
    return this.payouts.save(
      this.payouts.create({ accountType: LedgerAccount.COURIER, accountId: me.id, amount: dto.amount, mobileMoneyNumber: p.mobileMoneyNumber }),
    );
  }
}
