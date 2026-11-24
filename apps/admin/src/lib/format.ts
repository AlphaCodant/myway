const nf = new Intl.NumberFormat('fr-FR');

/** 1500 → « 1 500 F » (espaces normales pour un rendu identique partout). */
export const fcfa = (n: number | null | undefined) => `${nf.format(n ?? 0).replace(/[  ]/g, ' ')} F`;

export const dateTime = (d: string | Date | null | undefined) =>
  !d ? '—' : new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

/** « il y a 12 min » */
export function ago(d: string | Date | null | undefined, now = Date.now()) {
  if (!d) return '—';
  const min = Math.round((now - new Date(d).getTime()) / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h ${String(min % 60).padStart(2, '0')}`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export const orderStatus: Record<string, string> = {
  AWAITING_PAYMENT: 'Attente paiement',
  PENDING: 'Attente commerçant',
  AWAITING_CLIENT: 'Remplacement proposé',
  CONFIRMED: 'En préparation',
  READY: 'Prête',
  PICKED_UP: 'En livraison',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  RETURNED: 'Retournée',
};

export const dispatchStatus: Record<string, string> = {
  NONE: '—',
  SEARCHING: 'Recherche livreur',
  ASSIGNED: 'Livreur affecté',
  NO_COURIER: 'Aucun livreur',
};

export const accountStatus: Record<string, string> = { ACTIVE: 'Actif', PENDING: 'À valider', SUSPENDED: 'Suspendu' };

export const roles: Record<string, string> = {
  CLIENT: 'Client',
  MERCHANT: 'Commerçant',
  COURIER: 'Livreur',
  AGENT: 'Agent terrain',
  ADMIN: 'Administrateur',
};

export const categories: Record<string, string> = {
  ALIMENTATION: 'Alimentation',
  RESTAURANT: 'Maquis & restos',
  PHARMACIE: 'Pharmacie',
  QUINCAILLERIE: 'Quincaillerie',
  MARCHE: 'Marché',
  SUPERMARCHE: 'Supermarché',
};

export const payment: Record<string, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  MTN_MOMO: 'MTN MoMo',
  MOOV_MONEY: 'Moov Money',
  WAVE: 'Wave',
};

export const deliveryMode: Record<string, string> = { PLATFORM: 'Livreur MyWay', MERCHANT: 'Par le commerce', PICKUP: 'Retrait' };

export const vehicles: Record<string, string> = { MOTO: 'Moto', VELO: 'Vélo', PIED: 'À pied' };

export const timelineLabels: Record<string, string> = {
  CREATED: 'Commande passée',
  PAID: 'Paiement reçu',
  CONFIRMED: 'Acceptée par le commerçant',
  PAYMENT_FAILED: 'Paiement échoué',
  SUBSTITUTION_PROPOSED: 'Remplacement proposé',
  SUBSTITUTION_ACCEPTED: 'Remplacement accepté',
  READY: 'Prête',
  COURIER_ASSIGNED: 'Livreur affecté',
  COURIER_FORCED: 'Livreur affecté par l’admin',
  SELF_DELIVERY: 'Livrée par le commerce',
  SWITCHED_TO_PICKUP: 'Passée en retrait',
  PICKED_UP: 'Récupérée',
  CLIENT_CALL_ATTEMPT: 'Appel client sans réponse',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
  RETURNED: 'Retournée au commerce',
  GPS_CORRECTED: 'Point GPS corrigé',
};

/** Libellés des paramètres métier modifiables. */
export const settingLabels: Record<string, { label: string; unit?: string }> = {
  courierCashCeiling: { label: 'Plafond d’espèces d’un livreur', unit: 'F' },
  courierSharePercent: { label: 'Part des frais de livraison pour le livreur', unit: '%' },
  maxDeliveryDistanceMeters: { label: 'Distance de livraison maximale', unit: 'm' },
  dispatchRadiusMeters: { label: 'Rayon de recherche des livreurs', unit: 'm' },
  offerTimeoutSeconds: { label: 'Délai pour accepter une course', unit: 's' },
  merchantReminderMinutes: { label: 'Rappel au commerçant après', unit: 'min' },
  cancellationFeeAfterConfirm: { label: 'Frais d’annulation après confirmation', unit: 'F' },
  unreachableCallAttempts: { label: 'Appels avant « client injoignable »' },
  unreachableWaitMinutes: { label: 'Attente avant retour du colis', unit: 'min' },
  commissionFreeMonths: { label: 'Mois sans commission pour un nouveau commerce' },
  defaultCommissionPercent: { label: 'Commission par défaut', unit: '%' },
};
