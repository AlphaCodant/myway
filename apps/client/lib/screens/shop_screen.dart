import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../l10n/fr.dart';
import '../state/cart_state.dart';
import '../theme.dart';
import '../utils/format.dart';
import '../widgets/common.dart';
import 'cart_screen.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key, required this.shopId});
  final String shopId;
  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  late Future<Shop> _future = _load();

  Future<Shop> _load() async => Shop.fromJson(await context.read<ApiClient>().get('/shops/${widget.shopId}', cache: true));

  Future<void> _add(Shop shop, Product p) async {
    final cart = context.read<CartState>();
    if (cart.add(shop, p)) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text(T.otherShopTitle),
        content: const Text(T.otherShopBody),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Non')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Oui, vider')),
        ],
      ),
    );
    if (ok == true) {
      cart.clear();
      cart.add(shop, p);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartState>();
    final api = context.read<ApiClient>();
    return FutureBuilder<Shop>(
      future: _future,
      builder: (context, snap) {
        final shop = snap.data;
        return Scaffold(
          appBar: AppBar(title: Text(shop?.name ?? '')),
          body: snap.hasError
              ? ErrorView(error: snap.error!, onRetry: () => setState(() => _future = _load()))
              : shop == null
                  ? const Center(child: CircularProgressIndicator())
                  : ListView(
                      padding: const EdgeInsets.only(bottom: 100),
                      children: [
                        if (api.servedFromCache) const OfflineBanner(),
                        Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(categoryLabels[shop.category] ?? '', style: const TextStyle(color: AppColors.muted)),
                            if (shop.landmarkText != null)
                              Row(children: [
                                const Icon(Icons.place, size: 18, color: AppColors.muted),
                                const SizedBox(width: 4),
                                Expanded(child: Text(shop.landmarkText!)),
                              ]),
                            if (!shop.isOpen)
                              const Padding(
                                padding: EdgeInsets.only(top: 8),
                                child: Text('Ce commerce est fermé pour le moment.',
                                    style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700)),
                              ),
                          ]),
                        ),
                        ..._sections(shop).entries.expand((section) => [
                              Padding(
                                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                                child: Text(section.key, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                              ),
                              for (final p in section.value) _productTile(shop, p, cart, api),
                            ]),
                      ],
                    ),
          bottomNavigationBar: cart.isEmpty || cart.shopId != shop?.id
              ? null
              : SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: FilledButton.icon(
                      key: const Key('seeCart'),
                      style: FilledButton.styleFrom(backgroundColor: AppColors.secondary),
                      onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen())),
                      icon: const Icon(Icons.shopping_cart),
                      label: Text('Voir le panier · ${fcfa(cart.subtotal)}'),
                    ),
                  ),
                ),
        );
      },
    );
  }

  Map<String, List<Product>> _sections(Shop shop) {
    final map = <String, List<Product>>{};
    for (final p in shop.products) {
      map.putIfAbsent(p.section ?? 'Produits', () => []).add(p);
    }
    return map;
  }

  Widget _productTile(Shop shop, Product p, CartState cart, ApiClient api) {
    final qty = cart.quantityOf(p.id);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Row(children: [
          NetImage(url: p.photoUrl == null ? null : api.fileUrl(p.photoUrl), icon: Icons.inventory_2, size: 56),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.name, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
              Text(fcfa(p.price), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.primary)),
            ]),
          ),
          if (!p.available)
            const Text(T.outOfStock, style: TextStyle(color: AppColors.muted, fontWeight: FontWeight.w700))
          else if (qty == 0)
            FilledButton(
              key: Key('add-${p.id}'),
              style: FilledButton.styleFrom(minimumSize: const Size(96, 44)),
              onPressed: shop.isOpen ? () => _add(shop, p) : null,
              child: const Text(T.addToCart),
            )
          else
            Row(children: [
              IconButton.filledTonal(onPressed: () => cart.decrement(p.id), icon: const Icon(Icons.remove)),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: Text('$qty', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800))),
              IconButton.filled(onPressed: () => _add(shop, p), icon: const Icon(Icons.add)),
            ]),
        ]),
      ),
    );
  }
}
