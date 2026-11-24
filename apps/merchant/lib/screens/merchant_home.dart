import 'package:app_core/app_core.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/orders_state.dart';
import '../state/session.dart';
import 'catalog_screen.dart';
import 'dashboard_screen.dart';
import 'orders_tab.dart';

class MerchantHome extends StatefulWidget {
  const MerchantHome({super.key});
  @override
  State<MerchantHome> createState() => _MerchantHomeState();
}

class _MerchantHomeState extends State<MerchantHome> {
  int _tab = 0;
  int _dashboardVersion = 0;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<OrdersState>();
    final shop = state.shop;
    if (shop == null) {
      return Scaffold(
        body: state.error != null
            ? ErrorView(error: state.error!, onRetry: state.loadShop)
            : const Center(child: CircularProgressIndicator()),
      );
    }
    final badge = state.incoming.length;
    return Scaffold(
      appBar: AppBar(
        title: Text(shop['name'] ?? ''),
        actions: [
          PopupMenuButton<String>(
            onSelected: (v) => v == 'logout' ? context.read<Session>().logout() : null,
            itemBuilder: (_) => [const PopupMenuItem(value: 'logout', child: Text(CoreText.logout))],
          ),
        ],
        bottom: PreferredSize(preferredSize: const Size.fromHeight(64), child: _OpenSwitch(state: state)),
      ),
      body: IndexedStack(index: _tab, children: [
        const OrdersTab(),
        CatalogScreen(shopId: state.shopId!, embedded: true),
        DashboardScreen(key: ValueKey(_dashboardVersion)),
      ]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() {
          _tab = i;
          if (i == 2) _dashboardVersion++; // chiffres à jour à chaque ouverture
        }),
        destinations: [
          NavigationDestination(
            icon: Badge(isLabelVisible: badge > 0, label: Text('$badge'), child: const Icon(Icons.receipt_long)),
            label: 'Commandes',
          ),
          const NavigationDestination(icon: Icon(Icons.inventory_2), label: 'Catalogue'),
          const NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Mes ventes'),
        ],
      ),
    );
  }
}

/// Gros bouton « ouvert / fermé », visible en permanence.
class _OpenSwitch extends StatelessWidget {
  const _OpenSwitch({required this.state});
  final OrdersState state;

  @override
  Widget build(BuildContext context) {
    final open = state.isOpen;
    return Container(
      color: open ? AppColors.secondary : const Color(0xFF424242),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(children: [
        Icon(open ? Icons.storefront : Icons.lock, color: Colors.white),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            !state.validated
                ? 'En attente de validation par MyWay'
                : open
                    ? 'OUVERT : tu reçois les commandes'
                    : 'FERMÉ : aucune commande',
            style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800),
          ),
        ),
        Transform.scale(
          scale: 1.3,
          child: Switch(
            key: const Key('openSwitch'),
            value: open,
            activeThumbColor: Colors.white,
            onChanged: !state.validated
                ? null
                : (v) async {
                    try {
                      await state.setOpen(v);
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
          ),
        ),
      ]),
    );
  }
}
