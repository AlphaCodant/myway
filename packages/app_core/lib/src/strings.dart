/// Textes communs aux applications.
class CoreText {
  static const appName = 'MyWay';
  static const retry = 'Réessayer';
  static const errorGeneric = 'Une erreur est survenue. Réessaie.';
  static const networkError = 'Connexion impossible. Vérifie ton réseau.';
  static const offline = 'Pas de réseau : affichage des données enregistrées';
  static const logout = 'Se déconnecter';
}

const statusLabels = {
  'AWAITING_PAYMENT': 'En attente du paiement',
  'PENDING': 'En attente du commerçant',
  'AWAITING_CLIENT': 'Remplacement proposé',
  'CONFIRMED': 'Confirmée, en préparation',
  'READY': 'Prête',
  'PICKED_UP': 'En route vers le client',
  'DELIVERED': 'Livrée',
  'CANCELLED': 'Annulée',
  'RETURNED': 'Retournée au commerce',
};

const categoryLabels = {
  'ALIMENTATION': 'Alimentation',
  'RESTAURANT': 'Maquis & restos',
  'PHARMACIE': 'Pharmacie',
  'QUINCAILLERIE': 'Quincaillerie',
  'MARCHE': 'Marché',
  'SUPERMARCHE': 'Supermarché',
};

const paymentLabels = {
  'CASH': 'Espèces à la livraison',
  'ORANGE_MONEY': 'Orange Money',
  'MTN_MOMO': 'MTN MoMo',
  'MOOV_MONEY': 'Moov Money',
  'WAVE': 'Wave',
};

const deliveryModeLabels = {
  'PLATFORM': 'Livreur de la plateforme',
  'MERCHANT': 'Livré par le commerce',
  'PICKUP': 'Retrait au commerce',
};
