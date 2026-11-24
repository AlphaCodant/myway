/// Textes de l'interface. Fichier séparé pour pouvoir ajouter d'autres langues
/// (dioula, bété…) sans toucher aux écrans.
class T {
  static const appName = 'MyWay';
  static const tagline = 'Les commerces de ton quartier livrés chez toi';

  // Connexion
  static const phoneTitle = 'Ton numéro de téléphone';
  static const phoneHint = '07 01 02 03 04';
  static const phoneHelp = 'On t’envoie un code par SMS. Pas besoin d’email.';
  static const receiveCode = 'Recevoir le code';
  static const codeTitle = 'Entre le code reçu par SMS';
  static const validate = 'Valider';
  static const resend = 'Renvoyer le code';
  static const changeNumber = 'Changer de numéro';

  // Quartier
  static const chooseNeighborhood = 'Choisis ton quartier';
  static const yourNeighborhood = 'Ton quartier';

  // Accueil
  static const searchHint = 'Riz, garba, pharmacie…';
  static const open = 'Ouvert';
  static const closed = 'Fermé';
  static const noShops = 'Aucun commerce trouvé pour le moment.';
  static const offline = 'Pas de réseau : affichage des données enregistrées';
  static const all = 'Tout';

  // Panier
  static const cart = 'Mon panier';
  static const addToCart = 'Ajouter';
  static const outOfStock = 'Rupture';
  static const otherShopTitle = 'Nouveau panier ?';
  static const otherShopBody = 'Ton panier contient des produits d’un autre commerce. Une commande = un seul commerce. Vider le panier ?';
  static const emptyCart = 'Ton panier est vide.';
  static const noteForShop = 'Note pour le commerçant (facultatif)';
  static const delivery = 'Livraison';
  static const pickup = 'Je viens chercher';
  static const merchantDelivers = 'Le commerçant livre';
  static const deliveryAddress = 'Adresse de livraison';
  static const addAddress = 'Ajouter une adresse';
  static const payment = 'Paiement';
  static const subtotal = 'Produits';
  static const deliveryFee = 'Livraison';
  static const total = 'Total';
  static const order = 'Commander';
  static const orderQueued = 'Pas de réseau : ta commande partira dès le retour de la connexion.';

  // Adresse
  static const newAddress = 'Nouvelle adresse';
  static const placePin = 'Touche la carte pour placer ta maison';
  static const useMyPosition = 'Ma position';
  static const addressLabel = 'Nom (Maison, Bureau…)';
  static const landmark = 'Repère (ex. après la mosquée, portail bleu)';
  static const gatePhoto = 'Photo du portail (facultatif)';
  static const save = 'Enregistrer';

  // Suivi
  static const tracking = 'Suivi de commande';
  static const deliveryCode = 'Code à donner au livreur';
  static const deliveryCodePickup = 'Code à donner au commerçant';
  static const callCourier = 'Appeler le livreur';
  static const callShop = 'Appeler le commerce';
  static const cancel = 'Annuler la commande';
  static const cancelFree = 'L’annulation est gratuite tant que le commerçant n’a pas confirmé.';
  static const cancelPaid = 'Le commerçant a déjà confirmé : des frais d’annulation s’appliquent.';
  static const substitutionTitle = 'Un produit manque';
  static const substitutionBody = 'Le commerçant te propose :';
  static const accept = 'J’accepte';
  static const refuse = 'Je refuse (annuler)';
  static const noCourier = 'Aucun livreur disponible pour le moment. Tu peux venir chercher ta commande.';
  static const rate = 'Note ta commande';
  static const shopRating = 'Le commerce';
  static const courierRating = 'Le livreur';
  static const send = 'Envoyer';
  static const thanks = 'Merci pour ton avis !';
  static const report = 'Signaler un problème';
  static const myOrders = 'Mes commandes';
  static const noOrders = 'Tu n’as pas encore commandé.';
  static const payNow = 'Payer maintenant';
  static const waitingPayment = 'Valide le paiement sur ton téléphone';

  // Support
  static const problemSubject = 'De quoi s’agit-il ?';
  static const problemMessage = 'Explique-nous en quelques mots';
  static const reportSent = 'Réclamation envoyée. Le support te répond vite (7 h – 22 h).';

  static const retry = 'Réessayer';
  static const logout = 'Se déconnecter';
  static const errorGeneric = 'Une erreur est survenue. Réessaie.';
  static const networkError = 'Connexion impossible. Vérifie ton réseau.';
}

const statusLabels = {
  'AWAITING_PAYMENT': 'En attente du paiement',
  'PENDING': 'En attente du commerçant',
  'AWAITING_CLIENT': 'Remplacement proposé',
  'CONFIRMED': 'Confirmée, en préparation',
  'READY': 'Prête',
  'PICKED_UP': 'En route vers toi',
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
