import { LandmarkType, ShopCategory } from '../common/enums';

/**
 * Coordonnées APPROXIMATIVES, à remplacer par les relevés des agents terrain.
 * Centre de Gagnoa ≈ 6,132 N / 5,951 O.
 */
export const GAGNOA = { slug: 'gagnoa', name: 'Gagnoa', lat: 6.1319, lng: -5.9506 };

export const NEIGHBORHOODS = [
  { name: 'Commerce', lat: 6.1325, lng: -5.9495 },
  { name: 'Dioulabougou', lat: 6.1385, lng: -5.9450 },
  { name: 'Garahio', lat: 6.1255, lng: -5.9575 },
  { name: 'Babré', lat: 6.1420, lng: -5.9580 },
];

/** Villes de l'extension (inactives au MVP). */
export const OTHER_CITIES = [
  { slug: 'daloa', name: 'Daloa', lat: 6.877, lng: -6.45 },
  { slug: 'bouake', name: 'Bouaké', lat: 7.69, lng: -5.03 },
];

export const TARIFFS = [
  { maxDistanceMeters: 2000, fee: 500 },
  { maxDistanceMeters: 3500, fee: 750 },
  { maxDistanceMeters: 5000, fee: 1000 },
];

/** Commission 8 à 12 % selon la catégorie (cahier des charges, section modèle économique). */
export const COMMISSIONS: Record<ShopCategory, number> = {
  [ShopCategory.ALIMENTATION]: 8,
  [ShopCategory.RESTAURANT]: 12,
  [ShopCategory.PHARMACIE]: 8,
  [ShopCategory.QUINCAILLERIE]: 10,
  [ShopCategory.MARCHE]: 8,
  [ShopCategory.SUPERMARCHE]: 10,
};

export const LANDMARKS = [
  { neighborhood: 'Commerce', name: 'Grand marché de Gagnoa', type: LandmarkType.MARCHE, lat: 6.1330, lng: -5.9490 },
  { neighborhood: 'Commerce', name: 'Carrefour de la Mairie', type: LandmarkType.CARREFOUR, lat: 6.1312, lng: -5.9510 },
  { neighborhood: 'Dioulabougou', name: 'Grande mosquée de Dioulabougou', type: LandmarkType.MOSQUEE, lat: 6.1390, lng: -5.9445 },
  { neighborhood: 'Garahio', name: 'École primaire de Garahio', type: LandmarkType.ECOLE, lat: 6.1250, lng: -5.9580 },
  { neighborhood: 'Babré', name: 'Église catholique de Babré', type: LandmarkType.EGLISE, lat: 6.1425, lng: -5.9575 },
];

/** Données de démonstration (SEED_DEMO=true) : fictives, pour tester les applications. */
export const DEMO_SHOPS = [
  {
    name: 'Boutique Chez Awa', category: ShopCategory.ALIMENTATION, neighborhood: 'Commerce', lat: 6.1322, lng: -5.9500,
    landmarkText: 'Face au grand marché, porte verte', ownerPhone: '0701010101', ownerName: 'Awa Koné', selfDelivery: true,
    products: [
      { name: 'Riz parfumé 5 kg', price: 4500, section: 'Épicerie' },
      { name: 'Huile Dinor 1 L', price: 1500, section: 'Épicerie' },
      { name: 'Sucre en morceaux 1 kg', price: 900, section: 'Épicerie' },
      { name: 'Lait Bonnet Rouge (boîte)', price: 650, section: 'Épicerie' },
      { name: 'Eau minérale 1,5 L', price: 400, section: 'Boissons' },
      { name: 'Savon de Marseille', price: 300, section: 'Hygiène' },
    ],
  },
  {
    name: 'Maquis Le Bon Garba', category: ShopCategory.RESTAURANT, neighborhood: 'Dioulabougou', lat: 6.1380, lng: -5.9455,
    landmarkText: 'Derrière la grande mosquée', ownerPhone: '0502020202', ownerName: 'Moussa Traoré', selfDelivery: false,
    products: [
      { name: 'Garba (attiéké + thon)', price: 1000, section: 'Plats' },
      { name: 'Alloco poisson', price: 1500, section: 'Plats' },
      { name: 'Poulet braisé + attiéké', price: 3500, section: 'Plats' },
      { name: 'Jus de bissap 50 cl', price: 500, section: 'Boissons' },
    ],
  },
  {
    name: 'Quincaillerie du Garahio', category: ShopCategory.QUINCAILLERIE, neighborhood: 'Garahio', lat: 6.1260, lng: -5.9570,
    landmarkText: 'À côté de l’école primaire', ownerPhone: '0103030303', ownerName: 'Jean-Baptiste Gnahoré', selfDelivery: true,
    products: [
      { name: 'Ampoule LED 9 W', price: 1000, section: 'Électricité' },
      { name: 'Cadenas 40 mm', price: 2500, section: 'Serrurerie' },
      { name: 'Ruban adhésif isolant', price: 300, section: 'Électricité' },
    ],
  },
];

export const DEMO_COURIERS = [
  { phone: '0704040404', name: 'Koffi Yao', lat: 6.1330, lng: -5.9480 },
  { phone: '0505050505', name: 'Ibrahim Ouattara', lat: 6.1400, lng: -5.9500 },
];
export const DEMO_CLIENT = { phone: '0706060606', name: 'Mariam Bamba' };
export const DEMO_AGENT = { phone: '0707070707', name: 'Agent terrain Gagnoa' };
