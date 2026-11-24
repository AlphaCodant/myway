# Application commerçant (Flutter)

Application Android pour les commerçants (et les agents terrain) : recevoir les commandes, gérer le catalogue, suivre ses ventes.

## Lancer

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

Comptes de démo : commerçante « Boutique Chez Awa » 07 01 01 01 01, agent terrain 07 07 07 07 07 (le code SMS s'affiche en développement).

## Écrans

| Onglet / écran | Ce qu'on y fait |
|---|---|
| Bandeau ouvert / fermé | Toujours visible ; un commerce fermé ne reçoit pas de commande |
| Commandes | Nouvelles commandes en tête, **sonnerie forte répétée** tant qu'elles ne sont pas ouvertes (temps réel + vérification toutes les 20 s) ; rappel si une commande attend depuis 5 min |
| Détail commande | Accepter, refuser, « un produit manque » (remplacement ou retrait à faire accepter par le client), « commande prête », « je livre moi-même » si aucun livreur, « je pars livrer », remise contre le code à 4 chiffres, appel masqué |
| Catalogue | Rupture en un clic (interrupteur), ajout / modification avec photo (réduite à 600 px), prix, rayon |
| Mes ventes | Ventes du jour et de la semaine, commissions, solde MyWay, demande de reversement Mobile Money, mouvements |
| Agent terrain | Liste des commerces inscrits, inscription assistée (identité, téléphone, Mobile Money, catégorie, quartier, position GPS devant la boutique, photos), remplissage de leur catalogue |

Un compte qui n'est ni commerçant ni agent voit un message l'invitant à contacter un agent terrain.

## Son de l'alerte

`assets/sounds/nouvelle_commande.wav` (trois doubles bips aigus, générés). À remplacer par un son choisi avec les commerçants lors des tests terrain.
