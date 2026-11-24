import { UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { Order, Payment } from '../../database/entities';
import { InitiateResult, PaymentProvider, WebhookResult } from './payment-provider';

/**
 * Agrégateur simulé pour le développement et les tests.
 * Le webhook doit être signé : en-tête x-signature = HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, corps JSON).
 */
export class SimulatedPaymentProvider implements PaymentProvider {
  readonly name = 'simulated';
  constructor(private readonly secret: string) {}

  async initiate(payment: Payment, _order: Order): Promise<InitiateResult> {
    return { providerRef: `SIM-${payment.id}`, checkoutUrl: null };
  }

  sign(body: unknown) {
    return createHmac('sha256', this.secret).update(JSON.stringify(body)).digest('hex');
  }

  async parseWebhook(headers: Record<string, string | string[] | undefined>, body: any): Promise<WebhookResult> {
    const given = String(headers['x-signature'] ?? '');
    const expected = this.sign(body);
    if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
      throw new UnauthorizedException('Signature de notification invalide');
    }
    return { providerRef: body.providerRef, status: body.status, raw: body };
  }

  async refund() {}
}
