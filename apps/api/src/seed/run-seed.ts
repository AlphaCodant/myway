import { DataSource } from 'typeorm';
import {
  Address, CategoryCommission, City, CourierProfile, DeliveryTariff, Landmark, Neighborhood, Product, Shop, User,
} from '../database/entities';
import { AccountStatus, Role, ShopCategory, VehicleType } from '../common/enums';
import { toPoint } from '../common/geo';
import { normalizeCiPhone } from '../common/phone';
import {
  COMMISSIONS, DEMO_AGENT, DEMO_CLIENT, DEMO_COURIERS, DEMO_SHOPS, GAGNOA, LANDMARKS, NEIGHBORHOODS, OTHER_CITIES, TARIFFS,
} from './seed-data';

/** Charge les référentiels (idempotent) et, si demandé, des données de démonstration. */
export async function runSeed(ds: DataSource, opts: { adminPhone: string; demo: boolean }) {
  const cities = ds.getRepository(City);
  const nbs = ds.getRepository(Neighborhood);
  const users = ds.getRepository(User);

  let gagnoa = await cities.findOneBy({ slug: GAGNOA.slug });
  if (!gagnoa) gagnoa = await cities.save(cities.create({ slug: GAGNOA.slug, name: GAGNOA.name, active: true, center: toPoint(GAGNOA) }));
  for (const c of OTHER_CITIES) {
    if (!(await cities.existsBy({ slug: c.slug }))) await cities.save(cities.create({ slug: c.slug, name: c.name, active: false, center: toPoint(c) }));
  }

  const nbByName = new Map<string, Neighborhood>();
  for (const n of NEIGHBORHOODS) {
    let row = await nbs.findOneBy({ cityId: gagnoa.id, name: n.name });
    if (!row) row = await nbs.save(nbs.create({ cityId: gagnoa.id, name: n.name, center: toPoint(n) }));
    nbByName.set(n.name, row);
  }

  if (!(await ds.getRepository(DeliveryTariff).existsBy({ cityId: gagnoa.id }))) {
    await ds.getRepository(DeliveryTariff).save(TARIFFS.map((t) => ({ ...t, cityId: gagnoa!.id })));
  }
  for (const [category, ratePercent] of Object.entries(COMMISSIONS)) {
    await ds.getRepository(CategoryCommission).upsert({ category: category as ShopCategory, ratePercent }, ['category']);
  }
  const landmarks = ds.getRepository(Landmark);
  for (const l of LANDMARKS) {
    const nb = nbByName.get(l.neighborhood)!;
    if (!(await landmarks.existsBy({ name: l.name }))) {
      await landmarks.save(landmarks.create({ neighborhoodId: nb.id, name: l.name, type: l.type, location: toPoint(l) }));
    }
  }

  const upsertUser = async (phone: string, name: string, role: Role, status = AccountStatus.ACTIVE) => {
    const p = normalizeCiPhone(phone);
    const existing = await users.findOneBy({ phone: p });
    if (existing) return existing;
    return users.save(users.create({ phone: p, name, role, status }));
  };
  const admin = await upsertUser(opts.adminPhone, 'Administrateur', Role.ADMIN);
  const summary: Record<string, unknown> = { city: gagnoa.name, neighborhoods: NEIGHBORHOODS.length, adminPhone: admin.phone };
  if (!opts.demo) return summary;

  const agent = await upsertUser(DEMO_AGENT.phone, DEMO_AGENT.name, Role.AGENT);
  const shops = ds.getRepository(Shop);
  for (const s of DEMO_SHOPS) {
    const owner = await upsertUser(s.ownerPhone, s.ownerName, Role.MERCHANT);
    if (await shops.existsBy({ ownerId: owner.id })) continue;
    const nb = nbByName.get(s.neighborhood)!;
    const shop = await shops.save(
      shops.create({
        ownerId: owner.id, name: s.name, category: s.category, neighborhoodId: nb.id, location: toPoint(s), landmarkText: s.landmarkText,
        status: AccountStatus.ACTIVE, isOpen: true, selfDelivery: s.selfDelivery, mobileMoneyNumber: normalizeCiPhone(s.ownerPhone),
        createdByAgentId: agent.id,
        openingHours: Object.fromEntries([1, 2, 3, 4, 5, 6].map((d) => [String(d), { open: '07:00', close: '21:00' }])),
      }),
    );
    await ds.getRepository(Product).save(s.products.map((p) => ({ ...p, shopId: shop.id })));
  }
  for (const c of DEMO_COURIERS) {
    const u = await upsertUser(c.phone, c.name, Role.COURIER);
    if (!(await ds.getRepository(CourierProfile).existsBy({ userId: u.id }))) {
      await ds.getRepository(CourierProfile).save({
        userId: u.id, vehicle: VehicleType.MOTO, mobileMoneyNumber: u.phone, emergencyContact: '+2250100000000',
        online: false, location: toPoint(c),
      });
    }
  }
  const client = await upsertUser(DEMO_CLIENT.phone, DEMO_CLIENT.name, Role.CLIENT);
  if (!(await ds.getRepository(Address).existsBy({ userId: client.id }))) {
    const nb = nbByName.get('Commerce')!;
    await ds.getRepository(Address).save({
      userId: client.id, label: 'Maison', neighborhoodId: nb.id, location: toPoint({ lat: 6.1345, lng: -5.9470 }),
      landmarkText: 'Après la pharmacie, portail bleu',
    });
  }
  return { ...summary, demoShops: DEMO_SHOPS.length, demoCouriers: DEMO_COURIERS.length, demoClient: client.phone, demoAgent: agent.phone };
}
