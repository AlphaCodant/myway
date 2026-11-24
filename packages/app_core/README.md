# app_core

Code partagé par les applications Flutter MyWay (client, commerçant, et bientôt livreur) :

- `ApiClient` : appels à l'API, messages d'erreur en français, cache des lectures pour le mode hors ligne, envoi de fichiers ;
- modèles (`Shop`, `Product`, `Order`, `Address`…) ;
- `Realtime` : événements Socket.IO (`order.updated`, `order.new`…) ;
- `PhoneLoginScreen` : connexion par numéro + code SMS ;
- thème contrasté, composants communs, libellés (statuts, catégories, paiements), format FCFA.
