export enum Role {
  CLIENT = 'CLIENT',
  MERCHANT = 'MERCHANT',
  COURIER = 'COURIER',
  AGENT = 'AGENT', // agent terrain : inscrit les commerçants
  ADMIN = 'ADMIN',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  PENDING = 'PENDING', // en attente de validation par l'admin
  SUSPENDED = 'SUSPENDED',
}

export enum ShopCategory {
  ALIMENTATION = 'ALIMENTATION',
  RESTAURANT = 'RESTAURANT', // maquis et restaurants
  PHARMACIE = 'PHARMACIE', // produits sans ordonnance uniquement
  QUINCAILLERIE = 'QUINCAILLERIE',
  MARCHE = 'MARCHE', // vendeuses de marché
  SUPERMARCHE = 'SUPERMARCHE',
}

export enum VehicleType {
  MOTO = 'MOTO',
  VELO = 'VELO',
  PIED = 'PIED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ORANGE_MONEY = 'ORANGE_MONEY',
  MTN_MOMO = 'MTN_MOMO',
  MOOV_MONEY = 'MOOV_MONEY',
  WAVE = 'WAVE',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum DeliveryMode {
  PLATFORM = 'PLATFORM', // livreur de la plateforme
  MERCHANT = 'MERCHANT', // « je livre moi-même »
  PICKUP = 'PICKUP', // click & collect
}

export enum OrderStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT', // Mobile Money en attente de confirmation
  PENDING = 'PENDING', // en attente de confirmation du commerçant
  AWAITING_CLIENT = 'AWAITING_CLIENT', // remplacement proposé, en attente du client
  CONFIRMED = 'CONFIRMED', // confirmée, en préparation
  READY = 'READY', // prête à être récupérée
  PICKED_UP = 'PICKED_UP', // en route vers le client
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED', // client injoignable, colis retourné
}

export enum DispatchStatus {
  NONE = 'NONE',
  SEARCHING = 'SEARCHING',
  ASSIGNED = 'ASSIGNED',
  NO_COURIER = 'NO_COURIER',
}

export enum OfferStatus {
  OFFERED = 'OFFERED',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  EXPIRED = 'EXPIRED',
}

export enum ItemStatus {
  OK = 'OK',
  SUBSTITUTION_PROPOSED = 'SUBSTITUTION_PROPOSED',
  SUBSTITUTED = 'SUBSTITUTED',
  REMOVED = 'REMOVED',
}

export enum LedgerAccount {
  SHOP = 'SHOP',
  COURIER = 'COURIER',
}

export enum LedgerKind {
  SALE = 'SALE', // + montant des produits vendus
  COMMISSION = 'COMMISSION', // - commission de la plateforme
  DELIVERY_FEE = 'DELIVERY_FEE', // + frais de livraison (commerçant qui livre lui-même)
  DELIVERY_EARNING = 'DELIVERY_EARNING', // + gain du livreur
  CANCELLATION_FEE = 'CANCELLATION_FEE',
  CASH_COLLECTED = 'CASH_COLLECTED', // - espèces encaissées directement par le commerçant
  REFUND = 'REFUND',
  PAYOUT = 'PAYOUT', // - reversement Mobile Money effectué
}

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
}

export enum RatingTarget {
  SHOP = 'SHOP',
  COURIER = 'COURIER',
}

export enum LandmarkType {
  MOSQUEE = 'MOSQUEE',
  EGLISE = 'EGLISE',
  ECOLE = 'ECOLE',
  PHARMACIE = 'PHARMACIE',
  CARREFOUR = 'CARREFOUR',
  MARCHE = 'MARCHE',
  AUTRE = 'AUTRE',
}

export enum PayoutStatus {
  REQUESTED = 'REQUESTED',
  PAID = 'PAID',
  REJECTED = 'REJECTED',
}
