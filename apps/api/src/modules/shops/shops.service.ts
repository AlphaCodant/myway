import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Neighborhood, Product, Shop, User } from '../../database/entities';
import { AccountStatus, Role } from '../../common/enums';
import { fromPoint, toPoint } from '../../common/geo';
import { normalizeCiPhone } from '../../common/phone';
import { SettingsService } from '../settings/settings.service';
import { CreateShopDto, ListShopsQuery, OnboardMerchantDto, ProductDto, UpdateProductDto, UpdateShopDto } from './shops.dto';

export function serializeShop(s: Shop, extra: Record<string, unknown> = {}) {
  const { location, idDocumentUrl, mobileMoneyNumber, ...rest } = s;
  return { ...rest, location: fromPoint(location), ...extra };
}

@Injectable()
export class ShopsService {
  constructor(
    private readonly settings: SettingsService,
    @InjectRepository(Shop) private readonly shops: Repository<Shop>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Neighborhood) private readonly neighborhoods: Repository<Neighborhood>,
  ) {}

  /** Catalogue public : commerces validés, filtrés par quartier, catégorie, recherche ; triés par distance. */
  async list(q: ListShopsQuery) {
    const qb = this.shops.createQueryBuilder('s').where('s.status = :st', { st: AccountStatus.ACTIVE });
    if (q.neighborhoodId) qb.andWhere('s.neighborhoodId = :n', { n: q.neighborhoodId });
    if (q.category) qb.andWhere('s.category = :c', { c: q.category });
    if (q.openOnly === 'true') qb.andWhere('s.isOpen = true');
    if (q.q) {
      qb.andWhere(
        `(s.name ILIKE :q OR EXISTS (SELECT 1 FROM products p WHERE p."shopId" = s.id AND p.archived = false AND p.name ILIKE :q))`,
        { q: `%${q.q}%` },
      );
    }
    if (q.lat != null && q.lng != null) {
      qb.addSelect(`ST_Distance(s.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography)`, 'distance')
        .setParameters({ lat: q.lat, lng: q.lng })
        .orderBy('s.isOpen', 'DESC')
        .addOrderBy('distance', 'ASC');
    } else {
      qb.orderBy('s.isOpen', 'DESC').addOrderBy('s.ratingAvg', 'DESC');
    }
    const { entities, raw } = await qb.limit(100).getRawAndEntities();
    return entities.map((s, i) =>
      serializeShop(s, raw[i]?.distance != null ? { distanceMeters: Math.round(Number(raw[i].distance)) } : {}),
    );
  }

  async getPublic(id: string) {
    const shop = await this.shops.findOneBy({ id, status: AccountStatus.ACTIVE });
    if (!shop) throw new NotFoundException('Commerce introuvable');
    const products = await this.products.find({
      where: { shopId: id, archived: false },
      order: { section: 'ASC', name: 'ASC' },
    });
    return { ...serializeShop(shop), products };
  }

  async findOwned(ownerId: string, shopId?: string) {
    const shop = await this.shops.findOne({ where: shopId ? { id: shopId, ownerId } : { ownerId }, order: { createdAt: 'ASC' } });
    if (!shop) throw new NotFoundException('Aucun commerce associé à ce compte');
    return shop;
  }

  async assertCanManage(user: { id: string; role: Role }, shopId: string) {
    const shop = await this.shops.findOneBy({ id: shopId });
    if (!shop) throw new NotFoundException('Commerce introuvable');
    const ok =
      user.role === Role.ADMIN ||
      shop.ownerId === user.id ||
      (user.role === Role.AGENT && shop.createdByAgentId === user.id);
    if (!ok) throw new ForbiddenException('Ce commerce ne t’appartient pas');
    return shop;
  }

  async onboard(agentId: string, dto: OnboardMerchantDto) {
    const phone = normalizeCiPhone(dto.ownerPhone);
    let owner = await this.users.findOneBy({ phone });
    if (!owner) {
      owner = await this.users.save(this.users.create({ phone, name: dto.ownerName, role: Role.MERCHANT, status: AccountStatus.PENDING }));
    } else if (owner.role === Role.CLIENT) {
      owner.role = Role.MERCHANT;
      owner.name = owner.name ?? dto.ownerName;
      await this.users.save(owner);
    } else if (owner.role !== Role.MERCHANT) {
      throw new ForbiddenException('Ce numéro est déjà utilisé par un autre type de compte');
    }
    const { ownerPhone, ownerName, ...shopDto } = dto;
    return this.create(owner.id, shopDto, agentId);
  }

  async create(ownerId: string, dto: CreateShopDto, agentId?: string) {
    const { lat, lng, ...rest } = dto;
    await this.neighborhoods.findOneByOrFail({ id: dto.neighborhoodId });
    const months = await this.settings.get('commissionFreeMonths');
    const freeUntil = new Date();
    freeUntil.setMonth(freeUntil.getMonth() + months);
    const shop = await this.shops.save(
      this.shops.create({
        ...rest,
        ownerId,
        location: toPoint({ lat, lng }),
        status: AccountStatus.PENDING,
        commissionFreeUntil: freeUntil,
        createdByAgentId: agentId ?? null,
      }),
    );
    return serializeShop(shop);
  }

  async update(shop: Shop, dto: UpdateShopDto) {
    const { lat, lng, ...rest } = dto;
    Object.assign(shop, rest);
    if (lat != null && lng != null) shop.location = toPoint({ lat, lng });
    return serializeShop(await this.shops.save(shop));
  }

  async setOpen(shop: Shop, isOpen: boolean) {
    if (isOpen && shop.status !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('Ton commerce doit être validé par l’équipe avant d’ouvrir');
    }
    shop.isOpen = isOpen;
    return serializeShop(await this.shops.save(shop));
  }

  listProducts(shopId: string) {
    return this.products.find({ where: { shopId, archived: false }, order: { section: 'ASC', name: 'ASC' } });
  }

  addProducts(shopId: string, dtos: ProductDto[]) {
    return this.products.save(dtos.map((d) => this.products.create({ ...d, shopId })));
  }

  async updateProduct(shopId: string, productId: string, dto: UpdateProductDto) {
    const p = await this.products.findOneBy({ id: productId, shopId });
    if (!p) throw new NotFoundException('Produit introuvable');
    Object.assign(p, dto);
    return this.products.save(p);
  }

  async archiveProduct(shopId: string, productId: string) {
    await this.products.update({ id: productId, shopId }, { archived: true, available: false });
    return { ok: true };
  }
}
