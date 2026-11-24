import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryCommission, DeliveryTariff, Setting, Shop } from '../../database/entities';
import { ShopCategory } from '../../common/enums';

/** Valeurs par défaut des règles métier (modifiables par l'admin via la table settings). */
export const DEFAULT_SETTINGS = {
  /** Plafond d'espèces non reversées au-delà duquel un livreur ne reçoit plus de course. */
  courierCashCeiling: 50000,
  /** Part des frais de livraison reversée au livreur. */
  courierSharePercent: 80,
  /** Rayon maximum de livraison. */
  maxDeliveryDistanceMeters: 5000,
  /** Rayon de recherche des livreurs autour du commerce. */
  dispatchRadiusMeters: 5000,
  /** Délai pour accepter une course. */
  offerTimeoutSeconds: 30,
  /** Rappel automatique au commerçant si la commande n'est pas acceptée. */
  merchantReminderMinutes: 5,
  /** Frais d'annulation après confirmation du commerçant. */
  cancellationFeeAfterConfirm: 500,
  /** Client injoignable : nombre d'appels et attente avant retour du colis. */
  unreachableCallAttempts: 3,
  unreachableWaitMinutes: 10,
  /** Mois de commission offerte aux nouveaux commerçants. */
  commissionFreeMonths: 2,
  defaultCommissionPercent: 10,
};
export type SettingKey = keyof typeof DEFAULT_SETTINGS;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
    @InjectRepository(DeliveryTariff) private readonly tariffs: Repository<DeliveryTariff>,
    @InjectRepository(CategoryCommission) private readonly commissions: Repository<CategoryCommission>,
  ) {}

  async get<K extends SettingKey>(key: K): Promise<(typeof DEFAULT_SETTINGS)[K]> {
    const row = await this.settings.findOneBy({ key });
    return (row?.value as (typeof DEFAULT_SETTINGS)[K]) ?? DEFAULT_SETTINGS[key];
  }

  async all() {
    const rows = await this.settings.find();
    const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    rows.forEach((r) => (out[r.key] = r.value));
    return out;
  }

  async set(key: SettingKey, value: unknown) {
    await this.settings.save({ key, value });
  }

  /** Frais de livraison selon la grille de la ville ; null si hors zone. */
  async deliveryFee(cityId: string, distanceMeters: number): Promise<number | null> {
    const max = await this.get('maxDeliveryDistanceMeters');
    if (distanceMeters > max) return null;
    const grid = await this.tariffs.find({ where: { cityId }, order: { maxDistanceMeters: 'ASC' } });
    const tier = grid.find((t) => distanceMeters <= t.maxDistanceMeters);
    if (tier) return tier.fee;
    return grid.length ? null : 500;
  }

  /** Taux de commission applicable (en %) à un commerce aujourd'hui. */
  async commissionPercent(shop: Shop, now = new Date()): Promise<number> {
    if (shop.commissionFreeUntil && shop.commissionFreeUntil > now) return 0;
    if (shop.commissionRateOverride != null) return shop.commissionRateOverride;
    const row = await this.commissions.findOneBy({ category: shop.category as ShopCategory });
    return row?.ratePercent ?? (await this.get('defaultCommissionPercent'));
  }
}
