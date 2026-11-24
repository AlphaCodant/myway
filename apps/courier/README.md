# Application livreur (Flutter)

Application Android pour les livreurs indépendants : passer en service, recevoir et accepter des courses, livrer contre le code du client, suivre ses gains et ses espèces.

## Lancer

```bash
flutter pub get
flutter run --dart-define=API_URL=http://10.0.2.2:3000
```

Comptes de démo : Koffi Yao 07 04 04 04 04, Ibrahim Ouattara 05 05 05 05 05 (le code SMS s'affiche en développement).
Un nouveau numéro crée un compte livreur **en attente de validation** : il dépose ses pièces depuis l'onglet Profil, puis l'équipe le valide depuis la console d'administration.

## Écrans

| Onglet / écran | Ce qu'on y fait |
|---|---|
| Bandeau en service / hors service | Toujours visible. Passer en service vérifie d'abord le GPS ; la position est ensuite envoyée toutes les 20 s. Bloqué si le compte n'est pas validé ou si le plafond d'espèces est atteint |
| Proposition de course | Passe devant tout le reste avec une **sonnerie répétée** et un compte à rebours de 30 s : gain, trajet, commerce, repère du client, espèces à encaisser. Accepter ou refuser (la course passe alors au livreur suivant) |
| Course | Carte (commerce, client, ma position), étapes Commerce → En route → Livrée, itinéraire Google Maps, appel masqué du commerçant ou du client, « j'ai récupéré le colis », photo du portail et note vocale du client, remise contre le **code à 4 chiffres**, client injoignable (appels notés puis retour au commerce), correction du point GPS après la livraison |
| Gains | Gagné aujourd'hui, nombre de courses, gains disponibles, retrait Mobile Money, espèces à reverser et plafond (50 000 F par défaut), historique |
| Profil | Nom, moyen de déplacement, contact d'urgence, numéro Mobile Money, pièces (identité, photo, et pour une moto permis et carte grise) |

## Son de l'alerte

`assets/sounds/nouvelle_course.wav` (même son que l'app commerçant pour l'instant). À choisir avec les livreurs lors des tests terrain.

## Tests

```bash
flutter analyze && flutter test
```

Les tests couvrent la sonnerie des propositions, le refus du passage en service sans GPS, et le parcours complet : connexion, en service, proposition, acceptation, récupération, remise avec le code.
