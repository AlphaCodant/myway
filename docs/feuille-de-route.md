# Feuille de route du développement

Découpage du MVP en étapes livrables. Chaque étape se termine par une version testable de bout en bout.

## Étape 1 — Socle : API + application client ✅

- API NestJS complète pour le MVP (toutes les règles métier du cahier des charges, section 3) :
  connexion par SMS (OTP), villes/quartiers/repères, catalogue, adresses informelles, commandes,
  remplacements, affectation des livreurs, code de remise, paiements (espèces + agrégateur Mobile Money),
  appels masqués, notation, réclamations, reversements, console admin, temps réel.
- Application client Flutter : connexion, choix du quartier, recherche et catégories, catalogue,
  panier (un commerce par commande), adresse avec point GPS + repère + photo du portail,
  paiement, suivi en temps réel avec code de remise, remplacements, retrait au commerce,
  annulation, appel masqué, notation, réclamation, historique.
- Mode hors ligne partiel : catalogue et historique en cache, panier conservé, commande mise en file
  et envoyée au retour du réseau (sans doublon).

## Étape 2 — Application commerçant (Flutter)

Réception des commandes avec alerte sonore forte, accepter / refuser / proposer un remplacement,
« prête », « je livre moi-même », bouton ouvert/fermé, rupture en un clic, catalogue photo + prix,
tableau de bord (ventes du jour et de la semaine, commissions, solde), demande de reversement.
Mode « agent terrain » pour l'inscription assistée.
*Toutes les routes API existent déjà (`/merchant/*`, `/agent/*`).*

## Étape 3 — Application livreur (Flutter)

Inscription avec pièces (identité, permis, carte grise), bouton en service / hors service,
position envoyée toutes les 15 à 30 s, proposition de course avec compte à rebours de 30 s,
navigation vers le commerce puis le client (repère, photo du portail), appel masqué,
saisie du code de remise, client injoignable (3 appels + 10 min), portefeuille et plafond d'espèces,
correction du point GPS. *Routes API existantes : `/courier/*`, `/orders/:id/*`.*

## Étape 4 — Console d'administration (Next.js)

Validation des commerçants et livreurs, carte en direct, commandes en retard et réaffectation,
zones, tarifs et commissions, réclamations et remboursements, remises d'espèces, reversements,
export comptable CSV, tableaux de bord. *Routes API existantes : `/admin/*`.*

## Étape 5 — Branchements réels et mise en production

| Sujet | À faire |
|---|---|
| SMS / OTP | Choisir un fournisseur local et l'implémenter dans `SmsService` |
| Paiement | Ouvrir un compte marchand chez l'agrégateur (CinetPay, PayDunya ou Hub2), valider `CinetPayProvider` en recette, automatiser les reversements |
| Appels masqués | Numéro virtuel / SVI chez un opérateur (bouchon actuel : `CallsController`) |
| Notes vocales | Enregistrement 30 s dans l'app client (le stockage `/uploads` accepte déjà l'audio) |
| Notifications push | Firebase Cloud Messaging en complément du temps réel et des SMS |
| Stockage des fichiers | Stockage objet (S3 / OVH) à la place du disque local |
| Hébergement | Recette + production, sauvegardes quotidiennes 30 j, supervision (Sentry) |
| Conformité | Dossier ARTCI déposé et CGU validées **avant** toute donnée réelle |
| Tests terrain | 3 téléphones d'entrée de gamme (Tecno, Itel, Infinix), taille d'APK < 25 Mo |

## Hors MVP (V2 / V3)

Commande multi-commerces, WhatsApp / USSD, fidélité et parrainage, promotions, cahier de crédit,
bonus livreurs, notifications de masse, multi-villes avec gestionnaires locaux, carte bancaire.
Le modèle de données est déjà multi-villes.
