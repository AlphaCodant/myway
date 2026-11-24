import 'package:app_core/app_core.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:provider/provider.dart';

import '../state/orders_state.dart';
import 'order_detail_screen.dart';

class OrdersTab extends StatelessWidget {
  const OrdersTab({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<OrdersState>();
    if (state.loading) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: state.refresh,
      child: ListView(padding: const EdgeInsets.only(bottom: 24), children: [
        if (state.alert.ringing)
          Material(
            color: AppColors.primary,
            child: InkWell(
              onTap: state.silence,
              child: const Padding(
                padding: EdgeInsets.all(14),
                child: Row(children: [
                  Icon(Icons.notifications_active, color: Colors.white, size: 30),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text('Nouvelle commande ! Touche ici pour couper le son.',
                        style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                  ),
                ]),
              ),
            ),
          ),
        _Section(title: 'Nouvelles commandes', orders: state.incoming, highlight: true),
        _Section(title: 'Remplacement : en attente du client', orders: state.waitingClient),
        _Section(title: 'En cours', orders: state.inProgress),
        if (state.orders.isEmpty)
          const Padding(
            padding: EdgeInsets.all(40),
            child: Text('Aucune commande en cours.\nGarde l’application ouverte : une sonnerie t’avertit à chaque commande.',
                textAlign: TextAlign.center, style: TextStyle(color: AppColors.muted)),
          ),
      ]),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.orders, this.highlight = false});
  final String title;
  final List<Order> orders;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) return const SizedBox.shrink();
    final time = DateFormat('HH:mm', 'fr');
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Text('$title (${orders.length})', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
      ),
      for (final o in orders)
        Card(
          color: highlight ? const Color(0xFFFFF1E6) : null,
          shape: highlight
              ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(14), side: const BorderSide(color: AppColors.primary, width: 2))
              : null,
          child: ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            title: Text('${o.reference} · ${fcfa(o.subtotal)}', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            subtitle: Text(
              '${time.format(o.createdAt.toLocal())} · ${o.items.fold<int>(0, (s, i) => s + i.quantity)} article(s)\n'
              '${statusLabels[o.status]} · ${deliveryModeLabels[o.deliveryMode]}',
            ),
            isThreeLine: true,
            trailing: const Icon(Icons.chevron_right, size: 30),
            onTap: () {
              final state = context.read<OrdersState>()..silence();
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => ChangeNotifierProvider.value(value: state, child: OrderDetailScreen(orderId: o.id))),
              );
            },
          ),
        ),
    ]);
  }
}
