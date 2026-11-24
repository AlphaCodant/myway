import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Public } from '../../common/auth/auth.decorators';
import { RequestOtpDto, UpdateMeDto, VerifyOtpDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Envoie un code SMS à 6 chiffres. */
  @Public() @Post('otp/request') @HttpCode(200)
  request(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  /** Vérifie le code et renvoie un jeton ; crée le compte à la première connexion. */
  @Public() @Post('otp/verify') @HttpCode(200)
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code, dto.as);
  }

  @ApiBearerAuth() @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @ApiBearerAuth() @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.auth.updateMe(user.id, dto);
  }
}
