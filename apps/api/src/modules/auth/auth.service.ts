import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { CourierProfile, OtpCode, User } from '../../database/entities';
import { AccountStatus, Role } from '../../common/enums';
import { normalizeCiPhone } from '../../common/phone';
import { SmsService } from '../notifications/sms.service';

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_HOUR = 5;

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly sms: SmsService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(OtpCode) private readonly otps: Repository<OtpCode>,
    @InjectRepository(CourierProfile) private readonly couriers: Repository<CourierProfile>,
  ) {}

  async requestOtp(rawPhone: string) {
    const phone = normalizeCiPhone(rawPhone);
    const recent = await this.otps.count({ where: { phone, createdAt: MoreThan(new Date(Date.now() - 3600_000)) } });
    if (recent >= MAX_REQUESTS_PER_HOUR) {
      throw new HttpException('Trop de demandes de code. Réessaie dans une heure.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.otps.update({ phone, used: false }, { used: true });
    await this.otps.save(this.otps.create({ phone, codeHash: hash(phone + code), expiresAt: new Date(Date.now() + OTP_TTL_MS) }));
    await this.sms.send(phone, `Ton code de connexion est ${code}. Il expire dans 5 minutes. Ne le partage avec personne.`);
    const devMode = this.config.get('OTP_DEV_MODE') === 'true' && this.config.get('NODE_ENV') !== 'production';
    return { phone, expiresInSeconds: OTP_TTL_MS / 1000, ...(devMode ? { devCode: code } : {}) };
  }

  async verifyOtp(rawPhone: string, code: string, as: 'CLIENT' | 'COURIER' = 'CLIENT') {
    const phone = normalizeCiPhone(rawPhone);
    const otp = await this.otps.findOne({ where: { phone, used: false }, order: { createdAt: 'DESC' } });
    if (!otp || otp.expiresAt < new Date()) throw new BadRequestException('Code expiré, demande un nouveau code');
    if (otp.attempts >= MAX_ATTEMPTS) throw new BadRequestException('Trop d’essais, demande un nouveau code');
    if (otp.codeHash !== hash(phone + code)) {
      await this.otps.increment({ id: otp.id }, 'attempts', 1);
      throw new BadRequestException('Code incorrect');
    }
    await this.otps.update({ id: otp.id }, { used: true });

    let user = await this.users.findOneBy({ phone });
    let isNew = false;
    if (!user) {
      isNew = true;
      const role = as === 'COURIER' ? Role.COURIER : Role.CLIENT;
      user = await this.users.save(
        this.users.create({ phone, role, status: role === Role.COURIER ? AccountStatus.PENDING : AccountStatus.ACTIVE }),
      );
      if (role === Role.COURIER) await this.couriers.save(this.couriers.create({ userId: user.id }));
    }
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, user, isNew };
  }

  me(id: string) {
    return this.users.findOneByOrFail({ id });
  }

  async updateMe(id: string, patch: Partial<User>) {
    await this.users.update({ id }, patch);
    return this.me(id);
  }
}
