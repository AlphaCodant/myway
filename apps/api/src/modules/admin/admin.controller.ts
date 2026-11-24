import { Body, Controller, Get, Header, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AccountStatus, PayoutStatus, Role, TicketStatus } from '../../common/enums';
import { AuthUser, CurrentUser, Roles } from '../../common/auth/auth.decorators';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import {
  AdminCancelDto, AssignDto, CityDto, CommissionsDto, CreateStaffDto, NeighborhoodDto, OrdersQuery, PayoutPayDto, PeriodQuery,
  RemittanceDto, ResolveTicketDto, SettingDto, ShopAdminPatchDto, StatusDto, TariffsDto, UsersQuery,
} from './admin.dto';
import { AdminService } from './admin.service';

@ApiTags('Console d’administration')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly orders: OrdersService,
    private readonly settings: SettingsService,
  ) {}

  // Comptes
  @Get('users') users(@Query() q: UsersQuery) { return this.admin.listUsers(q); }
  @Post('users/:id/status') userStatus(@Param('id') id: string, @Body() dto: StatusDto) { return this.admin.setUserStatus(id, dto.status, dto.reason); }
  @Post('staff') staff(@Body() dto: CreateStaffDto) { return this.admin.createStaff(dto); }
  @Get('shops') shops(@Query('status') status?: AccountStatus) { return this.admin.listShops(status); }
  @Post('shops/:id/status') shopStatus(@Param('id') id: string, @Body() dto: StatusDto) { return this.admin.setShopStatus(id, dto.status); }
  @Patch('shops/:id') patchShop(@Param('id') id: string, @Body() dto: ShopAdminPatchDto) { return this.admin.patchShop(id, dto); }
  @Get('couriers') couriers(@Query('status') status?: AccountStatus) { return this.admin.listCouriers(status); }

  // Supervision des commandes
  @Get('orders') listOrders(@Query() q: OrdersQuery) { return this.admin.listOrders(q); }
  @Get('orders/:id') order(@CurrentUser() me: AuthUser, @Param('id') id: string) { return this.orders.getForUser(me, id); }
  @Post('orders/:id/assign')
  assign(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.orders.adminAssign(me, id, dto.courierId);
  }
  @Post('orders/:id/cancel')
  cancel(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: AdminCancelDto) {
    return this.orders.adminCancel(me, id, dto.reason, dto.fee ?? 0);
  }
  @Get('live') live() { return this.admin.live(); }

  // Zones et tarifs
  @Get('cities') cities() { return this.admin.allCities(); }
  @Post('cities') createCity(@Body() dto: CityDto) { return this.admin.upsertCity(dto); }
  @Put('cities/:id') updateCity(@Param('id') id: string, @Body() dto: CityDto) { return this.admin.upsertCity(dto, id); }
  @Post('neighborhoods') createNb(@Body() dto: NeighborhoodDto) { return this.admin.upsertNeighborhood(dto); }
  @Put('neighborhoods/:id') updateNb(@Param('id') id: string, @Body() dto: NeighborhoodDto) { return this.admin.upsertNeighborhood(dto, id); }
  @Get('cities/:id/tariffs') tariffs(@Param('id') id: string) { return this.admin.getTariffs(id); }
  @Put('cities/:id/tariffs') setTariffs(@Param('id') id: string, @Body() dto: TariffsDto) { return this.admin.setTariffs(id, dto); }
  @Get('commissions') commissions() { return this.admin.getCommissions(); }
  @Put('commissions') setCommissions(@Body() dto: CommissionsDto) { return this.admin.setCommissions(dto); }
  @Get('settings') allSettings() { return this.settings.all(); }
  @Put('settings/:key') setSetting(@Param('key') key: string, @Body() dto: SettingDto) { return this.admin.setSetting(key, dto.value); }

  // Support et litiges
  @Get('tickets') tickets(@Query('status') status?: TicketStatus) { return this.admin.listTickets(status); }
  @Post('tickets/:id/resolve')
  resolve(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: ResolveTicketDto) {
    return this.admin.resolveTicket(me.id, id, dto.refundAmount, dto.message);
  }

  // Finances
  @Get('finance/balances') balances() { return this.admin.balances(); }
  @Post('finance/remittances') remit(@CurrentUser() me: AuthUser, @Body() dto: RemittanceDto) { return this.admin.recordRemittance(me.id, dto); }
  @Get('finance/payouts') payouts(@Query('status') status?: PayoutStatus) { return this.admin.listPayouts(status); }
  @Post('finance/payouts/:id/pay') pay(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: PayoutPayDto) {
    return this.admin.payPayout(me.id, id, dto.providerRef);
  }
  @Post('finance/payouts/:id/reject') reject(@CurrentUser() me: AuthUser, @Param('id') id: string) { return this.admin.rejectPayout(me.id, id); }
  @Get('finance/export.csv') @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="commandes.csv"')
  export(@Query() q: PeriodQuery) { return this.admin.exportCsv(q.from, q.to); }

  // Tableaux de bord
  @Get('dashboard') dashboard(@Query('days') days?: string) { return this.admin.dashboard(days ? Number(days) : 7); }
}
