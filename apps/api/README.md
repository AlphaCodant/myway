# API — livraison de quartier

API unique (NestJS) utilisée par les applications client, commerçant, livreur et par la console d'administration. Seule l'API parle à la base de données et aux services externes (SMS, paiement, téléphonie) : on peut changer de fournisseur sans toucher aux applications.

- Documentation interactive (OpenAPI) : `http://localhost:3000/api/docs`
- Temps réel : Socket.IO sur le namespace `/realtime`, connexion avec `{ auth: { token } }`

## Modules

| Module | Routes | Rôle |
|---|---|---|
| auth | `/auth/otp/request`, `/auth/otp/verify`, `/auth/me` | Connexion par numéro + code SMS à 6 chiffres (5 min, 5 essais, 5 demandes/heure) |
| geo | `/cities`, `/cities/:slug/neighborhoods`, `/landmarks` | Villes, quartiers, base de repères partagés |
| addresses | `/me/addresses` | Adresse informelle : point GPS, quartier, repère texte, note vocale, photo du portail, Plus Code |
| shops | `/shops`, `/merchant/shops/*`, `/agent/merchants` | Catalogue public (tri par distance), gestion boutique/produits, inscription assistée par agent terrain |
| orders | `/orders/*`, `/merchant/orders/*`, `/courier/offers/*` | Cycle de vie des commandes, remplacements, remise par code, annulations, notation |
| dispatch | (interne) | Proposition au livreur disponible le plus proche, puis au suivant après 30 s |
| payments | `/payments/webhook/:provider` | Agrégateur Mobile Money (Orange, MTN, Moov, Wave), notifications signées |
| couriers | `/courier/profile`, `/courier/online`, `/courier/position`, `/courier/wallet`, `/courier/withdraw` | Disponibilité, position, portefeuille, plafond d'espèces |
| merchant | `/merchant/dashboard`, `/merchant/payouts` | Ventes, commissions, solde, reversements |
| tickets | `/tickets` | Réclamations et échanges avec le support |
| admin | `/admin/*` | Comptes, supervision, carte en direct, zones/tarifs/commissions, litiges, finances, export CSV, tableaux de bord |
| uploads | `/uploads` | Photos, notes vocales, pièces (2 Mo max) |

## Règles métier (modifiables par l'admin : `PUT /admin/settings/:key`)

| Paramètre | Défaut |
|---|---|
| Frais de livraison (Gagnoa) | 500 F ≤ 2 km, 750 F ≤ 3,5 km, 1 000 F ≤ 5 km ; au-delà, hors zone |
| Part du livreur | 80 % des frais de livraison |
| Commission | 8 à 12 % selon la catégorie, 0 % les 2 premiers mois |
| Délai pour accepter une course | 30 s, puis livreur suivant |
| Rappel au commerçant | après 5 min sans réponse (SMS + temps réel) |
| Plafond d'espèces du livreur | 50 000 F non reversés → plus de nouvelles courses |
| Annulation | gratuite avant confirmation, 500 F après |
| Client injoignable | 3 appels + 10 min d'attente avant retour du colis (frais = livraison) |

### Statuts d'une commande

`AWAITING_PAYMENT` (Mobile Money) → `PENDING` → (`AWAITING_CLIENT` si remplacement) → `CONFIRMED` → `READY` → `PICKED_UP` → `DELIVERED`
Sorties : `CANCELLED`, `RETURNED`. Modes : `PLATFORM` (livreur), `MERCHANT` (« je livre moi-même »), `PICKUP` (click & collect).

### Argent

Le grand livre (`ledger_entries`) enregistre ce que la plateforme doit à chaque commerçant et livreur. Les espèces encaissées par un livreur sont suivies à part (`cashHeld`) jusqu'à leur remise, enregistrée par l'admin. La plateforme ne détient pas de porte-monnaie : les fonds Mobile Money transitent par l'agrégateur agréé.

## Bouchons à remplacer avant la production

- `SmsService` : fournisseur `console` (écrit dans les logs et la table `sms_outbox`).
- `CinetPayProvider` : squelette à valider avec la documentation et un compte marchand.
- `CallsController` : numéro relais fictif ; brancher un service de numéros virtuels.
- `/uploads` : disque local ; passer sur un stockage objet.

## Variables d'environnement

Voir [`.env.example`](.env.example). En production : `NODE_ENV=production`, `OTP_DEV_MODE=false`, `DB_SYNC=false`, secrets forts pour `JWT_SECRET` et `PAYMENT_WEBHOOK_SECRET`.

## Scripts

| Commande | Effet |
|---|---|
| `npm run start:dev` | API avec rechargement |
| `npm run migration:run` | Applique les migrations |
| `npm run migration:generate` | Génère une migration après modification des entités |
| `npm run seed` | Référentiels Gagnoa (+ démo si `SEED_DEMO` ≠ `false`) |
| `npm test` / `npm run test:e2e` | Tests unitaires / bout en bout |
