import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://livraison:livraison@localhost:5432/livraison_test';
process.env.DB_SYNC = 'false'; // le schéma est recréé par ds.synchronize(true)
process.env.OTP_DEV_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.DISABLE_SCHEDULER = 'true';
process.env.PAYMENT_PROVIDER = 'simulated';
process.env.UPLOAD_DIR = require('os').tmpdir() + '/livraison-test-uploads';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { DispatchService } from '../src/modules/orders/dispatch.service';
import { runSeed } from '../src/seed/run-seed';

describe('Boucle complète commande → livraison → paiement', () => {
  let app: INestApplication;
  let ds: DataSource;
  let http: ReturnType<typeof request>;
  let baseUrl: string;
  const tokens: Record<string, string> = {};
  let shopId: string;
  let products: { id: string; name: string; price: number }[];
  let addressId: string;

  const login = async (phone: string, as?: 'CLIENT' | 'COURIER') => {
    const r1 = await http.post('/api/auth/otp/request').send({ phone }).expect(200);
    const r2 = await http.post('/api/auth/otp/verify').send({ phone, code: r1.body.devCode, as }).expect(200);
    return r2.body.token as string;
  };
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(mod.createNestApplication());
    ds = app.get(DataSource);
    await ds.synchronize(true); // base de test vidée
    await runSeed(ds, { adminPhone: '0700000000', demo: true });
    await app.listen(0);
    baseUrl = await app.getUrl();
    http = request(app.getHttpServer()) as any;

    tokens.client = await login('07 06 06 06 06');
    tokens.awa = await login('0701010101');
    tokens.moussa = await login('0502020202');
    tokens.koffi = await login('0704040404', 'COURIER');
    tokens.ibrahim = await login('0505050505', 'COURIER');
    tokens.admin = await login('0700000000');
    tokens.agent = await login('0707070707');
  });

  afterAll(async () => {
    await app?.close();
  });

  const rawOrder = async (id: string) => (await ds.query('SELECT * FROM orders WHERE id = $1', [id]))[0];
  const goOnline = async (who: string, lat: number, lng: number) => {
    await http.post('/api/courier/online').set(auth(who)).send({ online: true }).expect(201);
    await http.post('/api/courier/position').set(auth(who)).send({ lat, lng }).expect(201);
  };

  it('liste les quartiers et les commerces ouverts, triés par distance', async () => {
    const nbs = await http.get('/api/cities/gagnoa/neighborhoods').expect(200);
    expect(nbs.body.map((n: any) => n.name)).toEqual(['Babré', 'Commerce', 'Dioulabougou', 'Garahio']);
    const shops = await http.get('/api/shops').query({ lat: 6.1345, lng: -5.947, openOnly: 'true' }).expect(200);
    expect(shops.body[0].name).toBe('Boutique Chez Awa');
    expect(shops.body[0].distanceMeters).toBeGreaterThan(0);
    expect(shops.body[0].mobileMoneyNumber).toBeUndefined();
    shopId = shops.body[0].id;
    const detail = await http.get(`/api/shops/${shopId}`).expect(200);
    products = detail.body.products;
    expect(products.length).toBe(6);
    const search = await http.get('/api/shops').query({ q: 'garba' }).expect(200);
    expect(search.body.map((s: any) => s.name)).toEqual(['Maquis Le Bon Garba']);
  });

  it('crée une adresse informelle et calcule le devis', async () => {
    const addrs = await http.get('/api/me/addresses').set(auth('client')).expect(200);
    addressId = addrs.body[0].id;
    expect(addrs.body[0].landmarkText).toContain('portail bleu');
    const q = await http.post('/api/orders/quote').set(auth('client'))
      .send({ shopId, deliveryMode: 'PLATFORM', addressId, items: [{ productId: products[0].id, quantity: 2 }] })
      .expect(200);
    expect(q.body.subtotal).toBe(products[0].price * 2);
    expect(q.body.deliveryFee).toBe(500); // < 2 km
    expect(q.body.total).toBe(q.body.subtotal + 500);
  });

  it('déroule une commande payée en espèces livrée par un livreur', async () => {
    // Koffi est plus proche du commerce qu'Ibrahim
    await goOnline('koffi', 6.1330, -5.9480);
    await goOnline('ibrahim', 6.1400, -5.9500);

    // Le commerçant écoute en temps réel
    const sock: Socket = io(`${baseUrl}/realtime`, { auth: { token: tokens.awa }, transports: ['websocket'] });
    const newOrder = new Promise<any>((resolve) => sock.on('order.new', resolve));
    await new Promise<void>((r) => sock.on('connect', () => r()));
    await new Promise((r) => setTimeout(r, 200));

    const items = [{ productId: products[0].id, quantity: 1 }, { productId: products[4].id, quantity: 3 }];
    const created = await http.post('/api/orders').set(auth('client'))
      .send({ shopId, deliveryMode: 'PLATFORM', addressId, paymentMethod: 'CASH', items, note: 'Sonnez deux fois', clientRequestId: 'abc-1' })
      .expect(201);
    const order = created.body;
    expect(order.status).toBe('PENDING');
    expect(order.reference).toMatch(/^GAG-[A-Z0-9]{5}$/);
    expect(order.deliveryCode).toMatch(/^\d{4}$/);
    const expectedSubtotal = products[0].price + products[4].price * 3;
    expect(order.subtotal).toBe(expectedSubtotal);
    expect((await newOrder).reference).toBe(order.reference);
    sock.close();

    // Rejouer la même requête (réseau coupé) ne crée pas de doublon
    const replay = await http.post('/api/orders').set(auth('client'))
      .send({ shopId, deliveryMode: 'PLATFORM', addressId, paymentMethod: 'CASH', items, clientRequestId: 'abc-1' })
      .expect(201);
    expect(replay.body.id).toBe(order.id);

    // Un autre commerçant ne peut pas y toucher
    await http.post(`/api/merchant/orders/${order.id}/accept`).set(auth('moussa')).expect(403);

    // Le commerçant accepte → la course est proposée au livreur le plus proche
    await http.post(`/api/merchant/orders/${order.id}/accept`).set(auth('awa')).expect(201);
    const koffiOffers = await http.get('/api/courier/offers').set(auth('koffi')).expect(200);
    expect(koffiOffers.body).toHaveLength(1);
    expect(koffiOffers.body[0].cashToCollect).toBe(order.total);
    expect(koffiOffers.body[0].estimatedEarning).toBe(400); // 80 % de 500
    expect((await http.get('/api/courier/offers').set(auth('ibrahim'))).body).toHaveLength(0);

    // Le livreur ne voit pas le code de remise
    const accepted = await http.post(`/api/courier/offers/${koffiOffers.body[0].offerId}/accept`).set(auth('koffi')).expect(201);
    expect(accepted.body.courier.id).toBeDefined();
    expect(accepted.body.deliveryCode).toBeUndefined();

    await http.post(`/api/merchant/orders/${order.id}/ready`).set(auth('awa')).expect(201);
    await http.post(`/api/orders/${order.id}/picked-up`).set(auth('koffi')).expect(201);

    // Appel masqué
    const call = await http.post(`/api/orders/${order.id}/call/client`).set(auth('koffi')).expect(201);
    expect(call.body.sessionPin).toMatch(/^\d{4}$/);

    await http.post(`/api/orders/${order.id}/deliver`).set(auth('koffi'))
      .send({ code: order.deliveryCode === '0000' ? '1111' : '0000' }).expect(400);
    const delivered = await http.post(`/api/orders/${order.id}/deliver`).set(auth('koffi')).send({ code: order.deliveryCode }).expect(201);
    expect(delivered.body.status).toBe('DELIVERED');
    expect(delivered.body.paymentStatus).toBe('PAID');
    expect(delivered.body.timeline.map((e: any) => e.type)).toEqual(
      ['CREATED', 'CONFIRMED', 'COURIER_ASSIGNED', 'READY', 'PICKED_UP', 'DELIVERED'],
    );

    // Comptes : commission 8 % (alimentation), espèces chez le livreur
    const commission = Math.round(expectedSubtotal * 0.08);
    const dash = await http.get('/api/merchant/dashboard').set(auth('awa')).expect(200);
    expect(dash.body.balance).toBe(expectedSubtotal - commission);
    expect(dash.body.today.sales).toBe(expectedSubtotal);
    const wallet = await http.get('/api/courier/wallet').set(auth('koffi')).expect(200);
    expect(wallet.body.cashHeld).toBe(order.total);
    expect(wallet.body.earningsBalance).toBe(400);
    expect(wallet.body.deliveriesToday).toBe(1);

    // Notation
    await http.post(`/api/orders/${order.id}/rating`).set(auth('client')).send({ shopScore: 5, courierScore: 4, comment: 'Rapide' }).expect(201);
    await http.post(`/api/orders/${order.id}/rating`).set(auth('client')).send({ shopScore: 5 }).expect(400);
    const shop = await http.get(`/api/shops/${shopId}`).expect(200);
    expect(shop.body.ratingAvg).toBe(5);

    // SMS envoyés au client (code de remise compris)
    const sms = await ds.query(`SELECT body FROM sms_outbox WHERE phone = '+2250706060606' ORDER BY "createdAt"`);
    expect(sms.some((s: any) => s.body.includes(order.deliveryCode))).toBe(true);

    // L'admin enregistre la remise des espèces
    const koffiId = (await ds.query(`SELECT id FROM users WHERE phone = '+2250704040404'`))[0].id;
    await http.post('/api/admin/finance/remittances').set(auth('admin')).send({ courierId: koffiId, amount: order.total }).expect(201);
    expect((await http.get('/api/courier/wallet').set(auth('koffi'))).body.cashHeld).toBe(0);
  });

  it('passe au livreur suivant quand le premier ne répond pas en 30 secondes', async () => {
    const o = await http.post('/api/orders').set(auth('client'))
      .send({ shopId, deliveryMode: 'PLATFORM', addressId, paymentMethod: 'CASH', items: [{ productId: products[1].id, quantity: 1 }] })
      .expect(201);
    await http.post(`/api/merchant/orders/${o.body.id}/accept`).set(auth('awa')).expect(201);
    expect((await http.get('/api/courier/offers').set(auth('koffi'))).body).toHaveLength(1);

    await ds.query(`UPDATE delivery_offers SET "expiresAt" = now() - interval '1 second' WHERE "orderId" = $1`, [o.body.id]);
    await app.get(DispatchService).tick();

    expect((await http.get('/api/courier/offers').set(auth('koffi'))).body).toHaveLength(0);
    const ib = await http.get('/api/courier/offers').set(auth('ibrahim')).expect(200);
    expect(ib.body).toHaveLength(1);

    // Ibrahim refuse aussi → plus personne : le commerçant livre lui-même
    await http.post(`/api/courier/offers/${ib.body[0].offerId}/decline`).set(auth('ibrahim')).expect(201);
    expect((await rawOrder(o.body.id)).dispatchStatus).toBe('NO_COURIER');
    await http.post(`/api/merchant/orders/${o.body.id}/self-deliver`).set(auth('awa')).expect(201);
    await http.post(`/api/orders/${o.body.id}/picked-up`).set(auth('awa')).expect(201);
    const code = (await http.get(`/api/orders/${o.body.id}`).set(auth('client'))).body.deliveryCode;
    const done = await http.post(`/api/orders/${o.body.id}/deliver`).set(auth('awa')).send({ code }).expect(201);
    expect(done.body.deliveryMode).toBe('MERCHANT');
    expect(done.body.status).toBe('DELIVERED');
  });

  it('bloque un livreur au-delà du plafond d’espèces', async () => {
    const koffiId = (await ds.query(`SELECT id FROM users WHERE phone = '+2250704040404'`))[0].id;
    await ds.query(`UPDATE courier_profiles SET "cashHeld" = 50000 WHERE "userId" = $1`, [koffiId]);
    const o = await http.post('/api/orders').set(auth('client'))
      .send({ shopId, deliveryMode: 'PLATFORM', addressId, paymentMethod: 'CASH', items: [{ productId: products[2].id, quantity: 1 }] })
      .expect(201);
    await http.post(`/api/merchant/orders/${o.body.id}/accept`).set(auth('awa')).expect(201);
    expect((await http.get('/api/courier/offers').set(auth('koffi'))).body).toHaveLength(0);
    expect((await http.get('/api/courier/wallet').set(auth('koffi'))).body.blocked).toBe(true);
    await ds.query(`UPDATE courier_profiles SET "cashHeld" = 0 WHERE "userId" = $1`, [koffiId]);
    // Annulation après confirmation : payante
    const c = await http.post(`/api/orders/${o.body.id}/cancel`).set(auth('client')).send({ reason: 'Changé d’avis' }).expect(201);
    expect(c.body.status).toBe('CANCELLED');
    expect(c.body.cancellationFee).toBe(500);
  });

  it('gère le paiement Mobile Money (Wave) via l’agrégateur', async () => {
    const o = await http.post('/api/orders').set(auth('client'))
      .send({ shopId, deliveryMode: 'PICKUP', paymentMethod: 'WAVE', items: [{ productId: products[3].id, quantity: 2 }] })
      .expect(201);
    expect(o.body.status).toBe('AWAITING_PAYMENT');
    expect(o.body.deliveryFee).toBe(0);
    expect(o.body.payment.providerRef).toMatch(/^SIM-/);
    // Le commerçant ne voit pas encore la commande
    const before = await http.get('/api/merchant/orders').set(auth('awa')).expect(200);
    expect(before.body.find((x: any) => x.id === o.body.id)).toBeUndefined();
    // Notification non signée refusée
    await http.post('/api/payments/webhook/simulated').send({ providerRef: o.body.payment.providerRef, status: 'PAID' }).expect(401);
    await http.post(`/api/payments/simulate/${o.body.id}/success`).set(auth('client')).expect(200);
    const after = await http.get(`/api/orders/${o.body.id}`).set(auth('client')).expect(200);
    expect(after.body.status).toBe('PENDING');
    expect(after.body.paymentStatus).toBe('PAID');
    // Retrait au commerce
    await http.post(`/api/merchant/orders/${o.body.id}/accept`).set(auth('awa')).expect(201);
    await http.post(`/api/merchant/orders/${o.body.id}/ready`).set(auth('awa')).expect(201);
    const done = await http.post(`/api/orders/${o.body.id}/deliver`).set(auth('awa')).send({ code: after.body.deliveryCode }).expect(201);
    expect(done.body.status).toBe('DELIVERED');
  });

  it('propose un remplacement que le client accepte', async () => {
    const o = await http.post('/api/orders').set(auth('client'))
      .send({ shopId, deliveryMode: 'PICKUP', paymentMethod: 'CASH', items: [{ productId: products[0].id, quantity: 1 }, { productId: products[5].id, quantity: 2 }] })
      .expect(201);
    const itemId = o.body.items.find((i: any) => i.productId === products[0].id).id;
    await http.post(`/api/merchant/orders/${o.body.id}/substitutions`).set(auth('awa'))
      .send({ substitutions: [{ itemId, substituteProductId: products[2].id }] }).expect(201);
    expect((await rawOrder(o.body.id)).status).toBe('AWAITING_CLIENT');
    const r = await http.post(`/api/orders/${o.body.id}/substitutions/respond`).set(auth('client')).send({ accept: true }).expect(201);
    expect(r.body.status).toBe('CONFIRMED');
    expect(r.body.subtotal).toBe(products[2].price + products[5].price * 2);
  });

  it('inscription assistée d’un commerçant par un agent terrain puis validation admin', async () => {
    const nbs = await http.get('/api/cities/gagnoa/neighborhoods').expect(200);
    const created = await http.post('/api/agent/merchants').set(auth('agent')).send({
      ownerPhone: '01 08 08 08 08', ownerName: 'Adjoua N’Guessan', name: 'Étal Maman Adjoua', category: 'MARCHE',
      neighborhoodId: nbs.body[0].id, lat: 6.142, lng: -5.958, mobileMoneyNumber: '+2250108080808',
    }).expect(201);
    expect(created.body.status).toBe('PENDING');
    const mine = await http.get('/api/agent/shops').set(auth('agent')).expect(200);
    expect(mine.body.map((s: any) => s.id)).toContain(created.body.id);
    await http.post(`/api/merchant/shops/${created.body.id}/products/bulk`).set(auth('agent'))
      .send({ products: [{ name: 'Tomates (tas)', price: 500 }, { name: 'Piment (tas)', price: 200 }] }).expect(201);
    expect((await http.get('/api/shops').query({ q: 'Adjoua' })).body).toHaveLength(0);
    await http.post(`/api/admin/shops/${created.body.id}/status`).set(auth('admin')).send({ status: 'ACTIVE' }).expect(201);
    expect((await http.get('/api/shops').query({ q: 'Adjoua' })).body).toHaveLength(1);
    // Commission offerte les 2 premiers mois
    expect(new Date(created.body.commissionFreeUntil).getTime()).toBeGreaterThan(Date.now() + 50 * 86400000);
  });

  it('accepte l’envoi d’une photo de portail et refuse les autres formats', async () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
    const ok = await http.post('/api/uploads').set(auth('client')).attach('file', png, { filename: 'portail.png', contentType: 'image/png' }).expect(201);
    expect(ok.body.url).toMatch(/^\/uploads\/.+\.png$/);
    await http.post('/api/uploads').set(auth('client'))
      .attach('file', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/octet-stream' }).expect(400);
    await http.post('/api/uploads').attach('file', png, { filename: 'p.png', contentType: 'image/png' }).expect(401);
  });

  it('un nouveau livreur reste en attente de validation', async () => {
    const t = await login('0709090909', 'COURIER');
    await http.post('/api/courier/online').set({ Authorization: `Bearer ${t}` }).send({ online: true }).expect(403);
  });

  it('donne à l’admin les tableaux de bord, la carte en direct et l’export comptable', async () => {
    const d = await http.get('/api/admin/dashboard').set(auth('admin')).expect(200);
    expect(d.body.totals.orders).toBeGreaterThanOrEqual(5);
    expect(d.body.totals.delivered).toBeGreaterThanOrEqual(3);
    expect(d.body.perNeighborhood.length).toBeGreaterThan(0);
    const live = await http.get('/api/admin/live').set(auth('admin')).expect(200);
    expect(live.body.couriers.length).toBe(2);
    const csv = await http.get('/api/admin/finance/export.csv').set(auth('admin')).expect(200);
    expect(csv.text.split('\n')[0]).toContain('reference;createdAt');
    await http.get('/api/admin/dashboard').set(auth('client')).expect(403);
  });

  it('montre à l’admin les reversements et réclamations avec les noms', async () => {
    await http.post('/api/merchant/payouts').set(auth('awa')).send({ amount: 500 }).expect(201);
    const payouts = await http.get('/api/admin/finance/payouts?status=REQUESTED').set(auth('admin')).expect(200);
    expect(payouts.body.find((p: any) => p.accountType === 'SHOP').accountName).toBe('Boutique Chez Awa');

    const orderId = (await ds.query(`SELECT o.id FROM orders o JOIN users u ON u.id = o."clientId" WHERE u.phone = '+2250706060606' LIMIT 1`))[0].id;
    await http.post('/api/tickets').set(auth('client')).send({ orderId, subject: 'Produit manquant', message: 'Il manque l’eau' }).expect(201);
    const tickets = await http.get('/api/admin/tickets').set(auth('admin')).expect(200);
    const t = tickets.body.find((x: any) => x.subject === 'Produit manquant');
    expect(t.user.phone).toBe('+2250706060606');
    expect(t.order.reference).toMatch(/^GAG-/);
  });

  it('l’admin affecte une commande à un livreur et l’affectation apparaît dans l’historique', async () => {
    const o = await http.post('/api/orders').set(auth('client'))
      .send({ shopId, deliveryMode: 'PLATFORM', addressId, paymentMethod: 'CASH', items: [{ productId: products[2].id, quantity: 1 }] })
      .expect(201);
    await http.post(`/api/merchant/orders/${o.body.id}/accept`).set(auth('awa')).expect(201);
    const ibrahimId = (await ds.query(`SELECT id FROM users WHERE phone = '+2250505050505'`))[0].id;
    const r = await http.post(`/api/admin/orders/${o.body.id}/assign`).set(auth('admin')).send({ courierId: ibrahimId }).expect(201);
    expect(r.body.courierId).toBe(ibrahimId);
    expect(r.body.timeline.map((e: any) => e.type)).toContain('COURIER_FORCED');
    await http.post(`/api/admin/orders/${o.body.id}/cancel`).set(auth('admin')).send({ reason: 'Test', fee: 0 }).expect(201);
  });
});
