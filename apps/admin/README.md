# Console d'administration (Next.js)

Console web de l'équipe MyWay : suivre les commandes en direct, valider les comptes, gérer l'argent et régler les paramètres.

## Lancer

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev                    # http://localhost:3001
```

Connexion par SMS avec un compte administrateur (démo : 07 00 00 00 00 ; en développement le code s'affiche à l'écran).
Seuls les comptes au rôle « Administrateur » peuvent entrer ; on en ajoute depuis Comptes → Équipe.

## Pages

| Page | Ce qu'on y fait |
|---|---|
| Tableau de bord | Commandes, ventes livrées, revenus MyWay, délai moyen, taux d'annulation sur 1, 7 ou 30 jours ; commandes par jour ; chiffres par quartier ; raccourcis vers les comptes à valider et les réclamations |
| Carte en direct | Livreurs en service (libres / en course), commerces et clients des commandes en cours ; liste « à traiter » des commandes en retard ou sans livreur. Mise à jour toutes les 10 s et à chaque événement |
| Commandes | Filtres par statut, retards, référence ; panneau de détail : articles, historique, code de remise, **affecter ou réaffecter un livreur**, **annuler** avec motif et frais |
| Comptes | Commerces et livreurs **à valider** avec leurs pièces, suspension avec motif envoyé par SMS, commission propre à un commerce, équipe (admins, agents terrain), recherche d'un compte |
| Finances | **Espèces des livreurs** et remises, **reversements Mobile Money** à payer (avec référence de transaction) ou rejeter, soldes des commerces, **export CSV** pour Excel |
| Réclamations | Messages du client, lien vers la commande, réponse et **remboursement** |
| Paramètres | Règles métier (plafond d'espèces, part livreur, délais…), commissions par catégorie, frais de livraison par distance, villes et quartiers |

Des notifications apparaissent en bas à droite quand une commande n'a pas de livreur, prend du retard, ou qu'une réclamation arrive.

## Mise en production

`npm run build` produit un site statique dans `out/` (aucun serveur Node nécessaire) : à déposer sur un hébergement web ou un CDN, avec `NEXT_PUBLIC_API_URL` fixé au moment du build.

## Tests

```bash
npm test          # Vitest : client API, formats, connexion admin, graphique
npm run build     # vérifie aussi les types
```
