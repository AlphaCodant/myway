import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SmsMessage } from '../../database/entities';

/**
 * Envoi de SMS. En développement (SMS_PROVIDER=console), le message est écrit dans les logs
 * et dans la table sms_outbox. Pour la production, brancher un fournisseur local
 * (ex. API SMS d'un opérateur ou agrégateur) dans sendViaProvider().
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger('SMS');
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(SmsMessage) private readonly outbox: Repository<SmsMessage>,
  ) {}

  async send(phone: string, body: string): Promise<void> {
    const provider = this.config.get('SMS_PROVIDER', 'console');
    let status = 'SENT';
    try {
      await this.sendViaProvider(provider, phone, body);
    } catch (e) {
      status = 'FAILED';
      this.logger.error(`Échec SMS vers ${phone}: ${e}`);
    }
    await this.outbox.save(this.outbox.create({ phone, body, provider, status }));
  }

  private async sendViaProvider(provider: string, phone: string, body: string) {
    if (provider === 'console') {
      this.logger.log(`→ ${phone} : ${body}`);
      return;
    }
    throw new Error(`Fournisseur SMS « ${provider} » non configuré`);
  }
}
