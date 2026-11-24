import { Order, Payment } from '../../database/entities';

export interface InitiateResult {
  providerRef: string;
  /** Page de paiement de l'agrégateur où le client valide avec son Mobile Money. */
  checkoutUrl: string | null;
}

export interface WebhookResult {
  providerRef: string;
  status: 'PAID' | 'FAILED' | 'PENDING';
  raw: unknown;
}

/**
 * Un agrégateur agréé (CinetPay, PayDunya, Hub2…) couvre Orange Money, MTN MoMo, Moov Money et Wave
 * en une seule intégration. La plateforme ne détient jamais les fonds.
 */
export interface PaymentProvider {
  readonly name: string;
  initiate(payment: Payment, order: Order, customerPhone: string): Promise<InitiateResult>;
  /** Vérifie la notification reçue (signature ou re-vérification auprès de l'agrégateur). */
  parseWebhook(headers: Record<string, string | string[] | undefined>, body: any): Promise<WebhookResult>;
  refund(payment: Payment, amount: number): Promise<void>;
}
