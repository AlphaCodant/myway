# Application client (Flutter)

Application Android (puis iOS) pour commander auprès des commerces du quartier.

## Lancer

```bash
flutter pub get
# Émulateur Android (l'hôte est joignable via 10.0.2.2)
flutter run --dart-define=API_URL=http://10.0.2.2:3000
# Téléphone réel sur le même Wi-Fi que le poste de développement
flutter run --dart-define=API_URL=http://<ip-du-poste>:3000
# APK de test
flutter build apk --release --split-per-abi --dart-define=API_URL=https://api.exemple.ci
```

`--split-per-abi` garde chaque APK sous l'objectif de 25 Mo du cahier des charges.

## Écrans

Connexion (numéro + code SMS) · choix du quartier · accueil (recherche, catégories, commerces ouverts) · commerce (catalogue par rayon, rupture) · panier (mode de livraison, adresse, paiement, total) · nouvelle adresse (point sur la carte, ma position, repère, photo du portail) · suivi (étapes en temps réel, code de remise, livreur, appel masqué, remplacement, retrait au commerce, annulation, notation) · mes commandes · signaler un problème.

## Choix pour les téléphones d'entrée de gamme

- Gros boutons, textes 16 px minimum, couleurs contrastées (lisible en plein soleil).
- Lectures mises en cache (`shared_preferences`) : catalogue et historique restent visibles sans réseau.
- Panier conservé sur le téléphone ; une commande passée sans réseau part automatiquement au retour de la connexion (identifiant de requête : pas de doublon).
- Temps réel par Socket.IO, avec rafraîchissement toutes les 30 s en secours.
- Photos réduites avant envoi (800 px, qualité 60).
- Textes regroupés dans `lib/l10n/fr.dart` pour ajouter d'autres langues.

## Organisation

```
lib/
  api/        client HTTP (cache hors ligne) et modèles
  state/      session, panier, file d'envoi hors ligne, temps réel
  screens/    écrans
  widgets/    composants communs
  l10n/       textes
```

## À faire (étapes suivantes)

Note vocale de 30 s pour l'adresse, notifications push (FCM), icône et nom définitifs, tests sur Tecno / Itel / Infinix.
