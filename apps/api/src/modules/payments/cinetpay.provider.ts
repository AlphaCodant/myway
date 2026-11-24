import { Logger } from '@nestjs/common';
import { Order, Payment } from '../../database/entities';
import { PaymentMethod } from '../../common/enums';
import { InitiateResult, PaymentProvider, WebhookResult } from './payment-provider';

const CHANNEL_HINT: Partial<Record<PaymentMethod, string>> = {
  [PaymentMethod.ORANGE_MONEY]: 'OM',
  [PaymentMethod.MTN_MOMO]: 'MOMO',
  [PaymentMethod.MOOV_MONEY]: 'FLOOZ',
  [PaymentMethod.WAVE]: 'WAVE_CI',
};

/**
 * Intégration CinetPay (API checkout v2).
 * ⚠️ Squelette à valider avec la documentation et un compte marchand CinetPay avant la recette :
 * noms de champs, codes de canaux et procédure de remboursement peuvent différer.
 */
export class CinetPayProvider implements PaymentProvider {
  readonly name = 'cinetpay';
  private readonly logger = new Logger('CinetPay');
  private readonly baseUrl = 'https://api-checkout.cinetpay.com/v2';

  constructor(
    private readonly apiKey: string,
    private readonly siteId: string,
    private readonly publicUrl: string,
  ) {}

  async initiate(payment: Payment, order: Order, customerPhone: string): Promise<InitiateResult> {
    const res = await fetch(`${this.baseUrl}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: this.apiKey,
        site_id: this.siteId,
        transaction_id: payment.id,
        amount: payment.amount,
        currency: 'XOF',
        description: `Commande ${order.reference}`,
        customer_phone_number: customerPhone,
        channels: 'MOBILE_MONEY',
        lock_phone_number: false,
        metadata: CHANNEL_HINT[payment.method] ?? '',
        notify_url: `${this.publicUrl}/api/payments/webhook/cinetpay`,
        return_url: `${this.publicUrl}/paiement/retour`,
      }),
    });
    const json: any = await res.json();
    if (json.code !== '201') throw new Error(`CinetPay: ${json.message ?? 'erreur'}`);
    return { providerRef: payment.id, checkoutUrl: json.data?.payment_url ?? null };
  }

  /** CinetPay notifie seulement l'identifiant : on re-vérifie le statut auprès de l'API. */
  async parseWebhook(_headers: Record<string, string | string[] | undefined>, body: any): Promise<WebhookResult> {
    const transactionId = body.cpm_trans_id;
    const res = await fetch(`${this.baseUrl}/payment/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: this.apiKey, site_id: this.siteId, transaction_id: transactionId }),
    });
    const json: any = await res.json();
    const st = json.data?.status;
    return { providerRef: transactionId, status: st === 'ACCEPTED' ? 'PAID' : st === 'REFUSED' ? 'FAILED' : 'PENDING', raw: json };
  }

  async refund(payment: Payment, amount: number) {
    // Remboursement : à traiter via le transfert CinetPay vers le numéro du client (API transfert).
    this.logger.warn(`Remboursement manuel à effectuer : ${amount} FCFA pour le paiement ${payment.id}`);
  }
}
