import 'dart:async';

import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../l10n/fr.dart';
import '../state/auth_state.dart';
import '../state/cart_state.dart';
import '../state/outbox.dart';
import '../theme.dart';
import '../utils/format.dart';
import '../widgets/common.dart';
import 'cart_screen.dart';
import 'neighborhood_screen.dart';
import 'order_tracking_screen.dart';
import 'orders_screen.dart';
import 'shop_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String? _category;
  String _query = '';
  Timer? _debounce;
  late Future<List<Shop>> _future = _load();
  bool _fromCache = false;
  StreamSubscription? _outboxSub;

  @override
  void initState() {
    super.initState();
    final outbox = context.read<OrderOutbox>();
    outbox.flush();
    _outboxSub = outbox.sent.stream.listen(
      (order) {
        if (!mounted) return;
        showInfo(context, 'Ta commande ${order['reference']} est partie !');
        Navigator.push(context, MaterialPageRoute(builder: (_) => OrderTrackingScreen(orderId: order['id'])));
      },
      onError: (e) => mounted ? showError(context, e) : null,
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _outboxSub?.cancel();
    super.dispose();
  }

  Future<List<Shop>> _load() async {
    final api = context.read<ApiClient>();
    final auth = context.read<AuthState>();
    final rows = await api.get('/shops', cache: _query.isEmpty, query: {
      'neighborhoodId': _query.isEmpty ? auth.neighborhoodId : null,
      'category': _category,
      'q': _query.isEmpty ? null : _query,
    }) as List;
    _fromCache = api.servedFromCache;
    return rows.map((r) => Shop.fromJson(r)).toList();
  }

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    final cart = context.watch<CartState>();
    final outbox = context.watch<OrderOutbox>();
    return Scaffold(
      appBar: AppBar(
        title: InkWell(
          onTap: () async {
            await Navigator.push(context, MaterialPageRoute(builder: (_) => const NeighborhoodScreen(popOnSelect: true)));
            _reload();
          },
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.place, size: 22),
            const SizedBox(width: 6),
            Text(auth.neighborhoodName ?? T.yourNeighborhood),
            const Icon(Icons.expand_more),
          ]),
        ),
        actions: [
          IconButton(
            tooltip: T.myOrders,
            icon: const Icon(Icons.receipt_long),
            onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const OrdersScreen())),
          ),
          PopupMenuButton<String>(
            onSelected: (v) => v == 'logout' ? auth.logout() : null,
            itemBuilder: (_) => [const PopupMenuItem(value: 'logout', child: Text(T.logout))],
          ),
        ],
      ),
      body: Column(children: [
        if (outbox.pending.isNotEmpty)
          Container(
            width: double.infinity,
            color: const Color(0xFFFFF3CD),
            padding: const EdgeInsets.all(12),
            child: Text('${outbox.pending.length} commande(s) en attente de réseau…'),
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
          child: TextField(
            key: const Key('search'),
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: T.searchHint),
            onChanged: (v) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 400), () {
                _query = v.trim();
                _reload();
              });
            },
          ),
        ),
        SizedBox(
          height: 52,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            children: [
              _chip(null, T.all, Icons.apps),
              for (final e in categoryLabels.entries) _chip(e.key, e.value, categoryIcon(e.key)),
            ],
          ),
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: () async {
              _reload();
              await _future;
            },
            child: FutureBuilder<List<Shop>>(
              future: _future,
              builder: (context, snap) {
                if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
                if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                final shops = snap.data!;
                return ListView(
                  padding: const EdgeInsets.only(bottom: 96),
                  children: [
                    if (_fromCache) const OfflineBanner(),
                    if (shops.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text(T.noShops))),
                    for (final s in shops) _ShopCard(shop: s),
                  ],
                );
              },
            ),
          ),
        ),
      ]),
      floatingActionButton: cart.isEmpty
          ? null
          : FloatingActionButton.extended(
              key: const Key('cartFab'),
              backgroundColor: AppColors.secondary,
              foregroundColor: Colors.white,
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const CartScreen())),
              icon: const Icon(Icons.shopping_cart),
              label: Text('${cart.count} · ${fcfa(cart.subtotal)}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            ),
    );
  }

  Widget _chip(String? value, String label, IconData icon) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        child: ChoiceChip(
          avatar: Icon(icon, size: 18),
          label: Text(label),
          selected: _category == value,
          onSelected: (_) {
            _category = value;
            _reload();
          },
        ),
      );
}

class _ShopCard extends StatelessWidget {
  const _ShopCard({required this.shop});
  final Shop shop;

  @override
  Widget build(BuildContext context) {
    final api = context.read<ApiClient>();
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ShopScreen(shopId: shop.id))),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            NetImage(url: shop.photoUrl == null ? null : api.fileUrl(shop.photoUrl), icon: categoryIcon(shop.category)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(shop.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  [categoryLabels[shop.category] ?? shop.category, if (shop.distanceMeters != null) distance(shop.distanceMeters)].join(' · '),
                  style: const TextStyle(color: AppColors.muted),
                ),
                if (shop.ratingCount > 0)
                  Row(children: [
                    const Icon(Icons.star, size: 16, color: Color(0xFFF5A300)),
                    Text(' ${shop.ratingAvg.toStringAsFixed(1)} (${shop.ratingCount})'),
                  ]),
              ]),
            ),
            _OpenBadge(open: shop.isOpen),
          ]),
        ),
      ),
    );
  }
}

class _OpenBadge extends StatelessWidget {
  const _OpenBadge({required this.open});
  final bool open;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: open ? const Color(0xFFDFF5E8) : const Color(0xFFEDEDED),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(open ? T.open : T.closed,
            style: TextStyle(fontWeight: FontWeight.w700, color: open ? AppColors.secondary : AppColors.muted)),
      );
}
