import { Body, Controller, Get, Headers, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/auth/auth.decorators';
import { PaymentsService } from '../payments/payments.service';
import { SimulatedPaymentProvider } from '../payments/simulated.provider';
import { ShopsService } from '../shops/shops.service';
import { DispatchService } from './dispatch.service';
import {
  CancelDto, CorrectLocationDto, CreateOrderDto, DeliverDto, ListOrdersQuery, ProposeSubstitutionsDto, QuoteDto, RateDto,
  RespondSubstitutionsDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('Commandes : client')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** Calcule le total (produits + frais de livraison) avant de commander. */
  @Post('quote') @HttpCode(200)
  quote(@CurrentUser() me: AuthUser, @Body() dto: QuoteDto) {
    return this.orders.quote(me.id, dto);
  }

  @Post()
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(me, dto);
  }

  @Get('mine')
  mine(@CurrentUser() me: AuthUser) {
    return this.orders.listForClient(me.id);
  }

  @Get(':id')
  get(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.getForUser(me, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.orders.cancelByClient(me, id, dto.reason);
  }

  @Post(':id/substitutions/respond')
  respond(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: RespondSubstitutionsDto) {
    return this.orders.respondSubstitutions(me, id, dto.accept);
  }

  /** Aucun livreur : le client vient retirer (« click & collect »). */
  @Post(':id/pickup-instead')
  pickup(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.switchToPickup(me, id);
  }

  @Post(':id/rating')
  rate(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: RateDto) {
    return this.orders.rate(me, id, dto);
  }

  // Actions de remise : livreur (plateforme) ou commerçant (livraison par ses soins / retrait)

  @Post(':id/picked-up')
  pickedUp(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.pickUp(me, id);
  }

  @Post(':id/call-attempt')
  callAttempt(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.callAttempt(me, id);
  }

  @Post(':id/deliver')
  deliver(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: DeliverDto) {
    return this.orders.deliver(me, id, dto.code);
  }

  @Post(':id/return')
  returnToShop(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.returnToShop(me, id);
  }

  @Post(':id/correct-location')
  correct(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: CorrectLocationDto) {
    return this.orders.correctLocation(me, id, dto.lat, dto.lng);
  }
}

@ApiTags('Commandes : commerçant')
@ApiBearerAuth()
@Roles(Role.MERCHANT)
@Controller('merchant/orders')
export class MerchantOrdersController {
  constructor(private readonly orders: OrdersService, private readonly shops: ShopsService) {}

  @Get()
  async list(@CurrentUser() me: AuthUser, @Query() q: ListOrdersQuery) {
    const shop = await this.shops.findOwned(me.id);
    return this.orders.listForShop(shop.id, q.status, q.limit);
  }

  @Post(':id/accept')
  accept(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.accept(me, id);
  }

  @Post(':id/reject')
  reject(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: CancelDto) {
    return this.orders.reject(me, id, dto.reason);
  }

  @Post(':id/substitutions')
  substitutions(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: ProposeSubstitutionsDto) {
    return this.orders.proposeSubstitutions(me, id, dto);
  }

  @Post(':id/ready')
  ready(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.markReady(me, id);
  }

  @Post(':id/self-deliver')
  selfDeliver(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.orders.merchantSelfDeliver(me, id);
  }
}

@ApiTags('Courses : livreur')
@ApiBearerAuth()
@Roles(Role.COURIER)
@Controller('courier')
export class CourierOrdersController {
  constructor(private readonly orders: OrdersService, private readonly dispatch: DispatchService) {}

  @Get('offers')
  offers(@CurrentUser() me: AuthUser) {
    return this.dispatch.pendingOffersFor(me.id);
  }

  @Post('offers/:offerId/accept')
  accept(@CurrentUser() me: AuthUser, @Param('offerId') offerId: string) {
    return this.orders.acceptOffer(me, offerId);
  }

  @Post('offers/:offerId/decline')
  decline(@CurrentUser() me: AuthUser, @Param('offerId') offerId: string) {
    return this.dispatch.decline(me.id, offerId);
  }

  @Get('orders')
  list(@CurrentUser() me: AuthUser, @Query('active') active?: string) {
    return this.orders.listForCourier(me.id, active !== 'false');
  }
}

@ApiTags('Paiements')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  /** Notification de l'agrégateur (Orange Money, MTN MoMo, Moov Money, Wave). */
  @Public() @Post('webhook/:provider') @HttpCode(200)
  async webhook(@Param('provider') provider: string, @Headers() headers: Record<string, string>, @Body() body: any) {
    const { payment, changed } = await this.payments.handleWebhook(provider, headers, body);
    if (changed) await this.orders.onPaymentResult(payment.orderId, payment.status);
    return { ok: true };
  }

  /** Développement uniquement : simule la validation du paiement par le client sur son téléphone. */
  @ApiBearerAuth() @Post('simulate/:orderId/:result') @HttpCode(200)
  async simulate(@Param('orderId') orderId: string, @Param('result') result: 'success' | 'failure') {
    if (this.config.get('NODE_ENV') === 'production') throw new NotFoundException();
    const payment = await this.payments.latestForOrder(orderId);
    if (!payment || payment.provider !== 'simulated') throw new NotFoundException('Paiement simulé introuvable');
    const body = { providerRef: payment.providerRef, status: result === 'success' ? 'PAID' : 'FAILED' };
    const sim = this.payments.provider('simulated') as SimulatedPaymentProvider;
    return this.webhook('simulated', { 'x-signature': sim.sign(body) }, body);
  }
}
