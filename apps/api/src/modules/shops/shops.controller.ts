import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums';
import { AuthUser, CurrentUser, Public, Roles } from '../../common/auth/auth.decorators';
import {
  BulkProductsDto, ListShopsQuery, OnboardMerchantDto, ProductDto, SetAvailableDto, SetOpenDto, UpdateProductDto, UpdateShopDto,
} from './shops.dto';
import { ShopsService, serializeShop } from './shops.service';

@ApiTags('Commerces (catalogue public)')
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Public() @Get()
  list(@Query() q: ListShopsQuery) {
    return this.shops.list(q);
  }

  @Public() @Get(':id')
  get(@Param('id') id: string) {
    return this.shops.getPublic(id);
  }
}

@ApiTags('Commerçant : mon commerce et catalogue')
@ApiBearerAuth()
@Roles(Role.MERCHANT, Role.AGENT)
@Controller('merchant/shops')
export class MerchantShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Get('mine')
  async mine(@CurrentUser() me: AuthUser) {
    const shop = await this.shops.findOwned(me.id);
    return { ...serializeShop(shop), mobileMoneyNumber: shop.mobileMoneyNumber };
  }

  @Patch(':shopId')
  async update(@CurrentUser() me: AuthUser, @Param('shopId') shopId: string, @Body() dto: UpdateShopDto) {
    return this.shops.update(await this.shops.assertCanManage(me, shopId), dto);
  }

  /** Bouton « ouvert / fermé ». */
  @Post(':shopId/open')
  async setOpen(@CurrentUser() me: AuthUser, @Param('shopId') shopId: string, @Body() dto: SetOpenDto) {
    return this.shops.setOpen(await this.shops.assertCanManage(me, shopId), dto.isOpen);
  }

  @Get(':shopId/products')
  async products(@CurrentUser() me: AuthUser, @Param('shopId') shopId: string) {
    await this.shops.assertCanManage(me, shopId);
    return this.shops.listProducts(shopId);
  }

  @Post(':shopId/products')
  async addProduct(@CurrentUser() me: AuthUser, @Param('shopId') shopId: string, @Body() dto: ProductDto) {
    await this.shops.assertCanManage(me, shopId);
    const [p] = await this.shops.addProducts(shopId, [dto]);
    return p;
  }

  /** Import de plusieurs produits d'un coup (agent terrain). */
  @Post(':shopId/products/bulk')
  async bulk(@CurrentUser() me: AuthUser, @Param('shopId') shopId: string, @Body() dto: BulkProductsDto) {
    await this.shops.assertCanManage(me, shopId);
    return this.shops.addProducts(shopId, dto.products);
  }

  @Patch(':shopId/products/:productId')
  async updateProduct(
    @CurrentUser() me: AuthUser, @Param('shopId') shopId: string, @Param('productId') productId: string, @Body() dto: UpdateProductDto,
  ) {
    await this.shops.assertCanManage(me, shopId);
    return this.shops.updateProduct(shopId, productId, dto);
  }

  /** Rupture de stock en un clic. */
  @Post(':shopId/products/:productId/availability')
  async availability(
    @CurrentUser() me: AuthUser, @Param('shopId') shopId: string, @Param('productId') productId: string, @Body() dto: SetAvailableDto,
  ) {
    await this.shops.assertCanManage(me, shopId);
    return this.shops.updateProduct(shopId, productId, { available: dto.available });
  }

  @Delete(':shopId/products/:productId')
  async remove(@CurrentUser() me: AuthUser, @Param('shopId') shopId: string, @Param('productId') productId: string) {
    await this.shops.assertCanManage(me, shopId);
    return this.shops.archiveProduct(shopId, productId);
  }
}

@ApiTags('Agent terrain : inscription assistée')
@ApiBearerAuth()
@Roles(Role.AGENT)
@Controller('agent')
export class AgentController {
  constructor(private readonly shops: ShopsService) {}

  /** Crée le compte du commerçant et sa boutique (en attente de validation par l'admin). */
  @Post('merchants')
  onboard(@CurrentUser() me: AuthUser, @Body() dto: OnboardMerchantDto) {
    return this.shops.onboard(me.id, dto);
  }
}
