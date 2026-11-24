import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, Payment } from '../../database/entities';
import { PaymentStatus } from '../../common/enums';
import { CinetPayProvider } from './cinetpay.provider';
import { PaymentProvider } from './payment-provider';
import { SimulatedPaymentProvider } from './simulated.provider';

@Injectable()
export class PaymentsService {
  private readonly providers = new Map<string, PaymentProvider>();
  readonly defaultProvider: string;

  constructor(
    config: ConfigService,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
  ) {
    this.providers.set('simulated', new SimulatedPaymentProvider(config.get('PAYMENT_WEBHOOK_SECRET', 'dev-secret')));
    if (config.get('CINETPAY_API_KEY')) {
      this.providers.set(
        'cinetpay',
        new CinetPayProvider(config.get('CINETPAY_API_KEY')!, config.get('CINETPAY_SITE_ID', ''), config.get('PUBLIC_URL', '')),
      );
    }
    this.defaultProvider = config.get('PAYMENT_PROVIDER', 'simulated');
  }

  provider(name: string): PaymentProvider {
    const p = this.providers.get(name);
    if (!p) throw new BadRequestException(`Moyen de paiement « ${name} » non configuré`);
    return p;
  }

  async initiate(order: Order, customerPhone: string) {
    const provider = this.provider(this.defaultProvider);
    const payment = await this.payments.save(
      this.payments.create({ orderId: order.id, method: order.paymentMethod, provider: provider.name, amount: order.total }),
    );
    const { providerRef, checkoutUrl } = await provider.initiate(payment, order, customerPhone);
    payment.providerRef = providerRef;
    payment.checkoutUrl = checkoutUrl;
    return this.payments.save(payment);
  }

  /** Lit une notification d'agrégateur et met à jour le paiement. Renvoie le paiement et s'il vient de passer à PAID. */
  async handleWebhook(providerName: string, headers: Record<string, any>, body: any) {
    const result = await this.provider(providerName).parseWebhook(headers, body);
    const payment = await this.payments.findOneBy({ provider: providerName, providerRef: result.providerRef });
    if (!payment) throw new NotFoundException('Paiement inconnu');
    const before = payment.status;
    if (before === PaymentStatus.PENDING && result.status !== 'PENDING') {
      payment.status = result.status === 'PAID' ? PaymentStatus.PAID : PaymentStatus.FAILED;
      payment.raw = result.raw;
      await this.payments.save(payment);
    }
    return { payment, changed: before !== payment.status };
  }

  async refund(orderId: string, amount: number) {
    const payment = await this.payments.findOneBy({ orderId, status: PaymentStatus.PAID });
    if (!payment || amount <= 0) return null;
    await this.provider(payment.provider).refund(payment, amount);
    payment.status = PaymentStatus.REFUNDED;
    return this.payments.save(payment);
  }

  latestForOrder(orderId: string) {
    return this.payments.findOne({ where: { orderId }, order: { createdAt: 'DESC' } });
  }
}
